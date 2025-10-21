const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    isOverlayWindow: true,
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('overlay-set-ignore-mouse', !!ignore),
    onOverlayUpdate: (cb) => ipcRenderer.on('overlay-update', (event, msg) => cb(msg))
});
