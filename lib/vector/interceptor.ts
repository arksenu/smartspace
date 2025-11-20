import Groq from "groq-sdk";
import { relevanceScoreCache } from "@/lib/cache/relevance-cache";
import { performanceTracker, OperationType } from "@/lib/analytics/performance";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Models for relevance scoring - using only the model that actually works
const FAST_MODEL = "llama-3.3-70b-versatile"; // Using the only stable model
const ACCURATE_MODEL = "llama-3.3-70b-versatile"; // Same model for consistency
const FALLBACK_MODEL = "llama-3.3-70b-versatile"; // Same model - it's the only one that works

export interface RelevanceScore {
  chunkId: string;
  score: number; // 0-4 integer
}

/**
 * Classify relevance of a document chunk to a user query using Groq LLM
 * @param userQuery The user's query
 * @param documentChunk The document chunk to evaluate
 * @returns Relevance score (0-4 integer)
 */
export async function scoreRelevance(
  userQuery: string,
  documentChunk: string,
  useAccurateModel: boolean = false
): Promise<number> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  // Check cache first
  const cachedScore = relevanceScoreCache.get(userQuery, documentChunk);
  if (cachedScore !== null) {
    performanceTracker.track(OperationType.CACHE_HIT, 0, {
      type: 'relevance_score',
      model: 'cached'
    });
    return cachedScore;
  }

  // Simplified prompt that's more likely to work with Groq models
  const prompt = `Classify the relevance of this document chunk to the user query.

User query: ${userQuery}

Document chunk: ${documentChunk}

Rate the relevance from 0 to 4:
- 0 = no semantic relation
- 1 = minimal or tangential relation  
- 2 = partially relevant
- 3 = strongly relevant
- 4 = directly answers or significantly supports the query

Output only the number (0, 1, 2, 3, or 4):`;

  // Helper to sleep/delay
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Using the same model regardless since only llama-3.3-70b-versatile works reliably
  const primaryModel = ACCURATE_MODEL; // Always use the working model

  // Try primary model first, fallback to alternative if it fails
  const tryModel = async (modelName: string, retryCount = 0): Promise<number | null> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      const response = await groq.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent scoring
        // For reasoning models, need more tokens. Use 500 to allow full reasoning + answer
        // For regular models, this is more than enough
        max_tokens: modelName === "openai/gpt-oss-120b" ? 500 : 50,
      });

      if (!response.choices || response.choices.length === 0) {
        console.error(`[Interceptor] Groq response has no choices for model ${modelName}`);
        return null;
      }

      const choice = response.choices[0];
      let content = choice?.message?.content?.trim() || "";

      // For reasoning models (like openai/gpt-oss-120b), the answer might be in the reasoning field
      // Check reasoning field if content is empty
      const message = choice?.message as any;
      if (!content && message?.reasoning) {
        const reasoning = message.reasoning.trim();
        // Try to extract score from reasoning - use reasoning as content source
        content = reasoning;
      }

      // Log if content is still empty (error case)
      if (!content) {
        console.error(`[Interceptor] Groq returned empty content for model ${modelName}. Finish reason: ${choice?.finish_reason}`);
        return null;
      }

      // Extract integer from response (handle cases where LLM adds extra text)
      // For reasoning models, look for patterns like "relevance is 3" or "score: 4" or just the last number
      const numbers = content.match(/\d+/g);
      if (!numbers || numbers.length === 0) {
        console.warn(`[Interceptor] Failed to parse relevance score from response for model ${modelName}`);
        return null;
      }

      // For reasoning models, try to find score patterns first
      let match: string | null = null;
      if (modelName === "openai/gpt-oss-120b" || message?.reasoning) {
        // Look for patterns like "relevance is 3", "score: 4", "rating: 2", etc.
        const scorePatterns = [
          /relevance\s+(?:is|:|=)\s*(\d)/i,
          /score\s*(?:is|:|=)\s*(\d)/i,
          /rating\s*(?:is|:|=)\s*(\d)/i,
          /answer\s*(?:is|:|=)\s*(\d)/i,
        ];

        for (const pattern of scorePatterns) {
          const found = content.match(pattern);
          if (found && found[1]) {
            match = found[1];
            break;
          }
        }
      }

      // If no pattern match, use the last number found (most likely the final answer after reasoning)
      if (!match) {
        match = numbers[numbers.length - 1];
      }

      const score = parseInt(match, 10);

      // Clamp to valid range [0, 4]
      if (score < 0) return 0;
      if (score > 4) return 4;

      return score;
    } catch (error: any) {
      // Handle rate limiting with retry
      if (error?.status === 429 && retryCount < maxRetries) {
        // Extract retry-after from headers (could be string or number)
        let retryAfterMs = baseDelay * Math.pow(2, retryCount); // Default exponential backoff

        if (error?.headers) {
          const retryAfterHeader = error.headers['retry-after'] || error.headers['Retry-After'];
          if (retryAfterHeader) {
            // Parse retry-after (could be seconds as string or number)
            const retryAfterSeconds = typeof retryAfterHeader === 'string'
              ? parseFloat(retryAfterHeader)
              : retryAfterHeader;
            retryAfterMs = Math.ceil(retryAfterSeconds * 1000);
            // Add a small buffer (10%) to be safe
            retryAfterMs = Math.ceil(retryAfterMs * 1.1);
          }
        }

        // Rate limited - will retry automatically
        await sleep(retryAfterMs);
        return tryModel(modelName, retryCount + 1);
      }

      // Check if it's a model not found/decommissioned error
      if (error instanceof Error) {
        if (error.message.includes("model") || error.message.includes("not found") || error.message.includes("invalid") || error.message.includes("decommissioned")) {
          // Model error - will try fallback, no need to log
          return null;
        }
      }
      console.error(`[Interceptor] Error scoring relevance with Groq model ${modelName}:`, error instanceof Error ? error.message : error);
      return null;
    }
  };

  // Try primary model first
  let score = await tryModel(primaryModel);

  // If primary model fails, try fallback model
  if (score === null) {
    score = await tryModel(FALLBACK_MODEL);
  }

  // If both fail, return 0 (no relation) to be conservative
  if (score === null) {
    console.warn("[Interceptor] All models failed to score relevance, returning 0");
    return 0;
  }

  // Cache the score for future use
  relevanceScoreCache.set(userQuery, documentChunk, score);

  return score;
}

