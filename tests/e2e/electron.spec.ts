/**
 * E2E tests for Electron desktop functionality
 * These tests verify core desktop features work correctly
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron } from 'playwright';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await _electron.launch({
    executablePath: path.join(__dirname, '../../node_modules/.bin/electron'),
    args: [path.join(__dirname, '../../electron/main.js')],
    env: {
      ...process.env,
      ELECTRON_IS_DEV: '1',
    },
  });

  page = await electronApp.firstWindow();
  
  // Wait for app to load
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Electron Desktop App', () => {
  test('should launch and show window', async () => {
    const windows = electronApp.windows();
    expect(windows.length).toBeGreaterThan(0);
    
    const isVisible = await windows[0].isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should have electronAPI available', async () => {
    const hasElectronAPI = await page.evaluate(() => {
      return typeof (window as any).electronAPI !== 'undefined';
    });
    
    expect(hasElectronAPI).toBeTruthy();
  });

  test('should detect Electron platform', async () => {
    const isElectron = await page.evaluate(() => {
      return (window as any).electronAPI?.isElectron === true;
    });
    
    expect(isElectron).toBeTruthy();
  });

  test('should get platform information', async () => {
    const platform = await page.evaluate(() => {
      return (window as any).electronAPI?.getPlatform();
    });
    
    expect(['win32', 'darwin', 'linux']).toContain(platform);
  });

  test('should handle window controls', async () => {
    // Test minimize
    await page.evaluate(() => {
      (window as any).electronAPI?.minimizeWindow();
    });
    
    // Wait a bit for window to minimize
    await page.waitForTimeout(500);
    
    // Test maximize
    await page.evaluate(() => {
      (window as any).electronAPI?.maximizeWindow();
    });
    
    await page.waitForTimeout(500);
  });

  test('should get app version', async () => {
    const version = await page.evaluate(async () => {
      return await (window as any).electronAPI?.getVersion();
    });
    
    expect(version).toBeTruthy();
    expect(typeof version).toBe('string');
  });
});

test.describe('File System Access', () => {
  test('should expose file dialog API', async () => {
    const hasFileDialog = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.openFileDialog === 'function';
    });
    
    expect(hasFileDialog).toBeTruthy();
  });

  test('should expose folder dialog API', async () => {
    const hasFolderDialog = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.openFolderDialog === 'function';
    });
    
    expect(hasFolderDialog).toBeTruthy();
  });

  test('should expose file reading API', async () => {
    const hasReadFile = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.readFile === 'function';
    });
    
    expect(hasReadFile).toBeTruthy();
  });
});

test.describe('Secure Storage', () => {
  test('should store and retrieve secure items', async () => {
    const testKey = 'test-key';
    const testValue = 'test-value';
    
    // Set item
    const setResult = await page.evaluate(
      ({ key, value }) => {
        return (window as any).electronAPI?.setSecureItem(key, value);
      },
      { key: testKey, value: testValue }
    );
    
    expect(setResult).toBeTruthy();
    
    // Get item
    const retrievedValue = await page.evaluate(
      ({ key }) => {
        return (window as any).electronAPI?.getSecureItem(key);
      },
      { key: testKey }
    );
    
    expect(retrievedValue).toBe(testValue);
    
    // Remove item
    const removeResult = await page.evaluate(
      ({ key }) => {
        return (window as any).electronAPI?.removeSecureItem(key);
      },
      { key: testKey }
    );
    
    expect(removeResult).toBeTruthy();
    
    // Verify removal
    const afterRemove = await page.evaluate(
      ({ key }) => {
        return (window as any).electronAPI?.getSecureItem(key);
      },
      { key: testKey }
    );
    
    expect(afterRemove).toBeNull();
  });
});

test.describe('Authentication Flow', () => {
  test('should handle auth callbacks', async () => {
    let callbackReceived = false;
    let callbackData = null;
    
    // Set up callback listener
    await page.evaluate(() => {
      (window as any).electronAPI?.onAuthCallback((data: any) => {
        (window as any).__testCallbackData = data;
        (window as any).__testCallbackReceived = true;
      });
    });
    
    // Simulate auth callback (this would normally come from protocol handler)
    // In a real test, you'd trigger the protocol handler
    // For now, we just verify the API exists
    
    const hasCallbackHandler = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.onAuthCallback === 'function';
    });
    
    expect(hasCallbackHandler).toBeTruthy();
  });
});

test.describe('Update System', () => {
  test('should expose update checking API', async () => {
    const hasCheckUpdates = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.checkForUpdates === 'function';
    });
    
    expect(hasCheckUpdates).toBeTruthy();
  });

  test('should handle update events', async () => {
    const hasUpdateHandlers = await page.evaluate(() => {
      const api = (window as any).electronAPI;
      return (
        typeof api?.onUpdateAvailable === 'function' &&
        typeof api?.onUpdateDownloaded === 'function' &&
        typeof api?.onUpdateProgress === 'function' &&
        typeof api?.onUpdateError === 'function'
      );
    });
    
    expect(hasUpdateHandlers).toBeTruthy();
  });
});

test.describe('Network Status', () => {
  test('should detect online status', async () => {
    const isOnline = await page.evaluate(() => {
      return (window as any).electronAPI?.isOnline();
    });
    
    expect(typeof isOnline).toBe('boolean');
  });

  test('should handle online status changes', async () => {
    const hasStatusChangeHandler = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.onOnlineStatusChange === 'function';
    });
    
    expect(hasStatusChangeHandler).toBeTruthy();
  });
});
