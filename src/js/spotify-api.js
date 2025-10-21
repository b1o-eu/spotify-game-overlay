// Spotify Web API Integration
class SpotifyAPI {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.clientId = null;
        
        this.loadTokens();
        // Initialize from callback asynchronously
        setTimeout(() => this.initializeFromCallback(), 0);
    }

    // Load stored tokens
    loadTokens() {
        this.accessToken = localStorage.getItem(CONFIG.STORAGE.ACCESS_TOKEN);
        this.refreshToken = localStorage.getItem(CONFIG.STORAGE.REFRESH_TOKEN);
        this.clientId = localStorage.getItem(CONFIG.STORAGE.CLIENT_ID);
        
        const expiry = localStorage.getItem(CONFIG.STORAGE.TOKEN_EXPIRY);
        this.tokenExpiry = expiry ? new Date(expiry) : null;
    }

    // Save tokens to localStorage
    saveTokens() {
        if (this.accessToken) {
            localStorage.setItem(CONFIG.STORAGE.ACCESS_TOKEN, this.accessToken);
        }
        if (this.refreshToken) {
            localStorage.setItem(CONFIG.STORAGE.REFRESH_TOKEN, this.refreshToken);
        }
        if (this.tokenExpiry) {
            localStorage.setItem(CONFIG.STORAGE.TOKEN_EXPIRY, this.tokenExpiry.toISOString());
        }
        if (this.clientId) {
            localStorage.setItem(CONFIG.STORAGE.CLIENT_ID, this.clientId);
        }
    }

    // Initialize from OAuth callback
    async initializeFromCallback() {
        // Listen for messages from the callback window (Electron or popup flow)
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }

            const { type, code, error } = event.data || {};
            if (type === 'spotify-auth-code' && code) {
                this.handleOAuthCallback(`?code=${code}`);
            } else if (type === 'spotify-auth-error') {
                console.error('OAuth error from callback:', error);
            }
        });

        // Handle web-based OAuth callback (redirect to callback.html)
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        if (authCode) {
            this.handleOAuthCallback(urlParams.toString());
        }

        // Electron: listen for callback forwarded from main process via IPC
        if (window.electronAPI && typeof window.electronAPI.onSpotifyCallback === 'function') {
            window.electronAPI.onSpotifyCallback((params) => {
                try {
                    this.handleOAuthCallback(params);
                } catch (e) {
                    console.error('Failed to handle Electron OAuth callback:', e);
                }
            });
        }
    }

    // Handle OAuth callback from either web or Electron
    async handleOAuthCallback(params) {
        const urlParams = new URLSearchParams(params);
        const authCode = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth error:', error);
            try {
                if (window.uiController && typeof window.uiController.showToast === 'function') {
                    const err = String(error).toLowerCase();
                    if (err.includes('insecure')) {
                        window.uiController.showToast('Spotify rejected the redirect URI as insecure. Add http://localhost:8080/callback to your Spotify app Redirect URIs.', 'error', 6000);
                    } else if (err.includes('invalid')) {
                        window.uiController.showToast('Spotify says the redirect URI is invalid. Ensure it exactly matches your app settings.', 'error', 6000);
                    } else {
                        window.uiController.showToast(`Spotify auth error: ${error}`,'error',5000);
                    }
                }
            } catch(_) {}
            return;
        }
        
        if (authCode) {
            try {
                await this.exchangeCodeForToken(authCode);
                
                // Clean up URL (only for web version)
                if (!window.electronAPI || !window.electronAPI.isElectron) {
                    window.history.replaceState(null, null, window.location.pathname);
                }
                
                // Update connection status
                window.appState.updateConnectionStatus(true);
                
                // Start periodic updates
                this.startPeriodicUpdates();
            } catch (error) {
                console.error('Failed to exchange code for token:', error);
                // Handle error appropriately
            }
        }
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(authCode) {
        const codeVerifier = localStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) {
            throw new Error('No code verifier found');
        }
        
        try {
            const response = await fetch(`${CONFIG.SPOTIFY.ACCOUNTS_BASE_URL}/api/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: authCode,
                    redirect_uri: CONFIG.SPOTIFY.REDIRECT_URI,
                    client_id: this.clientId,
                    code_verifier: codeVerifier
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to exchange code for token');
            }
            
            const data = await response.json();
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
            
            this.saveTokens();
            
            // Clean up code verifier
            localStorage.removeItem('spotify_code_verifier');
            
        } catch (error) {
            console.error('Token exchange failed:', error);
            localStorage.removeItem('spotify_code_verifier');
            throw error;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry;
    }

    // Generate PKCE challenge
    generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        return crypto.subtle.digest('SHA-256', data).then(digest => {
            return btoa(String.fromCharCode(...new Uint8Array(digest)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        });
    }

    // Start OAuth authentication flow with PKCE
    async authenticate(clientId) {
        if (!clientId) {
            throw new Error('Client ID is required');
        }
        
        this.clientId = clientId;
        localStorage.setItem(CONFIG.STORAGE.CLIENT_ID, clientId);
        
        const state = Utils.generateRandomString(16);
        const codeVerifier = Utils.generateCodeVerifier(128);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        const scope = CONFIG.SPOTIFY.SCOPES;
        
        // Store code verifier for later use
        localStorage.setItem('spotify_code_verifier', codeVerifier);
        
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            scope: scope,
            redirect_uri: CONFIG.SPOTIFY.REDIRECT_URI,
            state: state,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });
        
        const authUrl = `${CONFIG.SPOTIFY.ACCOUNTS_BASE_URL}/authorize?${params}`;
        console.debug('[SpotifyAPI] Using redirect URI:', CONFIG.SPOTIFY.REDIRECT_URI);
        
        // Check if running in Electron
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) {
            // Open a popup window for Spotify authentication
            console.debug('[SpotifyAPI] Opening auth URL in Electron:', authUrl);
            const authWindow = window.open(authUrl, 'SpotifyAuth', 'width=500,height=600');
        } else {
            // In web browser, redirect to auth URL
            console.debug('[SpotifyAPI] Opening auth URL in web:', authUrl);
            window.location.href = authUrl;
        }
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        try {
            const response = await fetch(`${CONFIG.SPOTIFY.ACCOUNTS_BASE_URL}/api/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                    client_id: this.clientId
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }
            
            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
            
            if (data.refresh_token) {
                this.refreshToken = data.refresh_token;
            }
            
            this.saveTokens();
            
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.logout();
            throw error;
        }
    }

    // Make authenticated API request
    async apiRequest(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            if (this.refreshToken) {
                await this.refreshAccessToken();
            } else {
                throw new Error('Not authenticated');
            }
        }
        
        const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.SPOTIFY.API_BASE_URL}${endpoint}`;
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token expired, try to refresh
            if (this.refreshToken) {
                await this.refreshAccessToken();
                return this.apiRequest(endpoint, options);
            } else {
                this.logout();
                throw new Error('Authentication expired');
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
        }
        
        return response.json();
    }

    // Get current playback state
    async getCurrentPlayback() {
        try {
            const data = await this.apiRequest('/me/player');
            window.appState.updatePlaybackState(data);
            return data;
        } catch (error) {
            if (error.message.includes('404')) {
                // No active device
                window.appState.updatePlaybackState(null);
                return null;
            }
            throw error;
        }
    }

    // Get current playing track
    async getCurrentlyPlaying() {
        try {
            const data = await this.apiRequest('/me/player/currently-playing');
            if (data && data.item) {
                window.appState.updateCurrentTrack(data.item);
            }
            return data;
        } catch (error) {
            console.error('Failed to get currently playing:', error);
            return null;
        }
    }

    // Playback control methods
    async play(contextUri = null, trackUris = null) {
        const body = {};
        if (contextUri) body.context_uri = contextUri;
        if (trackUris) body.uris = trackUris;
        
        return this.apiRequest('/me/player/play', {
            method: 'PUT',
            body: Object.keys(body).length ? JSON.stringify(body) : undefined
        });
    }

    async pause() {
        return this.apiRequest('/me/player/pause', { method: 'PUT' });
    }

    async next() {
        return this.apiRequest('/me/player/next', { method: 'POST' });
    }

    async previous() {
        return this.apiRequest('/me/player/previous', { method: 'POST' });
    }

    async seek(positionMs) {
        return this.apiRequest(`/me/player/seek?position_ms=${positionMs}`, { method: 'PUT' });
    }

    async setVolume(volumePercent) {
        return this.apiRequest(`/me/player/volume?volume_percent=${volumePercent}`, { method: 'PUT' });
    }

    async setShuffle(state) {
        return this.apiRequest(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
    }

    async setRepeat(state) {
        return this.apiRequest(`/me/player/repeat?state=${state}`, { method: 'PUT' });
    }

    // Get user's queue
    async getQueue() {
        try {
            const data = await this.apiRequest('/me/player/queue');
            console.log('Queue data received:', data); // Debug log
            
            if (data && data.queue) {
                window.appState.updateQueue(data.queue);
            } else {
                console.warn('No queue data in response:', data);
                window.appState.updateQueue([]);
            }
            return data;
        } catch (error) {
            console.error('Failed to get queue:', error);
            // Don't clear the queue on error, keep existing state
            return null;
        }
    }

    // Add track to queue
    async addToQueue(trackUri) {
        try {
            console.log('Adding track to queue:', trackUri);
            const response = await this.apiRequest(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`, { method: 'POST' });
            console.log('Successfully added track to queue');
            return response;
        } catch (error) {
            console.error('Failed to add track to queue:', error);
            throw error;
        }
    }

    // Search for tracks, artists, albums, playlists
    async search(query, types = ['track'], limit = 20) {
        if (!query.trim()) {
            window.appState.updateSearchResults([]);
            return { tracks: { items: [] } };
        }
        
        try {
            const params = new URLSearchParams({
                q: query,
                type: types.join(','),
                limit: limit
            });
            
            const data = await this.apiRequest(`/search?${params}`);
            
            // Format search results for UI
            const results = [];
            if (data.tracks && data.tracks.items) {
                results.push(...data.tracks.items.map(track => ({
                    ...track,
                    type: 'track'
                })));
            }
            if (data.artists && data.artists.items) {
                results.push(...data.artists.items.map(artist => ({
                    ...artist,
                    type: 'artist'
                })));
            }
            if (data.albums && data.albums.items) {
                results.push(...data.albums.items.map(album => ({
                    ...album,
                    type: 'album'
                })));
            }
            if (data.playlists && data.playlists.items) {
                results.push(...data.playlists.items.map(playlist => ({
                    ...playlist,
                    type: 'playlist'
                })));
            }
            
            window.appState.updateSearchResults(results);
            return data;
        } catch (error) {
            console.error('Search failed:', error);
            window.appState.updateSearchResults([]);
            throw error;
        }
    }

    // Get user's devices
    async getDevices() {
        try {
            return await this.apiRequest('/me/player/devices');
        } catch (error) {
            console.error('Failed to get devices:', error);
            return { devices: [] };
        }
    }

    // Transfer playback to device
    async transferPlayback(deviceId, play = false) {
        return this.apiRequest('/me/player', {
            method: 'PUT',
            body: JSON.stringify({
                device_ids: [deviceId],
                play: play
            })
        });
    }

    // Get user profile
    async getUserProfile() {
        try {
            return await this.apiRequest('/me');
        } catch (error) {
            console.error('Failed to get user profile:', error);
            return null;
        }
    }

    // Start periodic updates
    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.queueUpdateInterval) {
            clearInterval(this.queueUpdateInterval);
        }
        
        // Update playback state every second
        this.updateInterval = setInterval(async () => {
            try {
                await this.getCurrentPlayback();
            } catch (error) {
                console.error('Periodic playback update failed:', error);
                // If authentication fails, stop updates
                if (error.message.includes('Authentication')) {
                    this.stopPeriodicUpdates();
                    window.appState.updateConnectionStatus(false);
                }
            }
        }, CONFIG.UI.UPDATE_INTERVAL);
        
        // Update queue every 5 seconds (less frequently)
        this.queueUpdateInterval = setInterval(async () => {
            try {
                await this.getQueue();
            } catch (error) {
                console.error('Periodic queue update failed:', error);
            }
        }, CONFIG.UI.UPDATE_INTERVAL * 5);
    }

    // Stop periodic updates
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.queueUpdateInterval) {
            clearInterval(this.queueUpdateInterval);
            this.queueUpdateInterval = null;
        }
    }

    // Logout and clear tokens
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        
        // Clear localStorage
        localStorage.removeItem(CONFIG.STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE.REFRESH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE.TOKEN_EXPIRY);
        
        // Stop updates
        this.stopPeriodicUpdates();
        
        // Update state
        window.appState.updateConnectionStatus(false);
        window.appState.updatePlaybackState(null);
        window.appState.updateCurrentTrack(null);
        window.appState.updateQueue([]);
    }
}

// Initialize Spotify API instance
window.spotifyAPI = new SpotifyAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpotifyAPI;
}