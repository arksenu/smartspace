import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentButton } from "@/components/documents/upload-document-button";
import { DocumentsPageClient } from "./documents-client";

export default async function DocumentsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white/80">Documents</h1>
          </div>
          <p className="text-[#8C8C92] text-base md:text-lg max-w-2xl">
            Upload and manage your documents for AI-powered search and chat
          </p>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <UploadDocumentButton />
        </div>
      </div>

      {/* Documents List */}
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <DocumentsPageClient documents={documents || []} />
      </div>
    </div>
  );
}
