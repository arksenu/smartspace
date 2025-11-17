import { generateEmbeddings } from "@/lib/embeddings";
import type { SearchResult } from "./search";

export interface ScoredChunk extends SearchResult {
  normalizedScore: number;
  mmrScore?: number;
}

/**
 * Normalize similarity scores using z-score normalization
 */
export function normalizeScores(chunks: SearchResult[]): ScoredChunk[] {
  if (chunks.length === 0) return [];

  const scores = chunks.map((c) => c.similarity);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // If standard deviation is 0, all scores are the same - return as-is
  if (stdDev === 0) {
    return chunks.map((chunk) => ({
      ...chunk,
      normalizedScore: 0,
    }));
  }

  return chunks.map((chunk) => ({
    ...chunk,
    normalizedScore: (chunk.similarity - mean) / stdDev,
  }));
}

/**
 * Remove statistical outliers (bottom 15% of normalized scores)
 */
export function removeOutliers(chunks: ScoredChunk[]): ScoredChunk[] {
  if (chunks.length === 0) return [];

  // If only one chunk, keep it (can't remove outliers from a single item)
  if (chunks.length === 1) return chunks;

  // Sort by normalized score (ascending)
  const sorted = [...chunks].sort((a, b) => a.normalizedScore - b.normalizedScore);

  // Calculate how many items to remove (bottom 15%)
  // Ensure we always keep at least 1 chunk
  const itemsToRemove = Math.min(Math.floor(sorted.length * 0.15), sorted.length - 1);

  // Return top 85% (remove bottom 15%)
  return sorted.slice(itemsToRemove);
}

/**
 * Calculate cosine similarity between two embeddings
 */
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

/**
 * Apply Maximal Marginal Relevance (MMR) for diversity
 * Uses chunk embeddings to compute actual chunk-to-chunk similarity
 * @param chunks Chunks to re-rank
 * @param lambda Balance between relevance (1.0) and diversity (0.0). Default 0.5
 */
export async function applyMMR(chunks: ScoredChunk[], lambda: number = 0.5): Promise<ScoredChunk[]> {
  if (chunks.length === 0) return [];

  // If only one chunk, no need for MMR
  if (chunks.length === 1) {
    return [{ ...chunks[0], mmrScore: chunks[0].similarity }];
  }

  // Generate embeddings for all chunks (needed for chunk-to-chunk similarity)
  const contents = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(contents);

  const selected: ScoredChunk[] = [];
  const selectedIndices: number[] = [];
  const remaining = chunks.map((chunk, idx) => ({ chunk, idx, embedding: embeddings[idx] }));

  // Start with the highest similarity chunk
  remaining.sort((a, b) => b.chunk.similarity - a.chunk.similarity);
  const first = remaining.shift()!;
  selected.push({ ...first.chunk, mmrScore: first.chunk.similarity });
  selectedIndices.push(first.idx);

  // For remaining chunks, calculate MMR score
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const { chunk, embedding } = remaining[i];

      // Find maximum similarity to already selected chunks
      let maxSimilarity = 0;
      for (const selectedIdx of selectedIndices) {
        const selectedEmbedding = embeddings[selectedIdx];
        const similarity = cosineSimilarity(embedding, selectedEmbedding);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // MMR score: lambda * relevance - (1 - lambda) * max_similarity_to_selected
      const mmrScore = lambda * chunk.similarity - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    const best = remaining.splice(bestIdx, 1)[0];
    selected.push({ ...best.chunk, mmrScore: bestMMR });
    selectedIndices.push(best.idx);
  }

  return selected;
}

/**
 * Remove near-duplicates with cosine similarity > 0.95
 * Keeps the first occurrence of each duplicate group
 * Reuses embeddings if provided (for efficiency when called after MMR)
 */
export async function removeNearDuplicates(
  chunks: ScoredChunk[],
  embeddings?: number[][]
): Promise<ScoredChunk[]> {
  if (chunks.length === 0) return [];

  // Generate embeddings if not provided
  let chunkEmbeddings: number[][];
  if (embeddings && embeddings.length === chunks.length) {
    chunkEmbeddings = embeddings;
  } else {
    const contents = chunks.map((c) => c.content);
    chunkEmbeddings = await generateEmbeddings(contents);
  }

  const kept: ScoredChunk[] = [];
  const keptEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = chunkEmbeddings[i];

    // Check if this chunk is a near-duplicate of any kept chunk
    let isDuplicate = false;
    for (const keptEmbedding of keptEmbeddings) {
      const similarity = cosineSimilarity(embedding, keptEmbedding);
      if (similarity > 0.95) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(chunk);
      keptEmbeddings.push(embedding);
    }
  }

  return kept;
}
