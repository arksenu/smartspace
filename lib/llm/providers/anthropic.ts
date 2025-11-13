import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface StreamChunk {
  content: string;
  done: boolean;
}

export async function* streamChatCompletion(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  // Convert messages format for Anthropic
  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const conversationMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })) as Array<{ role: "user" | "assistant"; content: string }>;

  const stream = await anthropic.messages.stream({
    model: options.model || "claude-3-opus-20240229",
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
    system: systemMessage,
    messages: conversationMessages,
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield {
        content: chunk.delta.text,
        done: false,
      };
    }
  }

  yield { content: "", done: true };
}

