"use client";

import { Message } from "./chat-interface";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Format latency display
  const formatLatency = (ms: number) => {
    if (ms < 1000) {
      return `${ms} ms`;
    }
    const seconds = ms / 1000;
    return seconds % 1 === 0 ? `${seconds} s` : `${seconds.toFixed(1)} s`;
  };

  // Format token count display
  const formatTokens = (count: number) => {
    if (count < 1000) {
      return count.toString();
    }
    return `${(count / 1000).toFixed(1)}k`;
  };

  return (
    <div className={cn(
      "flex gap-2.5 animate-fade-in-up group relative z-10",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <Avatar className={cn(
        "h-7 w-7 border-2 transition-all duration-200 shrink-0",
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
          {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <Card className={cn(
          "transition-all duration-200 relative z-10",
          isUser 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "bg-[#1A1A1D] border border-white/5"
        )}>
          <CardContent className={cn(
            isUser ? "!p-0 !px-4 !py-3" : "!p-3"
          )}>
            <div className={cn(
              "prose prose-sm max-w-none",
              isUser ? "prose-invert" : "",
              "prose-headings:font-semibold prose-headings:text-sm prose-headings:mb-1 prose-headings:mt-0",
              "prose-p:leading-relaxed prose-p:text-sm prose-p:text-[#CFCFD3] prose-p:my-1",
              "prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-[#CFCFD3]",
              "prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/5 prose-pre:text-xs prose-pre:text-[#CFCFD3] prose-pre:p-2 prose-pre:my-2",
              "prose-strong:text-[#CFCFD3] prose-strong:font-semibold",
              "prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:text-sm",
              "prose-li:text-sm prose-li:text-[#CFCFD3] prose-ul:text-[#CFCFD3] prose-ol:text-[#CFCFD3] prose-ul:my-1 prose-ol:my-1",
              "prose-ul:pl-4 prose-ol:pl-4"
            )}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
        
        {/* Metrics display for assistant messages */}
        {!isUser && message.metrics && (
          <div className="flex items-center gap-3 px-1 text-xs text-[#8C8C92]">
            {/* Latency */}
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span className="font-mono">{formatLatency(message.metrics.latencyMs)}</span>
            </div>
            {/* Token count */}
            <div className="flex items-center gap-1">
              <span>Tokens:</span>
              <span className="font-mono">{formatTokens(message.metrics.totalTokens)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

