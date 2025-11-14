"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { revalidatePath } from "next/cache";
import { ingestUrl as ingestUrlContent } from "@/lib/ingestion/url-ingestion";

export async function uploadDocument(formData: FormData) {
  const user = await requireAuth();
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  // Generate unique filename
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Create document record
  const { data: document, error: dbError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: file.name,
      file_name: file.name,
      file_type: fileExt === "pdf" ? "pdf" : fileExt === "txt" ? "txt" : "unknown",
      file_size: file.size,
      storage_path: filePath,
      status: "pending",
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file if DB insert fails
    await supabase.storage.from("documents").remove([filePath]);
    throw new Error(`Failed to create document record: ${dbError.message}`);
  }

  revalidatePath("/documents");

  // Trigger ingestion pipeline automatically (non-blocking)
  // Use dynamic import to avoid loading PDF parsing libraries during module initialization
  import("@/lib/ingestion/pipeline").then(({ processDocument }) => {
    processDocument(document.id, user.id).catch((error) => {
      // Don't fail upload if ingestion fails - it can be retried manually
      console.error("Failed to process document:", error);
    });
  });

  return document;
}

export async function ingestUrl(url: string) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Ingest URL content
  const { title, content } = await ingestUrlContent(url);

  // Create document record
  const { data: document, error: dbError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: title || url,
      file_name: url,
      file_type: "url",
      file_size: content.length,
      storage_path: null,
      status: "pending",
      metadata: { url, content },
    })
    .select()
    .single();

  if (dbError) {
    throw new Error(`Failed to create document record: ${dbError.message}`);
  }

  revalidatePath("/documents");

  // Trigger ingestion pipeline automatically for URLs (non-blocking)
  // Use dynamic import to avoid loading PDF parsing libraries during module initialization
  import("@/lib/ingestion/pipeline").then(({ processDocument }) => {
    processDocument(document.id, user.id).catch((error) => {
      console.error("Failed to process document:", error);
    });
  });

  return document;
}

