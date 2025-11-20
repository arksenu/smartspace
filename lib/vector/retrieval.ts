import { createClient } from "@/lib/supabase/server";
import { generateEmbeddings } from "@/lib/embeddings";
import { MIN_SIMILARITY_THRESHOLD } from "./search";
import type { SearchResult } from "./search";
import { performanceTracker, OperationType } from "@/lib/analytics/performance";

const K_MAX = 10;
const K_MIN = 2;

/**
 * Retrieve top-k chunks using embeddings
 * @param query User query string
 * @param userId User ID for filtering
 * @param documentId Optional document ID filter
 * @returns Array of search results with similarity scores
 */
export async function retrieveTopKChunks(
  query: string,
  userId: string,
  documentId?: string
): Promise<SearchResult[]> {
  const supabase = await createClient();

  // Generate query embedding
  const [queryEmbedding] = await generateEmbeddings([query]);

  // Track vector search operation
  const startTime = Date.now();

  // Build the query - retrieve k_max chunks
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: MIN_SIMILARITY_THRESHOLD,
    match_count: K_MAX,
    user_id: userId,
    document_id_filter: documentId || null,
  });

  if (error) {
    // Fallback to manual similarity search if RPC function doesn't exist
    let chunksQuery = supabase
      .from("document_chunks")
      .select("*")
      .eq("user_id", userId)
      .not("embedding", "is", null);

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
      .slice(0, K_MAX);

    // Track performance (fallback path)
    performanceTracker.track(OperationType.VECTOR_SEARCH, Date.now() - startTime, {
      result_count: results.length,
      k_max: K_MAX,
      has_document_filter: !!documentId,
      fallback: true
    });

    return results;
  }

  // Map RPC results
  const results = (data || []).map((item: any) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    similarity: item.similarity || 0,
    metadata: item.metadata,
  }));

  // Track performance
  const duration = Date.now() - startTime;
  console.log(`[Vector Search] Tracking performance: ${duration}ms for ${results.length} results`);
  performanceTracker.track(OperationType.VECTOR_SEARCH, duration, {
    result_count: results.length,
    k_max: K_MAX,
    has_document_filter: !!documentId
  });

  return results;
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

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export { K_MAX, K_MIN };
