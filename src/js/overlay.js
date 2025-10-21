// Overlay Manager: creates a global, non-interactable overlay with movable widgets in edit mode
(function () {
    const STORAGE_KEY = 'overlay_positions_v1';
    const WIDGET_VISIBILITY_KEY = 'overlay_widget_visibility_v1';
    const DEFAULT_POSITIONS = {
        nowPlaying: { left: 20, top: 20 },
        upNext: { left: 20, top: 120 },
        toasts: { right: 20, bottom: 20 }
    };
    // How close to the end of the current song (ms) before showing the single "Up Next" item
    const UPNEXT_THRESHOLD_MS = 10000; // 10 seconds
    // Pause between marquee scroll cycles (milliseconds)
    const MARQUEE_PAUSE_MS = 4000; // 4 seconds (configurable)

    class OverlayManager {
        constructor() {
            this.positions = this.loadPositions();
            this.widgetVisibility = this.loadWidgetVisibility();
            this.editMode = false;
            this.dragging = null; // {el, startX, startY, origLeft, origTop}
            this.queue = [];
            this.playbackState = null; // latest playback state (progress/duration/is_playing)

            // Detect if this code runs inside a dedicated overlay BrowserWindow
            this.isOverlayWindow = !!(window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isOverlayWindow);

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }

        init() {
            try {
                if (this.isOverlayWindow) {
                    // Running inside the dedicated overlay BrowserWindow: create widgets here
                    this.createOverlayElements();
                    this.applyPositions();
                    this.attachUIHooks();
                    // Improve readability for overlay windows
                    this.container.classList.add('overlay-opaque');
                } else {
                    // Running inside the main app window: don't create duplicate overlay UI elements.
                    // Provide a small shim so UI code can toggle overlay edit mode by forwarding a command.
                    window.overlayManager = {
                        toggleEditMode: () => {
                            try {
                                if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.forwardOverlayUpdate === 'function') {
                                    window.electronAPI.forwardOverlayUpdate({ type: 'COMMAND', data: { action: 'toggleEditMode' } });
                                }
                            } catch (e) {
                                console.warn('[OverlayManager shim] failed to forward toggleEditMode', e);
                            }
                        }
                    };
                }
                // Listen for state changes ONLY in the overlay window
                if (this.isOverlayWindow) {
                    window.addEventListener('appStateChange', this.handleAppState.bind(this));
                    if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.onOverlayUpdate === 'function') {
                        try {
                            window.electronAPI.onOverlayUpdate((msg) => {
                                if (!msg || !msg.type) return;
                                // The event from main process is the detail itself
                                this.handleAppState({ detail: msg }); 
                            });
                        } catch (e) {
                            console.warn('[OverlayManager] failed to register onOverlayUpdate', e);
                        }
                    }
                }
            } catch (e) {
                console.error('[OverlayManager] init failed', e);
            }
        }

        createOverlayElements() {
            // Main overlay container
            this.container = document.createElement('div');
            this.container.id = 'global-overlay';
            this.container.className = 'global-overlay';
            // By default overlay does not accept pointer events so it won't block input
            this.container.style.pointerEvents = 'none';
            document.body.appendChild(this.container);

            // Now Playing widget
            this.nowPlaying = document.createElement('div');
            this.nowPlaying.className = 'overlay-widget now-playing-widget';
            this.nowPlaying.dataset.widgetId = 'nowPlaying';
            this.nowPlaying.innerHTML = `
                <div class="overlay-album"><img src="assets/icon.png" alt="album"></div>
                <div class="overlay-meta">
                    <div class="title-container">
                        <div class="marquee">
                            <span class="marquee-content overlay-track">Not Playing</span>
                        </div>
                    </div>
                    <div class="overlay-artist" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Connect to Spotify</div>
                    <div class="overlay-progress">
                        <div class="overlay-time current">0:00</div>
                        <div class="overlay-progress-bar"><div class="overlay-progress-fill"></div></div>
                        <div class="overlay-time total">0:00</div>
                    </div>
                </div>
            `;
            this.container.appendChild(this.nowPlaying);

            // Up Next widget
            this.upNext = document.createElement('div');
            this.upNext.className = 'overlay-widget up-next-widget';
            this.upNext.dataset.widgetId = 'upNext';
            this.upNext.innerHTML =
                '<span class="up-next-label">Up Next:</span> <span class="up-next-track">No songs in queue</span>';
            this.container.appendChild(this.upNext);

            // Toasts overlay container (mirrors in-page toasts)
            this.toastArea = document.createElement('div');
            this.toastArea.className = 'overlay-toast-area';
            this.toastArea.dataset.widgetId = 'toasts';
            this.container.appendChild(this.toastArea);

            // Make widgets absolute positioned
            [this.nowPlaying, this.upNext, this.toastArea].forEach(el => {
                el.style.position = 'absolute';
                // When not editing, widgets shouldn't capture pointer events
                el.style.pointerEvents = 'none';
            });

            // Create visibility toggles inside each widget, only visible in edit mode
            [this.nowPlaying, this.upNext, this.toastArea].forEach(widget => {
                const id = widget.dataset.widgetId;
                const toggle = document.createElement('div');
                toggle.className = 'overlay-widget-toggle';
                toggle.innerHTML = `<i class="fas fa-eye"></i>`;
                toggle.title = 'Toggle visibility';
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleWidgetVisibility(id);
                });
                // Set initial icon state
                const isVisible = this.widgetVisibility[id] ?? true;
                if (!isVisible) {
                    toggle.querySelector('i').classList.replace('fa-eye', 'fa-eye-slash');
                }
                widget.appendChild(toggle);
            });

            // Apply initial visibility
            Object.entries(this.widgetVisibility).forEach(([id, visible]) => {
                const el = this.container.querySelector(`[data-widget-id="${id}"]`);
                if (el) el.style.display = visible ? '' : 'none';
            });

            // If running inside overlay window, increase contrast / background opacity for readability
            if (this.isOverlayWindow) {
                this.container.classList.add('overlay-opaque');
            }

            // Attach dragging handlers (will check editMode inside handlers)
            this.container.addEventListener('pointerdown', this.onPointerDown.bind(this));
            document.addEventListener('pointermove', this.onPointerMove.bind(this));
            document.addEventListener('pointerup', this.onPointerUp.bind(this));
            // Recalculate marquee on window resize so scrolling starts/stops appropriately
            window.addEventListener('resize', () => {
                try { this._updateMarqueeState(); } catch (_) {}
            });
            // Add keydown listener for exiting edit mode with Escape key
            document.addEventListener('keydown', (e) => {
                if (this.editMode && e.key === 'Escape') {
                    this.toggleEditMode(false);
                }
            });
        }

        applyPositions() {
            const p = this.positions || {};
            const now = p.nowPlaying || DEFAULT_POSITIONS.nowPlaying;
            const next = p.upNext || DEFAULT_POSITIONS.upNext;
            const toasts = p.toasts || DEFAULT_POSITIONS.toasts;

            this.setElPos(this.nowPlaying, now.left, now.top);
            this.setElPos(this.upNext, next.left, next.top);

            // Toasts anchored to bottom-right by default
            if (toasts.left !== undefined && toasts.top !== undefined) {
                this.setElPos(this.toastArea, toasts.left, toasts.top);
            } else {
                // Use right/bottom placement via CSS variables
                this.toastArea.style.right = (toasts.right || DEFAULT_POSITIONS.toasts.right) + 'px';
                this.toastArea.style.bottom = (toasts.bottom || DEFAULT_POSITIONS.toasts.bottom) + 'px';
            }
        }

        setElPos(el, left, top) {
            if (!el) return;
            el.style.left = (left || 0) + 'px';
            el.style.top = (top || 0) + 'px';
            // clear right/bottom to avoid conflicts
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        attachUIHooks() {
            // Toggle edit mode button
            const btn = document.getElementById('edit-overlay-btn');
            if (btn) {
                btn.addEventListener('click', () => this.toggleEditMode());
            }

            // Also support programmatic toggles from window.overlayManager
            window.overlayManager = this;
        }

        toggleEditMode(enable) {
            this.editMode = typeof enable === 'boolean' ? enable : !this.editMode;
            const editControls = document.getElementById('overlay-edit-controls');
            const finishBtn = document.getElementById('finish-editing-btn');

            if (this.editMode) {
                this.container.classList.add('overlay-edit-mode');
                this.container.style.pointerEvents = 'auto';
                [this.nowPlaying, this.upNext, this.toastArea].forEach(el => el.style.pointerEvents = 'auto');
                // If running as a native overlay window, ask main process to make the window focusable/clickable

                // Show the "Finish Editing" button
                // Also ensure the toast area is visible for positioning, even if empty.
                if (this.toastArea) {
                    this.toastArea.style.display = 'flex'; // Use flex as it's a flex container
                    // To make it more obvious, we can add a placeholder toast
                    this.showToast('Toasts appear here', 'info', 999999, true);
                }

                if (editControls) editControls.style.display = 'block';
                if (finishBtn && !finishBtn.dataset.listenerAttached) {
                    finishBtn.addEventListener('click', () => this.toggleEditMode(false));
                    finishBtn.dataset.listenerAttached = 'true';
                }

                try {
                    if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
                        // setIgnoreMouseEvents(false) so user can interact with overlay while editing
                        window.electronAPI.setIgnoreMouseEvents(false);
                    }
                } catch (e) {
                    console.warn('[OverlayManager] failed to request native mouse behavior change', e);
                }
            } else {
                this.container.classList.remove('overlay-edit-mode');
                this.container.style.pointerEvents = 'none';
                [this.nowPlaying, this.upNext, this.toastArea].forEach(el => el.style.pointerEvents = 'none');

                // Hide the "Finish Editing" button
                if (this.toastArea) {
                    // Hide placeholder toasts when exiting edit mode
                    const placeholderToasts = this.toastArea.querySelectorAll('.placeholder-toast');
                    placeholderToasts.forEach(t => t.remove());
                    // If there are no real toasts, it will become invisible again.
                    if (this.toastArea.childElementCount === 0) this.toastArea.style.display = '';
                }
                if (editControls) editControls.style.display = 'none';

                this.savePositions();
                try {
                    if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
                        // When not editing, make window click-through
                        window.electronAPI.setIgnoreMouseEvents(true);
                    }
                } catch (e) {
                    console.warn('[OverlayManager] failed to request native mouse behavior change', e);
                }

                // Apply final visibility state when exiting edit mode
                this.applyVisibility();
            }
            // Re-render up-next area on edit mode change so users see full queue while editing
            try { this.renderUpNext(); } catch (e) { /* ignore */ }
            // Apply visibility classes for edit mode
            Object.entries(this.widgetVisibility).forEach(([id, visible]) => {
                const el = this.container.querySelector(`[data-widget-id="${id}"]`);
                if (!el) return;
                el.classList.toggle('widget-hidden-in-edit', !visible);
            });
        }

        onPointerDown(e) {
            if (!this.editMode) return;
            // Only start drag when pointer is over a widget
            const target = e.target.closest('.overlay-widget') || e.target.closest('[data-widget-id]');
            if (!target || !this.container.contains(target)) return;

            // Do not start dragging if the click is on the visibility toggle itself
            if (e.target.closest('.overlay-widget-toggle')) {
                return;
            }

            e.preventDefault();
            const rect = target.getBoundingClientRect();
            this.dragging = {
                el: target,
                startX: e.clientX,
                startY: e.clientY,
                origLeft: rect.left + window.scrollX,
                origTop: rect.top + window.scrollY
            };
            target.classList.add('dragging');
            target.style.cursor = 'grabbing';
        }

        onPointerMove(e) {
            if (!this.dragging) return;
            e.preventDefault();
            const dx = e.clientX - this.dragging.startX;
            const dy = e.clientY - this.dragging.startY;
            const newLeft = Math.max(0, this.dragging.origLeft + dx);
            const newTop = Math.max(0, this.dragging.origTop + dy);
            this.dragging.el.style.left = newLeft + 'px';
            this.dragging.el.style.top = newTop + 'px';
            this.dragging.el.style.right = 'auto';
            this.dragging.el.style.bottom = 'auto';
        }

        onPointerUp() {
            if (!this.dragging) return;
            this.dragging.el.classList.remove('dragging');
            this.dragging.el.style.cursor = 'grab';
            // Persist position for this widget
            const id = this.dragging.el.dataset.widgetId;
            if (id) {
                const rect = this.dragging.el.getBoundingClientRect();
                this.positions = this.positions || {};
                this.positions[id] = { left: Math.round(rect.left), top: Math.round(rect.top) };
                this.savePositions();
            }
            this.dragging = null;
        }

        toggleWidgetVisibility(widgetId) {
            if (!this.editMode) return;
            const isVisible = !(this.widgetVisibility[widgetId] ?? true);
            this.widgetVisibility[widgetId] = isVisible;

            const el = this.container.querySelector(`[data-widget-id="${widgetId}"]`);
            if (el) {
                el.classList.toggle('widget-hidden-in-edit', !isVisible);
                // Also update the icon inside the toggle button
                const icon = el.querySelector('.overlay-widget-toggle i');
                if (icon) icon.classList.toggle('fa-eye-slash', !isVisible);
                if (icon) icon.classList.toggle('fa-eye', isVisible);
                // Visibility outside of edit mode is handled by renderUpNext and a new applyVisibility method
                this.applyVisibility();
            }
            this.saveWidgetVisibility();
            this.renderUpNext(); // Re-render to apply new visibility rules
        }

        saveWidgetVisibility() {
            try {
                localStorage.setItem(WIDGET_VISIBILITY_KEY, JSON.stringify(this.widgetVisibility));
            } catch (e) {
                console.warn('[OverlayManager] Failed to save widget visibility', e);
            }
        }

        savePositions() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.positions || {}));
            } catch (e) {
                console.warn('[OverlayManager] failed to save positions', e);
            }
        }

        loadPositions() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return { ...DEFAULT_POSITIONS };
                return JSON.parse(raw);
            } catch (e) {
                console.warn('[OverlayManager] failed to load positions', e);
                return { ...DEFAULT_POSITIONS };
            }
        }

        handleAppState(e) {
            const { type, data } = e.detail || {};
            if (type === 'currentTrack') {
                this.updateNowPlaying(data);
            } else if (type === 'queue') {
                this.updateQueue(data);
            } else if (type === 'playbackState') {
                // store playback state and update visibility of up-next widget
                this.playbackState = data;
                this.updatePlaybackState(data);
            }
            // Support commands forwarded from main/renderer
            if (type === 'COMMAND' && data && data.action) {
                if (data.action === 'toggleEditMode') {
                    this.toggleEditMode();
                } else if (data.action === 'enterEditMode') {
                    this.toggleEditMode(true);
                } else if (data.action === 'exitEditMode') {
                    this.toggleEditMode(false);
                } else if (data.action === 'setOpacity') {
                    // Expect data.opacity as integer percentage (0-100)
                    const pct = Number.isFinite(data.opacity) ? parseInt(data.opacity, 10) : null;
                    if (pct !== null && !Number.isNaN(pct)) {
                        try { this.setOverlayOpacity(pct / 100); } catch (e) {}
                    }
                }
            } else if (type === 'TOAST' && data) {
                if (this.isOverlayWindow) {
                    this.showToast(data.message, data.type);
                }
            }
        }

        applyVisibility() {
            if (this.editMode) return; // In edit mode, CSS classes handle visibility
            Object.entries(this.widgetVisibility).forEach(([id, visible]) => {
                const el = this.container.querySelector(`[data-widget-id="${id}"]`);
                if (el) el.style.display = visible ? '' : 'none';
            });
        }

        updateNowPlaying(track) {
            try {
                // Ensure overlay elements exist (this manager may run in non-overlay windows)
                if (!this.nowPlaying || !this.nowPlaying.querySelector) return;
                const img = this.nowPlaying.querySelector('img');
                const title = this.nowPlaying.querySelector('.overlay-track');
                const artist = this.nowPlaying.querySelector('.overlay-artist');

                if (!track) {
                    if (title) title.textContent = 'Not Playing';
                    if (artist) artist.textContent = 'Connect to Spotify';
                    if (img) img.src = 'assets/default-album.png';
                    return;
                }

                if (title) {
                    const normalized = this.normalizeText(track.name) || 'Unknown Track';
                    // If title is inside marquee-content span, update that instead
                    const marqueeContent = this.nowPlaying.querySelector('.marquee-content');
                    if (marqueeContent) {
                        marqueeContent.textContent = normalized;
                        // ensure any scrolling state updates
                        this._updateMarqueeState();
                    } else {
                        title.textContent = normalized;
                    }
                }
                if (artist) {
                    artist.textContent = track.artists
                        ? track.artists.map(a => this.normalizeText(a.name)).join(', ')
                        : '';
                }
                if (img) img.src = track.album?.images?.[0]?.url || img.src;
            } catch (e) {
                console.error('[OverlayManager] updateNowPlaying', e);
            }
            // re-evaluate up-next visibility when track metadata changes
            try {
                // If track contains duration_ms, initialize duration for progress UI
                if (track && track.duration_ms) this._duration = track.duration_ms;
                this.updateProgressUI();
            } catch (_) {}
            try { this.renderUpNext(); } catch (_) {}
        }

        // Update marquee scrolling based on overflow width.
        _updateMarqueeState() {
            if (!this.nowPlaying) return;
            const marquee = this.nowPlaying.querySelector('.marquee');
            const content = this.nowPlaying.querySelector('.marquee-content');
            if (!marquee || !content) return;

            // Reset any previous animation settings
            // Clear any previously scheduled start
            try { if (marquee.__marqueeStartTimeout) { clearTimeout(marquee.__marqueeStartTimeout); marquee.__marqueeStartTimeout = null; } } catch (_) {}

            // Reset any previous animation settings immediately to stop any in-progress animation
            marquee.classList.remove('scrolling');
            marquee.style.setProperty('--scroll-distance', '0px');
            marquee.style.removeProperty('--scroll-duration');

            // Small timeout to ensure DOM layout updated
            requestAnimationFrame(() => {
                const containerWidth = marquee.clientWidth;
                const contentWidth = content.scrollWidth;
                if (contentWidth > containerWidth + 8) {
                    const distance = contentWidth + 36; // include padding-right used in CSS
                    // Speed: 40 px/sec (tunable). Duration in seconds
                    const duration = Math.max(3, distance / 40);
                    marquee.style.setProperty('--scroll-distance', `${distance}px`);
                    marquee.style.setProperty('--scroll-duration', `${duration}s`);

                    // Clear any previous animationend handler and timeouts
                    try {
                        if (marquee.__marqueeAnimationEndHandler) {
                            marquee.removeEventListener('animationend', marquee.__marqueeAnimationEndHandler);
                            marquee.__marqueeAnimationEndHandler = null;
                        }
                        if (marquee.__marqueeStartTimeout) { clearTimeout(marquee.__marqueeStartTimeout); marquee.__marqueeStartTimeout = null; }
                        if (marquee.__marqueeCycleTimeout) { clearTimeout(marquee.__marqueeCycleTimeout); marquee.__marqueeCycleTimeout = null; }
                    } catch (_) {}

                    // Add the scrolling class after the initial pause
                    marquee.__marqueeStartTimeout = setTimeout(() => {
                        try { marquee.classList.add('scrolling'); } catch (e) {}
                        marquee.__marqueeStartTimeout = null;

                        // When the animation finishes, remove the class and schedule the next cycle after pause
                        const onAnimationEnd = () => {
                            try { marquee.classList.remove('scrolling'); } catch (e) {}
                            // Schedule restart after MARQUEE_PAUSE_MS
                            marquee.__marqueeCycleTimeout = setTimeout(() => {
                                try { marquee.classList.add('scrolling'); } catch (e) {}
                                marquee.__marqueeCycleTimeout = null;
                            }, MARQUEE_PAUSE_MS);
                        };

                        // Store handler so we can remove it on content changes
                        marquee.__marqueeAnimationEndHandler = onAnimationEnd;
                        marquee.addEventListener('animationend', onAnimationEnd, { once: true });
                    }, MARQUEE_PAUSE_MS);
                } else {
                    // No overflow: ensure no scrolling and clear any start timers
                    try { if (marquee.__marqueeStartTimeout) { clearTimeout(marquee.__marqueeStartTimeout); marquee.__marqueeStartTimeout = null; } } catch (_) {}
                    try { if (marquee.__marqueeCycleTimeout) { clearTimeout(marquee.__marqueeCycleTimeout); marquee.__marqueeCycleTimeout = null; } } catch (_) {}
                    marquee.classList.remove('scrolling');
                }
            });
        }

        updateQueue(queue) {
            try {
                // If the overlay isn't created in this context, just store queue for later
                this.queue = queue || [];
                if (!this.upNext) return;
                this.renderUpNext();
            } catch (e) {
                console.error('[OverlayManager] updateQueue', e);
            }
        }

        updatePlaybackState(state) {
            // called when playbackState message arrives; ensure we have position/duration
            try {
                // Normalize position/duration (ms)
                this._position = state?.progress_ms || 0;
                this._duration = state?.item?.duration_ms || 0;
            } catch (e) {
                console.warn('[OverlayManager] updatePlaybackState parse error', e);
                this._position = 0;
                this._duration = 0;
            }
            // Update now-playing progress UI if present
            try { this.updateProgressUI(); } catch (e) { /* ignore */ }
            this.renderUpNext();
        }

        updateProgressUI() {
            if (!this.nowPlaying || !this.nowPlaying.querySelector) return;
            const current = this.nowPlaying.querySelector('.overlay-time.current');
            const total = this.nowPlaying.querySelector('.overlay-time.total');
            const fill = this.nowPlaying.querySelector('.overlay-progress-fill');
            if (!fill || !current || !total) return;

            const pos = Math.max(0, this._position || 0);
            const dur = Math.max(0, this._duration || 0);
            const fmt = (ms) => {
                if (!ms || ms <= 0) return '0:00';
                const s = Math.floor(ms / 1000);
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return `${m}:${String(sec).padStart(2, '0')}`;
            };

            current.textContent = fmt(pos);
            total.textContent = fmt(dur);
            const pct = dur > 0 ? Math.min(100, Math.max(0, (pos / dur) * 100)) : 0;
            fill.style.width = pct + '%';
        }

        // Set overlay opacity (0.0 - 1.0). Applies to the main container so the whole overlay becomes translucent.
        setOverlayOpacity(opacity) {
            if (!this.container) return;
            try {
                const o = Math.max(0, Math.min(1, Number(opacity) || 0));
                // Apply as CSS variable and direct style for broad compatibility
                this.container.style.setProperty('--overlay-opacity', String(o));
                this.container.style.opacity = String(o);
            } catch (e) {
                // ignore
            }
        }

        renderUpNext() {
            // Determine whether to show the up-next widget and what to render.
            if (!this.upNext) return;
            const trackEl = this.upNext.querySelector('.up-next-track');
            if (!trackEl) return;

            const isVisible = this.widgetVisibility.upNext ?? true;

            // Always show in edit mode for positioning, but visually indicate if it's hidden.
            if (this.editMode) {
                this.upNext.style.display = 'block';
                // The 'widget-hidden-in-edit' class is handled by toggleEditMode
            } else {
                // When not in edit mode, hide if queue is empty OR if visibility is off
                const hasQueue = this.queue && this.queue.length > 0;
                this.upNext.style.display = isVisible && hasQueue ? '' : 'none';
            }

            // Set content whether visible or not, so it's ready if toggled on
            if (!this.queue || this.queue.length === 0) {
                trackEl.textContent = 'No songs in queue';
                return;
            }
            
            const next = this.queue[0];
            if (!next) {
                trackEl.textContent = 'No songs in queue';
                return;
            }
            trackEl.textContent = `${this.normalizeTitle(next.name)} — ${next.artists?.map(a => a.name).join(', ')}`;
        }

        loadWidgetVisibility() {
            try {
                const raw = localStorage.getItem(WIDGET_VISIBILITY_KEY);
                const defaults = { nowPlaying: true, upNext: true, toasts: true };
                return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
            } catch (e) {
                console.warn('[OverlayManager] failed to load widget visibility', e);
                return { nowPlaying: true, upNext: true, toasts: true };
            }
        }

        // Normalize a track title by removing any parenthetical parts like "(feat. Artist)" or "(Live)"
        // and trimming extra whitespace. Preserves other punctuation.
        normalizeText(name) {
            if (!name || typeof name !== 'string') return name;
            // Remove any occurrences of parentheses and their contents, including nested ones.
            // We'll repeatedly strip the innermost parentheses until none remain.
            let out = name;
            const parenRe = /\([^()]*\)/g;
            const bracketRe = /\[[^[\]]*\]/g;

            while (parenRe.test(out)) {
                out = out.replace(parenRe, '');
            }
            while (bracketRe.test(out)) {
                out = out.replace(bracketRe, '');
            }

            // Replace multiple spaces with single space and trim
            out = out.replace(/\s{2,}/g, ' ').trim();
            // If title ends with stray hyphen or em-dash from removed part like "Song - " or "Song — ", trim that too
            out = out.replace(/[\-–—:\s]+$/g, '').trim();
            return out;
        }

        showToast(message, type = 'info', duration, isPlaceholder = false) {
            if (!this.toastArea) return;
            // Do not show toasts if the widget is hidden, unless it's a placeholder in edit mode
            const isToastsVisible = this.widgetVisibility.toasts ?? true;
            if (!isToastsVisible && !isPlaceholder) return;

            try {
                // In non-edit mode, if the toast area is hidden, make it visible
                if (!this.editMode && this.toastArea.style.display === 'none') {
                    this.toastArea.style.display = 'flex';
                }
                const icons = {
                    success: 'fa-check-circle',
                    error: 'fa-exclamation-circle',
                    warning: 'fa-exclamation-triangle',
                    info: 'fa-info-circle'
                };

                const toast = document.createElement('div');
                toast.className = `overlay-toast ${type}`;
                if (isPlaceholder) toast.classList.add('placeholder-toast');
                toast.innerHTML = `<i class="fas ${icons[type] || icons.info} overlay-toast-icon"></i><span class="overlay-toast-message">${message}</span>`;
                
                this.toastArea.appendChild(toast);

                const finalDuration = duration || (window.CONFIG && window.CONFIG.UI && window.CONFIG.UI.TOAST_DURATION) || 3000;
                setTimeout(() => {
                    toast.remove();
                    // If it was the last toast, hide the container again (unless in edit mode)
                    if (!this.editMode && this.toastArea.childElementCount === 0) {
                        this.toastArea.style.display = ''; // Revert to default display
                    }
                }, finalDuration);
            } catch (e) {
                console.error('[OverlayManager] showToast error:', e);
            }
        }
    }

    // Initialize
    try {
        new OverlayManager();
    } catch (e) {
        console.error('Failed to initialize overlay manager', e);
    }
})();
