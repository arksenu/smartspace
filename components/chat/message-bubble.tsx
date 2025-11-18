"use client";

import { Message } from "./chat-interface";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn(
      "flex gap-4 animate-fade-in-up group relative z-10",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <Avatar className={cn(
        "h-9 w-9 border-2 transition-all duration-200 shrink-0",
        isUser 
          ? "border-primary/20 group-hover:border-primary/40" 
          : "border-white/5 group-hover:border-primary/20"
      )}>
        <AvatarFallback className={cn(
          "transition-all duration-200",
          isUser 
            ? "bg-primary/10 text-primary group-hover:bg-primary/20" 
            : "bg-white/5 group-hover:bg-primary/10"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <Card className={cn(
        "max-w-[80%] transition-all duration-200 relative z-10",
        isUser 
          ? "bg-primary/10 text-primary border border-primary/20" 
          : "bg-[#1A1A1D] border border-white/5"
      )}>
        <CardContent className="p-4">
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser ? "prose-invert" : "",
            "prose-headings:font-semibold prose-p:leading-relaxed prose-p:text-[#CFCFD3]",
            "prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[#CFCFD3]",
            "prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/5 prose-pre:text-[#CFCFD3]",
            "prose-strong:text-[#CFCFD3] prose-strong:font-semibold",
            "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
            "prose-li:text-[#CFCFD3] prose-ul:text-[#CFCFD3] prose-ol:text-[#CFCFD3]"
          )}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

