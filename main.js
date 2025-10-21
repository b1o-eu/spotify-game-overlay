// Electron Main Process for Spotify Game Overlay
const { app, BrowserWindow, protocol, shell, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { URL } = require('url');
const https = require('https');
const fs = require('fs');
const selfsigned = require('selfsigned');

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
    // Create the main application window as a frameless overlay-like window
    // so the overlay DOM becomes the visible window and can be dragged via CSS.
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minWidth: 360,
        minHeight: 300,
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
            label: 'Show Overlay',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide Overlay',
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

    tray.setToolTip('Spotify Game Overlay');
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
    // Generate a self-signed certificate for localhost (runtime-only)
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, {
        days: 365,
        keySize: 2048,
        algorithm: 'sha256',
        extensions: [
            { name: 'basicConstraints', cA: true },
            {
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: 'localhost' }, // DNS
                    { type: 7, ip: '127.0.0.1' } // IP
                ]
            }
        ]
    });

    // Create an HTTPS server for the OAuth callback
    const server = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
        if (req.url.startsWith('/callback')) {
            // If the callback includes query params (e.g., ?code=...&state=...), forward to renderer
            const queryIndex = req.url.indexOf('?');
            if (queryIndex !== -1 && mainWindow && !mainWindow.isDestroyed()) {
                const params = req.url.substring(queryIndex + 1);
                // Notify renderer so it can exchange the code for tokens
                mainWindow.webContents.send('spotify-oauth-callback', params);
            }

            fs.readFile(path.join(__dirname, 'callback.html'), (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end(JSON.stringify(err));
                    return;
                }
                res.writeHead(200);
                res.end(data);
            });
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }).listen(8080);

    // Allow our self-signed localhost certificate inside Electron windows
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        if (url.startsWith('https://localhost:8080')) {
            event.preventDefault();
            callback(true);
        } else {
            callback(false);
        }
    });

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

