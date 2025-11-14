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
        <CardContent className="p-12 text-center">
          <File className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No results found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting your search query or filters
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Results ({results.length})</h2>
      </div>
      <div className="space-y-4">
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


