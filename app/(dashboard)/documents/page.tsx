import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentButton } from "@/components/documents/upload-document-button";

export default async function DocumentsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage your documents for AI-powered search and chat
          </p>
        </div>
        <UploadDocumentButton />
      </div>

      <DocumentList documents={documents || []} />
    </div>
  );
}

