// Overlay Manager: creates a global, non-interactable overlay with movable widgets in edit mode
(function () {
    const STORAGE_KEY = 'overlay_positions_v1';
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
                    this.observeToasts();
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
                window.addEventListener('appStateChange', this.handleAppState.bind(this));
                // If running as a separate Electron overlay window, main process can forward
                // app state updates via an IPC helper exposed on window.electronAPI.
                if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.onOverlayUpdate === 'function') {
                    try {
                        window.electronAPI.onOverlayUpdate((msg) => {
                            // Expect msg to be { type, data }
                            if (!msg || !msg.type) return;
                            this.handleAppState({ detail: msg });
                        });
                    } catch (e) {
                        console.warn('[OverlayManager] failed to register onOverlayUpdate', e);
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
                    <div class="overlay-artist">Connect to Spotify</div>
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
            this.upNext.innerHTML = `
                <div class="overlay-upnext-header">Up Next</div>
                <div class="overlay-upnext-list"><span class="empty">No songs in queue</span></div>
            `;
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

            if (this.editMode) {
                this.container.classList.add('overlay-edit-mode');
                this.container.style.pointerEvents = 'auto';
                [this.nowPlaying, this.upNext, this.toastArea].forEach(el => el.style.pointerEvents = 'auto');
                // If running as a native overlay window, ask main process to make the window focusable/clickable
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
                this.savePositions();
                try {
                    if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
                        // When not editing, make window click-through
                        window.electronAPI.setIgnoreMouseEvents(true);
                    }
                } catch (e) {
                    console.warn('[OverlayManager] failed to request native mouse behavior change', e);
                }
            }
            // Re-render up-next area on edit mode change so users see full queue while editing
            try { this.renderUpNext(); } catch (e) { /* ignore */ }
        }

        onPointerDown(e) {
            if (!this.editMode) return;
            // Only start drag when pointer is over a widget
            const target = e.target.closest('.overlay-widget') || e.target.closest('[data-widget-id]');
            if (!target || !this.container.contains(target)) return;

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
            }
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
                    const normalized = this.normalizeTitle(track.name) || 'Unknown Track';
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
                if (artist) artist.textContent = track.artists ? track.artists.map(a => a.name).join(', ') : '';
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
            if (!this.upNext || !this.upNext.querySelector) return;
            const list = this.upNext.querySelector('.overlay-upnext-list');
            if (!list) return;

            // If in edit mode, always show the full queue (helpful when positioning widgets)
                if (this.editMode) {
                this.upNext.style.display = 'block';
                list.innerHTML = '';
                if (!this.queue || this.queue.length === 0) {
                    list.innerHTML = '<span class="empty">No songs in queue</span>';
                    return;
                }
                this.queue.slice(0, 5).forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'overlay-upnext-item';
                    el.textContent = `${this.normalizeTitle(item.name)} — ${item.artists?.map(a => a.name).join(', ')}`;
                    list.appendChild(el);
                });
                return;
            }

            // Not in edit mode: show only when there's an immediate next song and current track is near its end
            if (!this.queue || this.queue.length === 0) {
                this.upNext.style.display = 'none';
                return;
            }

            // Need playback timing info to decide
            const position = (this._position !== undefined) ? this._position : (this.playbackState?.progress_ms || 0);
            const duration = (this._duration !== undefined) ? this._duration : (this.playbackState?.item?.duration_ms || 0);
            if (!duration || duration <= 0) {
                // unknown duration: hide
                this.upNext.style.display = 'none';
                return;
            }

            const remaining = Math.max(0, duration - position);
            if (remaining <= UPNEXT_THRESHOLD_MS && this.queue.length > 0 && this.playbackState?.is_playing) {
                // Show only the first queued item
                this.upNext.style.display = 'block';
                list.innerHTML = '';
                const next = this.queue[0];
                if (!next) {
                    list.innerHTML = '<span class="empty">No songs in queue</span>';
                    return;
                }
                const el = document.createElement('div');
                el.className = 'overlay-upnext-item';
                el.textContent = `${this.normalizeTitle(next.name)} — ${next.artists?.map(a => a.name).join(', ')}`;
                list.appendChild(el);
            } else {
                // Hide when not near the end
                this.upNext.style.display = 'none';
            }
        }

        // Normalize a track title by removing any parenthetical parts like "(feat. Artist)" or "(Live)"
        // and trimming extra whitespace. Preserves other punctuation.
        normalizeTitle(name) {
            if (!name || typeof name !== 'string') return name;
            // Remove any occurrences of parentheses and their contents, including nested ones.
            // We'll repeatedly strip the innermost parentheses until none remain.
            let out = name;
            const parenRe = /\([^()]*\)/g;
            while (parenRe.test(out)) {
                out = out.replace(parenRe, '');
            }
            // Replace multiple spaces with single space and trim
            out = out.replace(/\s{2,}/g, ' ').trim();
            // If title ends with stray hyphen or em-dash from removed part like "Song - " or "Song — ", trim that too
            out = out.replace(/[\-–—:\s]+$/g, '').trim();
            return out;
        }

        observeToasts() {
            const orig = document.getElementById('toast-container');
            if (!orig) return;

            // Mirror newly added toasts into overlay toast area
            const observer = new MutationObserver(mutations => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (!(node instanceof HTMLElement)) continue;
                        const cloned = this.cloneToast(node);
                        if (cloned) this.toastArea.appendChild(cloned);
                    }
                }
            });

            observer.observe(orig, { childList: true });
        }

        cloneToast(node) {
            try {
                const type = (node && node.classList && node.classList.contains && (node.classList.contains('success') ? 'success' : node.classList.contains('error') ? 'error' : node.classList.contains('warning') ? 'warning' : 'info')) || 'info';
                const msg = (node && typeof node.querySelector === 'function' && node.querySelector('.toast-message')?.textContent) || (node && node.textContent) || '';
                const toast = document.createElement('div');
                toast.className = `overlay-toast ${type}`;
                toast.innerHTML = `<span class="overlay-toast-message">${msg}</span>`;
                // Keep same lifetime as app (try reading duration if stored on node)
                const duration = (node.__toastDuration || (window.CONFIG && window.CONFIG.UI && window.CONFIG.UI.TOAST_DURATION)) || 4000;
                setTimeout(() => toast.remove(), duration);
                return toast;
            } catch (e) {
                console.error('[OverlayManager] cloneToast', e);
                return null;
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
