"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Source {
  chunkId: string;
  content: string;
  similarity: number;
}

interface SourcesPanelProps {
  sources: Source[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex-shrink-0">
        <h3 className="text-sm font-semibold">Sources</h3>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {sources.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <p>No relevant sources found</p>
            <p className="text-xs mt-2">Sources will appear here when relevant documents match your query</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source, index) => {
              const similarityPercent = Math.round(source.similarity * 100);
              
              return (
                <Card key={source.chunkId}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="shrink-0">
                        Source {index + 1}
                      </Badge>
                      {similarityPercent > 0 && (
                        <Badge variant="outline" className="shrink-0">
                          {similarityPercent}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground w-full">
                      <p className="break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {source.content.length > 200 
                          ? source.content.substring(0, 200) + '...' 
                          : source.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

