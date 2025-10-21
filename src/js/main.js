// Main Application Entry Point for Spotify Game Menu
class SpotifyGameMenu {
    constructor() {
        this.initialized = false;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 3;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Spotify Game Menu...');
            
            // Wait for DOM to be fully loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }
            
            // Initialize components in order
            await this.initializeComponents();
            
            // Setup initial state
            await this.setupInitialState();
            
            // Start application
            await this.startApplication();
            
            this.initialized = true;
            console.log('Spotify Game Menu initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize menu:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeComponents() {
        // All components are already initialized via their constructors
        // when the scripts are loaded, so we just need to verify they exist
        
        if (!window.appState) {
            throw new Error('App State not initialized');
        }
        
        if (!window.spotifyAPI) {
            throw new Error('Spotify API not initialized');
        }
        
        if (!window.uiController) {
            throw new Error('UI Controller not initialized');
        }
        
        if (!window.hotkeyManager) {
            throw new Error('Hotkey Manager not initialized');
        }
        
        console.log('All components verified');
    }

    async setupInitialState() {
        // Apply saved settings
        window.uiController.applyTheme();
        window.uiController.applyOpacity();
        
        // Check if user is already authenticated
        if (window.spotifyAPI.isAuthenticated()) {
            console.log('User already authenticated');
            window.appState.updateConnectionStatus(true);
            
            // Start getting current playback state
            try {
                await window.spotifyAPI.getCurrentPlayback();
                await window.spotifyAPI.getQueue();
            } catch (error) {
                console.warn('Failed to get initial playback state:', error);
            }
        } else {
            console.log('User not authenticated');
            window.appState.updateConnectionStatus(false);
        }
        
        // Load initial UI state
        this.updateUIFromState();

        // Register global hotkeys if user enabled them (Electron only)
        try {
            if (window.uiController && typeof window.uiController.registerGlobalHotkeysIfEnabled === 'function') {
                await window.uiController.registerGlobalHotkeysIfEnabled();
            }
        } catch (e) {
            console.error('[App] registerGlobalHotkeysIfEnabled failed:', e);
        }
    }

    async startApplication() {
        // Start periodic updates if authenticated
        if (window.spotifyAPI.isAuthenticated()) {
            window.spotifyAPI.startPeriodicUpdates();
        }
        
        // Setup error handling
        this.setupErrorHandlers();
        
        // Setup window events
        this.setupWindowEvents();
        
        // Show welcome message if first time user
        this.showWelcomeMessage();
    }

    updateUIFromState() {
        const state = window.appState.getCurrentState();
        
        // Update now playing
        if (state.currentTrack) {
            window.uiController.updateNowPlaying(state.currentTrack);
        }
        
        // Update playback controls
        if (state.playbackState) {
            window.uiController.updatePlaybackControls(state.playbackState);
            window.uiController.updateProgress(state.playbackState);
        }
        
        // Update connection status
        window.uiController.updateConnectionStatus(state.isConnected);
        
        // Update queue
        if (state.queue && state.queue.length > 0) {
            window.uiController.updateQueue(state.queue);
        }
    }

    setupErrorHandlers() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error);
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason);
        });
        
        // Spotify API error handler
        window.addEventListener('appStateChange', (event) => {
            if (event.detail.type === 'error') {
                this.handleError(event.detail.data);
            }
        });
    }

    setupWindowEvents() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // Handle window beforeunload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Handle visibility change (for pausing updates when tab is hidden)
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            console.log('Connection restored');
            if (window.spotifyAPI.isAuthenticated()) {
                window.spotifyAPI.startPeriodicUpdates();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('Connection lost');
            window.spotifyAPI.stopPeriodicUpdates();
            window.uiController.showToast('Connection lost', 'warning');
        });
    }

    handleWindowResize() {
        // Ensure menu stays within viewport bounds
        const menuEl = document.getElementById('spotify-menu');
        if (!menuEl) return;
        
        const rect = menuEl.getBoundingClientRect();
        const maxX = window.innerWidth - menuEl.offsetWidth;
        const maxY = window.innerHeight - menuEl.offsetHeight;
        
        if (rect.left > maxX || rect.top > maxY) {
            const newX = Math.max(0, Math.min(rect.left, maxX));
            const newY = Math.max(0, Math.min(rect.top, maxY));
            
            menuEl.style.left = `${newX}px`;
            menuEl.style.top = `${newY}px`;
            
            // Save new position
            window.appState.settings.position = { x: newX, y: newY };
            window.appState.saveSettings();
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Reduce update frequency when tab is hidden
            console.log('Tab hidden, reducing update frequency');
        } else {
            // Resume normal updates when tab is visible
            console.log('Tab visible, resuming normal updates');
            if (window.spotifyAPI.isAuthenticated()) {
                // Get fresh data
                window.spotifyAPI.getCurrentPlayback().catch(console.error);
            }
        }
    }

    showWelcomeMessage() {
        const hasShownWelcome = localStorage.getItem('spotify_menu_welcome_shown');
        
        if (!hasShownWelcome && !window.spotifyAPI.isAuthenticated()) {
            setTimeout(() => {
                window.uiController.showToast(
                    'Welcome! Click settings to configure your Spotify Client ID',
                    'info',
                    5000
                );
                localStorage.setItem('spotify_menu_welcome_shown', 'true');
            }, 1000);
        }
    }

    handleError(error) {
        console.error('Application error:', error);
        
        // Show user-friendly error message
        let message = 'An error occurred';
        
        if (error.message) {
            if (error.message.includes('Authentication')) {
                message = 'Authentication error. Please reconnect to Spotify.';
            } else if (error.message.includes('Network')) {
                message = 'Network error. Please check your connection.';
            } else if (error.message.includes('API')) {
                message = 'Spotify API error. Please try again.';
            } else {
                message = error.message;
            }
        }
        
        window.uiController.showToast(message, 'error');
        
        // Log to console for debugging
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    handleInitializationError(error) {
        console.error('Initialization error:', error);
        
        // Retry initialization if possible
        if (this.retryAttempts < this.maxRetryAttempts) {
            this.retryAttempts++;
            console.log(`Retrying initialization (${this.retryAttempts}/${this.maxRetryAttempts})...`);
            
            setTimeout(() => {
                this.init();
            }, 2000 * this.retryAttempts); // Exponential backoff
        } else {
            // Show error to user
            document.body.innerHTML = `
                <div style=\"
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: #121212;
                    color: #ffffff;
                    font-family: 'Segoe UI', sans-serif;
                    text-align: center;
                    padding: 20px;
                \">
                            <div>
                                <h1 style=\"color: #ff4444; margin-bottom: 20px;\">Initialization Failed</h1>
                                <p style=\"margin-bottom: 20px; color: #b3b3b3;\">The Spotify Game Menu failed to initialize properly.</p>
                        <p style=\"margin-bottom: 20px; color: #b3b3b3;\">
                            Error: ${error.message || 'Unknown error'}
                        </p>
                        <button onclick=\"window.location.reload()\" style=\"
                            background: #1db954;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                        \">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    cleanup() {
        console.log('Cleaning up application...');
        
        // Stop periodic updates
        if (window.spotifyAPI) {
            window.spotifyAPI.stopPeriodicUpdates();
        }
        
        // Clear any pending timeouts/intervals
        // (Individual components should handle their own cleanup)
        
        // Save current state
        if (window.appState) {
            window.appState.saveSettings();
        }
    }

    // Public API methods
    restart() {
        console.log('Restarting application...');
        this.cleanup();
        this.retryAttempts = 0;
        this.initialized = false;
        this.init();
    }

    getStatus() {
        return {
            initialized: this.initialized,
            authenticated: window.spotifyAPI ? window.spotifyAPI.isAuthenticated() : false,
            connected: window.appState ? window.appState.isConnected : false,
            currentTrack: window.appState ? window.appState.currentTrack : null,
            isPlaying: window.appState ? window.appState.isPlaying : false
        };
    }

    // Debug methods
    enableDebugMode() {
        window.DEBUG_MODE = true;
        console.log('Debug mode enabled');
        
        // Add debug info to overlay
        const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
        debugInfo.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: #00ff00;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10002;
            max-width: 300px;
        `;
        document.body.appendChild(debugInfo);
        
        // Update debug info periodically
        setInterval(() => {
            if (window.DEBUG_MODE) {
                this.updateDebugInfo();
            }
        }, 1000);
    }

    updateDebugInfo() {
        const debugElement = document.getElementById('debug-info');
        if (!debugElement) return;
        
        const status = this.getStatus();
        const state = window.appState ? window.appState.getCurrentState() : {};
        
        debugElement.innerHTML = `
            <strong>Spotify Game Menu Debug</strong><br>
            Initialized: ${status.initialized}<br>
            Authenticated: ${status.authenticated}<br>
            Connected: ${status.connected}<br>
            Playing: ${status.isPlaying}<br>
            Track: ${state.currentTrack?.name || 'None'}<br>
            Position: ${Utils.formatTime(state.position)}<br>
            Duration: ${Utils.formatTime(state.duration)}<br>
            Queue Items: ${state.queue?.length || 0}<br>
            Hotkeys Enabled: ${window.hotkeyManager?.isEnabled || false}
        `;
    }
}

// Initialize the application when the script loads
const app = new SpotifyGameMenu();

// Make app available globally for debugging
window.spotifyMenuApp = app;

// Add some helpful global functions
window.debugMenu = () => app.enableDebugMode();
window.restartMenu = () => app.restart();
window.getMenuStatus = () => app.getStatus();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpotifyGameMenu;
}