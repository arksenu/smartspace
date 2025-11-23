const { contextBridge, ipcRenderer } = require('electron');

// Try to initialize electron-store, fallback to in-memory storage if it fails
let store = null;
let memoryStore = {};

try {
  const Store = require('electron-store');
  store = new Store();
} catch (error) {
  console.warn('electron-store not available, using in-memory storage:', error.message);
  // Fallback to in-memory storage
  store = {
    get: (key) => memoryStore[key] || null,
    set: (key, value) => { memoryStore[key] = value; },
    delete: (key) => { delete memoryStore[key]; }
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system access
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openFolderDialog: (options) => ipcRenderer.invoke('dialog:openFolder', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  
  // Secure storage for auth tokens
  getSecureItem: (key) => {
    try {
      return store.get(key);
    } catch (error) {
      console.error('Error getting secure item:', error);
      return null;
    }
  },
  setSecureItem: (key, value) => {
    try {
      store.set(key, value);
      return true;
    } catch (error) {
      console.error('Error setting secure item:', error);
      return false;
    }
  },
  removeSecureItem: (key) => {
    try {
      store.delete(key);
      return true;
    } catch (error) {
      console.error('Error removing secure item:', error);
      return false;
    }
  },
  
  // Auth callback handling
  onAuthCallback: (callback) => {
    ipcRenderer.on('auth:callback', (event, data) => callback(data));
  },
  removeAuthCallback: () => {
    ipcRenderer.removeAllListeners('auth:callback');
  },
  
  // Platform info
  getPlatform: () => process.platform,
  isElectron: true,
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // App version
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Offline/online status
  isOnline: () => navigator.onLine,
  onOnlineStatusChange: (callback) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },
  
  // Update handlers
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('updater:update-available', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('updater:update-downloaded', (event, info) => callback(info));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('updater:download-progress', (event, progress) => callback(progress));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('updater:error', (event, error) => callback(error));
  },
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
});
