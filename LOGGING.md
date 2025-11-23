# SmartSpace Electron Logging

## Running with Logs

There are now several ways to run the Electron app with different logging levels:

### 1. Basic Mode (Default)
```bash
npm run electron:dev
```
- Runs both Next.js and Electron concurrently
- Basic output, might be hard to distinguish between processes

### 2. Verbose Mode with Labels
```bash
npm run electron:dev:verbose
```
- Shows clear labels for each process ([NEXT] and [ELECTRON])
- Color-coded output (blue for Next.js, green for Electron)
- Easier to track which process is logging what

### 3. Custom Dev Runner (Most Detailed)
```bash
npm run electron:dev:logs
```
- Custom logging with detailed prefixes
- Color-coded by log type (errors in red, warnings in yellow, etc.)
- Shows API route logs separately
- Waits for Next.js to be ready before starting Electron

## Log Files (Development Only)

When running in development mode, logs are automatically saved to:
```
logs/electron-[timestamp].log
```

This includes:
- All Electron main process logs
- Supabase API requests (in debug mode)
- Server startup information
- Error messages with full stack traces

## Viewing Logs

### Real-time Console
All logging options show real-time output in your terminal.

### Log Files
Check the `logs/` directory for persistent log files with timestamps.

### Electron DevTools
When running in development, the Electron app automatically opens DevTools where you can see:
- Client-side console logs
- Network requests
- React component tree
- Redux/state debugging

## Running in Production Mode

### Testing Production Mode (Without Building)

```bash
npm run electron:prod:test
```
- Builds Next.js for production
- Runs Electron in production mode
- No DevTools, minimal logging
- Good for testing production behavior quickly

### Building for Production

1. **Quick Test Build** (unpacked for testing):
```bash
npm run electron:pack
```
- Creates an unpacked build in `dist/` directory
- Good for testing production behavior without creating installers

2. **Full Production Build** (creates installer):
```bash
npm run electron:dist
```
- Creates platform-specific installer (.dmg for Mac, .exe for Windows, .AppImage for Linux)
- Output in `dist/` directory
- Ready for distribution

3. **Build and Publish** (for auto-updates):
```bash
npm run electron:build
```
- Builds and can publish to GitHub releases (requires configuration)

### Running Production Build

After building with `npm run electron:pack`:

**macOS:**
```bash
./dist/mac/SmartSpace.app/Contents/MacOS/SmartSpace
```
Or simply double-click the app in Finder

**Windows:**
```bash
./dist/win-unpacked/SmartSpace.exe
```

**Linux:**
```bash
./dist/linux-unpacked/smartspace
```

### Production vs Development Differences

| Feature | Development | Production |
|---------|------------|------------|
| DevTools | Auto-opens | Disabled |
| Logging | Verbose, saves to file | Minimal, errors only |
| Web Security | Disabled | Enabled |
| Source Maps | Included | Removed |
| Hot Reload | Yes | No |
| Update Checks | Disabled | Enabled |

## Tips

1. **For debugging authentication issues**: Use `electron:dev:logs` to see Supabase API calls
2. **For general development**: Use `electron:dev:verbose` for clean, labeled output
3. **For production builds**: Logs are minimal but errors are still logged
4. **For production testing**: Use `electron:pack` to quickly test production behavior

## Log Levels

The custom logger supports these levels:
- `INFO` - General information
- `DEBUG` - Detailed debugging information (only in dev)
- `WARN` - Warnings that don't stop execution
- `ERROR` - Errors and exceptions

## Production Logging

In production mode:
1. Console output is minimal (errors only)
2. No file logging by default
3. DevTools are disabled
4. To see production logs on macOS:
   ```bash
   # View console logs
   open ~/Library/Logs/SmartSpace/
   
   # Or use Console.app and filter by "SmartSpace"
   ```
5. On Windows:
   ```bash
   # Check Event Viewer or
   %APPDATA%/SmartSpace/logs/
   ```
6. On Linux:
   ```bash
   ~/.config/SmartSpace/logs/
   ```
