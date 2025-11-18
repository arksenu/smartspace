"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex gap-3">
      {/* Matte input container */}
      <div className={cn(
        "relative flex-1 rounded-2xl border transition-all duration-200",
        "bg-[#1A1A1D] border-white/5",
        isFocused 
          ? "border-primary/50 ring-2 ring-primary/30" 
          : "hover:border-white/10"
      )}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Type your message..."
          disabled={disabled}
          className={cn(
            "min-h-[60px] resize-none border-0 bg-transparent text-[#CFCFD3]",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-[#8C8C92]/60"
          )}
        />
        {/* Decorative corner accent */}
        {isFocused && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-primary/20 rounded-bl-full" />
        )}
      </div>
      
      <Button 
        onClick={handleSend} 
        disabled={disabled || !message.trim()} 
        size="icon"
        className={cn(
          "h-[60px] w-[60px] rounded-2xl transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          message.trim() && !disabled 
            ? "bg-white/10 border border-white/5 hover:bg-white/15 hover:border-primary/30" 
            : "bg-white/5 border border-white/5"
        )}
      >
        {disabled ? (
          <Sparkles className="h-5 w-5 animate-pulse" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}

