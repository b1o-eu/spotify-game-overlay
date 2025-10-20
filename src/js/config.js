// Configuration and constants for Spotify Game Overlay
const CONFIG = {
    // Spotify API Configuration
    SPOTIFY: {
        CLIENT_ID: '', // To be set by user in settings
        REDIRECT_URI: (() => {
            // Check if running in Electron
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) {
                return 'spotify-overlay://callback';
            }
            // Fallback for web version
            return 'http://127.0.0.1:5500/callback.html';
        })(),
        SCOPES: [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'user-library-read',
            'user-library-modify',
            'playlist-read-private',
            'playlist-read-collaborative',
            'user-read-recently-played',
            'user-top-read'
        ].join(' '),
        API_BASE_URL: 'https://api.spotify.com/v1',
        ACCOUNTS_BASE_URL: 'https://accounts.spotify.com'
    },

    // UI Configuration
    UI: {
        UPDATE_INTERVAL: 1000, // Update current playback every second
        SEARCH_DEBOUNCE: 300, // Debounce search input
        TOAST_DURATION: 3000, // Toast notification duration
        MAX_SEARCH_RESULTS: 20,
        MAX_QUEUE_ITEMS: 50
    },

    // Hotkeys Configuration
    HOTKEYS: {
        TOGGLE_OVERLAY: 'ctrl+shift+m',
        PLAY_PAUSE: 'ctrl+shift+space',
        NEXT_TRACK: 'ctrl+shift+right',
        PREV_TRACK: 'ctrl+shift+left',
        VOLUME_UP: 'ctrl+shift+up',
        VOLUME_DOWN: 'ctrl+shift+down'
    },

    // Storage Keys
    STORAGE: {
        ACCESS_TOKEN: 'spotify_access_token',
        REFRESH_TOKEN: 'spotify_refresh_token',
        TOKEN_EXPIRY: 'spotify_token_expiry',
        CLIENT_ID: 'spotify_client_id',
        SETTINGS: 'overlay_settings',
        THEME: 'overlay_theme',
        POSITION: 'overlay_position',
        OPACITY: 'overlay_opacity'
    },

    // Default Settings
    DEFAULTS: {
        theme: 'dark',
        opacity: 95,
        position: { x: 20, y: 20 },
        autoHide: false,
        showNotifications: true,
        volume: 50
    }
};

// App State Management
class AppState {
    constructor() {
        this.currentTrack = null;
        this.playbackState = null;
        this.queue = [];
        this.searchResults = [];
        this.isConnected = false;
        this.isPlaying = false;
        this.position = 0;
        this.duration = 0;
        this.volume = 50;
        this.shuffleState = false;
        this.repeatState = 'off'; // 'off', 'context', 'track'
        this.device = null;
        this.settings = { ...CONFIG.DEFAULTS };
        
        this.loadSettings();
    }

    // Load settings from localStorage
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem(CONFIG.STORAGE.SETTINGS);
            if (savedSettings) {
                this.settings = { ...CONFIG.DEFAULTS, ...JSON.parse(savedSettings) };
            }
            
            // Load individual settings
            const theme = localStorage.getItem(CONFIG.STORAGE.THEME);
            if (theme) this.settings.theme = theme;
            
            const opacity = localStorage.getItem(CONFIG.STORAGE.OPACITY);
            if (opacity) this.settings.opacity = parseInt(opacity);
            
            const position = localStorage.getItem(CONFIG.STORAGE.POSITION);
            if (position) this.settings.position = JSON.parse(position);
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = { ...CONFIG.DEFAULTS };
        }
    }

    // Save settings to localStorage
    saveSettings() {
        try {
            localStorage.setItem(CONFIG.STORAGE.SETTINGS, JSON.stringify(this.settings));
            localStorage.setItem(CONFIG.STORAGE.THEME, this.settings.theme);
            localStorage.setItem(CONFIG.STORAGE.OPACITY, this.settings.opacity.toString());
            localStorage.setItem(CONFIG.STORAGE.POSITION, JSON.stringify(this.settings.position));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    // Update current track info
    updateCurrentTrack(track) {
        this.currentTrack = track;
        this.notifyStateChange('currentTrack', track);
    }

    // Update playback state
    updatePlaybackState(state) {
        this.playbackState = state;
        this.isPlaying = state?.is_playing || false;
        this.position = state?.progress_ms || 0;
        this.duration = state?.item?.duration_ms || 0;
        this.shuffleState = state?.shuffle_state || false;
        this.repeatState = state?.repeat_state || 'off';
        this.device = state?.device || null;
        
        if (state?.item) {
            this.updateCurrentTrack(state.item);
        }
        
        this.notifyStateChange('playbackState', state);
    }

    // Update connection status
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        this.notifyStateChange('connectionStatus', connected);
    }

    // Update queue
    updateQueue(queue) {
        this.queue = queue || [];
        this.notifyStateChange('queue', this.queue);
    }

    // Update search results
    updateSearchResults(results) {
        this.searchResults = results || [];
        this.notifyStateChange('searchResults', this.searchResults);
    }

    // State change notification system
    notifyStateChange(type, data) {
        window.dispatchEvent(new CustomEvent('appStateChange', {
            detail: { type, data }
        }));
    }

    // Get current state
    getCurrentState() {
        return {
            currentTrack: this.currentTrack,
            playbackState: this.playbackState,
            queue: this.queue,
            searchResults: this.searchResults,
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            position: this.position,
            duration: this.duration,
            volume: this.volume,
            shuffleState: this.shuffleState,
            repeatState: this.repeatState,
            device: this.device,
            settings: this.settings
        };
    }
}

// Utility Functions
const Utils = {
    // Format time in milliseconds to MM:SS format
    formatTime(ms) {
        if (!ms || ms < 0) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    // Debounce function for search input
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function for API calls
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Safe JSON parse
    safeJsonParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch {
            return defaultValue;
        }
    },

    // Generate random string for OAuth state
    generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    },

    // Generate PKCE code verifier (URL-safe)
    generateCodeVerifier(length = 128) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let text = '';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    },

    // Get URL parameters
    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    },

    // Get hash parameters (for OAuth callback)
    getHashParams() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const result = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }
};

// Initialize global app state
window.appState = new AppState();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, AppState, Utils };
}