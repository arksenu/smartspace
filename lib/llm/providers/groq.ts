import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
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
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const stream = await groq.chat.completions.create({
    model: options.model || "llama-3.1-70b-versatile",
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

