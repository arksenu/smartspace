"use client";

import { useCallback, useState, useImperativeHandle, forwardRef } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, X } from "lucide-react";

interface UploadZoneProps {
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
}

export interface UploadZoneRef {
  getFiles: () => File[];
  clearFiles: () => void;
  addFiles: (files: File[]) => void;
}

export const UploadZone = forwardRef<UploadZoneRef, UploadZoneProps>(
  ({ maxSize = 10 * 1024 * 1024, accept = { "application/pdf": [".pdf"], "text/plain": [".txt"] } }, ref) => {
    const [files, setFiles] = useState<File[]>([]);

    useImperativeHandle(ref, () => ({
      getFiles: () => files,
      clearFiles: () => setFiles([]),
      addFiles: (newFiles: File[]) => setFiles((prev) => [...prev, ...newFiles]),
    }));

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        const validFiles = acceptedFiles.filter((file) => file.size <= maxSize);
        setFiles((prev) => [...prev, ...validFiles]);
      },
      [maxSize]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept,
      maxSize,
    });

    const removeFile = (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
    };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  Drag and drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF and TXT files up to {maxSize / 1024 / 1024}MB
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Selected Files:</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(2)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

UploadZone.displayName = "UploadZone";

