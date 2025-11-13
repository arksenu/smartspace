"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="space-y-3">
            {sources.map((source, index) => (
              <Card key={source.chunkId}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary">Source {index + 1}</Badge>
                    <Badge variant="outline">
                      {(source.similarity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {source.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

