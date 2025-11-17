import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// User requested openai/gpt-oss-120b - it's a reasoning model that outputs to reasoning field
// Using llama-3.3-70b-versatile as primary (current model, llama-3.1 was decommissioned)
// openai/gpt-oss-120b as fallback (requires extracting from reasoning field)
const INTERCEPTOR_MODEL = "llama-3.3-70b-versatile"; // Primary: current working model
const FALLBACK_MODEL = "openai/gpt-oss-120b"; // Fallback: user-requested reasoning model

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
  documentChunk: string
): Promise<number> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
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

  // Try primary model first (known working model)
  let score = await tryModel(INTERCEPTOR_MODEL);
  
  // If primary model fails, try fallback (user-requested model)
  if (score === null) {
    score = await tryModel(FALLBACK_MODEL);
  }
  
  // If both fail, return 0 (no relation) to be conservative
  if (score === null) {
    console.warn("[Interceptor] Both models failed to score relevance, returning 0");
    return 0;
  }
  
  return score;
}

/**
 * Score relevance for multiple chunks with rate limiting
 * Processes chunks in batches to avoid hitting rate limits
 * @param userQuery The user's query
 * @param chunks Array of chunks with their IDs and content
 * @returns Array of relevance scores
 */
export async function scoreRelevanceBatch(
  userQuery: string,
  chunks: Array<{ chunkId: string; content: string }>
): Promise<RelevanceScore[]> {
  if (chunks.length === 0) return [];

  // Process in smaller batches to avoid rate limits
  // Groq free tier: 8000 TPM, so we'll batch conservatively
  const BATCH_SIZE = 3; // Process 3 at a time
  const BATCH_DELAY = 500; // 500ms delay between batches
  
  const results: RelevanceScore[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map((chunk) =>
      scoreRelevance(userQuery, chunk.content).then((score) => ({
        chunkId: chunk.chunkId,
        score,
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
}
