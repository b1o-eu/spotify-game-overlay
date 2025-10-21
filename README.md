# Spotify Game Overlay

A sleek, customizable desktop overlay for displaying your currently playing Spotify song. Designed to be unobtrusive and work seamlessly with full-screen games and applications.

 <!-- It's highly recommended to add a screenshot! -->

## Features

*   **Real-time Song Display:** Shows the current track, artist, and album art from Spotify.
*   **In-Game Overlay:** A transparent, click-through overlay that can be positioned anywhere on your screen.
*   **Customizable Global Hotkeys:** Control Spotify playback (play/pause, next, previous) from anywhere, even inside a game.
*   **Modern UI:** A clean, frameless window for configuration and login.
*   **Secure Spotify Login:** Uses a secure, local-only OAuth 2.0 flow to connect to your Spotify account.
*   **System Tray Integration:** The app minimizes to the system tray for easy access without cluttering your taskbar.
*   **Cross-Platform:** Built with Electron to run on Windows, macOS, and Linux.

## Installation

1.  Go to the [**Releases Page**](../../releases) on GitHub.
2.  Download the latest installer for your operating system (`.exe` for Windows, `.dmg` for macOS, `.AppImage` or `.deb` for Linux).
3.  Run the installer and follow the on-screen instructions.

## Initial Setup

To connect the overlay to your Spotify account, you need to create a Spotify Developer App. This is a one-time setup.

1.  **Go to the Spotify Developer Dashboard** and log in.
2.  Click **"Create App"**.
3.  Give your app a **Name** and **Description** (e.g., "My Game Overlay").
4.  Go to **"App settings"** and add the following **Redirect URI**:
    *   `http://127.0.0.1:8080/callback`
5.  Save your changes and copy the **Client ID**.
6.  Launch the Spotify Game Overlay app and paste the **Client ID** when prompted.
7.  Click "Connect to Spotify" to authorize the application.

## For Developers

Interested in contributing or running the app from the source?

### Prerequisites

*   Node.js (LTS version recommended)
*   A package manager like `npm` or `yarn`

### Running for Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/b1o-eu/spotify-game-overlay.git
    cd spotify-game-overlay
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the application in development mode (with hot-reloading):
    ```bash
    npm run dev
    ```

### Building for Production

You can build the application for your desired platform using the following commands. The output will be in the `dist/` directory.

```bash
# Build for the current platform
npm run build

# Build for a specific platform
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

### Technical Overview

This application is built using Electron and follows modern security best practices.

*   **Process Sandboxing:** The renderer process (UI) is sandboxed from Node.js APIs.
*   **Context Isolation:** `contextBridge` is used to securely expose specific functions from the main process to the renderer, preventing leakage of privileged APIs.
*   **IPC Communication:** All communication between the UI and the back-end (e.g., registering hotkeys, resizing windows) is done via secure asynchronous IPC channels.
*   **Local OAuth Server:** A temporary local HTTP server is used solely to handle the OAuth 2.0 redirect from Spotify, ensuring that authentication tokens are handled securely on the user's machine.

## Contributing

Contributions are welcome! Please feel free to fork the repository, make your changes, and submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
