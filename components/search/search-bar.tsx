"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  loading?: boolean;
  placeholder?: string;
}

export function SearchBar({
  query,
  onQueryChange,
  onSearch,
  loading = false,
  placeholder = "Enter your search query...",
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      onSearch();
    }
  };

  return (
    <div className="relative flex gap-3">
      {/* Enhanced search input */}
      <div className={cn(
        "relative flex-1 rounded-2xl border transition-all duration-200",
        "bg-[#1A1A1D] border-white/5",
        isFocused 
          ? "border-primary/50 ring-2 ring-primary/30" 
          : "hover:border-white/10"
      )}>
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Search className={cn(
            "h-5 w-5 transition-colors duration-200",
            isFocused ? "text-primary" : "text-[#8C8C92]"
          )} />
        </div>
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "flex-1 pl-12 pr-4 border-0 bg-transparent",
            "focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
          disabled={loading}
        />
        {/* Decorative corner accent */}
        {isFocused && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-primary/20 rounded-bl-full" />
        )}
      </div>
      
      <Button 
        onClick={onSearch} 
        disabled={loading || !query.trim()}
        className={cn(
          "px-6 rounded-2xl transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        )}
      >
        {loading ? (
          <>
            <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Search
          </>
        )}
      </Button>
    </div>
  );
}


