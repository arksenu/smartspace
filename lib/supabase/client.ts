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

  return {
    getItem: (key: string): string | null => {
      try {
        // First try localStorage (which also works for cookies via document.cookie)
        if (typeof window !== 'undefined') {
          try {
            const value = localStorage.getItem(key);
            if (value) return value;
          } catch (e) {
            // localStorage might not be available
          }
          
          // Also try reading from cookies
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, val] = cookie.trim().split('=');
            if (name === key) {
              return decodeURIComponent(val);
            }
          }
        }
        
        // Then try Electron secure storage
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          try {
            const electronAPI = (window as any).electronAPI;
            const value = electronAPI.getSecureItem(key);
            if (value !== null && value !== undefined) {
              return String(value);
            }
          } catch (error) {
            console.warn('Failed to get from Electron storage:', error);
          }
        }
        
        return null;
      } catch (error) {
        console.error('Error getting secure item:', error);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        // Always set in localStorage/cookies for server-side access
        // In Electron, the server runs on localhost so cookies work
        try {
          localStorage.setItem(key, value);
          // Also set as cookie for server-side middleware access
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (e) {
          console.warn('Failed to set localStorage/cookie:', e);
        }
        
        // Check for electronAPI on each call
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          try {
            const electronAPI = (window as any).electronAPI;
            electronAPI.setSecureItem(key, value);
          } catch (error) {
            console.warn('Failed to set secure item in Electron storage:', error);
          }
        }
      } catch (error) {
        console.error('Error setting secure item:', error);
      }
    },
    removeItem: (key: string): void => {
      try {
        // Remove from localStorage and cookies
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(key);
            // Remove cookie
            document.cookie = `${key}=; path=/; max-age=0`;
          } catch (e) {
            console.warn('Failed to remove from localStorage/cookie:', e);
          }
        }
        
        // Remove from Electron secure storage
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          try {
            const electronAPI = (window as any).electronAPI;
            electronAPI.removeSecureItem(key);
          } catch (error) {
            console.warn('Failed to remove from Electron storage:', error);
          }
        }
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

  // In Electron, use the standard Supabase client
  // It will use localStorage by default, and cookies will work for server-side access
  // since Electron runs Next.js on localhost
  if (isElectron()) {
    console.log('Creating Supabase client for Electron');
    // Use standard client - it will use localStorage and cookies automatically
    return createSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Don't override storage - let Supabase use default (localStorage + cookies)
        },
      }
    );
  }

  // In browser, use SSR client (uses cookies)
  console.log('Creating Supabase client for browser');
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

