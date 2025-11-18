"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      <div className="p-3 border-b border-white/5 flex-shrink-0">
        <h3 className="text-xs font-medium text-white/80">Sources</h3>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {sources.length === 0 ? (
          <div className="text-center text-[#8C8C92] text-xs mt-6">
            <p>No relevant sources found</p>
            <p className="text-xs mt-1">Sources will appear here when relevant documents match your query</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source, index) => {
              const similarityPercent = Math.round(source.similarity * 100);
              
              return (
                <Card key={source.chunkId}>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Badge 
                        variant="secondary" 
                        className="shrink-0 text-xs px-1.5 py-0.5 h-5 rounded-lg bg-white/5 text-[#CFCFD3] border-white/5"
                      >
                        Source {index + 1}
                      </Badge>
                      {similarityPercent > 0 && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "shrink-0 text-xs px-1.5 py-0.5 h-5 rounded-lg",
                            similarityPercent >= 50 
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-white/5 text-[#8C8C92] border-white/5"
                          )}
                        >
                          {similarityPercent}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[#8C8C92] w-full leading-relaxed">
                      <p className="break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {source.content.length > 150 
                          ? source.content.substring(0, 150) + '...' 
                          : source.content}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

