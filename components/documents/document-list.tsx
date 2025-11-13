"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { File, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Document {
  id: string;
  title: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
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
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{doc.title}</CardTitle>
                <CardDescription className="mt-1">
                  {doc.fileName && (
                    <>
                      {doc.fileName}
                      {doc.fileSize && ` • ${(doc.fileSize / 1024).toFixed(2)} KB`}
                    </>
                  )}
                  {!doc.fileName && doc.fileType && `Type: ${doc.fileType}`}
                </CardDescription>
              </div>
              <Badge variant={statusColors[doc.status]}>
                {doc.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
              </p>
              <div className="flex gap-2">
                {doc.status === "failed" && onReindex && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReindex(doc.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-index
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

