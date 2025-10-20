// Electron Main Process for Spotify Game Overlay
const { app, BrowserWindow, protocol, shell, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { URL } = require('url');

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
    // Create the browser window with overlay capabilities
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minWidth: 300,
        minHeight: 400,
        frame: false, // Frameless for custom controls
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'), // We'll create this
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
function registerSpotifyProtocol() {
    protocol.registerHttpProtocol('spotify-overlay', (request, callback) => {
        const url = new URL(request.url);
        
        // Handle the callback from Spotify OAuth
        if (url.pathname === '/callback') {
            // Send the authorization code to the renderer process
            if (mainWindow) {
                mainWindow.webContents.send('spotify-oauth-callback', url.searchParams.toString());
            }
        }
        
        callback({ statusCode: 200 });
    });
}

// App event handlers
app.whenReady().then(() => {
    // Register protocol before creating window
    registerSpotifyProtocol();
    
    // Create main window
    createWindow();
    
    // Create system tray
    createTray();
    
    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
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

// Open external URL in default browser
ipcMain.handle('open-external', (event, url) => {
    try {
        shell.openExternal(url);
        return true;
    } catch (e) {
        console.error('Failed to open external URL', e);
        return false;
    }
});