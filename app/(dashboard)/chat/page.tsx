"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage() {
  const [settings, setSettings] = useState<{ model?: string; provider?: string; webSearchEnabled?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

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

