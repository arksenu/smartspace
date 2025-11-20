import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Check if we're in Electron
function isElectron() {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

// Custom storage adapter for Electron
function createElectronStorageAdapter() {
  if (!isElectron()) {
    return undefined;
  }

  const electronAPI = (window as any).electronAPI;

  return {
    getItem: (key: string): string | null => {
      try {
        const value = electronAPI.getSecureItem(key);
        return value !== null && value !== undefined ? String(value) : null;
      } catch (error) {
        console.error('Error getting secure item:', error);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        electronAPI.setSecureItem(key, value);
      } catch (error) {
        console.error('Error setting secure item:', error);
      }
    },
    removeItem: (key: string): void => {
      try {
        electronAPI.removeSecureItem(key);
      } catch (error) {
        console.error('Error removing secure item:', error);
      }
    },
  };
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey,
    });
    throw new Error('Missing Supabase configuration. Please check your environment variables.');
  }

  // In Electron, use the standard Supabase client with custom storage
  if (isElectron()) {
    const storageAdapter = createElectronStorageAdapter();
    
    if (storageAdapter) {
      console.log('Creating Supabase client for Electron with custom storage');
      return createSupabaseClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          auth: {
            storage: storageAdapter,
            storageKey: 'sb-auth-token',
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        }
      );
    } else {
      console.warn('Electron detected but storage adapter not available, falling back to default');
    }
  }

  // In browser, use SSR client (uses cookies)
  console.log('Creating Supabase client for browser');
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

