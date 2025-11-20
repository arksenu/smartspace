"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ElectronAuthHandler() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if we're in Electron
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      return;
    }

    const electronAPI = (window as any).electronAPI;

    // Handle OAuth callback from protocol handler
    const handleAuthCallback = async (data: {
      token?: string;
      refreshToken?: string;
      error?: string;
      errorDescription?: string;
    }) => {
      if (data.error) {
        toast.error(data.errorDescription || data.error);
        return;
      }

      if (data.token && data.refreshToken) {
        try {
          // Set the session using the tokens
          const { error } = await supabase.auth.setSession({
            access_token: data.token,
            refresh_token: data.refreshToken,
          });

          if (error) throw error;

          toast.success("Successfully signed in!");
          router.push("/dashboard");
          router.refresh();
        } catch (error: any) {
          toast.error(error.message || "Failed to sign in");
        }
      }
    };

    // Listen for auth callbacks
    electronAPI.onAuthCallback(handleAuthCallback);

    // Cleanup
    return () => {
      electronAPI.removeAuthCallback();
    };
  }, [router, supabase]);

  return null;
}
