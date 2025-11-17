import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const INTERCEPTOR_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.1-70b-versatile"; // Fallback if primary model fails

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

  const prompt = `Given the user_query and document_chunk, classify relevance.

Output ONLY an integer 0–4.

0 = no semantic relation.
1 = minimal or tangential relation.
2 = partially relevant.
3 = strongly relevant.
4 = directly answers or significantly supports the query.

user_query: ${userQuery}

document_chunk: ${documentChunk}

Relevance score (0-4):`;

  // Try primary model first, fallback to alternative if it fails
  const tryModel = async (modelName: string): Promise<number | null> => {
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
        max_tokens: 50, // Increased to ensure we get a response
      });

      // Log full response for debugging
      if (!response.choices || response.choices.length === 0) {
        console.error(`[Interceptor] Groq response has no choices for model ${modelName}:`, JSON.stringify(response, null, 2));
        return null;
      }

      const choice = response.choices[0];
      const content = choice?.message?.content?.trim() || "";
      
      // Log if content is empty
      if (!content) {
        console.error(`[Interceptor] Groq returned empty content for model ${modelName}. Full response:`, JSON.stringify({
          finish_reason: choice?.finish_reason,
          message: choice?.message,
          response_id: (response as any).id,
        }, null, 2));
        return null;
      }
      
      // Extract integer from response (handle cases where LLM adds extra text)
      const match = content.match(/\d+/);
      if (!match) {
        console.warn(`[Interceptor] Failed to parse relevance score from: "${content}" for model ${modelName}. Full response:`, JSON.stringify(choice?.message, null, 2));
        return null;
      }

      const score = parseInt(match[0], 10);
      
      // Clamp to valid range [0, 4]
      if (score < 0) return 0;
      if (score > 4) return 4;
      
      return score;
    } catch (error) {
      console.error(`[Interceptor] Error scoring relevance with Groq model ${modelName}:`, error);
      if (error instanceof Error) {
        console.error(`[Interceptor] Error message:`, error.message);
        // Check if it's a model not found error
        if (error.message.includes("model") || error.message.includes("not found") || error.message.includes("invalid")) {
          console.warn(`[Interceptor] Model ${modelName} may not be available, will try fallback`);
        }
      }
      return null;
    }
  };

  // Try primary model first
  let score = await tryModel(INTERCEPTOR_MODEL);
  
  // If primary model fails, try fallback
  if (score === null) {
    console.log(`[Interceptor] Primary model ${INTERCEPTOR_MODEL} failed, trying fallback ${FALLBACK_MODEL}`);
    score = await tryModel(FALLBACK_MODEL);
  }
  
  // If both fail, return 0 (no relation) to be conservative
  if (score === null) {
    console.error("[Interceptor] Both models failed, returning 0");
    return 0;
  }
  
  return score;
}

/**
 * Score relevance for multiple chunks in parallel
 * @param userQuery The user's query
 * @param chunks Array of chunks with their IDs and content
 * @returns Array of relevance scores
 */
export async function scoreRelevanceBatch(
  userQuery: string,
  chunks: Array<{ chunkId: string; content: string }>
): Promise<RelevanceScore[]> {
  // Score all chunks in parallel for efficiency
  const promises = chunks.map((chunk) =>
    scoreRelevance(userQuery, chunk.content).then((score) => ({
      chunkId: chunk.chunkId,
      score,
    }))
  );

  return Promise.all(promises);
}
