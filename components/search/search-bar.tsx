"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";

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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      onSearch();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1"
        disabled={loading}
      />
      <Button onClick={onSearch} disabled={loading || !query.trim()}>
        <Search className="h-4 w-4 mr-2" />
        {loading ? "Searching..." : "Search"}
      </Button>
    </div>
  );
}


