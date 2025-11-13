import { createClient } from "@/lib/supabase/server";
import { generateEmbeddings } from "@/lib/embeddings";

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
  let queryBuilder = supabase
    .rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: topK,
      user_id: userId,
    });

  if (documentId) {
    queryBuilder = queryBuilder.eq("document_id", documentId);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    // Fallback to manual similarity search if RPC function doesn't exist
    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("*")
      .eq("user_id", userId)
      .limit(topK * 2);

    if (chunksError || !chunks) {
      throw new Error(`Vector search failed: ${chunksError?.message || "Unknown error"}`);
    }

    // Calculate cosine similarity manually
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
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  }

  return (data || []).map((item: any) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    similarity: item.similarity || 0,
    metadata: item.metadata,
  }));
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

