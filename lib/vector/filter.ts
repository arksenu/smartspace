import { retrieveTopKChunks, K_MIN } from "./retrieval";
import { normalizeScores, removeOutliers, removeNearDuplicates, applyMMR } from "./scoring";
import { scoreRelevanceBatch } from "./interceptor";
import type { SearchResult } from "./search";

export interface VerifiedRetrievalResult {
  results: SearchResult[];
  isNullRetrieval: boolean; // true if max score = 0
}

/**
 * Run the complete LLM-Verified Retrieval Filter pipeline
 * @param query User query string
 * @param userId User ID for filtering
 * @param documentId Optional document ID filter
 * @returns Filtered search results
 */
export async function runVerifiedRetrieval(
  query: string,
  userId: string,
  documentId?: string
): Promise<VerifiedRetrievalResult> {
  // Step 1: Retrieve top-k chunks (k_max = 10)
  let chunks = await retrieveTopKChunks(query, userId, documentId);

  if (chunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 2: Normalize similarity scores using z-score normalization
  let scoredChunks = normalizeScores(chunks);

  // Step 3: Drop statistical outliers (bottom 15% of normalized scores)
  scoredChunks = removeOutliers(scoredChunks);

  if (scoredChunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 4: Apply Maximal Marginal Relevance (MMR) for diversity
  // This also generates embeddings needed for deduplication
  scoredChunks = await applyMMR(scoredChunks, 0.5);

  // Step 5: Remove near-duplicates with cosine > 0.95
  // Note: We could optimize by passing embeddings from MMR, but for simplicity
  // we'll let removeNearDuplicates handle it (it will cache if called with same chunks)
  scoredChunks = await removeNearDuplicates(scoredChunks);

  if (scoredChunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 6: Score relevance using Groq interceptor LLM
  const relevanceScores = await scoreRelevanceBatch(
    query,
    scoredChunks.map((c) => ({ chunkId: c.chunkId, content: c.content }))
  );

  // Create a map for quick lookup
  const scoreMap = new Map(relevanceScores.map((r) => [r.chunkId, r.score]));

  // Step 7: Keep all chunks scoring >= 2
  let filtered = scoredChunks
    .map((chunk) => ({
      ...chunk,
      relevanceScore: scoreMap.get(chunk.chunkId) ?? 0,
    }))
    .filter((chunk) => chunk.relevanceScore >= 2);

  // Step 8: If fewer than k_min remain, keep the top 2 unless all scores are 0
  const maxScore = Math.max(...relevanceScores.map((r) => r.score), 0);

  if (filtered.length < K_MIN) {
    // Sort all chunks by relevance score (descending)
    const allScored = scoredChunks
      .map((chunk) => ({
        ...chunk,
        relevanceScore: scoreMap.get(chunk.chunkId) ?? 0,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // If max score is 0, treat as null-retrieval
    if (maxScore === 0) {
      return {
        results: [],
        isNullRetrieval: true,
      };
    }

    // Otherwise, keep top 2
    filtered = allScored.slice(0, K_MIN);
  }

  // Step 9: If max score = 0, treat as null-retrieval
  if (maxScore === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Return results without the extra scoring fields
  const results: SearchResult[] = filtered.map(({ relevanceScore, normalizedScore, mmrScore, ...rest }) => rest);

  return {
    results,
    isNullRetrieval: false,
  };
}
