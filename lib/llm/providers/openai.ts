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
    webSearchEnabled?: boolean;
  } = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  // Convert messages array to Responses API format
  // Extract system messages to instructions
  const systemMessages: string[] = [];
  const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemMessages.push(message.content);
    } else {
      conversationMessages.push({
        role: message.role,
        content: message.content,
      });
    }
  }

  // Combine system messages into instructions
  const instructions = systemMessages.length > 0
    ? systemMessages.join("\n\n")
    : undefined;

  // Format conversation history + current query into input
  // For multi-turn conversations, format as a conversation
  let input: string;
  if (conversationMessages.length === 1) {
    // Single message - just use the content
    input = conversationMessages[0].content;
  } else {
    // Multiple messages - format as conversation
    const formattedMessages = conversationMessages.map((msg) => {
      const roleLabel = msg.role === "user" ? "User" : "Assistant";
      return `${roleLabel}: ${msg.content}`;
    });
    input = formattedMessages.join("\n\n");
  }

  const modelToUse = options.model || "gpt-5.1";

  console.log(`[OpenAI Provider] Attempting to use Responses API`);
  console.log(`[OpenAI Provider] Model: ${modelToUse}`);
  console.log(`[OpenAI Provider] Temperature: ${options.temperature ?? 1.0}`);
  console.log(`[OpenAI Provider] Max Tokens: ${options.maxTokens ?? 'default'}`);
  console.log(`[OpenAI Provider] Web Search Enabled: ${options.webSearchEnabled ?? false}`);

  // Prepare tools array if web search is enabled
  const tools = options.webSearchEnabled ? [{ type: "web_search" as const }] : undefined;

  try {
    const stream = await openai.responses.create({
      model: modelToUse,
      input: input,
      instructions: instructions,
      temperature: options.temperature ?? 1.0,
      max_output_tokens: options.maxTokens ?? undefined,
      tools: tools,
      stream: true,
    });

    console.log(`[OpenAI Provider] ✅ Successfully using Responses API with model: ${modelToUse}`);

    for await (const chunk of stream) {
      // Responses API uses discriminated union types based on the 'type' field
      let content = "";
      let done = false;

      // Handle text delta events - these contain the streaming text content
      if (chunk.type === 'response.output_text.delta') {
        // TypeScript narrows chunk to ResponseTextDeltaEvent here
        content = chunk.delta || "";
      }
      // Handle text done events - these indicate a text part is complete
      else if (chunk.type === 'response.output_text.done') {
        // TypeScript narrows chunk to ResponseTextDoneEvent here
        // The done event may contain final text, but we've already received deltas
        // Mark as done but don't add content (it's already been streamed)
        done = true;
      }
      // Handle response completion - the entire response is complete
      else if (chunk.type === 'response.completed') {
        // TypeScript narrows chunk to ResponseCompletedEvent here
        done = true;
      }
      // Handle response failed/incomplete events
      else if (chunk.type === 'response.failed' || chunk.type === 'response.incomplete') {
        const errorMessage = (chunk as any).error?.message ||
          (chunk.type === 'response.failed' ? 'Response generation failed' : 'Response generation incomplete');
        const errorCode = (chunk as any).error?.code;

        console.error(`[OpenAI Provider] ❌ Response ${chunk.type}: `, {
          message: errorMessage,
          code: errorCode,
          event: chunk,
        });

        // Throw an error to properly propagate the failure
        throw new Error(`OpenAI Responses API ${chunk.type}: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ''}`);
      }

      // Only yield if we have content or if we're done
      if (content || done) {
        yield {
          content,
          done,
        };
      }
    }
  } catch (error) {
    // If Responses API is not available, fall back to Chat Completions API
    // Don't fallback for response.failed/incomplete - those should propagate
    // Note: Web search is only available with Responses API, not Chat Completions API
    if (error instanceof Error &&
      !error.message.includes('response.failed') &&
      !error.message.includes('response.incomplete') &&
      (error.message.includes("responses") || error.message.includes("not found"))) {
      console.log(`[OpenAI Provider] ⚠️ Responses API not available: ${error.message}`);
      console.log(`[OpenAI Provider] Falling back to Chat Completions API`);
      console.log(`[OpenAI Provider] Model: ${modelToUse}`);
      if (options.webSearchEnabled) {
        console.log(`[OpenAI Provider] ⚠️ Web search is not available with Chat Completions API fallback`);
      }

      // Fallback to Chat Completions API
      const stream = await openai.chat.completions.create({
        model: modelToUse,
        messages: messages as any,
        temperature: options.temperature ?? 1.0,
        max_tokens: options.maxTokens,
        stream: true,
      });

      console.log(`[OpenAI Provider] ✅ Successfully using Chat Completions API (fallback) with model: ${modelToUse}`);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        yield {
          content,
          done: chunk.choices[0]?.finish_reason === "stop",
        };
      }
    } else {
      throw error;
    }
  }
}

