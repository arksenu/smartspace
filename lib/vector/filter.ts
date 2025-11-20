import { retrieveTopKChunks, K_MIN } from "./retrieval";
import { normalizeScores, removeOutliers, removeNearDuplicates, applyMMR, type ScoredChunkWithEmbedding } from "./scoring";
import { scoreRelevanceBatch } from "./interceptor";
import type { SearchResult } from "./search";

export interface VerifiedRetrievalResult {
  results: SearchResult[];
  isNullRetrieval: boolean; // true if max score = 0
}

/**
 * Classify query complexity to determine if LLM verification is needed
 * @param query User query string
 * @returns true if query is complex/ambiguous and needs verification
 */
function isComplexQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const wordCount = query.split(/\s+/).length;

  // Simple queries that don't need verification
  const simplePatterns = [
    /^(what|where|when|who|how) (is|are|does|do) \w+/i, // Direct questions
    /^(find|get|show|list|display) .+/i, // Direct commands
    /^(define|explain) \w+/i, // Definition queries
    /(documentation|docs|api|reference) (for|about|on)/i, // Doc lookups
    /\b(error|bug|issue|problem) (with|in) \w+/i, // Specific error queries
  ];

  // Complex queries that need verification
  const complexPatterns = [
    /\b(how|why|what) .* (work|happen|relate|affect|impact)/i, // Conceptual questions
    /\b(compare|difference|versus|vs|between)\b/i, // Comparison queries
    /\b(best|optimal|recommended|should|could)\b/i, // Opinion/recommendation queries
    /\b(analyze|evaluate|assess|review)\b/i, // Analysis queries
    /\b(all|every|any|some) .* (that|which|where)/i, // Broad scope queries
  ];

  // Check for simple patterns
  for (const pattern of simplePatterns) {
    if (pattern.test(lowerQuery)) {
      return false; // Simple query, no verification needed
    }
  }

  // Check for complex patterns
  for (const pattern of complexPatterns) {
    if (pattern.test(lowerQuery)) {
      return true; // Complex query, needs verification
    }
  }

  // Heuristics for ambiguity
  if (wordCount < 3) {
    // Very short queries are often too vague
    return true;
  }

  if (wordCount > 15) {
    // Long queries often have multiple aspects
    return true;
  }

  // Check for multiple questions or clauses
  if ((query.match(/\?/g) || []).length > 1) {
    return true; // Multiple questions
  }

  if ((query.match(/\b(and|or|but|however|although)\b/gi) || []).length > 2) {
    return true; // Multiple clauses
  }

  // Default to simple for medium-length, focused queries
  return false;
}

/**
 * Run the complete LLM-Verified Retrieval Filter pipeline
 * @param query User query string
 * @param userId User ID for filtering
 * @param documentId Optional document ID filter
 * @param forceVerification Force verification regardless of query complexity (default: true for backward compatibility)
 * @returns Filtered search results
 */
export async function runVerifiedRetrieval(
  query: string,
  userId: string,
  documentId?: string,
  forceVerification: boolean = true
): Promise<VerifiedRetrievalResult> {
  console.log("[Filter] 🚀 Starting LLM-Verified Retrieval Filter pipeline");

  // Check if we should use verification based on query complexity
  const shouldVerify = forceVerification || isComplexQuery(query);

  if (!shouldVerify) {
    console.log("[Filter] Query classified as simple, skipping LLM verification");
    console.log(`[Filter] Query: "${query}"`);
  } else {
    console.log("[Filter] Query classified as complex or verification forced, using full pipeline");
  }

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
  // This generates embeddings that we'll reuse for deduplication
  const mmrResult = await applyMMR(scoredChunks, 0.5);
  let scoredChunksWithEmbeddings = mmrResult.chunks;
  const embeddings = mmrResult.embeddings;
  console.log(`[Filter] Step 4: Applied MMR for diversity (${scoredChunksWithEmbeddings.length} chunks)`);

  // Step 5: Remove near-duplicates with cosine > 0.95
  // We reuse embeddings from MMR to avoid regenerating them
  const beforeDedup = scoredChunksWithEmbeddings.length;
  scoredChunks = await removeNearDuplicates(scoredChunksWithEmbeddings, embeddings);
  console.log(`[Filter] Step 5: Removed near-duplicates (${beforeDedup} → ${scoredChunks.length} chunks)`);

  if (scoredChunks.length === 0) {
    return {
      results: [],
      isNullRetrieval: true,
    };
  }

  // For simple queries, skip LLM scoring and return top results
  if (!shouldVerify) {
    console.log(`[Filter] Skipping LLM scoring for simple query, returning top ${Math.min(scoredChunks.length, 5)} results`);

    // Return top 5 results based on vector similarity
    const results: SearchResult[] = scoredChunks
      .slice(0, 5)
      .map((item) => {
        const { relevanceScore, normalizedScore, mmrScore, embedding, ...rest } = item as any;
        return rest;
      });

    return {
      results,
      isNullRetrieval: false,
    };
  }

  // Step 6: Score relevance using Groq interceptor LLM (llama-3.3-70b-versatile only)
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

  // Return results without the extra scoring fields and embedding
  const results: SearchResult[] = filtered.map((item) => {
    const { relevanceScore, normalizedScore, mmrScore, embedding, ...rest } = item as any;
    return rest;
  });

  console.log(`[Filter] ✅ Pipeline complete: Returning ${results.length} verified relevant chunks`);

  return {
    results,
    isNullRetrieval: false,
  };
}
