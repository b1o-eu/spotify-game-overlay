// UI Controller for Spotify Game Menu
class UIController {
    constructor() {
        this.elements = {};
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
        this.searchDebounced = Utils.debounce(this.performSearch.bind(this), CONFIG.UI.SEARCH_DEBOUNCE);
        // Guard each initialization step so a single error doesn't break the whole controller
        try {
            this.initializeElements();
        } catch (err) {
            console.error('[UIController] initializeElements failed:', err);
        }

        try {
            this.attachEventListeners();
        } catch (err) {
            console.error('[UIController] attachEventListeners failed:', err);
        }

        try {
            this.loadStoredPosition();
        } catch (err) {
            console.error('[UIController] loadStoredPosition failed:', err);
        }

        try {
            this.applyTheme();
        } catch (err) {
            console.error('[UIController] applyTheme failed:', err);
        }
        try {
            this.applyOverlayOpacity();
        } catch (err) {
            // ignore
        }
        
        // Listen to app state changes
        window.addEventListener('appStateChange', this.handleStateChange.bind(this));
    }

    // Initialize DOM element references
    initializeElements() {
        this.elements = {
            // Main container
            menu: document.getElementById('spotify-menu'),
            
            // Header controls
            minimizeBtn: document.getElementById('minimize-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            closeBtn: document.getElementById('close-btn'),
            
            // Now playing
            trackImage: document.getElementById('track-image'),
            trackName: document.getElementById('track-name'),
            artistName: document.getElementById('artist-name'),
            albumName: document.getElementById('album-name'),
            timeCurrent: document.getElementById('time-current'),
            timeTotal: document.getElementById('time-total'),
            progressBar: document.querySelector('.progress-bar'),
            progressFill: document.getElementById('progress-fill'),
            progressHandle: document.getElementById('progress-handle'),
            
            // Playback controls
            shuffleBtn: document.getElementById('shuffle-btn'),
            prevBtn: document.getElementById('prev-btn'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            nextBtn: document.getElementById('next-btn'),
            repeatBtn: document.getElementById('repeat-btn'),
            
            // Volume control
            volumeSlider: document.getElementById('volume-slider'),
            
            // Search
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('search-btn'),
            searchResults: document.getElementById('search-results'),
            
            // Queue
            queueList: document.getElementById('queue-list'),
            clearQueueBtn: document.getElementById('clear-queue-btn'),
            
            // Connection status
            connectionStatus: document.getElementById('connection-status'),
            statusIndicator: document.querySelector('.status-indicator'),
            statusText: document.querySelector('.status-text'),
            
            // Modals
            authModal: document.getElementById('auth-modal'),
            settingsModal: document.getElementById('settings-modal'),
            modalClose: document.getElementById('modal-close'),
            settingsModalClose: document.getElementById('settings-modal-close'),
            connectSpotifyBtn: document.getElementById('connect-spotify-btn'),
            
            // Settings
            themeSelect: document.getElementById('theme-select'),
            opacitySlider: document.getElementById('opacity-slider'),
            opacityValue: document.getElementById('opacity-value'),
            clientIdInput: document.getElementById('client-id'),
            // Hotkey inputs
            hotkeyToggle: document.getElementById('hotkey-toggle'),
            globalHotkeysCheckbox: document.getElementById('global-hotkeys'),
            hotkeyPlayPause: document.getElementById('hotkey-playpause'),
            hotkeyNext: document.getElementById('hotkey-next'),
            hotkeyPrev: document.getElementById('hotkey-prev'),
            hotkeyVolUp: document.getElementById('hotkey-volup'),
            hotkeyVolDown: document.getElementById('hotkey-voldown'),
            connectSpotifySettingsBtn: document.getElementById('connect-spotify-settings-btn'),
            saveSettingsBtn: document.getElementById('save-settings-btn'),
            resetSettingsBtn: document.getElementById('reset-settings-btn'),
            
            // Toast container
            toastContainer: document.getElementById('toast-container'),

            // About section
            appVersion: document.getElementById('app-version')
        };
    }

    // Attach event listeners
    attachEventListeners() {
        // Header controls
        this.elements.minimizeBtn?.addEventListener('click', this.handleMinimize.bind(this));
        this.elements.settingsBtn?.addEventListener('click', this.showSettings.bind(this));
        this.elements.closeBtn?.addEventListener('click', this.handleClose.bind(this));
        
        // Dragging
    const header = document.querySelector('.menu-header');
        header?.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.handleDrag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        
        // Playback controls
        this.elements.playPauseBtn?.addEventListener('click', this.togglePlayPause.bind(this));
        this.elements.nextBtn?.addEventListener('click', this.nextTrack.bind(this));
        this.elements.prevBtn?.addEventListener('click', this.previousTrack.bind(this));
        this.elements.shuffleBtn?.addEventListener('click', this.toggleShuffle.bind(this));
        this.elements.repeatBtn?.addEventListener('click', this.toggleRepeat.bind(this));
        
        // Progress bar
        this.elements.progressBar?.addEventListener('click', this.seekToPosition.bind(this));
        
        // Volume control
        this.elements.volumeSlider?.addEventListener('input', this.changeVolume.bind(this));
        
        // Search
        this.elements.searchInput?.addEventListener('input', this.handleSearchInput.bind(this));
        this.elements.searchBtn?.addEventListener('click', this.handleSearchSubmit.bind(this));
        this.elements.searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearchSubmit();
        });
        
        // Queue
        this.elements.clearQueueBtn?.addEventListener('click', this.refreshQueue.bind(this));
        
        // Modals
        this.elements.modalClose?.addEventListener('click', this.hideAuthModal.bind(this));
        this.elements.settingsModalClose?.addEventListener('click', this.hideSettings.bind(this));
        this.elements.connectSpotifyBtn?.addEventListener('click', this.connectToSpotify.bind(this));
        
        // Settings
        this.elements.themeSelect?.addEventListener('change', this.changeTheme.bind(this));
        this.elements.opacitySlider?.addEventListener('input', this.changeOpacity.bind(this));
        this.elements.connectSpotifySettingsBtn?.addEventListener('click', this.connectFromSettings.bind(this));
        this.elements.saveSettingsBtn?.addEventListener('click', this.saveSettings.bind(this));
        this.elements.resetSettingsBtn?.addEventListener('click', this.resetSettings.bind(this));
        // About section link
        const authorLink = document.getElementById('author-link');
        authorLink?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                window.electronAPI.openExternal('https://b1o.eu');
            }
        });
        // Edit overlay button (toggles overlay edit mode when available)
        const editOverlayBtn = document.getElementById('edit-overlay-btn');
        editOverlayBtn?.addEventListener('click', () => {
            try {
                // If running in Electron, forward a command so the overlay BrowserWindow toggles edit mode
                if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.forwardOverlayUpdate === 'function') {
                    window.electronAPI.forwardOverlayUpdate({ type: 'COMMAND', data: { action: 'toggleEditMode' } });
                    this.showToast('Entering overlay edit mode. Drag widgets to move them.', 'info', 5000);
                    return;
                }

                // Fallback for web-only mode: try to toggle local overlayManager
                if (window.overlayManager && typeof window.overlayManager.toggleEditMode === 'function') {
                    window.overlayManager.toggleEditMode();
                    const mode = window.overlayManager.editMode ? 'enabled' : 'disabled';
                    this.showToast(`Overlay edit mode ${mode}. Drag widgets to move them.`, 'info', 5000);
                } else {
                    this.showToast('Overlay manager not available', 'warning');
                }
            } catch (e) {
                console.error('Failed to toggle overlay edit mode', e);
            }
        });
    // Global hotkeys checkbox
    this.elements.globalHotkeysCheckbox?.addEventListener('change', this.handleGlobalHotkeysToggle.bind(this));

        // Hotkey inputs: capture when focused
        const hotInputs = [
            { el: this.elements.hotkeyToggle, key: 'TOGGLE_OVERLAY' },
            { el: this.elements.hotkeyPlayPause, key: 'PLAY_PAUSE' },
            { el: this.elements.hotkeyNext, key: 'NEXT_TRACK' },
            { el: this.elements.hotkeyPrev, key: 'PREV_TRACK' },
            { el: this.elements.hotkeyVolUp, key: 'VOLUME_UP' },
            { el: this.elements.hotkeyVolDown, key: 'VOLUME_DOWN' }
        ];

        hotInputs.forEach(({ el, key }) => {
            if (!el) return;
            // Show a hint
            el.addEventListener('focus', () => el.value = 'Press keys...');

            const keyDownHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const combo = window.hotkeyManager?.captureComboFromEvent(e) || '';
                el.value = combo.replace(/\+/g, ' + ');
                // Temporarily store on the element dataset for later saving
                el.dataset.combo = combo;
            };

            const blurHandler = () => {
                // If user didn't press anything, restore previous value
                if (!el.dataset.combo) {
                    // will be set by loadSettingsToForm when modal opens
                }
                document.removeEventListener('keydown', keyDownHandler, true);
            };

            el.addEventListener('keydown', keyDownHandler, true);
            el.addEventListener('blur', blurHandler);
        });
        
        // Click outside modals to close
        this.elements.authModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.authModal) this.hideAuthModal();
        });
        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.hideSettings();
        });
        
        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAuthModal();
                this.hideSettings();
            }
        });

        // Listen for global hotkey events from main (Electron)
        if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.onGlobalHotkey === 'function') {
            window.electronAPI.onGlobalHotkey((action) => {
                // When a global hotkey arrives, run the corresponding hotkey manager callback
                if (!window.hotkeyManager) return;

                // Temporarily disable local key handling to avoid duplicates
                const prev = window.hotkeyManager.isEnabled;
                window.hotkeyManager.setEnabled(false);

                try {
                    const actionMap = {
                        TOGGLE_OVERLAY: () => window.hotkeyManager.toggleOverlay(),
                        PLAY_PAUSE: () => window.hotkeyManager.togglePlayPause(),
                        NEXT_TRACK: () => window.hotkeyManager.nextTrack(),
                        PREV_TRACK: () => window.hotkeyManager.previousTrack(),
                        VOLUME_UP: () => window.hotkeyManager.volumeUp(),
                        VOLUME_DOWN: () => window.hotkeyManager.volumeDown()
                    };

                    const fn = actionMap[action];
                    if (fn) fn();
                } finally {
                    window.hotkeyManager.setEnabled(prev);
                }
            });
        }

        // If running in Electron, observe local toasts and forward them to the overlay
        if (window.electronAPI && window.electronAPI.isElectron) {
            this.observeAndForwardToasts();
        }
    }

    // Handle app state changes
    handleStateChange(event) {
        const { type, data } = event.detail;
        
        switch (type) {
            case 'currentTrack':
                this.updateNowPlaying(data);
                break;
            case 'playbackState':
                this.updatePlaybackControls(data);
                this.updateProgress(data);
                break;
            case 'connectionStatus':
                this.updateConnectionStatus(data);
                break;
            case 'queue':
                this.updateQueue(data);
                break;
            case 'searchResults':
                this.updateSearchResults(data);
                break;
        }

        // Forward to overlay window (main process will forward to overlay BrowserWindow)
        try {
            if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.forwardOverlayUpdate === 'function') {
                window.electronAPI.forwardOverlayUpdate({ type, data });
            }
        } catch (e) {
            // Non-fatal
        }
    }

    // Update now playing display
    updateNowPlaying(track) {
        if (!track) {
            this.elements.trackName.textContent = 'Not Playing';
            this.elements.artistName.textContent = 'Connect to Spotify';
            this.elements.albumName.textContent = '';
            this.elements.trackImage.src = 'assets/default-album.png';
            return;
        }
        
        this.elements.trackName.textContent = track.name || 'Unknown Track';
        this.elements.artistName.textContent = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
        this.elements.albumName.textContent = track.album?.name || '';
        
        // Update album art
        const imageUrl = track.album?.images?.[0]?.url || 'assets/default-album.png';
        this.elements.trackImage.src = imageUrl;
    }

    // Update playback controls
    updatePlaybackControls(state) {
        if (!state) {
            this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.elements.shuffleBtn.classList.remove('active');
            this.elements.repeatBtn.classList.remove('active');
            return;
        }
        
        // Play/Pause button
        const playIcon = state.is_playing ? 'fa-pause' : 'fa-play';
        this.elements.playPauseBtn.innerHTML = `<i class="fas ${playIcon}"></i>`;
        
        // Shuffle button
        if (state.shuffle_state) {
            this.elements.shuffleBtn.classList.add('active');
        } else {
            this.elements.shuffleBtn.classList.remove('active');
        }
        
        // Repeat button
        this.elements.repeatBtn.classList.remove('active');
        if (state.repeat_state === 'context') {
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
        } else if (state.repeat_state === 'track') {
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
        } else {
            this.elements.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
        
        // Volume
        if (state.device?.volume_percent !== undefined) {
            this.elements.volumeSlider.value = state.device.volume_percent;
        }
    }

    // Update progress bar
    updateProgress(state) {
        if (!state || !state.item) {
            this.elements.timeCurrent.textContent = '0:00';
            this.elements.timeTotal.textContent = '0:00';
            this.elements.progressFill.style.width = '0%';
            return;
        }
        
        const current = state.progress_ms || 0;
        const total = state.item.duration_ms || 0;
        const percentage = total > 0 ? (current / total) * 100 : 0;
        
        this.elements.timeCurrent.textContent = Utils.formatTime(current);
        this.elements.timeTotal.textContent = Utils.formatTime(total);
        this.elements.progressFill.style.width = `${percentage}%`;
    }

    // Update connection status
    updateConnectionStatus(connected) {
        if (connected) {
            this.elements.statusIndicator.className = 'status-indicator connected';
            this.elements.statusText.textContent = 'Connected';
            this.hideAuthModal();
        } else {
            this.elements.statusIndicator.className = 'status-indicator disconnected';
            this.elements.statusText.textContent = 'Disconnected';
            this.showAuthModal();
        }
    }

    // Update queue display
    updateQueue(queue) {
        this.elements.queueList.innerHTML = '';
        
        if (!queue || queue.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'queue-item placeholder';
            placeholder.innerHTML = '<span>No songs in queue</span>';
            this.elements.queueList.appendChild(placeholder);
            return;
        }
        
        queue.slice(0, CONFIG.UI.MAX_QUEUE_ITEMS).forEach(track => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            
            const imageUrl = track.album?.images?.[2]?.url || 'assets/default-album.png';
            
            item.innerHTML = `
                <img src="${imageUrl}" alt="Album Art">
                <div class="queue-item-info">
                    <div class="queue-item-name">${track.name}</div>
                    <div class="queue-item-artist">${track.artists?.map(a => a.name).join(', ')}</div>
                </div>
            `;
            
            this.elements.queueList.appendChild(item);
        });
    }

    // Update search results
    updateSearchResults(results) {
        this.elements.searchResults.innerHTML = '';
        
        if (!results || results.length === 0) {
            this.elements.searchResults.classList.add('hidden');
            return;
        }
        
        this.elements.searchResults.classList.remove('hidden');
        
        results.slice(0, CONFIG.UI.MAX_SEARCH_RESULTS).forEach(item => {
            const resultElement = document.createElement('div');
            resultElement.className = 'search-item';
            
            let imageUrl = 'assets/default-album.png';
            let title = item.name;
            let subtitle = '';
            
            if (item.type === 'track') {
                imageUrl = item.album?.images?.[2]?.url || imageUrl;
                subtitle = item.artists?.map(a => a.name).join(', ');
            } else if (item.type === 'artist') {
                imageUrl = item.images?.[2]?.url || imageUrl;
                subtitle = 'Artist';
            } else if (item.type === 'album') {
                imageUrl = item.images?.[2]?.url || imageUrl;
                subtitle = item.artists?.map(a => a.name).join(', ');
            } else if (item.type === 'playlist') {
                imageUrl = item.images?.[0]?.url || imageUrl;
                subtitle = `Playlist • ${item.tracks?.total || 0} tracks`;
            }
            
            resultElement.innerHTML = `
                <img src="${imageUrl}" alt="${title}">
                <div class="search-item-info">
                    <div class="search-item-name">${title}</div>
                    <div class="search-item-artist">${subtitle}</div>
                </div>
                ${item.type === 'track' ? `
                    <div class="search-item-actions">
                        <button class="search-action-btn play-btn" title="Play Now">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="search-action-btn queue-btn" title="Add to Queue">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                ` : ''}
            `;
            
            if (item.type === 'track') {
                const playBtn = resultElement.querySelector('.play-btn');
                const queueBtn = resultElement.querySelector('.queue-btn');
                
                playBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.playTrackNow(item);
                });
                
                queueBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addTrackToQueue(item);
                });
                
                // Default click behavior for tracks is now add to queue
                resultElement.addEventListener('click', () => this.addTrackToQueue(item));
            } else {
                // For albums, playlists, artists - play immediately
                resultElement.addEventListener('click', () => this.playContextNow(item));
            }
            this.elements.searchResults.appendChild(resultElement);
        });
    }

    // Playback control methods
    async togglePlayPause() {
        try {
            const state = window.appState.getCurrentState();
            if (state.isPlaying) {
                await window.spotifyAPI.pause();
                this.showToast('Paused', 'success');
            } else {
                await window.spotifyAPI.play();
                this.showToast('Playing', 'success');
            }
        } catch (error) {
            this.showToast('Playback control failed', 'error');
            console.error('Playback control error:', error);
        }
    }

    async nextTrack() {
        try {
            await window.spotifyAPI.next();
            this.showToast('Next track', 'success');
        } catch (error) {
            this.showToast('Failed to skip track', 'error');
            console.error('Next track error:', error);
        }
    }

    async previousTrack() {
        try {
            await window.spotifyAPI.previous();
            this.showToast('Previous track', 'success');
        } catch (error) {
            this.showToast('Failed to go to previous track', 'error');
            console.error('Previous track error:', error);
        }
    }

    async refreshQueue() {
        try {
            await window.spotifyAPI.getQueue();
            this.showToast('Queue refreshed', 'success');
        } catch (error) {
            this.showToast('Failed to refresh queue', 'error');
            console.error('Refresh queue error:', error);
        }
    }

    async toggleShuffle() {
        try {
            const state = window.appState.getCurrentState();
            const newState = !state.shuffleState;
            await window.spotifyAPI.setShuffle(newState);
            this.showToast(`Shuffle ${newState ? 'on' : 'off'}`, 'success');
        } catch (error) {
            this.showToast('Failed to toggle shuffle', 'error');
            console.error('Shuffle toggle error:', error);
        }
    }

    async toggleRepeat() {
        try {
            const state = window.appState.getCurrentState();
            let newState = 'off';
            
            if (state.repeatState === 'off') {
                newState = 'context';
            } else if (state.repeatState === 'context') {
                newState = 'track';
            }
            
            await window.spotifyAPI.setRepeat(newState);
            
            const messages = {
                'off': 'Repeat off',
                'context': 'Repeat all',
                'track': 'Repeat track'
            };
            this.showToast(messages[newState], 'success');
        } catch (error) {
            this.showToast('Failed to change repeat mode', 'error');
            console.error('Repeat toggle error:', error);
        }
    }

    async seekToPosition(event) {
        try {
            const rect = this.elements.progressBar.getBoundingClientRect();
            const percentage = (event.clientX - rect.left) / rect.width;
            const state = window.appState.getCurrentState();
            
            if (state.duration > 0) {
                const positionMs = Math.floor(percentage * state.duration);
                await window.spotifyAPI.seek(positionMs);
            }
        } catch (error) {
            this.showToast('Failed to seek', 'error');
            console.error('Seek error:', error);
        }
    }

    async changeVolume(event) {
        try {
            const volume = parseInt(event.target.value);
            await window.spotifyAPI.setVolume(volume);
        } catch (error) {
            console.error('Volume change error:', error);
        }
    }

    // Search functionality
    handleSearchInput(event) {
        const query = event.target.value;
        this.searchDebounced(query);
    }

    handleSearchSubmit() {
        const query = this.elements.searchInput.value;
        this.performSearch(query);
    }

    async performSearch(query) {
        if (!query.trim()) {
            this.elements.searchResults.classList.add('hidden');
            return;
        }
        
        try {
            await window.spotifyAPI.search(query, ['track', 'artist', 'album', 'playlist']);
        } catch (error) {
            this.showToast('Search failed', 'error');
            console.error('Search error:', error);
        }
    }

    async playTrackNow(item) {
        try {
            await window.spotifyAPI.play(null, [item.uri]);
            this.showToast(`Playing: ${item.name}`, 'success');
            
            // Clear search results
            this.elements.searchInput.value = '';
            this.elements.searchResults.classList.add('hidden');
        } catch (error) {
            this.showToast('Failed to play track', 'error');
            console.error('Play track error:', error);
        }
    }

    async addTrackToQueue(item) {
        try {
            await window.spotifyAPI.addToQueue(item.uri);
            this.showToast(`Added to queue: ${item.name}`, 'success');
            
            // Refresh the queue to show the new addition
            setTimeout(() => window.spotifyAPI.getQueue(), 500);
            
            // Clear search results
            this.elements.searchInput.value = '';
            this.elements.searchResults.classList.add('hidden');
        } catch (error) {
            this.showToast('Failed to add to queue', 'error');
            console.error('Add to queue error:', error);
        }
    }

    async playContextNow(item) {
        try {
            await window.spotifyAPI.play(item.uri);
            this.showToast(`Playing: ${item.name}`, 'success');
            
            // Clear search results
            this.elements.searchInput.value = '';
            this.elements.searchResults.classList.add('hidden');
        } catch (error) {
            this.showToast('Failed to play selection', 'error');
            console.error('Play context error:', error);
        }
    }

    // Modal management
    showAuthModal() {
        this.elements.authModal?.classList.remove('hidden');
    }

    hideAuthModal() {
        this.elements.authModal?.classList.add('hidden');
    }

    showSettings() {
        this.loadSettingsToForm();
        // Always show the in-page settings modal so settings appear inside the app
        // Fetch and display app version (Electron only)
        if (this.elements.appVersion && window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
            window.electronAPI.getAppVersion()
                .then(version => {
                    if (this.elements.appVersion) {
                        this.elements.appVersion.textContent = version;
                    }
                }).catch(err => console.warn('Failed to get app version', err));
        }
        this.elements.settingsModal?.classList.remove('hidden');
    }

    hideSettings() {
        this.elements.settingsModal?.classList.add('hidden');
    }

    // Settings management
    loadSettingsToForm() {
        const settings = window.appState.settings;
        
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = settings.theme;
        }
        
        if (this.elements.opacitySlider) {
            // Slider now controls overlay opacity (not menu opacity)
            this.elements.opacitySlider.value = settings.overlayOpacity ?? settings.opacity ?? 95;
            this.elements.opacityValue.textContent = `${this.elements.opacitySlider.value}%`;
        }

        if (this.elements.clientIdInput) {
            this.elements.clientIdInput.value = localStorage.getItem(CONFIG.STORAGE.CLIENT_ID) || '';
        }
        
        // Update connection status based on current authentication state
        const isAuthenticated = window.spotifyAPI && window.spotifyAPI.isAuthenticated();
        this.updateConnectionStatus(isAuthenticated ? 'connected' : 'disconnected');
        
        // Update redirect URI based on environment
        const redirectUriInput = document.getElementById('redirect-uri');
        if (redirectUriInput) {
            redirectUriInput.value = CONFIG.SPOTIFY.REDIRECT_URI;
        }

        // Load hotkeys into form (stored under settings.hotkeys or fallback to CONFIG.DEFAULTS.hotkeys)
        const hotkeys = settings.hotkeys || CONFIG.DEFAULTS.hotkeys || CONFIG.HOTKEYS;

        if (this.elements.hotkeyToggle) this.elements.hotkeyToggle.value = (hotkeys.TOGGLE_OVERLAY || CONFIG.HOTKEYS.TOGGLE_OVERLAY).replace(/\+/g, ' + ');
        if (this.elements.hotkeyPlayPause) this.elements.hotkeyPlayPause.value = (hotkeys.PLAY_PAUSE || CONFIG.HOTKEYS.PLAY_PAUSE).replace(/\+/g, ' + ');
        if (this.elements.hotkeyNext) this.elements.hotkeyNext.value = (hotkeys.NEXT_TRACK || CONFIG.HOTKEYS.NEXT_TRACK).replace(/\+/g, ' + ');
        if (this.elements.hotkeyPrev) this.elements.hotkeyPrev.value = (hotkeys.PREV_TRACK || CONFIG.HOTKEYS.PREV_TRACK).replace(/\+/g, ' + ');
        if (this.elements.hotkeyVolUp) this.elements.hotkeyVolUp.value = (hotkeys.VOLUME_UP || CONFIG.HOTKEYS.VOLUME_UP).replace(/\+/g, ' + ');
        if (this.elements.hotkeyVolDown) this.elements.hotkeyVolDown.value = (hotkeys.VOLUME_DOWN || CONFIG.HOTKEYS.VOLUME_DOWN).replace(/\+/g, ' + ');

        // Global hotkeys setting
        if (this.elements.globalHotkeysCheckbox) {
            this.elements.globalHotkeysCheckbox.checked = !!settings.globalHotkeys;
        }
    }

    async connectToSpotify() {
        const clientId = this.elements.clientIdInput?.value?.trim();

        console.debug('[UI] connectToSpotify clicked, clientId=', clientId);

        if (!clientId) {
            this.showToast('Please enter your Spotify Client ID', 'error');
            return;
        }

        if (!window.spotifyAPI || typeof window.spotifyAPI.authenticate !== 'function') {
            console.error('[UI] spotifyAPI.authenticate not available');
            this.showToast('Internal error: spotify API not initialized', 'error');
            return;
        }

        try {
            this.showToast('Starting Spotify authentication...', 'info');
            await window.spotifyAPI.authenticate(clientId);
            console.debug('[UI] spotifyAPI.authenticate returned');
        } catch (error) {
            this.showToast('Authentication failed', 'error');
            console.error('Auth error:', error);
        }
    }

    async connectFromSettings() {
        // First, save the Client ID if it's been changed
        const clientId = this.elements.clientIdInput?.value?.trim();
        
        if (!clientId) {
            this.showToast('Please enter your Spotify Client ID first', 'error');
            this.elements.clientIdInput?.focus();
            return;
        }
        
        // Save the client ID
        localStorage.setItem(CONFIG.STORAGE.CLIENT_ID, clientId);

        console.debug('[UI] connectFromSettings clicked, clientId=', clientId);

        if (!window.spotifyAPI || typeof window.spotifyAPI.authenticate !== 'function') {
            console.error('[UI] spotifyAPI.authenticate not available (from settings)');
            this.showToast('Internal error: spotify API not initialized', 'error');
            this.updateConnectionStatus('disconnected');
            return;
        }
        
        // Update connection status to "Connecting..."
        this.updateConnectionStatus('connecting');
        
        try {
            await window.spotifyAPI.authenticate(clientId);
            this.showToast('Successfully connected to Spotify!', 'success');
            this.updateConnectionStatus('connected');
        } catch (error) {
            this.showToast('Failed to connect to Spotify', 'error');
            this.updateConnectionStatus('disconnected');
            console.error('Auth error:', error);
        }
    }

    updateConnectionStatus(status) {
        if (!this.elements.connectionStatus) return; 
        
        const statusElement = this.elements.connectionStatus;
        const connectButton = this.elements.connectSpotifySettingsBtn;
        
        switch (status) {
            case 'connected':
                statusElement.textContent = 'Connected';
                statusElement.className = 'connection-status connected';
                if (connectButton) {
                    connectButton.innerHTML = '<i class="fas fa-check"></i> Connected';
                    connectButton.disabled = true;
                }
                break;
            case 'connecting':
                statusElement.textContent = 'Connecting...';
                statusElement.className = 'connection-status connecting';
                if (connectButton) {
                    connectButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                    connectButton.disabled = true;
                }
                break;
            case 'disconnected':
            default:
                statusElement.textContent = 'Not Connected';
                statusElement.className = 'connection-status disconnected';
                if (connectButton) {
                    connectButton.innerHTML = '<i class="fab fa-spotify"></i> Connect to Spotify';
                    connectButton.disabled = false;
                }
                break;
        }
    }

    saveSettings() {
        const settings = window.appState.settings;
        
        if (this.elements.themeSelect) {
            settings.theme = this.elements.themeSelect.value;
        }
        
        if (this.elements.opacitySlider) {
            settings.overlayOpacity = parseInt(this.elements.opacitySlider.value);
        }

        if (this.elements.clientIdInput) {
            const clientId = this.elements.clientIdInput.value.trim();
            if (clientId) {
                localStorage.setItem(CONFIG.STORAGE.CLIENT_ID, clientId);
            }
        }

        // Read hotkey values from input elements (prefer stored dataset.combo if user captured)
        settings.hotkeys = settings.hotkeys || {};
        const pick = (el, fallback) => {
            if (!el) return fallback;
            return el.dataset.combo || el.value.replace(/\s+\+\s+/g, '+') || fallback;
        };

        settings.hotkeys.TOGGLE_OVERLAY = pick(this.elements.hotkeyToggle, CONFIG.HOTKEYS.TOGGLE_OVERLAY);
        settings.hotkeys.PLAY_PAUSE = pick(this.elements.hotkeyPlayPause, CONFIG.HOTKEYS.PLAY_PAUSE);
        settings.hotkeys.NEXT_TRACK = pick(this.elements.hotkeyNext, CONFIG.HOTKEYS.NEXT_TRACK);
        settings.hotkeys.PREV_TRACK = pick(this.elements.hotkeyPrev, CONFIG.HOTKEYS.PREV_TRACK);
        settings.hotkeys.VOLUME_UP = pick(this.elements.hotkeyVolUp, CONFIG.HOTKEYS.VOLUME_UP);
        settings.hotkeys.VOLUME_DOWN = pick(this.elements.hotkeyVolDown, CONFIG.HOTKEYS.VOLUME_DOWN);

        // Global hotkeys option (Electron only)
        if (this.elements.globalHotkeysCheckbox) {
            settings.globalHotkeys = !!this.elements.globalHotkeysCheckbox.checked;
        }

        // Persist settings and apply hotkeys
        window.appState.saveSettings();
        if (window.hotkeyManager && typeof window.hotkeyManager.applyHotkeysFromSettings === 'function') {
            window.hotkeyManager.applyHotkeysFromSettings(settings.hotkeys);
        }
        // Register/unregister global hotkeys if applicable
        try {
            if (typeof this.registerGlobalHotkeysIfEnabled === 'function') {
                this.registerGlobalHotkeysIfEnabled();
            }
        } catch (e) {
            console.error('Failed to register/unregister global hotkeys:', e);
        }
        
        // Other UI updates
        this.applyTheme();
        this.applyOverlayOpacity();

        this.showToast('Settings saved', 'success');
        this.hideSettings();
    }

    resetSettings() {
        window.appState.settings = { ...CONFIG.DEFAULTS };
        window.appState.saveSettings();
        
        this.loadSettingsToForm();
        this.applyTheme();
        this.applyOverlayOpacity();
        
        this.showToast('Settings reset to default', 'success');
    }

    changeTheme(event) {
        window.appState.settings.theme = event.target.value;
        this.applyTheme();
    }

    changeOpacity(event) {
        const opacity = parseInt(event.target.value);
        // This slider now controls overlay opacity specifically
        window.appState.settings.overlayOpacity = opacity;
        this.elements.opacityValue.textContent = `${opacity}%`;
        // Persist the settings
        window.appState.saveSettings();
        // Apply overlay opacity locally and forward to overlay window if present
        this.applyOverlayOpacity();
    }

    applyOverlayOpacity() {
        const overlayOpacity = (window.appState.settings.overlayOpacity ?? 90) / 100;
        // Apply to overlay if it's present in this renderer
        try {
            if (window.overlayManager && typeof window.overlayManager.setOverlayOpacity === 'function') {
                window.overlayManager.setOverlayOpacity(overlayOpacity);
            }
        } catch (e) {}

        // Forward to overlay BrowserWindow if running under Electron
        try {
            if (window.electronAPI && window.electronAPI.isElectron && typeof window.electronAPI.forwardOverlayUpdate === 'function') {
                window.electronAPI.forwardOverlayUpdate({ type: 'COMMAND', data: { action: 'setOpacity', opacity: Math.round(overlayOpacity * 100) } });
            }
        } catch (e) {}
    }

    // Handle enabling/disabling of global hotkeys via the checkbox
    async handleGlobalHotkeysToggle(event) {
        window.appState.settings.globalHotkeys = !!event.target.checked;
        window.appState.saveSettings();
        await this.registerGlobalHotkeysIfEnabled();
    }

    // Convert settings.hotkeys to Electron accelerators and register/unregister via preload
    async registerGlobalHotkeysIfEnabled() {
        if (!(window.electronAPI && window.electronAPI.isElectron)) return;
        if (typeof window.electronAPI.registerGlobalHotkeys !== 'function') return;

        const settings = window.appState.settings || {};
        const enabled = !!settings.globalHotkeys;

        try {
            if (!enabled) {
                await window.electronAPI.unregisterGlobalHotkeys();
                return;
            }

            const accelMap = {};
            const hotkeys = settings.hotkeys || CONFIG.DEFAULTS.hotkeys || CONFIG.HOTKEYS;

            const specialMap = {
                ' ': 'Space',
                'space': 'Space',
                'arrowup': 'Up',
                'arrowdown': 'Down',
                'arrowleft': 'Left',
                'arrowright': 'Right',
                'up': 'Up',
                'down': 'Down',
                'left': 'Left',
                'right': 'Right',
                'escape': 'Esc',
                'esc': 'Esc',
                'enter': 'Enter',
                'tab': 'Tab',
                'backspace': 'Backspace',
                'delete': 'Delete',
                'del': 'Delete'
            };

            const normalizePart = (p) => {
                const lower = p.toLowerCase();
                if (lower === 'ctrl' || lower === 'meta') return 'CmdOrCtrl';
                if (lower === 'alt') return 'Alt';
                if (lower === 'shift') return 'Shift';
                if (specialMap[lower]) return specialMap[lower];
                if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase();
                return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
            };

            Object.entries(hotkeys).forEach(([action, combo]) => {
                if (!combo) return;
                const parts = combo.split('+').map(p => p.trim()).filter(Boolean);
                // Map and dedupe modifiers like CmdOrCtrl
                const mapped = parts.map(normalizePart);
                // Ensure CmdOrCtrl appears only once
                const finalParts = [];
                const seen = new Set();
                mapped.forEach(part => {
                    if (part === 'CmdOrCtrl') {
                        if (!seen.has('CmdOrCtrl')) {
                            finalParts.push('CmdOrCtrl');
                            seen.add('CmdOrCtrl');
                        }
                    } else {
                        if (!seen.has(part)) {
                            finalParts.push(part);
                            seen.add(part);
                        }
                    }
                });

                accelMap[action] = finalParts.join('+');
            });

            const result = await window.electronAPI.registerGlobalHotkeys(accelMap);
            // result expected to be { registered: [], failed: [] }
            if (result && typeof result === 'object') {
                const reg = result.registered || [];
                const failed = result.failed || [];
                if (failed.length > 0) {
                    this.showToast(`Global hotkeys: ${reg.length} registered, ${failed.length} failed`, 'warning');
                    console.warn('[UIController] Global hotkey registration failures:', JSON.stringify(failed, null, 2));
                } else {
                    this.showToast(`Global hotkeys registered (${reg.length})`, 'success');
                }
            }
        } catch (err) {
            console.error('[UIController] registerGlobalHotkeysIfEnabled error:', err);
        }
    }

    applyTheme() {
        const theme = window.appState.settings.theme;
        if (theme === 'light') {
            this.elements.menu?.classList.add('light-theme');
        } else {
            this.elements.menu?.classList.remove('light-theme');
        }
    }

    // Menu positioning and dragging
    startDrag(event) {
        // If running in Electron use native window dragging (via CSS -webkit-app-region: drag)
        if (window.electronAPI && window.electronAPI.isElectron) return;

        this.isDragging = true;
        this.elements.menu?.classList.add('dragging');

        const rect = this.elements.menu.getBoundingClientRect();
        this.dragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        event.preventDefault();
    }

    handleDrag(event) {
        if (!this.isDragging) return; 
        
        const x = event.clientX - this.dragOffset.x;
        const y = event.clientY - this.dragOffset.y;
        
    // Keep menu within viewport
        const maxX = window.innerWidth - this.elements.menu.offsetWidth;
        const maxY = window.innerHeight - this.elements.menu.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        this.elements.menu.style.right = 'auto';
        this.elements.menu.style.left = `${constrainedX}px`;
        this.elements.menu.style.top = `${constrainedY}px`;
    }

    endDrag() {
        if (!this.isDragging) return; 

        this.isDragging = false;
        this.elements.menu?.classList.remove('dragging');

        // If not running in Electron, save DOM position
        if (!(window.electronAPI && window.electronAPI.isElectron)) {
            const rect = this.elements.menu.getBoundingClientRect();
            window.appState.settings.position = {
                x: rect.left,
                y: rect.top
            };
            window.appState.saveSettings();
        }
    }

    loadStoredPosition() {
        // Only apply stored DOM position for web builds. In Electron the frameless window
        // will be positioned via the OS and BrowserWindow API; keeping DOM positioning
        // can conflict with the native window.
        if (window.electronAPI && window.electronAPI.isElectron) return;

        const position = window.appState.settings.position;
        if (position) {
            this.elements.menu.style.right = 'auto';
            this.elements.menu.style.left = `${position.x}px`;
            this.elements.menu.style.top = `${position.y}px`;
        }
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            this.elements.menu?.classList.add('minimized');
            this.elements.minimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
        } else {
            this.elements.menu?.classList.remove('minimized');
            this.elements.minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        }
    }

    hideMenu() {
        this.elements.menu?.classList.add('hidden');
    }

    showMenu() {
        this.elements.menu?.classList.remove('hidden');
    }

    // Electron-compatible window controls
    async handleMinimize() {
        if (window.electronAPI && window.electronAPI.isElectron) {
            await window.electronAPI.minimizeWindow();
        } else {
            this.toggleMinimize();
        }
    }

    async handleClose() {
        if (window.electronAPI && window.electronAPI.isElectron) {
            await window.electronAPI.closeWindow();
        } else {
            this.hideMenu();
        }
    }

    // Toast notifications
    showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => toast.remove());
        
        this.elements.toastContainer?.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
    }

    // Observe the main toast container and forward new toasts to the overlay window
    observeAndForwardToasts() {
        const toastContainer = this.elements.toastContainer;
        if (!toastContainer || !window.electronAPI || typeof window.electronAPI.forwardOverlayUpdate !== 'function') {
            return;
        }

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement && node.classList.contains('toast')) {
                        const type = node.classList.contains('success') ? 'success' : node.classList.contains('error') ? 'error' : 'info';
                        const message = node.querySelector('.toast-message')?.textContent || '';
                        
                        if (message) {
                            window.electronAPI.forwardOverlayUpdate({ type: 'TOAST', data: { message, type } });
                        }
                    }
                }
            }
        });

        observer.observe(toastContainer, { childList: true });
    }
}

// Initialize UI Controller (guarded)
try {
    window.uiController = new UIController();
} catch (err) {
    console.error('[UIController] initialization failed:', err);
    // Provide a more comprehensive stub so other modules don't crash while we surface the real error
    window.uiController = {
        applyTheme: () => {},
        applyOpacity: () => {},
        updateConnectionStatus: () => {},
        updateNowPlaying: () => {},
        updatePlaybackControls: () => {},
        updateProgress: () => {},
        updateQueue: () => {},
        showToast: (msg, type) => console.log('[UI Stub Toast]', type, msg),
        // Playback helper stubs
        togglePlayPause: async () => console.log('[UI Stub] togglePlayPause'),
        nextTrack: async () => console.log('[UI Stub] nextTrack'),
        previousTrack: async () => console.log('[UI Stub] previousTrack'),
        showMenu: () => console.log('[UI Stub] showMenu'),
        hideMenu: () => console.log('[UI Stub] hideMenu')
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}