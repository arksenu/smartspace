const { app, BrowserWindow, ipcMain, dialog, shell, protocol, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const NextServer = require('./nextServer');
const Logger = require('./logger');

// Initialize logger with file logging in development or test mode
const logger = new Logger({
  enabled: true,
  logToFile: isDev || process.env.ELECTRON_PROD_TEST === '1', // Log in dev or test mode
  prefix: '[Electron Main]'
});

let mainWindow = null;
let nextServer = null;
let tray = null;
let baseUrl = 'http://localhost:3004'; // Default to dev server URL
const PROTOCOL_NAME = 'smartspace';

// Register schemes as privileged before app is ready for CORS
protocol.registerSchemesAsPrivileged([
  { scheme: 'http', privileges: { standard: true, secure: true, corsEnabled: true } },
  { scheme: 'https', privileges: { standard: true, secure: true, corsEnabled: true } }
]);

// Handle protocol for OAuth callbacks
app.setAsDefaultProtocolClient(PROTOCOL_NAME);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable for development to allow CORS requests
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'), // Add icon later
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Focus window on creation
    // Don't open DevTools in production test mode
    if (isDev && !process.env.ELECTRON_PROD_TEST) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle minimize to tray (Windows/Linux)
  if (process.platform !== 'darwin') {
    mainWindow.on('minimize', (event) => {
      if (tray) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.on('close', (event) => {
      if (!app.isQuitting && tray) {
        event.preventDefault();
        mainWindow.hide();
      }
    });
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

function createTray() {
  // Create a simple tray icon (you'll need to add an actual icon file)
  const iconPath = path.join(__dirname, '..', 'public', 'icon-tray.png');
  let trayIcon = nativeImage.createEmpty();

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch (error) {
    // If icon doesn't exist, create a simple colored image
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show SmartSpace',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('SmartSpace');
  tray.setContextMenu(contextMenu);

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

  return tray;
}

async function startNextServer() {
  nextServer = new NextServer();
  try {
    const serverUrl = await nextServer.start();
    baseUrl = serverUrl; // Store globally for protocol handler
    logger.info(`Next.js server started at ${baseUrl}`);
    return serverUrl;
  } catch (error) {
    logger.error('Failed to start Next.js server:', error);
    throw error;
  }
}

// Handle protocol URLs (smartspace://auth/callback?code=... or ?token=...)
async function handleProtocolUrl(url) {
  if (!url.startsWith(`${PROTOCOL_NAME}://`)) return;

  const parsedUrl = new URL(url);
  if (parsedUrl.pathname === '/auth/callback') {
    const params = new URLSearchParams(parsedUrl.search);
    const code = params.get('code');
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // If we have a code parameter, exchange it for tokens via the HTTP callback route
    if (code) {
      logger.info('Exchanging OAuth code for tokens via HTTP callback');
      try {
        const callbackUrl = `${baseUrl}/auth/callback?code=${encodeURIComponent(code)}&electron=true`;

        // Make HTTP request to exchange code for tokens
        const tokens = await new Promise((resolve, reject) => {
          http.get(callbackUrl, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              data += chunk;
            });

            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  const json = JSON.parse(data);
                  if (json.success && json.session) {
                    resolve({
                      token: json.session.access_token,
                      refreshToken: json.session.refresh_token,
                    });
                  } else {
                    reject(new Error(json.error || 'Failed to exchange code for tokens'));
                  }
                } catch (parseError) {
                  reject(new Error(`Failed to parse response: ${parseError.message}`));
                }
              } else {
                try {
                  const errorJson = JSON.parse(data);
                  reject(new Error(errorJson.error || `HTTP ${res.statusCode}: Authentication failed`));
                } catch {
                  reject(new Error(`HTTP ${res.statusCode}: Authentication failed`));
                }
              }
            });
          }).on('error', (err) => {
            reject(new Error(`Failed to connect to callback route: ${err.message}`));
          });
        });

        // Send tokens to renderer process
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback', {
            token: tokens.token,
            refreshToken: tokens.refreshToken,
          });
          mainWindow.focus();
        }
      } catch (err) {
        logger.error('Failed to exchange code for tokens:', err);
        // Send error to renderer process
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback', {
            error: err.message || 'Failed to exchange code for tokens',
            errorDescription: err.message,
          });
          mainWindow.focus();
        }
      }
    } else if (token && refreshToken) {
      // Direct token parameters (backward compatibility)
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback', {
          token,
          refreshToken,
          error,
          errorDescription,
        });
        mainWindow.focus();
      }
    } else if (error) {
      // Error parameters
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback', {
          error,
          errorDescription,
        });
        mainWindow.focus();
      }
    } else {
      logger.warn('Protocol URL received but no code, token, or error parameters found');
    }
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'txt', 'doc', 'docx', 'md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    ...options,
  });

  return result;
});

