// Overlay Manager: creates a global, non-interactable overlay with movable widgets in edit mode
(function () {
    const STORAGE_KEY = 'overlay_positions_v1';
    const DEFAULT_POSITIONS = {
        nowPlaying: { left: 20, top: 20 },
        upNext: { left: 20, top: 120 },
        toasts: { right: 20, bottom: 20 }
    };

    class OverlayManager {
        constructor() {
            this.positions = this.loadPositions();
            this.editMode = false;
            this.dragging = null; // {el, startX, startY, origLeft, origTop}

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
                    <div class="overlay-track">Not Playing</div>
                    <div class="overlay-artist">Connect to Spotify</div>
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
                // optionally show play/pause indicators
            }
            // Support commands forwarded from main/renderer
            if (type === 'COMMAND' && data && data.action) {
                if (data.action === 'toggleEditMode') {
                    this.toggleEditMode();
                } else if (data.action === 'enterEditMode') {
                    this.toggleEditMode(true);
                } else if (data.action === 'exitEditMode') {
                    this.toggleEditMode(false);
                }
            }
        }

        updateNowPlaying(track) {
            try {
                const img = this.nowPlaying.querySelector('img');
                const title = this.nowPlaying.querySelector('.overlay-track');
                const artist = this.nowPlaying.querySelector('.overlay-artist');

                if (!track) {
                    title.textContent = 'Not Playing';
                    artist.textContent = 'Connect to Spotify';
                    img.src = 'assets/default-album.png';
                    return;
                }

                title.textContent = track.name || 'Unknown Track';
                artist.textContent = track.artists ? track.artists.map(a => a.name).join(', ') : '';
                img.src = track.album?.images?.[0]?.url || img.src;
            } catch (e) {
                console.error('[OverlayManager] updateNowPlaying', e);
            }
        }

        updateQueue(queue) {
            try {
                const list = this.upNext.querySelector('.overlay-upnext-list');
                list.innerHTML = '';
                if (!queue || queue.length === 0) {
                    list.innerHTML = '<span class="empty">No songs in queue</span>';
                    return;
                }
                queue.slice(0, 5).forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'overlay-upnext-item';
                    el.textContent = `${item.name} — ${item.artists?.map(a => a.name).join(', ')}`;
                    list.appendChild(el);
                });
            } catch (e) {
                console.error('[OverlayManager] updateQueue', e);
            }
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
                const type = node.classList.contains('success') ? 'success' : node.classList.contains('error') ? 'error' : node.classList.contains('warning') ? 'warning' : 'info';
                const msg = node.querySelector('.toast-message')?.textContent || node.textContent || '';
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
