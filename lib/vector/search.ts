import { createClient } from "@/lib/supabase/server";
import { generateEmbeddings } from "@/lib/embeddings";

// Minimum similarity threshold to consider a source relevant (0.5% when displayed as percentage)
export const MIN_SIMILARITY_THRESHOLD = 0.005;

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: any;
}

export async function vectorSearch(
  query: string,
  userId: string,
  topK: number = 5,
  documentId?: string
): Promise<SearchResult[]> {
  const supabase = await createClient();

  // Generate query embedding
  const [queryEmbedding] = await generateEmbeddings([query]);

  // Build the query
  // Use MIN_SIMILARITY_THRESHOLD to ensure consistency between RPC and fallback paths
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: MIN_SIMILARITY_THRESHOLD,
    match_count: topK,
    user_id: userId,
    document_id_filter: documentId || null,
  });

  if (error) {
    // Fallback to manual similarity search if RPC function doesn't exist
    // Fetch all chunks (with embedding filter) and calculate similarity for accurate results
    let chunksQuery = supabase
      .from("document_chunks")
      .select("*")
      .eq("user_id", userId)
      .not("embedding", "is", null); // Only fetch chunks with embeddings

    if (documentId) {
      chunksQuery = chunksQuery.eq("document_id", documentId);
    }

    const { data: chunks, error: chunksError } = await chunksQuery;

    if (chunksError || !chunks) {
      throw new Error(`Vector search failed: ${chunksError?.message || "Unknown error"}`);
    }

    // Calculate cosine similarity for all chunks and sort
    const results = chunks
      .map((chunk) => {
        if (!chunk.embedding) return null;
        const embedding = Array.isArray(chunk.embedding)
          ? chunk.embedding
          : JSON.parse(chunk.embedding as string);

        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          chunkId: chunk.id,
          documentId: chunk.document_id,
          content: chunk.content,
          similarity,
          metadata: chunk.metadata,
        };
      })
      .filter((r): r is SearchResult => r !== null && r.similarity > MIN_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  }

  // Map RPC results - RPC already filtered by MIN_SIMILARITY_THRESHOLD and limited to topK
  // No need for additional filtering or slicing since the database already applied these constraints
  return (data || [])
    .map((item: any) => ({
      chunkId: item.id,
      documentId: item.document_id,
      content: item.content,
      similarity: item.similarity || 0,
      metadata: item.metadata,
    }))
    .sort((a: SearchResult, b: SearchResult) => b.similarity - a.similarity);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

