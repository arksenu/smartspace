"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResultHighlight } from "./result-highlight";
import { FileText } from "lucide-react";

interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: any;
}

interface ResultItemProps {
  result: SearchResult;
  index: number;
  query: string;
  documentTitle?: string;
}

export function ResultItem({ result, index, query, documentTitle }: ResultItemProps) {
  const similarityPercent = Math.round(result.similarity * 100);
  const similarityColor =
    similarityPercent >= 80
      ? "default"
      : similarityPercent >= 60
      ? "secondary"
      : "outline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Result {index + 1}
            </CardTitle>
            <CardDescription className="mt-1">
              {documentTitle ? (
                <span>{documentTitle}</span>
              ) : (
                <span>Document ID: {result.documentId.substring(0, 8)}...</span>
              )}
              {result.metadata?.page_number && (
                <span className="ml-2">• Page {result.metadata.page_number}</span>
              )}
              {result.metadata?.chunk_index !== undefined && (
                <span className="ml-2">• Chunk {result.metadata.chunk_index + 1}</span>
              )}
            </CardDescription>
          </div>
          <Badge variant={similarityColor}>
            {similarityPercent}% match
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ResultHighlight text={result.content} query={query} />
      </CardContent>
    </Card>
  );
}


