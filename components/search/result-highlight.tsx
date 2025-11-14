"use client";

import { useMemo } from "react";

interface ResultHighlightProps {
  text: string;
  query: string;
  maxLength?: number;
}

export function ResultHighlight({ text, query, maxLength = 500 }: ResultHighlightProps) {
  const highlightedText = useMemo(() => {
    if (!query.trim()) return text;

    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    if (queryWords.length === 0) return text;

    // Find the first occurrence of any query word
    let startIndex = -1;
    for (const word of queryWords) {
      const index = text.toLowerCase().indexOf(word);
      if (index !== -1) {
        startIndex = index;
        break;
      }
    }

    // If no match found, return truncated text
    if (startIndex === -1) {
      return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    }

    // Extract a window around the match
    const windowStart = Math.max(0, startIndex - 100);
    const windowEnd = Math.min(text.length, startIndex + maxLength);
    let excerpt = text.substring(windowStart, windowEnd);

    // Add ellipsis if needed
    if (windowStart > 0) excerpt = "..." + excerpt;
    if (windowEnd < text.length) excerpt = excerpt + "...";

    // Highlight query words
    queryWords.forEach((word) => {
      const regex = new RegExp(`(${word})`, "gi");
      excerpt = excerpt.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900">$1</mark>');
    });

    return excerpt;
  }, [text, query, maxLength]);

  return (
    <p
      className="text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: highlightedText }}
    />
  );
}


