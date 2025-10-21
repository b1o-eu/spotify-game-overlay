# Spotify Game Menu

A lightweight JavaScript-based menu application that provides seamless Spotify integration for gamers. This menu allows you to control your music and view track information without alt-tabbing out of your game or needing multiple monitors.

This Spotify menu is designed specifically for gamers who want to:

- **Search & Play**: Search for songs and playlists directly from the menu

- **Quick Controls**: Play/pause, next, previous, volume and queue management without leaving the game

- **Game-friendly menu positioning**

Getting started

1. **Clone**: `git clone https://github.com/your-username/spotify-game-menu.git`

2. **Install**: `npm install`

3. **Configure**: Enter your Client ID in the menu settings

4. **Run**: `npm run dev` for development

For desktop builds see `DESKTOP.md`.

## What This Project Will Be

This Spotify menu is designed specifically for gamers who want to:
- **View Current Track**: See what's currently playing without leaving your game
- **Control Playback**: Play, pause, skip, and go back to previous tracks
- **Browse Queue**: Check upcoming songs in your Spotify queue
- **Search & Play**: Search for songs and playlists directly from the menu
- **Volume Control**: Adjust Spotify volume independently from game audio
- **Minimal Interface**: Clean, unobtrusive UI that won't interfere with gameplay

## Technology Stack

- **Frontend**: JavaScript (ES6+), HTML5, CSS3
- **Desktop**: Electron framework for cross-platform desktop app
- **API Integration**: Spotify Web API
- **Authentication**: OAuth 2.0 with Spotify (custom protocol for desktop)
- **Framework**: Vanilla JavaScript with Electron APIs
- **Styling**: Modern CSS with responsive design

## Key Features (Planned)

- Real-time now playing display
- Full playback controls (play, pause, skip, previous)
- Queue management and visualization
- Search functionality for tracks, artists, and playlists
- Independent volume control
- Customizable hotkeys for quick actions
- Game-friendly menu positioning
- Responsive design for different screen sizes
- Dark/light theme options
- Cross-platform desktop app (Windows, macOS, Linux)

## Installation & Setup

### Option 1: Desktop App (Recommended)

1. **Download**: Get the latest release for your platform from the [Releases](../../releases) page
2. **Install**: Run the installer (.exe for Windows, .dmg for macOS, .AppImage for Linux)
3. **Setup**: Follow the [Desktop Setup Guide](DESKTOP.md) for configuration

### Option 2: Web Version

1. **Clone**: `git clone https://github.com/your-username/spotify-game-menu.git`
2. **Install**: `npm install`
3. **Run**: `npm run web-dev`
4. **Setup**: Configure your Spotify Client ID in the app settings

### Quick Start

1. **Spotify App**: Create a Spotify Developer App at [developer.spotify.com](https://developer.spotify.com/dashboard)
2. **Client ID**: Copy your Client ID from the Spotify app dashboard
3. **Configure**: Enter your Client ID in the menu settings
4. **Authorize**: Click "Connect to Spotify" to authorize the app

## Target Audience

Perfect for gamers, streamers, and anyone who wants quick access to Spotify controls without interrupting their current application or workflow.
