/**
 * Local file-based storage for Electron offline mode
 * Persists data to disk using electron-store
 */

import Store from 'electron-store';

let store: Store | null = null;

// Initialize store (only works in Electron main process)
export function initLocalStorage() {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In renderer process, we'll use electron-store via IPC
    return null;
  }
  
  // In main process, create store directly
  try {
    store = new Store({
      name: 'smartspace-cache',
      cwd: 'cache',
    });
    return store;
  } catch (error) {
    console.error('Failed to initialize local storage:', error);
    return null;
  }
}

// Get item from local storage
export async function getLocalItem(key: string): Promise<any | null> {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In renderer, use electronAPI
    try {
      return (window as any).electronAPI.getSecureItem(key);
    } catch {
      return null;
    }
  }
  
  if (store) {
    return store.get(key, null);
  }
  
  return null;
}

// Set item in local storage
export async function setLocalItem(key: string, value: any): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In renderer, use electronAPI
    try {
      return (window as any).electronAPI.setSecureItem(key, value);
    } catch {
      return false;
    }
  }
  
  if (store) {
    store.set(key, value);
    return true;
  }
  
  return false;
}

// Remove item from local storage
export async function removeLocalItem(key: string): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In renderer, use electronAPI
    try {
      return (window as any).electronAPI.removeSecureItem(key);
    } catch {
      return false;
    }
  }
  
  if (store) {
    store.delete(key);
    return true;
  }
  
  return false;
}

// Check if we're in Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

// Check if we're online
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}
