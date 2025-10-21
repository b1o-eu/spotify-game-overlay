// Electron Main Process for Spotify Game Menu
const { app, BrowserWindow, protocol, shell, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { URL } = require('url');
const http = require('http');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;
let tray = null;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit'
        });
    } catch (_) {}
}



function createWindow() {
    // Create the main application window as a frameless, menu-like window
    // so the menu DOM becomes the visible window and can be dragged via CSS.
    mainWindow = new BrowserWindow({
    width: 400,
    height: 625,
    minWidth: 360,
    minHeight: 400,
        frame: false, // Frameless so we can style and drag via CSS
        transparent: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false // Don't show until ready
    });

    // Try to disable the OS-level window shadow where supported (Windows/macOS).
    // setHasShadow is available on BrowserWindow instances on supported platforms.
    try {
        if (typeof mainWindow.setHasShadow === 'function') {
            mainWindow.setHasShadow(false);
        }
    } catch (e) {
        console.warn('[Main] Failed to disable window shadow:', e);
    }

    // Load the app
    mainWindow.loadFile('index.html');

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Focus on the window
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Prevent window from being closed, minimize to tray instead
    mainWindow.on('close', (event) => {
        if (app.quitting) {
            mainWindow = null;
        } else {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

// Settings are displayed in-app (modal) now; no separate settings window needed.

function createTray() {
    // Create tray icon (we'll need to create this asset)
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(nativeImage.createFromPath(iconPath));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Menu',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide Menu',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: true,
            click: (item) => {
                if (mainWindow) {
                    mainWindow.setAlwaysOnTop(item.checked);
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Spotify Game Menu');
    tray.setContextMenu(contextMenu);
    
    // Show window on tray click
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

// Register custom protocol for OAuth callback


// App event handlers
app.whenReady().then(() => {
    // Create an HTTP server for the OAuth callback on 127.0.0.1:8080 (loopback)
    // Using plain HTTP for a loopback redirect avoids issues with self-signed certs
    const server = http.createServer((req, res) => {
        console.log('[Main] HTTP server received request:', req.method, req.url);
        if (req.url.startsWith('/callback')) {
            // If the callback includes query params (e.g., ?code=...&state=...), forward to renderer
            const queryIndex = req.url.indexOf('?');
            if (queryIndex !== -1 && mainWindow && !mainWindow.isDestroyed()) {
                const params = req.url.substring(queryIndex + 1);
                console.log('[Main] OAuth callback params detected, forwarding to renderer:', params);
                // Notify renderer so it can exchange the code for tokens
                try {
                    mainWindow.webContents.send('spotify-oauth-callback', params);
                    console.log('[Main] Forwarded spotify-oauth-callback to renderer');
                } catch (e) {
                    console.error('[Main] Failed to forward callback to renderer:', e);
                }
            } else {
                console.log('[Main] Callback received but no query params or renderer not ready');
            }

            fs.readFile(path.join(__dirname, 'callback.html'), (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end(JSON.stringify(err));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.on('listening', () => console.log('[Main] OAuth HTTP server listening on http://127.0.0.1:8080'));
    server.on('error', (err) => console.error('[Main] OAuth HTTP server error:', err));
    server.listen(8080);

    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.quitting = true;
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// IPC handlers for renderer process communication
ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) {
        mainWindow.hide();
    }
});

ipcMain.handle('window-toggle-always-on-top', () => {
    if (mainWindow) {
        const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
        return !isAlwaysOnTop;
    }
    return false;
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Resize the main window to the given width and height (validated)
ipcMain.handle('window-resize', (event, width, height) => {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) {
            throw new Error('Main window not available');
        }

        // Validate inputs
        const w = Number(width);
        const h = Number(height);

        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            throw new Error('Invalid width/height');
        }

        // Apply minimum size constraints similar to creation
        const minW = mainWindow.getMinimumSize ? mainWindow.getMinimumSize()[0] : 100;
        const minH = mainWindow.getMinimumSize ? mainWindow.getMinimumSize()[1] : 100;

        const finalW = Math.max(w, minW);
        const finalH = Math.max(h, minH);

        mainWindow.setSize(Math.round(finalW), Math.round(finalH));

        // Return the new size
        return { width: finalW, height: finalH };
    } catch (err) {
        console.error('[Main] window-resize error:', err);
        throw err;
    }
});

