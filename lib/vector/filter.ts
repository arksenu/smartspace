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
  console.log("[Filter] 🚀 Starting LLM-Verified Retrieval Filter pipeline");
  
  // Step 1: Retrieve top-k chunks (k_max = 10)
  let chunks = await retrieveTopKChunks(query, userId, documentId);
  console.log(`[Filter] Step 1: Retrieved ${chunks.length} chunks (k_max=10)`);

  if (chunks.length === 0) {
    console.log("[Filter] No chunks found, returning empty results");
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 2: Normalize similarity scores using z-score normalization
  let scoredChunks = normalizeScores(chunks);

  // Step 3: Drop statistical outliers (bottom 15% of normalized scores)
  const beforeOutliers = scoredChunks.length;
  scoredChunks = removeOutliers(scoredChunks);
  console.log(`[Filter] Step 2-3: Normalized scores and removed outliers (${beforeOutliers} → ${scoredChunks.length} chunks)`);

  if (scoredChunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 4: Apply Maximal Marginal Relevance (MMR) for diversity
  // This also generates embeddings needed for deduplication
  scoredChunks = await applyMMR(scoredChunks, 0.5);
  console.log(`[Filter] Step 4: Applied MMR for diversity (${scoredChunks.length} chunks)`);

  // Step 5: Remove near-duplicates with cosine > 0.95
  // Note: We could optimize by passing embeddings from MMR, but for simplicity
  // we'll let removeNearDuplicates handle it (it will cache if called with same chunks)
  const beforeDedup = scoredChunks.length;
  scoredChunks = await removeNearDuplicates(scoredChunks);
  console.log(`[Filter] Step 5: Removed near-duplicates (${beforeDedup} → ${scoredChunks.length} chunks)`);

  if (scoredChunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // Step 6: Score relevance using Groq interceptor LLM
  console.log(`[Filter] Step 6: Scoring relevance with Groq LLM for ${scoredChunks.length} chunks...`);
  const relevanceScores = await scoreRelevanceBatch(
    query,
    scoredChunks.map((c) => ({ chunkId: c.chunkId, content: c.content }))
  );

  // Create a map for quick lookup
  const scoreMap = new Map(relevanceScores.map((r) => [r.chunkId, r.score]));

  // Log score distribution
  const scoreCounts = relevanceScores.reduce((acc, r) => {
    acc[r.score] = (acc[r.score] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  console.log(`[Filter] Relevance scores distribution:`, scoreCounts);

  // Step 7: Keep all chunks scoring >= 2
  let filtered = scoredChunks
    .map((chunk) => ({
      ...chunk,
      relevanceScore: scoreMap.get(chunk.chunkId) ?? 0,
    }))
    .filter((chunk) => chunk.relevanceScore >= 2);
  
  console.log(`[Filter] Step 7: Filtered to chunks with score >= 2 (${filtered.length} chunks)`);

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

  // Return results without the extra scoring fields
  const results: SearchResult[] = filtered.map(({ relevanceScore, normalizedScore, mmrScore, ...rest }) => rest);

  console.log(`[Filter] ✅ Pipeline complete: Returning ${results.length} verified relevant chunks`);
  
  return {
    results,
    isNullRetrieval: false,
  };
}
