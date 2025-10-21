// Preload script for secure communication between main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
    
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    // Resize the main window: (width: number, height: number) => Promise<{width, height}>
    resizeWindow: (width, height) => ipcRenderer.invoke('window-resize', width, height),
    
    // Spotify OAuth callback handler
    onSpotifyCallback: (callback) => {
        ipcRenderer.on('spotify-oauth-callback', (event, params) => {
            callback(params);
        });
    },
    
    // Open external URLs in the user's default browser
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Platform detection
    platform: process.platform,
    
    // Check if running in Electron
    isElectron: true
});