ipcMain.handle('dialog:openFolder', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    ...options,
  });

  return result;
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determine MIME type
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return {
      name: fileName,
      path: filePath,
      size: stats.size,
      type: mimeTypes[ext] || 'application/octet-stream',
      data: buffer.toString('base64'),
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Auto-updater handlers
ipcMain.handle('updater:check', () => {
  if (!isDev && !process.env.ELECTRON_PROD_TEST && typeof autoUpdater.checkForUpdates === 'function') {
    autoUpdater.checkForUpdates().catch(err => {
      logger.debug('Update check failed:', err.message);
    });
  } else {
    logger.debug('Update check skipped (dev/test mode)');
  }
});

ipcMain.handle('updater:quitAndInstall', () => {
  if (!isDev && !process.env.ELECTRON_PROD_TEST && typeof autoUpdater.quitAndInstall === 'function') {
    autoUpdater.quitAndInstall();
  } else {
    logger.debug('Quit and install skipped (dev/test mode)');
  }
});

// App event handlers
app.whenReady().then(async () => {
  // Configure session for CORS
  const filter = {
    urls: ['https://*.supabase.co/*', 'http://localhost:*/*']
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Add proper headers for Supabase requests
    details.requestHeaders['Origin'] = 'http://localhost:3004';
    if (isDev && details.url.includes('supabase')) {
      logger.debug('Supabase request:', details.method, details.url.split('?')[0]);
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    // Allow CORS for Supabase responses
    if (details.responseHeaders) {
      details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      details.responseHeaders['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, apikey, x-client-info'];
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  // Start Next.js server
  try {
    const baseUrl = await startNextServer();

    // Create window
    createWindow();

    // Create system tray (Windows/Linux)
    if (process.platform !== 'darwin') {
      createTray();
    }

    // macOS dock integration
    if (process.platform === 'darwin') {
      app.dock.setBadge('');
      // You can set a custom dock menu here if needed
    }

    // Load Next.js app
    if (isDev) {
      // In dev, assume server is already running
      mainWindow.loadURL('http://localhost:3004');
    } else {
      mainWindow.loadURL(baseUrl);
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    dialog.showErrorBox('Startup Error', `Failed to start the application.\n\nError: ${error.message}\n\nStack: ${error.stack}`);
    app.quit();
  }

  // Handle protocol URLs on Windows/Linux
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url).catch((err) => {
      logger.error('Error handling protocol URL:', err);
    });
  });

  // macOS specific: Handle app activation
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle protocol URLs on Windows/Linux (before app is ready)
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  // Handle protocol URL from command line
  const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://`));
  if (url) {
    handleProtocolUrl(url).catch((err) => {
      logger.error('Error handling protocol URL:', err);
    });
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  // Stop Next.js server
  if (nextServer) {
    await nextServer.stop();
  }

  // On macOS, keep app running even when all windows are closed
  // On Windows/Linux with tray, also keep running
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  if (nextServer) {
    await nextServer.stop();
  }
});

// Auto-updater configuration
// Only enable auto-updater in production builds (not in dev or test mode)
if (!isDev && process.env.NODE_ENV === 'production' && !process.env.ELECTRON_IS_DEV) {
  try {
    // Check if auto-updater methods are available
    if (typeof autoUpdater.setAutoDownload === 'function') {
      autoUpdater.setAutoDownload(true);
    }
    if (typeof autoUpdater.setAutoInstallOnAppQuit === 'function') {
      autoUpdater.setAutoInstallOnAppQuit(true);
    }

    // Check for updates on startup (after a delay)
    setTimeout(() => {
      if (typeof autoUpdater.checkForUpdates === 'function') {
        autoUpdater.checkForUpdates().catch(err => {
          logger.debug('Auto-updater check failed:', err.message);
        });
      }
    }, 5000);

    // Check for updates every 4 hours
    setInterval(() => {
      if (typeof autoUpdater.checkForUpdates === 'function') {
        autoUpdater.checkForUpdates().catch(err => {
          logger.debug('Auto-updater check failed:', err.message);
        });
      }
    }, 4 * 60 * 60 * 1000);
  } catch (error) {
    logger.debug('Auto-updater initialization skipped:', error.message);
  }
} else {
  logger.info('Auto-updater disabled (dev/test mode)');
}

// Auto-updater events (only in production, not in dev/test mode)
if (!isDev && process.env.NODE_ENV === 'production' && !process.env.ELECTRON_IS_DEV && !process.env.ELECTRON_PROD_TEST) {
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('Update not available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-downloaded', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:download-progress', progressObj);
    }
  });

  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', error.message);
    }
  });
}

// Handle protocol URLs on Windows (via command line)
if (process.platform === 'win32') {
  const args = process.argv.slice(1);
  args.forEach((arg) => {
    if (arg.startsWith(`${PROTOCOL_NAME}://`)) {
      handleProtocolUrl(arg).catch((err) => {
        logger.error('Error handling protocol URL:', err);
      });
    }
  });
}
