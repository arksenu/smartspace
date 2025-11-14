"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UploadZone, UploadZoneRef } from "./upload-zone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ingestUrl } from "@/app/actions/documents/upload";
import { toast } from "sonner";
import { Upload, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";

export function UploadDocumentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadZoneRef = useRef<UploadZoneRef>(null);

  const handleFileUpload = async () => {
    const files = uploadZoneRef.current?.getFiles() || [];
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload file");
        }

        toast.success(`Uploaded ${file.name}`);
      }
      uploadZoneRef.current?.clearFiles();
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlIngest = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setUploading(true);
    try {
      await ingestUrl(url);
      toast.success("URL ingested successfully");
      setUrl("");
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to ingest URL");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when dialog closes
      uploadZoneRef.current?.clearFiles();
      setUrl("");
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a file or ingest content from a URL
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">File Upload</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>
          <TabsContent value="file">
            <div className="space-y-4">
              <UploadZone ref={uploadZoneRef} />
              <Button
                onClick={handleFileUpload}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Files"}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="url">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={uploading}
                />
              </div>
              <Button
                onClick={handleUrlIngest}
                disabled={uploading || !url.trim()}
                className="w-full"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {uploading ? "Ingesting..." : "Ingest URL"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

