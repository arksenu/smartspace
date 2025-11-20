import { generateEmbeddings as openaiEmbeddings } from "./openai";
import { embeddingCache } from "./cache";
import { performanceTracker, OperationType } from "@/lib/analytics/performance";

export type EmbeddingProvider = "openai";

export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider = "openai"
): Promise<number[][]> {
  // Check cache first
  const { cached, missing } = embeddingCache.getMultiple(texts);

  if (missing.length === 0) {
    // All embeddings were cached
    console.log(`[Embeddings] Retrieved ${texts.length} embeddings from cache`);
    performanceTracker.track(OperationType.CACHE_HIT, 0, {
      count: texts.length,
      type: 'embeddings'
    });
    return texts.map((_, index) => cached.get(index)!);
  }

  // Generate embeddings only for missing texts
  const missingTexts = missing.map(index => texts[index]);
  console.log(`[Embeddings] Cache hit: ${cached.size}/${texts.length}, generating ${missing.length} new embeddings`);

  // Track both cache hits and misses for partial cache scenarios
  if (cached.size > 0) {
    performanceTracker.track(OperationType.CACHE_HIT, 0, {
      count: cached.size,
      type: 'embeddings'
    });
  }

  if (missing.length > 0) {
    performanceTracker.track(OperationType.CACHE_MISS, 0, {
      count: missing.length,
      type: 'embeddings'
    });
  }

  let newEmbeddings: number[][];
  switch (provider) {
    case "openai":
      newEmbeddings = await performanceTracker.measure(
        OperationType.EMBEDDING_GENERATION,
        () => openaiEmbeddings(missingTexts),
        { provider, count: missingTexts.length }
      );
      break;
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }

  // Store new embeddings in cache
  embeddingCache.setMultiple(missingTexts, newEmbeddings);

  // Combine cached and new embeddings in correct order
  const result: number[][] = [];
  let newEmbeddingIndex = 0;

  for (let i = 0; i < texts.length; i++) {
    if (cached.has(i)) {
      result.push(cached.get(i)!);
    } else {
      result.push(newEmbeddings[newEmbeddingIndex++]);
    }
  }

  return result;
}

