# Spotify Game Overlay - Setup Instructions

## Prerequisites

1. **Spotify Premium Account** - Required for playback control
2. **Spotify Developer Account** - To create an application and get Client ID
3. **Web Browser** - Chrome, Firefox, Edge, or Safari
4. **Local Web Server** - For serving the application (Python/Node or VS Code Live Server)

## Setup Steps

### 1. Create Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the details:
   - **App Name**: Spotify Game Overlay
   - **App Description**: Gaming overlay for Spotify control
    - **Website**: https://localhost:8080
    - **Redirect URIs**: add BOTH of the following so either Electron or Web flow works
       - https://localhost:8080/callback (Electron app)
       - http://localhost:5500/callback.html (Web via Live Server; ensure it matches your actual port)
5. Accept the terms and create the app
6. Copy your **Client ID** (you'll need this later)

### 2. Run the Application

#### Option A: Using Python (Recommended)
```bash
# Navigate to the project directory
cd spotify-game-overlay

# Start a local web server
python -m http.server 8080

# Or if you have Python 2
python -m SimpleHTTPServer 8080
```

#### Option B: Using Node.js
```bash
# Install a simple HTTP server
npm install -g http-server

# Navigate to the project directory
cd spotify-game-overlay

# Start the server
http-server -p 8080
```

#### Option C: Using VS Code Live Server
1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"
   - Note the URL it opens (e.g., http://127.0.0.1:5500). Ensure your Spotify app includes the matching Redirect URI (e.g., http://127.0.0.1:5500/callback.html)

### 3. Configure the Overlay

1. Open your browser and go to `http://localhost:8080`
2. Click the settings button in the overlay header
3. Enter your Spotify **Client ID** from step 1
4. Click "Save Settings"
5. Click "Connect to Spotify"
6. Log in to Spotify and authorize the application
7. You should now see your current playing track!

## Usage

### Basic Controls
- **Play/Pause**: Click the play button or use `Ctrl+Shift+Space`
- **Next Track**: Click next button or use `Ctrl+Shift+Right`
- **Previous Track**: Click previous button or use `Ctrl+Shift+Left`
- **Volume**: Use the volume slider or `Ctrl+Shift+Up/Down`
- **Shuffle**: Click the shuffle button
- **Repeat**: Click the repeat button (cycles through off/all/track)

### Search
- Type in the search box to find songs, artists, albums, or playlists
- Click on any result to play it immediately

### Queue Management
- View upcoming songs in the "Up Next" section
- The queue updates automatically as you play music

### Hotkeys (Global)
- `Ctrl+Shift+M`: Toggle overlay visibility
- `Ctrl+Shift+Space`: Play/Pause
- `Ctrl+Shift+Right`: Next track
- `Ctrl+Shift+Left`: Previous track
- `Ctrl+Shift+Up`: Volume up
- `Ctrl+Shift+Down`: Volume down

### Overlay Features
- **Draggable**: Drag the header to move the overlay anywhere on screen
- **Minimizable**: Click the minimize button to collapse to header only
- **Resizable Opacity**: Adjust overlay transparency in settings
- **Theme Support**: Switch between dark and light themes

## Troubleshooting

### "Authentication Error" or `INVALID_CLIENT: Insecure redirect URI`
- Make sure your Client ID is correct
- Verify the Redirect URI in the Spotify Dashboard EXACTLY matches what the app is using:
   - Electron app: `https://localhost:8080/callback`
   - Browser with Live Server: `${window.location.origin}/callback.html` (e.g., `http://localhost:5500/callback.html`)
- If your Live Server uses a different port, update the Redirect URI accordingly in the Spotify Dashboard and try again.
- If your Live Server uses a different port, update the Redirect URI accordingly in the Spotify Dashboard and try again.

### "No Active Device"
- Open Spotify on your computer or phone
- Start playing a song to activate a device
- You can also use the Spotify Connect feature to transfer playback

### "Playback Control Failed"
- Ensure you have Spotify Premium (required for playback control)
- Make sure Spotify is running and has an active device
- Try refreshing the page and reconnecting

### Hotkeys Not Working
- Make sure you're not typing in an input field
- Check if another application is capturing the same hotkeys
- Try different key combinations in the settings

### Overlay Not Updating
- Check your internet connection
- Verify Spotify is playing music
- Try refreshing the page
- Check browser console for errors (F12)

## Customization

### Changing Themes
1. Open settings
2. Select "Light" or "Dark" theme
3. Click "Save Settings"

### Adjusting Opacity
1. Open settings
2. Use the opacity slider
3. Click "Save Settings"

### Positioning
- Simply drag the overlay header to move it anywhere on screen
- Position is automatically saved

## Advanced Usage

### Debug Mode
Open browser console (F12) and type:
```javascript
debugOverlay()
```
This will show debug information overlay with current state.

### Restart Application
```javascript
restartOverlay()
```

### Check Status
```javascript
getOverlayStatus()
```

## Security Notes

- Your Client ID is stored locally in your browser
- The application only requests necessary Spotify permissions
- No data is sent to external servers (everything runs locally)
- Access tokens are handled securely and refresh automatically

## Supported Browsers

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## Performance Tips

- Close unused browser tabs to improve performance
- Use hardware acceleration if available
- Consider using a dedicated browser window for the overlay

## Need Help?

If you encounter issues:
1. Check the browser console for error messages (F12)
2. Verify your Spotify Developer app settings
3. Make sure you have Spotify Premium
4. Try restarting both the overlay and Spotify

Enjoy your seamless gaming music experience!