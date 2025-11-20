import { createBrowserClient } from "@supabase/ssr";

// Custom storage adapter for Electron
function createElectronStorageAdapter() {
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    return undefined; // Use default browser storage
  }

  const electronAPI = (window as any).electronAPI;

  return {
    getItem: (key: string): string | null => {
      try {
        return electronAPI.getSecureItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        electronAPI.setSecureItem(key, value);
      } catch {
        // Silently fail if storage is unavailable
      }
    },
    removeItem: (key: string): void => {
      try {
        electronAPI.removeSecureItem(key);
      } catch {
        // Silently fail if storage is unavailable
      }
    },
  };
}

export function createClient() {
  const storageAdapter = createElectronStorageAdapter();

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(storageAdapter && {
        auth: {
          storage: storageAdapter,
          storageKey: 'sb-auth-token',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }),
    }
  );
}

