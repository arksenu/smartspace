import { SearchResult } from "@/lib/vector/search";

export interface BuildPromptOptions {
  systemPrompt?: string;
  contextChunks: SearchResult[];
  conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userQuery: string;
  maxContextTokens?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions based on the provided context from the user's documents. Use the context to provide accurate and relevant answers. If the context doesn't contain enough information to answer the question, say so.`;

export function buildPrompt(options: BuildPromptOptions): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    contextChunks,
    conversationHistory,
    userQuery,
    maxContextTokens = 4000,
  } = options;

  // Build context from retrieved chunks
  const contextText = contextChunks
    .map((chunk, index) => `[Document ${index + 1}]\n${chunk.content}`)
    .join("\n\n");

  // Build the full prompt (system prompt is already in system message, don't duplicate)
  const fullPrompt = `Context from documents:
${contextText}

Based on the context above, please answer the following question. If the context doesn't contain enough information, please say so.

Question: ${userQuery}`;

  // Build messages array
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: fullPrompt },
  ];

  return messages;
}

