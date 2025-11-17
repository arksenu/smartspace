"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

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
    <div className="h-full flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white/80">Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-6 w-32 rounded-2xl bg-white/5" />
              {(!settings || settings.provider === "openai") && <Skeleton className="h-6 w-24 rounded-2xl bg-white/5" />}
            </>
          ) : (
            <>
              <div className="text-sm px-3 py-1.5 rounded-2xl bg-[#1A1A1D] border border-white/5 text-[#CFCFD3]">
                <span className="font-medium text-[#8C8C92]">Model:</span>{" "}
                <span className="text-[#CFCFD3]">{modelName}</span>
              </div>
              {isOpenAI && (
                <Badge
                  variant={webSearchEnabled ? "default" : "outline"}
                  className={cn(
                    "gap-1.5 px-3 py-1.5 rounded-2xl",
                    webSearchEnabled
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "text-[#8C8C92] border-white/5"
                  )}
                >
                  <span className="text-xs">🌐</span>
                  <span>
                    Web Search{" "}
                    <span className={webSearchEnabled ? "text-green-400" : "text-red-400"}>
                      {webSearchEnabled ? "On" : "Off"}
                    </span>
                  </span>
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-h-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <ChatInterface />
      </div>
    </div>
  );
}

