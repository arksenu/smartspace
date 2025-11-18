"use client";

import { ResultItem } from "./result-item";
import { Card, CardContent } from "@/components/ui/card";
import { File } from "lucide-react";

interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: any;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  documentTitles?: Record<string, string>;
}

export function SearchResults({ results, query, documentTitles = {} }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <File className="mx-auto h-8 w-8 text-[#8C8C92] mb-3" />
          <p className="text-sm text-[#8C8C92]">No results found</p>
          <p className="text-xs text-[#8C8C92] mt-1">
            Try adjusting your search query or filters
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-white/80">Results ({results.length})</h2>
      </div>
      <div className="space-y-2">
        {results.map((result, index) => (
          <ResultItem
            key={result.chunkId}
            result={result}
            index={index + 1}
            query={query}
            documentTitle={documentTitles[result.documentId]}
          />
        ))}
      </div>
    </div>
  );
}


