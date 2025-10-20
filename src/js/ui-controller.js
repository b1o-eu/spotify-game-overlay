// UI Controller for Spotify Game Overlay
class UIController {
    constructor() {
        this.elements = {};
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
        this.searchDebounced = Utils.debounce(this.performSearch.bind(this), CONFIG.UI.SEARCH_DEBOUNCE);
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadStoredPosition();
        this.applyTheme();
        
        // Listen to app state changes
        window.addEventListener('appStateChange', this.handleStateChange.bind(this));
    }

    // Initialize DOM element references
    initializeElements() {
        this.elements = {
            // Main container
            overlay: document.getElementById('spotify-overlay'),
            
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
            connectSpotifySettingsBtn: document.getElementById('connect-spotify-btn'),
            connectionStatus: document.getElementById('connection-status'),
            saveSettingsBtn: document.getElementById('save-settings-btn'),
            resetSettingsBtn: document.getElementById('reset-settings-btn'),
            
            // Toast container
            toastContainer: document.getElementById('toast-container')
        };
    }

    // Attach event listeners
    attachEventListeners() {
        // Header controls
        this.elements.minimizeBtn?.addEventListener('click', this.handleMinimize.bind(this));
        this.elements.settingsBtn?.addEventListener('click', this.showSettings.bind(this));
        this.elements.closeBtn?.addEventListener('click', this.handleClose.bind(this));
        
        // Dragging
        const header = document.querySelector('.overlay-header');
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
            this.elements.playPauseBtn.innerHTML = '<i class=\"fas fa-play\"></i>';
            this.elements.shuffleBtn.classList.remove('active');
            this.elements.repeatBtn.classList.remove('active');
            return;
        }
        
        // Play/Pause button
        const playIcon = state.is_playing ? 'fa-pause' : 'fa-play';
        this.elements.playPauseBtn.innerHTML = `<i class=\"fas ${playIcon}\"></i>`;
        
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
            this.elements.repeatBtn.innerHTML = '<i class=\"fas fa-redo\"></i>';
        } else if (state.repeat_state === 'track') {
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.innerHTML = '<i class=\"fas fa-redo-alt\"></i>';
        } else {
            this.elements.repeatBtn.innerHTML = '<i class=\"fas fa-redo\"></i>';
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
                <img src=\"${imageUrl}\" alt=\"Album Art\">
                <div class=\"queue-item-info\">
                    <div class=\"queue-item-name\">${track.name}</div>
                    <div class=\"queue-item-artist\">${track.artists?.map(a => a.name).join(', ')}</div>
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
                <img src=\"${imageUrl}\" alt=\"${title}\">
                <div class=\"search-item-info\">
                    <div class=\"search-item-name\">${title}</div>
                    <div class=\"search-item-artist\">${subtitle}</div>
                </div>
                ${item.type === 'track' ? `
                    <div class=\"search-item-actions\">
                        <button class=\"search-action-btn play-btn\" title=\"Play Now\">
                            <i class=\"fas fa-play\"></i>
                        </button>
                        <button class=\"search-action-btn queue-btn\" title=\"Add to Queue\">
                            <i class=\"fas fa-plus\"></i>
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
            this.elements.opacitySlider.value = settings.opacity;
            this.elements.opacityValue.textContent = `${settings.opacity}%`;
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
            settings.opacity = parseInt(this.elements.opacitySlider.value);
        }
        
        if (this.elements.clientIdInput) {
            const clientId = this.elements.clientIdInput.value.trim();
            if (clientId) {
                localStorage.setItem(CONFIG.STORAGE.CLIENT_ID, clientId);
            }
        }
        
        window.appState.saveSettings();
        this.applyTheme();
        this.applyOpacity();
        
        this.showToast('Settings saved', 'success');
        this.hideSettings();
    }

    resetSettings() {
        window.appState.settings = { ...CONFIG.DEFAULTS };
        window.appState.saveSettings();
        
        this.loadSettingsToForm();
        this.applyTheme();
        this.applyOpacity();
        
        this.showToast('Settings reset to default', 'success');
    }

    changeTheme(event) {
        window.appState.settings.theme = event.target.value;
        this.applyTheme();
    }

    changeOpacity(event) {
        const opacity = parseInt(event.target.value);
        window.appState.settings.opacity = opacity;
        this.elements.opacityValue.textContent = `${opacity}%`;
        this.applyOpacity();
    }

    applyTheme() {
        const theme = window.appState.settings.theme;
        if (theme === 'light') {
            this.elements.overlay?.classList.add('light-theme');
        } else {
            this.elements.overlay?.classList.remove('light-theme');
        }
    }

    applyOpacity() {
        const opacity = window.appState.settings.opacity / 100;
        if (this.elements.overlay) {
            this.elements.overlay.style.opacity = opacity;
        }
    }

    // Overlay positioning and dragging
    startDrag(event) {
        this.isDragging = true;
        this.elements.overlay?.classList.add('dragging');
        
        const rect = this.elements.overlay.getBoundingClientRect();
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
        
        // Keep overlay within viewport
        const maxX = window.innerWidth - this.elements.overlay.offsetWidth;
        const maxY = window.innerHeight - this.elements.overlay.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        this.elements.overlay.style.right = 'auto';
        this.elements.overlay.style.left = `${constrainedX}px`;
        this.elements.overlay.style.top = `${constrainedY}px`;
    }

    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.elements.overlay?.classList.remove('dragging');
        
        // Save position
        const rect = this.elements.overlay.getBoundingClientRect();
        window.appState.settings.position = {
            x: rect.left,
            y: rect.top
        };
        window.appState.saveSettings();
    }

    loadStoredPosition() {
        const position = window.appState.settings.position;
        if (position) {
            this.elements.overlay.style.right = 'auto';
            this.elements.overlay.style.left = `${position.x}px`;
            this.elements.overlay.style.top = `${position.y}px`;
        }
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            this.elements.overlay?.classList.add('minimized');
            this.elements.minimizeBtn.innerHTML = '<i class=\"fas fa-plus\"></i>';
        } else {
            this.elements.overlay?.classList.remove('minimized');
            this.elements.minimizeBtn.innerHTML = '<i class=\"fas fa-minus\"></i>';
        }
    }

    hideOverlay() {
        this.elements.overlay?.classList.add('hidden');
    }

    showOverlay() {
        this.elements.overlay?.classList.remove('hidden');
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
            this.hideOverlay();
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
            <i class=\"fas ${icons[type] || icons.info} toast-icon\"></i>
            <span class=\"toast-message\">${message}</span>
            <button class=\"toast-close\">
                <i class=\"fas fa-times\"></i>
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
}

// Initialize UI Controller
window.uiController = new UIController();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}