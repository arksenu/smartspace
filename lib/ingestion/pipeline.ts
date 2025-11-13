import { parsePDF } from "./pdf-parser";
import { chunkText } from "./chunker";
import { generateEmbeddings } from "@/lib/embeddings";
import { createClient } from "@/lib/supabase/server";
import { sql } from "drizzle-orm";

export async function processDocument(documentId: string, userId: string) {
  const supabase = await createClient();

  // Update status to processing
  await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  try {
    // Get document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    let text: string;
    let metadata: any = {};

    // Extract text based on file type
    if (document.file_type === "pdf") {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(document.storage_path!);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const parsed = await parsePDF(buffer);
      text = parsed.text;
      metadata = parsed.metadata;
    } else if (document.file_type === "url") {
      text = document.metadata?.content || "";
      metadata = { url: document.metadata?.url };
    } else if (document.file_type === "txt") {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(document.storage_path!);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      text = await fileData.text();
    } else {
      throw new Error(`Unsupported file type: ${document.file_type}`);
    }

    // Chunk text
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No chunks generated from document");
    }

    // Generate embeddings
    const chunkContents = chunks.map((chunk) => chunk.content);
    const embeddings = await generateEmbeddings(chunkContents);

    // Store chunks with embeddings
    // Note: PGVector expects embeddings as a string representation of the vector
    // Format: '[...]' for Supabase/PostgreSQL
    const chunkInserts = chunks.map((chunk, index) => ({
      document_id: documentId,
      user_id: userId,
      chunk_index: chunk.metadata.chunkIndex,
      content: chunk.content,
      content_tokens: chunk.metadata.tokenCount,
      embedding: `[${embeddings[index].join(",")}]`, // PGVector format
      metadata: { ...metadata, ...chunk.metadata },
    }));

    // Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunkInserts.length; i += batchSize) {
      const batch = chunkInserts.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    // Update document status
    await supabase
      .from("documents")
      .update({
        status: "completed",
        chunk_count: chunks.length,
      })
      .eq("id", documentId);

    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    // Update status to failed
    const { data: doc } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    await supabase
      .from("documents")
      .update({
        status: "failed",
        metadata: {
          ...(doc?.metadata || {}),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .eq("id", documentId);

    throw error;
  }
}

