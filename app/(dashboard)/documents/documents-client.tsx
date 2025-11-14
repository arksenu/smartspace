"use client";

import { DocumentList } from "@/components/documents/document-list";
import { deleteDocument } from "@/app/actions/documents/delete";
import { reindexDocument } from "@/app/actions/documents/reindex";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  title: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date | string;
}

interface DocumentsPageClientProps {
  documents: Document[];
}

export function DocumentsPageClient({ documents }: DocumentsPageClientProps) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteDocument(id);
      toast.success("Document deleted successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const handleReindex = async (id: string) => {
    try {
      await reindexDocument(id);
      toast.success("Document reindexing started");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reindex document");
    }
  };

  return (
    <DocumentList
      documents={documents}
      onDelete={handleDelete}
      onReindex={handleReindex}
    />
  );
}

