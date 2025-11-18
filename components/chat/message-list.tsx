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
      <div className="flex items-center justify-center h-full text-[#8C8C92]">
        <p className="text-sm">Start a conversation by sending a message</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {streaming && (
        <div className="flex items-center gap-2 text-[#8C8C92]">
          <div className="h-1.5 w-1.5 bg-current rounded-full animate-pulse" />
          <span className="text-sm">Thinking...</span>
        </div>
      )}
    </div>
  );
}

