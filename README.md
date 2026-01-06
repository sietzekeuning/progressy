# Progressy

A desktop application that monitors GitHub Actions progress and shows notifications when actions start running.

## Features

-   🚀 Auto-starts on Windows boot
-   🔔 System tray icon for easy access
-   📊 Real-time GitHub Actions progress monitoring
-   🔔 Popup notifications when actions start
-   📈 Progress tracking for all running actions
-   🔐 Secure GitHub token storage

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the application:

```bash
npm run build
```

3. Start the application:

```bash
npm start
```

For development:

```bash
npm run dev
```

## GitHub Token Setup

1. Generate a Personal Access Token at https://github.com/settings/tokens
2. Required scopes:
    - `repo` - Full control of private repositories
    - `workflow` - Update GitHub Action workflows
3. Enter the token in the login screen when you first launch the app

## Building for Production

Build distributable packages for different platforms:

### macOS

```bash
npm run package:mac
```

Creates DMG and ZIP files in `release/` folder.

### Windows

```bash
npm run package:win
```

Creates NSIS installer and portable executable in `release/` folder.

### Linux

```bash
npm run package:linux
```

Creates AppImage and DEB packages in `release/` folder.

### All Platforms

```bash
npm run package:all
```

Builds for all platforms (requires running on each platform or CI/CD).

**Note:** Electron apps run on desktop platforms (Windows, macOS, Linux), not iOS/Android. See `BUILD.md` for detailed build instructions.

## How It Works

-   The app runs in the system tray and monitors all repositories in your GitHub account
-   When a GitHub Action starts, a popup window appears in the top-right corner
-   The popup shows progress for all running actions
-   When all actions complete, the popup automatically disappears
-   Click the tray icon to open the main window and manage settings

## Development

-   Main process: `src/main/main.ts`
-   Renderer process: `src/renderer/`
-   Preload script: `src/main/preload.ts`
