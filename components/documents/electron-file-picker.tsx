"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface ElectronFilePickerProps {
  onFilesSelected: (files: File[]) => void;
  accept?: { name: string; extensions: string[] }[];
  multiple?: boolean;
  children?: React.ReactNode;
}

export function ElectronFilePicker({
  onFilesSelected,
  accept = [{ name: "Documents", extensions: ["pdf", "txt", "doc", "docx", "md"] }],
  multiple = true,
  children,
}: ElectronFilePickerProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      toast.error("Native file picker is only available in the desktop app");
      return;
    }

    setLoading(true);
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.openFileDialog({
        properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
        filters: accept,
      });

      if (result.canceled) {
        return;
      }

      // Convert file paths to File objects
      const files = await Promise.all(
        result.filePaths.map(async (filePath: string) => {
          const electronAPI = (window as any).electronAPI;
          const fileData = await electronAPI.readFile(filePath);
          
          // Convert base64 to blob
          const byteCharacters = atob(fileData.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: fileData.type });
          
          return new File([blob], fileData.name, { type: fileData.type });
        })
      );

      onFilesSelected(files);
    } catch (error: any) {
      toast.error(error.message || "Failed to open file dialog");
    } finally {
      setLoading(false);
    }
  };

  if (children) {
    return (
      <div onClick={handleClick} style={{ cursor: "pointer" }}>
        {children}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
    >
      <FolderOpen className="mr-2 h-4 w-4" />
      {loading ? "Opening..." : "Choose Files"}
    </Button>
  );
}
