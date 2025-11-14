"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { revalidatePath } from "next/cache";

export async function reindexDocument(documentId: string) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Verify the document belongs to the user
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, user_id")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    throw new Error("Document not found");
  }

  if (document.user_id !== user.id) {
    throw new Error("Unauthorized: You can only reindex your own documents");
  }

  // Reset document status to pending
  const { error: updateError } = await supabase
    .from("documents")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to reset document status: ${updateError.message}`);
  }

  revalidatePath("/documents");

  // Trigger ingestion pipeline (non-blocking)
  // Use dynamic import to avoid loading PDF parsing libraries during module initialization
  import("@/lib/ingestion/pipeline").then(({ processDocument }) => {
    processDocument(documentId, user.id).catch(async (error) => {
      console.error("Failed to process document during reindex:", error);
      // Update status to failed if processing fails
      const { error: updateError } = await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", documentId);

      if (updateError) {
        console.error("Failed to update status to failed:", updateError);
      }
    });
  });

  return { success: true };
}

