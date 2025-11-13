import { streamChatCompletion as openaiStream } from "./providers/openai";
import { streamChatCompletion as anthropicStream } from "./providers/anthropic";
import { streamChatCompletion as groqStream } from "./providers/groq";

export type LLMProvider = "openai" | "anthropic" | "groq";

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function* streamChatCompletion(
  provider: LLMProvider,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: LLMOptions = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  switch (provider) {
    case "openai":
      yield* openaiStream(messages, options);
      break;
    case "anthropic":
      yield* anthropicStream(messages, options);
      break;
    case "groq":
      yield* groqStream(messages, options);
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

