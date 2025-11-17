"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { File, FileText, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  title: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date | string;
}

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: string) => void;
  onReindex?: (id: string) => void;
}

const statusColors = {
  pending: "secondary",
  processing: "default",
  completed: "default",
  failed: "destructive",
} as const;

export function DocumentList({ documents, onDelete, onReindex }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <File className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc, index) => (
        <Card 
          key={doc.id} 
          className="group card-depth-hover animate-fade-in-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                      {doc.title}
                    </CardTitle>
                    <Badge 
                      variant={statusColors[doc.status]}
                      className={cn(
                        "shrink-0 text-xs px-1.5 py-0.5 h-5 rounded-lg",
                        doc.status === "completed" && "bg-green-500/10 text-green-400 border-green-500/20",
                        doc.status === "processing" && "bg-primary/10 text-primary border-primary/20",
                        doc.status === "pending" && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      )}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8C8C92]">
                    {doc.fileName && (
                      <>
                        <span className="truncate">{doc.fileName}</span>
                        {doc.fileSize && (
                          <span className="shrink-0">
                            • {(doc.fileSize / 1024).toFixed(2)} KB
                          </span>
                        )}
                      </>
                    )}
                    {!doc.fileName && doc.fileType && (
                      <span>Type: {doc.fileType}</span>
                    )}
                    <span className="shrink-0">
                      {(() => {
                        if (!doc.createdAt) return "• Uploaded recently";
                        const date = new Date(doc.createdAt);
                        if (isNaN(date.getTime())) return "• Uploaded recently";
                        return `• ${formatDistanceToNow(date, { addSuffix: true })}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {doc.status === "failed" && onReindex && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReindex(doc.id)}
                    className="h-7 px-2 text-xs group/btn hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                  >
                    <RefreshCw className="h-3 w-3 mr-1.5 group-hover/btn:rotate-180 transition-transform duration-500" />
                    Re-index
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(doc.id)}
                    className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all group/btn"
                  >
                    <Trash2 className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* Hover shine effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/3 to-transparent pointer-events-none rounded-2xl" />
        </Card>
      ))}
    </div>
  );
}

