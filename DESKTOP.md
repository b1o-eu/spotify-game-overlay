# Spotify Game Overlay - Developer Guide

This guide provides technical details for developers working on the Electron desktop application. For user-facing installation and setup, please see the main [README.md](README.md).

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- A Spotify Developer App (for Client ID)

## Development

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Run in Development Mode**
    ```bash
    npm run dev
    ```
    This will open the app with hot-reloading and developer tools enabled.

## Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-win    # Windows
npm run build-mac    # macOS  
npm run build-linux  # Linux
```

Built packages will be available in the `dist/` folder.

## Features

The desktop version includes:

- **Always on Top**: Stays above other windows while gaming
- **System Tray**: Minimize to system tray
- **Native Window Controls**: Proper minimize/close behavior
- **OAuth Integration**: Secure Spotify authentication
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Auto-Updater Ready**: Built with electron-builder
-- **Frameless Window**: Custom menu appearance

## Usage

1. **First Run**: Enter your Spotify Client ID when prompted
2. **Authentication**: Click "Connect to Spotify" to authorize the app
3. **Position**: Drag the menu to your preferred screen location
4. **Controls**: Use the header buttons to minimize or close
5. **System Tray**: Right-click the tray icon for options

## Keyboard Shortcuts

-- `Ctrl+Shift+M`: Toggle menu visibility
- `Ctrl+Shift+Space`: Play/Pause
- `Ctrl+Shift+Right`: Next track
- `Ctrl+Shift+Left`: Previous track
- `Ctrl+Shift+Up`: Volume up
- `Ctrl+Shift+Down`: Volume down

## Development

### File Structure

```
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── index.html           # App interface
├── src/
│   ├── js/
│   │   ├── main.js      # App initialization
│   │   ├── spotify-api.js # Spotify Web API
│   │   ├── ui-controller.js # Interface controls
│   │   └── config.js    # Configuration
│   └── css/             # Stylesheets
└── assets/              # Icons and images
```

### Adding Features

1. **UI Changes**: Modify files in `src/`
2. **Electron Features**: Update `main.js` and `preload.js`
3. **API Integration**: Extend `spotify-api.js`
4. **Styling**: Update CSS files in `src/css/`

## Troubleshooting

### OAuth Issues
- Ensure redirect URI matches your Spotify app settings
- Check that your Client ID is correct
- Verify internet connection for authentication

### Window Issues  
- Try resetting position by deleting app data
- Check if "Always on Top" is causing conflicts
- Restart the app if the menu becomes unresponsive

### Build Issues
- Clear `node_modules` and reinstall dependencies
- Check that all icon files exist in `assets/`
- Ensure Node.js version compatibility

## Distribution

The built packages can be distributed as:

- **Windows**: `.exe` installer or portable `.exe`
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` or `.deb` package

For production distribution, replace placeholder icons in `assets/` with proper app icons.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in both web and desktop modes
5. Submit a pull request

## License

MIT License - See LICENSE file for details.