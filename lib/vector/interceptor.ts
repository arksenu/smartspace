import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const INTERCEPTOR_MODEL = "openai/gpt-oss-120b";

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

  try {
    const response = await groq.chat.completions.create({
      model: INTERCEPTOR_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent scoring
      max_tokens: 10, // Only need a single integer
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    
    // Extract integer from response (handle cases where LLM adds extra text)
    const match = content.match(/\d+/);
    if (!match) {
      console.warn(`Failed to parse relevance score from: ${content}`);
      return 0; // Default to no relation if parsing fails
    }

    const score = parseInt(match[0], 10);
    
    // Clamp to valid range [0, 4]
    if (score < 0) return 0;
    if (score > 4) return 4;
    
    return score;
  } catch (error) {
    console.error("Error scoring relevance with Groq:", error);
    // On error, return 0 (no relation) to be conservative
    return 0;
  }
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
