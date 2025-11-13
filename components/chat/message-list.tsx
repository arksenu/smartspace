"use client";

import { Message } from "./chat-interface";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: Message[];
  streaming?: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Start a conversation by sending a message</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {streaming && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-2 w-2 bg-current rounded-full animate-pulse" />
          <span>Thinking...</span>
        </div>
      )}
    </div>
  );
}

