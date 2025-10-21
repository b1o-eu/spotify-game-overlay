// Hotkey Management for Spotify Game Menu
class HotkeyManager {
    constructor() {
        this.activeHotkeys = new Map();
        this.isEnabled = true;
        
        this.initializeHotkeys();
        this.attachEventListeners();
    }

    // Initialize default hotkeys
    initializeHotkeys() {
        this.registerHotkey(CONFIG.HOTKEYS.TOGGLE_OVERLAY, this.toggleOverlay.bind(this));
        this.registerHotkey(CONFIG.HOTKEYS.PLAY_PAUSE, this.togglePlayPause.bind(this));
        this.registerHotkey(CONFIG.HOTKEYS.NEXT_TRACK, this.nextTrack.bind(this));
        this.registerHotkey(CONFIG.HOTKEYS.PREV_TRACK, this.previousTrack.bind(this));
        this.registerHotkey(CONFIG.HOTKEYS.VOLUME_UP, this.volumeUp.bind(this));
        this.registerHotkey(CONFIG.HOTKEYS.VOLUME_DOWN, this.volumeDown.bind(this));
    }

    // Attach global event listeners
    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        
        // Listen for focus events to disable hotkeys in input fields
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.addEventListener('focusout', this.handleFocusOut.bind(this));
    }

    // Register a new hotkey
    registerHotkey(combination, callback, description = '') {
        const normalizedCombo = this.normalizeKeyCombination(combination);
        
        this.activeHotkeys.set(normalizedCombo, {
            callback,
            description,
            originalCombo: combination
        });
    }

    // Unregister a hotkey
    unregisterHotkey(combination) {
        const normalizedCombo = this.normalizeKeyCombination(combination);
        this.activeHotkeys.delete(normalizedCombo);
    }

    // Normalize key combination string
    normalizeKeyCombination(combo) {
        return combo
            .toLowerCase()
            .split('+')
            .map(key => key.trim())
            .sort()
            .join('+');
    }

    // Parse keyboard event to key combination
    eventToKeyCombination(event) {
        const keys = [];
        
        // Add modifier keys
        if (event.ctrlKey) keys.push('ctrl');
        if (event.altKey) keys.push('alt');
        if (event.shiftKey) keys.push('shift');
        if (event.metaKey) keys.push('meta');
        
        // Add main key
        const key = event.key.toLowerCase();
        
        // Handle special keys
        const specialKeys = {
            ' ': 'space',
            'arrowup': 'up',
            'arrowdown': 'down',
            'arrowleft': 'left',
            'arrowright': 'right',
            'escape': 'esc',
            'enter': 'enter',
            'tab': 'tab',
            'backspace': 'backspace',
            'delete': 'del'
        };
        
        const finalKey = specialKeys[key] || key;
        
        // Don't add modifier keys as main keys
        if (!['ctrl', 'alt', 'shift', 'meta'].includes(finalKey)) {
            keys.push(finalKey);
        }
        
        return keys.sort().join('+');
    }

    // Handle keydown events
    handleKeyDown(event) {
        if (!this.isEnabled) return;
        
        // Skip if typing in input fields
        if (this.isTypingInInput(event.target)) return;
        
        const combination = this.eventToKeyCombination(event);
        const hotkey = this.activeHotkeys.get(combination);
        
        if (hotkey) {
            event.preventDefault();
            event.stopPropagation();
            
            try {
                hotkey.callback(event);
            } catch (error) {
                console.error('Hotkey callback error:', error);
            }
        }
    }

    // Handle keyup events
    handleKeyUp(event) {
        // Currently not used, but available for future functionality
    }

    // Check if user is typing in an input field
    isTypingInInput(element) {
        const inputTypes = ['input', 'textarea', 'select'];
        const tagName = element.tagName.toLowerCase();
        
        return inputTypes.includes(tagName) || 
               element.contentEditable === 'true' ||
               element.closest('[contenteditable=\"true\"]');
    }

    // Handle focus in events
    handleFocusIn(event) {
        if (this.isTypingInInput(event.target)) {
            this.tempDisable();
        }
    }

    // Handle focus out events
    handleFocusOut(event) {
        if (this.isTypingInInput(event.target)) {
            this.tempEnable();
        }
    }

    // Temporarily disable hotkeys
    tempDisable() {
        this.isEnabled = false;
    }

    // Re-enable hotkeys
    tempEnable() {
        this.isEnabled = true;
    }

    // Enable/disable hotkeys globally
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    // Hotkey action methods
    toggleOverlay() {
        // In Electron, this will toggle the visibility of the overlay window.
        if (window.electronAPI && window.electronAPI.isElectron) {
            window.electronAPI.toggleOverlay();
            // We don't know the new state, so a generic toast is best.
            window.uiController?.showToast('Overlay toggled', 'info');
            return;
        }
        // Fallback for web version if needed in the future.
    }

    async togglePlayPause() {
        if (window.uiController && window.spotifyAPI.isAuthenticated()) {
            try {
                await window.uiController.togglePlayPause();
            } catch (error) {
                console.error('Hotkey play/pause error:', error);
            }
        }
    }

    async nextTrack() {
        if (window.uiController && window.spotifyAPI.isAuthenticated()) {
            try {
                await window.uiController.nextTrack();
            } catch (error) {
                console.error('Hotkey next track error:', error);
            }
        }
    }

    async previousTrack() {
        if (window.uiController && window.spotifyAPI.isAuthenticated()) {
            try {
                await window.uiController.previousTrack();
            } catch (error) {
                console.error('Hotkey previous track error:', error);
            }
        }
    }

    async volumeUp() {
        if (window.spotifyAPI.isAuthenticated()) {
            try {
                const currentState = window.appState.getCurrentState();
                const currentVolume = currentState.playbackState?.device?.volume_percent || 50;
                const newVolume = Math.min(100, currentVolume + 10);
                
                await window.spotifyAPI.setVolume(newVolume);
                window.uiController?.showToast(`Volume: ${newVolume}%`, 'info');
                
                // Update UI slider
                const volumeSlider = document.getElementById('volume-slider');
                if (volumeSlider) {
                    volumeSlider.value = newVolume;
                }
            } catch (error) {
                console.error('Hotkey volume up error:', error);
            }
        }
    }

    async volumeDown() {
        if (window.spotifyAPI.isAuthenticated()) {
            try {
                const currentState = window.appState.getCurrentState();
                const currentVolume = currentState.playbackState?.device?.volume_percent || 50;
                const newVolume = Math.max(0, currentVolume - 10);
                
                await window.spotifyAPI.setVolume(newVolume);
                window.uiController?.showToast(`Volume: ${newVolume}%`, 'info');
                
                // Update UI slider
                const volumeSlider = document.getElementById('volume-slider');
                if (volumeSlider) {
                    volumeSlider.value = newVolume;
                }
            } catch (error) {
                console.error('Hotkey volume down error:', error);
            }
        }
    }

    // Get all registered hotkeys for display
    getRegisteredHotkeys() {
        const hotkeys = [];
        
        for (const [combination, data] of this.activeHotkeys.entries()) {
            hotkeys.push({
                combination: data.originalCombo,
                description: data.description,
                normalized: combination
            });
        }
        
        return hotkeys;
    }

    // Update hotkey combination
    updateHotkey(oldCombination, newCombination, callback, description) {
        this.unregisterHotkey(oldCombination);
        this.registerHotkey(newCombination, callback, description);
    }

    // Load hotkeys from a settings object (expected keys match CONFIG.HOTKEYS keys)
    applyHotkeysFromSettings(settingsHotkeys) {
        if (!settingsHotkeys || typeof settingsHotkeys !== 'object') return;

        const actionMap = {
            TOGGLE_OVERLAY: this.toggleOverlay.bind(this),
            PLAY_PAUSE: this.togglePlayPause.bind(this),
            NEXT_TRACK: this.nextTrack.bind(this),
            PREV_TRACK: this.previousTrack.bind(this),
            VOLUME_UP: this.volumeUp.bind(this),
            VOLUME_DOWN: this.volumeDown.bind(this)
        };

        this.clearAllHotkeys();

        for (const [action, combo] of Object.entries(settingsHotkeys)) {
            const callback = actionMap[action];
            if (callback && combo) {
                try {
                    this.registerHotkey(combo, callback, action);
                } catch (e) {
                    console.warn('[HotkeyManager] Failed to register', action, combo, e);
                }
            }
        }
    }

    // Utility: capture a key combination from a keyboard event and return normalized combo
    captureComboFromEvent(event) {
        return this.eventToKeyCombination(event);
    }

    // Clear all hotkeys
    clearAllHotkeys() {
        this.activeHotkeys.clear();
    }

    // Export hotkeys configuration
    exportConfiguration() {
        const config = {};
        
        for (const [combination, data] of this.activeHotkeys.entries()) {
            config[combination] = {
                originalCombo: data.originalCombo,
                description: data.description
            };
        }
        
        return config;
    }

    // Import hotkeys configuration
    importConfiguration(config) {
        this.clearAllHotkeys();
        
        const actionMap = {
            [CONFIG.HOTKEYS.TOGGLE_OVERLAY]: this.toggleOverlay.bind(this),
            [CONFIG.HOTKEYS.PLAY_PAUSE]: this.togglePlayPause.bind(this),
            [CONFIG.HOTKEYS.NEXT_TRACK]: this.nextTrack.bind(this),
            [CONFIG.HOTKEYS.PREV_TRACK]: this.previousTrack.bind(this),
            [CONFIG.HOTKEYS.VOLUME_UP]: this.volumeUp.bind(this),
            [CONFIG.HOTKEYS.VOLUME_DOWN]: this.volumeDown.bind(this)
        };
        
        for (const [combination, data] of Object.entries(config)) {
            const callback = actionMap[data.originalCombo];
            if (callback) {
                this.registerHotkey(data.originalCombo, callback, data.description);
            }
        }
    }
}

