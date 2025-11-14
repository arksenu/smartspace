"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { revalidatePath } from "next/cache";

export async function deleteDocument(documentId: string) {
  const user = await requireAuth();
  const supabase = await createClient();

  // First, verify the document belongs to the user
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("storage_path, user_id")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    throw new Error("Document not found");
  }

  if (document.user_id !== user.id) {
    throw new Error("Unauthorized: You can only delete your own documents");
  }

  // Delete from storage if storage_path exists
  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([document.storage_path]);

    if (storageError) {
      console.error("Failed to delete file from storage:", storageError);
      // Continue with DB deletion even if storage deletion fails
    }
  }

  // Delete from database (cascade will handle document_chunks)
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (dbError) {
    throw new Error(`Failed to delete document: ${dbError.message}`);
  }

  revalidatePath("/documents");
  return { success: true };
}


