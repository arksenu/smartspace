import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const stream = await openai.chat.completions.create({
    model: options.model || "gpt-4-turbo-preview",
    messages: messages as any,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    yield {
      content,
      done: chunk.choices[0]?.finish_reason === "stop",
    };
  }
}

