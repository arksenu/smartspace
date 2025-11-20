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

// Add interface to track embeddings through the pipeline
export interface ScoredChunkWithEmbedding extends ScoredChunk {
  embedding?: number[];
}

/**
 * Apply Maximal Marginal Relevance (MMR) for diversity
 * Uses chunk embeddings to compute actual chunk-to-chunk similarity
 * @param chunks Chunks to re-rank
 * @param lambda Balance between relevance (1.0) and diversity (0.0). Default 0.5
 * @param existingEmbeddings Optional pre-computed embeddings to avoid regeneration
 * @returns Chunks with MMR scores and their embeddings for reuse
 */
export async function applyMMR(
  chunks: ScoredChunk[],
  lambda: number = 0.5,
  existingEmbeddings?: number[][]
): Promise<{ chunks: ScoredChunkWithEmbedding[]; embeddings: number[][] }> {
  if (chunks.length === 0) return { chunks: [], embeddings: [] };

  // If only one chunk, no need for MMR
  if (chunks.length === 1) {
    const embedding = existingEmbeddings?.[0];
    if (embedding) {
      return {
        chunks: [{ ...chunks[0], mmrScore: chunks[0].similarity, embedding }],
        embeddings: [embedding]
      };
    }
    const [newEmbedding] = await generateEmbeddings([chunks[0].content]);
    return {
      chunks: [{ ...chunks[0], mmrScore: chunks[0].similarity, embedding: newEmbedding }],
      embeddings: [newEmbedding]
    };
  }

  // Use existing embeddings if provided, otherwise generate them
  const embeddings = existingEmbeddings || await generateEmbeddings(chunks.map(c => c.content));

  const selected: ScoredChunkWithEmbedding[] = [];
  const selectedIndices: number[] = [];
  const remaining = chunks.map((chunk, idx) => ({ chunk, idx, embedding: embeddings[idx] }));

  // Start with the highest similarity chunk
  remaining.sort((a, b) => b.chunk.similarity - a.chunk.similarity);
  const first = remaining.shift()!;
  selected.push({ ...first.chunk, mmrScore: first.chunk.similarity, embedding: first.embedding });
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
    selected.push({ ...best.chunk, mmrScore: bestMMR, embedding: best.embedding });
    selectedIndices.push(best.idx);
  }

  return { chunks: selected, embeddings };
}

/**
 * Remove near-duplicates with cosine similarity > 0.95
 * Keeps the first occurrence of each duplicate group
 * Reuses embeddings if provided (for efficiency when called after MMR)
 */
export async function removeNearDuplicates(
  chunks: ScoredChunkWithEmbedding[],
  embeddings?: number[][]
): Promise<ScoredChunk[]> {
  if (chunks.length === 0) return [];

  // Use embeddings from chunks if they have them (from MMR), otherwise use provided embeddings
  let chunkEmbeddings: number[][];
  const hasEmbeddingsInChunks = chunks[0].embedding !== undefined;

  if (hasEmbeddingsInChunks) {
    chunkEmbeddings = chunks.map(c => c.embedding!);
  } else if (embeddings && embeddings.length === chunks.length) {
    chunkEmbeddings = embeddings;
  } else {
    // Only generate if we absolutely have to
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
      // Remove the embedding field before returning to keep the result clean
      const { embedding: _, ...cleanChunk } = chunk as ScoredChunkWithEmbedding;
      kept.push(cleanChunk as ScoredChunk);
      keptEmbeddings.push(embedding);
    }
  }

  return kept;
}
