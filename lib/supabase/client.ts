import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton instance for Electron client
let electronClientInstance: SupabaseClient | null = null;

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

  // In Electron, use a singleton client to prevent multiple instances
  // It will use localStorage by default, and we need to ensure cookies are set for server-side access
  if (isElectron()) {
    // Return existing instance if available
    if (electronClientInstance) {
      return electronClientInstance;
    }
    
    // Create and cache new instance
    electronClientInstance = createSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: {
            getItem: (key: string) => {
              // First try localStorage
              const value = localStorage.getItem(key);
              if (value) return value;
              
              // Then try cookies
              const cookies = document.cookie.split(';');
              for (const cookie of cookies) {
                const [name, val] = cookie.trim().split('=');
                if (name === key) {
                  return decodeURIComponent(val);
                }
              }
              return null;
            },
            setItem: (key: string, value: string) => {
              // Set in localStorage
              localStorage.setItem(key, value);
              
              // Also set as cookie for server-side access
              // Use path=/ and no domain to ensure it works on localhost
              document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
              
              // Special handling for auth tokens - also set the individual cookie parts
              // Supabase expects cookies with specific names
              if (key.includes('auth-token')) {
                try {
                  const parsed = JSON.parse(value);
                  // Get the project reference from the URL
                  const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
                  const projectRef = urlMatch ? urlMatch[1] : '';
                  
                  if (parsed.access_token) {
                    // Set both generic and project-specific cookie names
                    document.cookie = `sb-access-token=${encodeURIComponent(parsed.access_token)}; path=/; max-age=31536000; SameSite=Lax`;
                    if (projectRef) {
                      document.cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
                    }
                  }
                  if (parsed.refresh_token) {
                    document.cookie = `sb-refresh-token=${encodeURIComponent(parsed.refresh_token)}; path=/; max-age=31536000; SameSite=Lax`;
                  }
                } catch (e) {
                  // Not a JSON token, ignore
                }
              }
            },
            removeItem: (key: string) => {
              localStorage.removeItem(key);
              document.cookie = `${key}=; path=/; max-age=0`;
              // Also remove the individual cookie parts
              document.cookie = `sb-access-token=; path=/; max-age=0`;
              document.cookie = `sb-refresh-token=; path=/; max-age=0`;
            },
          },
        },
        global: {
          // Use native fetch but ensure it works in Electron environment
          fetch: (...args) => {
            return fetch(...args).catch((error) => {
              console.error('Fetch error in Electron:', error);
              throw error;
            });
          },
        },
      }
    );
    
    return electronClientInstance;
  }

  // In browser, use SSR client (uses cookies)
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

