"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<{ model?: string; provider?: string; webSearchEnabled?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // Only fetch settings if user is authenticated
    if (!user) {
      setLoading(false);
      setSettings(null);
      return;
    }

    // Reset loading state when user changes to show loading indicator
    setLoading(true);
    setSettings(null);

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings);
        }
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto p-6 h-full">
        <div className="flex items-center justify-center h-full">
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
    );
  }

  const modelName = settings?.model || "gpt-5.1";
  const webSearchEnabled = settings?.webSearchEnabled ?? false;
  const isOpenAI = settings?.provider === "openai";

  return (
    <div className="container mx-auto p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Chat</h1>
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-6 w-32" />
              {(!settings || settings.provider === "openai") && <Skeleton className="h-6 w-24" />}
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Model:</span> {modelName}
              </div>
              {isOpenAI && (
                <Badge
                  variant={webSearchEnabled ? "default" : "outline"}
                  className={`gap-1.5 ${webSearchEnabled ? "" : "text-muted-foreground"}`}
                >
                  <span className="text-xs">🌐</span>
                  <span>
                    Web Search{" "}
                    <span className={webSearchEnabled ? "text-green-500" : "text-red-500"}>
                      {webSearchEnabled ? "On" : "Off"}
                    </span>
                  </span>
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
      <ChatInterface />
    </div>
  );
}

