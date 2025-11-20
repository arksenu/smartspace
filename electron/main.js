const { app, BrowserWindow, ipcMain, dialog, shell, protocol, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const NextServer = require('./nextServer');

let mainWindow = null;
let nextServer = null;
let tray = null;
const PROTOCOL_NAME = 'smartspace';

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
      webSecurity: true,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'), // Add icon later
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus window on creation
    if (isDev) {
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
    const baseUrl = await nextServer.start();
    console.log(`Next.js server started at ${baseUrl}`);
    return baseUrl;
  } catch (error) {
    console.error('Failed to start Next.js server:', error);
    throw error;
  }
}

// Handle protocol URLs (smartspace://auth/callback?token=...)
function handleProtocolUrl(url) {
  if (!url.startsWith(`${PROTOCOL_NAME}://`)) return;

  const parsedUrl = new URL(url);
  if (parsedUrl.pathname === '/auth/callback') {
    const params = new URLSearchParams(parsedUrl.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (mainWindow) {
      mainWindow.webContents.send('auth:callback', {
        token,
        refreshToken,
        error,
        errorDescription,
      });
      mainWindow.focus();
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
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});

ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall();
});

// App event handlers
app.whenReady().then(async () => {
  // Register protocol handler
  protocol.registerHttpProtocol('http', (request, callback) => {
    callback(request);
  });

  protocol.registerHttpProtocol('https', (request, callback) => {
    callback(request);
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
    dialog.showErrorBox('Startup Error', 'Failed to start the application. Please try again.');
    app.quit();
  }

  // Handle protocol URLs on Windows/Linux
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
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
    handleProtocolUrl(url);
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
if (!isDev) {
  autoUpdater.setAutoDownload(true);
  autoUpdater.setAutoInstallOnAppQuit(true);
  
  // Check for updates on startup (after a delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
  
  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('updater:update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
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
  console.error('Auto-updater error:', error);
  if (mainWindow) {
    mainWindow.webContents.send('updater:error', error.message);
  }
});

// Handle protocol URLs on Windows (via command line)
if (process.platform === 'win32') {
  const args = process.argv.slice(1);
  args.forEach((arg) => {
    if (arg.startsWith(`${PROTOCOL_NAME}://`)) {
      handleProtocolUrl(arg);
    }
  });
}
