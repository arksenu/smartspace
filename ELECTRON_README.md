# SmartSpace Electron Desktop Application

This document provides instructions for building and running the SmartSpace desktop application using Electron.

## Prerequisites

- Node.js 18+ and npm
- All dependencies from the main project

## Development

### Running in Development Mode

1. Install dependencies:
```bash
npm install
```

2. Run the development server and Electron app:
```bash
npm run electron:dev
```

This will:
- Start the Next.js development server on port 3004
- Launch the Electron app once the server is ready
- Enable hot reload for both Next.js and Electron

### Manual Development Setup

If you prefer to run them separately:

1. Start Next.js dev server:
```bash
npm run dev
```

2. In another terminal, start Electron:
```bash
npm run electron
```

## Building for Production

### Build the Application

1. Build Next.js and package Electron:
```bash
npm run electron:build
```

This will:
- Build Next.js in standalone mode
- Package the Electron app using electron-builder
- Create installers for your platform

### Build Outputs

The build outputs will be in the `dist/` directory:
- **macOS**: `.dmg` and `.zip` files
- **Windows**: `.exe` installer (NSIS) and portable `.exe`
- **Linux**: `.AppImage` and `.deb` packages

### Platform-Specific Builds

To build for a specific platform:

```bash
# macOS
npm run electron:build -- --mac

# Windows
npm run electron:build -- --win

# Linux
npm run electron:build -- --linux
```

## Features

### Desktop-Specific Features

- **Native File Dialogs**: Use system file pickers for document uploads
- **System Tray**: Minimize to tray on Windows/Linux
- **Dock Integration**: macOS dock badge and menu support
- **Protocol Handler**: Custom `smartspace://` protocol for OAuth callbacks
- **Secure Storage**: Uses Electron's secure storage for auth tokens
- **Auto-Updates**: Automatic update checking and installation
- **Offline Support**: Local caching of embeddings and data

### Authentication

The desktop app uses a custom protocol handler for OAuth:
- OAuth redirects use `smartspace://auth/callback`
- Tokens are stored securely using Electron's safeStorage API
- Sessions persist across app restarts

### File Handling

- Native file dialogs for better UX
- Direct file system access
- Drag & drop support (via existing UploadZone component)
- Support for PDF, TXT, DOC, DOCX, and MD files

## Configuration

### Electron Builder Configuration

Edit `electron-builder.config.js` to customize:
- App icons
- Installer options
- Auto-update server
- Code signing certificates

### Environment Variables

The app uses the same environment variables as the web version. Make sure to set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- API keys for LLM providers

## Testing

### E2E Tests

Run end-to-end tests for Electron functionality:

```bash
npm run test:e2e
```

Run tests with UI:

```bash
npm run test:e2e:ui
```

## Troubleshooting

### Port Already in Use

If port 3004 is already in use, the app will automatically find an available port.

### Build Issues

If you encounter build issues:

1. Clear Next.js cache:
```bash
rm -rf .next
```

2. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Protocol Handler Not Working

On macOS/Linux, you may need to rebuild the app after installing to register the protocol handler:

```bash
npm run electron:build
```

## Distribution

### Code Signing

For production releases, you'll need code signing certificates:
- **macOS**: Apple Developer certificate
- **Windows**: Code signing certificate
- **Linux**: Not required, but recommended for some distributions

### Auto-Updates

Configure auto-updates in `electron-builder.config.js`:
- Set up a GitHub release server
- Configure update server URL
- Set up signing for updates

## Architecture

### Main Process (`electron/main.js`)
- Window management
- Next.js server spawning
- IPC communication
- Protocol handler
- Auto-updater

### Preload Script (`electron/preload.js`)
- Exposes safe APIs to renderer
- File system access
- Secure storage
- IPC bridge

### Next.js Server (`electron/nextServer.js`)
- Manages Next.js production server
- Port management
- Health checking

## Platform-Specific Notes

### macOS
- Touch Bar support (can be added)
- Dock badge for notifications
- Native menu bar integration

### Windows
- System tray integration
- Jump list for recent documents (can be added)
- Windows Hello for auth (can be added)

### Linux
- Desktop entry file creation
- System notifications via libnotify
- Theme detection for dark mode

## License

Same as the main SmartSpace project.
