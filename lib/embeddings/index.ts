import { generateEmbeddings as openaiEmbeddings } from "./openai";

export type EmbeddingProvider = "openai";

export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider = "openai"
): Promise<number[][]> {
  switch (provider) {
    case "openai":
      return openaiEmbeddings(texts);
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
}

