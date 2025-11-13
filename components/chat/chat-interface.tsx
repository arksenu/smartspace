"use client";

import { useState, useRef, useEffect } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { SourcesPanel } from "./sources-panel";
import { Card } from "@/components/ui/card";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ chunkId: string; content: string; similarity: number }>;
}

interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: Message[];
}

export function ChatInterface({ conversationId, initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sources, setSources] = useState<Array<{ chunkId: string; content: string; similarity: number }>>([]);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message,
          provider: "openai",
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setStreaming(false);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              assistantMessage.content += parsed.content;

              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMessage };
                return updated;
              });
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <MessageList messages={messages} streaming={streaming} />
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t p-4">
            <ChatInput onSend={handleSend} disabled={streaming} />
          </div>
        </Card>
      </div>
      {sources.length > 0 && (
        <div className="w-80 border-l">
          <SourcesPanel sources={sources} />
        </div>
      )}
    </div>
  );
}

