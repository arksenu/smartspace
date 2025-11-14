"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { revalidatePath } from "next/cache";
import { ingestUrl as ingestUrlContent } from "@/lib/ingestion/url-ingestion";

/**
 * Validates file content by checking magic bytes/headers
 * Prevents malicious files disguised with wrong extensions
 */
async function validateFileContent(file: File, expectedExt: string): Promise<void> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const header = buffer.slice(0, 8).toString("utf-8");

  if (expectedExt === "pdf") {
    // PDF files start with "%PDF-"
    if (!header.startsWith("%PDF-")) {
      throw new Error("Invalid PDF file: file content does not match PDF format");
    }
  } else if (expectedExt === "txt") {
    // Text files should be valid UTF-8 and not contain binary data
    // Check if the file contains null bytes or other binary indicators
    if (buffer.includes(0x00)) {
      throw new Error("Invalid text file: file contains binary data");
    }
    // Try to decode as UTF-8 to validate
    try {
      buffer.toString("utf-8");
    } catch {
      throw new Error("Invalid text file: not valid UTF-8 encoding");
    }
  }
}

export async function uploadDocument(formData: FormData) {
  const user = await requireAuth();
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  // Generate unique filename
  const fileExt = file.name.split(".").pop()?.toLowerCase();
  
  // Validate file extension
  if (!fileExt || !["pdf", "txt"].includes(fileExt)) {
    throw new Error("Unsupported file type. Only PDF and TXT files are allowed.");
  }

  // Validate file content matches extension
  await validateFileContent(file, fileExt);
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
      file_type: fileExt,
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
  import("@/lib/ingestion/pipeline")
    .then(({ processDocument }) => {
      return processDocument(document.id, user.id);
    })
    .catch(async (error) => {
      // Handle both dynamic import errors and processing errors
      console.error("Failed to process document:", error);
      
      // Update document status to failed if import or processing fails
      const supabaseClient = await createClient();
      await supabaseClient
        .from("documents")
        .update({
          status: "failed",
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
            failedAt: new Date().toISOString(),
          },
        })
        .eq("id", document.id);
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
  import("@/lib/ingestion/pipeline")
    .then(({ processDocument }) => {
      return processDocument(document.id, user.id);
    })
    .catch(async (error) => {
      // Handle both dynamic import errors and processing errors
      console.error("Failed to process document:", error);
      
      // Update document status to failed if import or processing fails
      const supabaseClient = await createClient();
      await supabaseClient
        .from("documents")
        .update({
          status: "failed",
          metadata: {
            ...(document.metadata || {}),
            error: error instanceof Error ? error.message : "Unknown error",
            failedAt: new Date().toISOString(),
          },
        })
        .eq("id", document.id);
    });

  return document;
}