// Global hotkey utilities
const HotkeyUtils = {
    // Format key combination for display
    formatKeyCombination(combo) {
        return combo
            .split('+')
            .map(key => {
                const capitalize = key.charAt(0).toUpperCase() + key.slice(1);
                const keyMap = {
                    'Ctrl': '⌃',
                    'Alt': '⌥',
                    'Shift': '⇧',
                    'Meta': '⌘',
                    'Space': '␣',
                    'Left': '←',
                    'Right': '→',
                    'Up': '↑',
                    'Down': '↓',
                    'Enter': '↵',
                    'Tab': '⇥',
                    'Esc': '⎋',
                    'Backspace': '⌫',
                    'Del': '⌦'
                };
                
                return keyMap[capitalize] || capitalize;
            })
            .join(' + ');
    },

    // Validate key combination
    isValidKeyCombination(combo) {
        if (!combo || typeof combo !== 'string') return false;
        
        const parts = combo.toLowerCase().split('+').map(s => s.trim());
        const validModifiers = ['ctrl', 'alt', 'shift', 'meta'];
        const validKeys = [
            'space', 'enter', 'tab', 'esc', 'backspace', 'delete',
            'up', 'down', 'left', 'right',
            'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'
        ];
        
        // Check if it has at least one modifier and one main key
        const hasModifier = parts.some(part => validModifiers.includes(part));
        const hasMainKey = parts.some(part => 
            !validModifiers.includes(part) && 
            (validKeys.includes(part) || part.match(/^[a-z0-9]$/))
        );
        
        return hasModifier && hasMainKey;
    },

    // Get platform-specific modifier names
    getPlatformModifiers() {
        const platform = navigator.platform.toLowerCase();
        const isMac = platform.includes('mac');
        
        return {
            ctrl: isMac ? '⌃' : 'Ctrl',
            alt: isMac ? '⌥' : 'Alt',
            shift: isMac ? '⇧' : 'Shift',
            meta: isMac ? '⌘' : 'Win'
        };
    }
};

// Initialize Hotkey Manager
window.hotkeyManager = new HotkeyManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HotkeyManager, HotkeyUtils };
}

// Apply saved hotkeys from appState (if available). This allows hotkeys persisted in settings
// to override the defaults on startup.
try {
    if (window.appState && window.appState.settings && window.appState.settings.hotkeys) {
        window.hotkeyManager.applyHotkeysFromSettings(window.appState.settings.hotkeys);
    } else if (window.appState && window.appState.settings && window.appState.settings.hotkeys === undefined) {
        // If no custom hotkeys stored yet, seed from CONFIG.DEFAULTS.hotkeys if present
        if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULTS && CONFIG.DEFAULTS.hotkeys) {
            window.hotkeyManager.applyHotkeysFromSettings(CONFIG.DEFAULTS.hotkeys);
        }
    }
} catch (e) {
    console.warn('[hotkeys] Could not apply saved hotkeys on startup', e);
}