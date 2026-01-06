# Building Progressy for Distribution

This guide explains how to build Progressy for different platforms so other users can install and use it.

## Prerequisites

1. Make sure all dependencies are installed:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

## Building for Different Platforms

### macOS (Current Platform)

Build DMG and ZIP files for macOS:
```bash
npm run package:mac
```

Output files will be in `release/`:
- `Progressy-1.0.0-arm64.dmg` - DMG installer for Apple Silicon Macs
- `Progressy-1.0.0-arm64-mac.zip` - ZIP archive for Apple Silicon Macs

**Note:** To build for Intel Macs, you'll need to run on an Intel Mac or use cross-compilation.

### Windows

Build Windows installer:
```bash
npm run package:win
```

Output files will be in `release/`:
- `Progressy Setup 1.0.0.exe` - NSIS installer
- `Progressy-1.0.0-win-portable.exe` - Portable executable (no installation needed)

**Note:** Windows builds must be done on a Windows machine or using CI/CD.

### Linux

Build Linux packages:
```bash
npm run package:linux
```

Output files will be in `release/`:
- `Progressy-1.0.0.AppImage` - AppImage (runs on most Linux distributions)
- `progressy_1.0.0_amd64.deb` - Debian package (for Ubuntu/Debian)

### Build All Platforms

To build for all platforms at once (requires running on each platform or CI/CD):
```bash
npm run package:all
```

## Distribution

### For macOS Users:
- Share the `.dmg` file - users can double-click to install
- Or share the `.zip` file - users can extract and run the app

### For Windows Users:
- Share the `.exe` installer - users can run it to install
- Or share the portable `.exe` - users can run it directly without installation

### For Linux Users:
- Share the `.AppImage` - users can make it executable and run it
- Or share the `.deb` file - users can install with `sudo dpkg -i progressy_1.0.0_amd64.deb`

## Code Signing (Optional but Recommended)

For production distribution, you should code sign your applications:

### macOS:
- Requires Apple Developer account ($99/year)
- Configure in `electron-builder.json`:
```json
"mac": {
  "identity": "Developer ID Application: Your Name"
}
```

### Windows:
- Requires code signing certificate
- Configure in `electron-builder.json`:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

## Notes

- The app will use default Electron icons if no custom icons are provided
- Auto-launch feature currently only works on Windows
- Users will need to configure their GitHub OAuth credentials when first running the app
