"use client";

import { useEffect, useState } from "react";

export function ElectronDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const info: any = {
      isElectron: !!(window as any).electronAPI,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing",
      platform: typeof window !== "undefined" && (window as any).electronAPI
        ? (window as any).electronAPI.getPlatform()
        : "browser",
    };

    if ((window as any).electronAPI) {
      info.electronAPI = {
        hasOpenFileDialog: typeof (window as any).electronAPI.openFileDialog === "function",
        hasGetSecureItem: typeof (window as any).electronAPI.getSecureItem === "function",
        hasSetSecureItem: typeof (window as any).electronAPI.setSecureItem === "function",
      };
    }

    setDebugInfo(info);
  }, []);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-4 rounded-lg font-mono z-50 max-w-md">
      <div className="font-bold mb-2">Electron Debug Info</div>
      <pre className="whitespace-pre-wrap break-words">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
}
