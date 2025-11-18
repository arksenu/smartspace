"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResultHighlight } from "./result-highlight";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-3.5 w-3.5 text-[#8C8C92] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <CardTitle className="text-xs font-medium text-white/80">
                  Result {index}
                </CardTitle>
                <Badge 
                  variant={similarityColor}
                  className={cn(
                    "text-xs px-1.5 py-0.5 h-5 rounded-lg shrink-0",
                    similarityPercent >= 80 && "bg-green-500/10 text-green-400 border-green-500/20",
                    similarityPercent >= 60 && "bg-primary/10 text-primary border-primary/20",
                    similarityPercent < 60 && "bg-white/5 text-[#8C8C92] border-white/5"
                  )}
                >
                  {similarityPercent}%
                </Badge>
              </div>
              <CardDescription className="text-xs flex items-center gap-1.5 flex-wrap">
                {documentTitle ? (
                  <span className="truncate">{documentTitle}</span>
                ) : (
                  <span>Doc: {result.documentId.substring(0, 8)}...</span>
                )}
                {result.metadata?.page_number && (
                  <span className="shrink-0">• Page {result.metadata.page_number}</span>
                )}
                {result.metadata?.chunk_index !== undefined && (
                  <span className="shrink-0">• Chunk {result.metadata.chunk_index + 1}</span>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <ResultHighlight text={result.content} query={query} />
        </div>
      </div>
    </Card>
  );
}