/**
 * Score multiple chunks in a single LLM call for efficiency
 * @param userQuery The user's query
 * @param chunks Array of chunks to score (max 5 per batch)
 * @returns Array of scores in the same order as input
 */
async function scoreRelevanceBatchCall(
  userQuery: string,
  chunks: Array<{ chunkId: string; content: string }>,
  useAccurateModel: boolean = false
): Promise<RelevanceScore[]> {
  if (chunks.length === 0) return [];

  // Limit batch size to prevent context overflow
  const batchChunks = chunks.slice(0, 5);

  // Build batched prompt
  let batchPrompt = `Rate the relevance of each document chunk to the user query.

User query: ${userQuery}

Rate each chunk from 0 to 4:
- 0 = no semantic relation
- 1 = minimal or tangential relation
- 2 = partially relevant
- 3 = strongly relevant
- 4 = directly answers or significantly supports the query

Respond with ONLY a JSON array of scores in the same order as the chunks.

Chunks:
`;

  batchChunks.forEach((chunk, index) => {
    batchPrompt += `\n[Chunk ${index + 1}]\n${chunk.content.substring(0, 500)}...\n`;
  });

  batchPrompt += `\nOutput format: [score1, score2, score3, ...]`;

  const modelToUse = ACCURATE_MODEL; // Always use the only working model

  try {
    const response = await groq.chat.completions.create({
      model: modelToUse,
      messages: [{ role: "user", content: batchPrompt }],
      temperature: 0.1,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Try to parse JSON array
    let scores: number[];
    try {
      scores = JSON.parse(content);
      if (!Array.isArray(scores) || scores.length !== batchChunks.length) {
        throw new Error("Invalid response format");
      }
    } catch {
      // Fallback: try to extract numbers from response
      const numbers = content.match(/\d+/g);
      if (!numbers || numbers.length !== batchChunks.length) {
        throw new Error("Could not parse scores from response");
      }
      scores = numbers.map(n => Math.min(4, Math.max(0, parseInt(n, 10))));
    }

    return batchChunks.map((chunk, index) => ({
      chunkId: chunk.chunkId,
      score: scores[index] || 0,
    }));
  } catch (error) {
    console.error(`[Interceptor] Batch scoring failed, falling back to individual:`, error);
    // Fallback to individual scoring
    const results: RelevanceScore[] = [];
    for (const chunk of batchChunks) {
      const score = await scoreRelevance(userQuery, chunk.content, useAccurateModel);
      results.push({ chunkId: chunk.chunkId, score });
    }
    return results;
  }
}

/**
 * Score relevance for multiple chunks with optimized parallelization
 * Note: We're using llama-3.3-70b-versatile for everything since Groq keeps decommissioning other models
 * @param userQuery The user's query
 * @param chunks Array of chunks with their IDs and content
 * @returns Array of relevance scores
 */
export async function scoreRelevanceBatch(
  userQuery: string,
  chunks: Array<{ chunkId: string; content: string }>,
  useTwoStageFiltering: boolean = true // Ignored - we use single stage now
): Promise<RelevanceScore[]> {
  if (chunks.length === 0) return [];

  const results: RelevanceScore[] = [];

  // Check cache first and separate cached vs uncached chunks
  const uncachedChunks: typeof chunks = [];

  for (const chunk of chunks) {
    const cachedScore = relevanceScoreCache.get(userQuery, chunk.content);
    if (cachedScore !== null) {
      results.push({ chunkId: chunk.chunkId, score: cachedScore });
      performanceTracker.track(OperationType.CACHE_HIT, 0, {
        type: 'relevance_score_batch'
      });
    } else {
      uncachedChunks.push(chunk);
    }
  }

  if (uncachedChunks.length === 0) {
    console.log(`[Interceptor] All ${chunks.length} chunks found in cache`);
    return results;
  }

  console.log(`[Interceptor] Cache hits: ${results.length}/${chunks.length}, scoring ${uncachedChunks.length} chunks`);

  if (uncachedChunks.length > 0) {
    // Single-stage scoring with batch calls using the only working model
    console.log(`[Interceptor] Scoring with ${ACCURATE_MODEL} (the only model that works)`);

    const scoringResults = await performanceTracker.measure(
      OperationType.RELEVANCE_SCORING,
      async () => {
        const scores: RelevanceScore[] = [];

        // Process in batches of 5
        for (let i = 0; i < uncachedChunks.length; i += 5) {
          const batch = uncachedChunks.slice(i, i + 5);
          const batchScores = await scoreRelevanceBatchCall(userQuery, batch, false);
          scores.push(...batchScores);

          // Cache the scores
          for (let j = 0; j < batch.length; j++) {
            relevanceScoreCache.set(userQuery, batch[j].content, batchScores[j].score);
          }

          // Small delay between batches to avoid rate limiting
          if (i + 5 < uncachedChunks.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        return scores;
      },
      { model: ACCURATE_MODEL, count: uncachedChunks.length }
    );

    results.push(...scoringResults);
  }

  return results;
}
