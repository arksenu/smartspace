import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { vectorSearch } from "@/lib/vector/search";
import { buildPrompt } from "@/lib/rag/prompt-builder";
import { getConversationHistory, updateConversationSummary } from "@/lib/chat/memory";
import { saveMessage } from "@/lib/chat/save-message";
import { streamChatCompletion, LLMProvider } from "@/lib/llm";
import { logEval } from "@/lib/analytics/logger";
import { getSettings } from "@/app/actions/settings/update";
import { get_encoding, TiktokenEncoding } from "tiktoken";

// Helper function to count tokens accurately
function countTokens(text: string, encodingName: TiktokenEncoding = "cl100k_base"): number {
  const encoding = get_encoding(encodingName);
  const tokens = encoding.encode(text);
  encoding.free();
  return tokens.length;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const user = await requireAuth();
  const supabase = await createClient();

  try {
    // Load user settings as defaults
    const userSettings = await getSettings();
    const defaultProvider = userSettings?.provider || "openai";
    const defaultModel = userSettings?.model || "gpt-4-turbo-preview";
    const defaultTemperature = userSettings?.temperature ?? 0.7;
    const defaultSystemPrompt = userSettings?.systemPrompt;

    const { conversationId, message, provider = defaultProvider, model = defaultModel, temperature = defaultTemperature } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

      // Get or create conversation
      let convId: string;
      let conversationMeta: { use_memory?: boolean | null; system_prompt?: string | null } | null = null;

      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            title: message.substring(0, 50),
            model_provider: provider,
            model_name: model,
            temperature: temperature,
            system_prompt: defaultSystemPrompt,
          })
          .select()
          .single();

        if (convError) {
          throw new Error(`Failed to create conversation: ${convError.message}`);
        }

        convId = newConv.id;
        conversationMeta = newConv;
      } else {
        convId = conversationId;
        const { data: existingConv, error: fetchConvError } = await supabase
          .from("conversations")
          .select("use_memory, system_prompt")
          .eq("id", convId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchConvError) {
          throw new Error(`Failed to load conversation settings: ${fetchConvError.message}`);
        }

        if (!existingConv) {
          throw new Error("Conversation not found for the current user.");
        }

        conversationMeta = existingConv;
      }

      const useMemory = conversationMeta?.use_memory ?? true;
      const activeSystemPrompt = conversationMeta?.system_prompt ?? defaultSystemPrompt;

      // Retrieve relevant chunks
      const searchResults = await vectorSearch(message, user.id, 5);

      // Get conversation history
      const historyContext = await getConversationHistory({
        conversationId: convId,
        userId: user.id,
        useMemory,
        model,
      });

      // Build prompt with user's system prompt if available
      const messages = buildPrompt({
        systemPrompt: activeSystemPrompt,
        contextChunks: searchResults,
        conversationHistory: historyContext.messages,
        userQuery: message,
      });

    // Save user message
    await saveMessage({
      conversationId: convId,
      userId: user.id,
      role: "user",
      content: message,
      retrievedChunkIds: searchResults.map((r) => r.chunkId),
    });

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        const encoder = new TextEncoder();

          try {
            // Emit memory metadata if we have it
            if (historyContext.summaryIncluded || historyContext.truncatedMessages > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "memory",
                    summaryIncluded: historyContext.summaryIncluded,
                    truncatedMessages: historyContext.truncatedMessages,
                    tokensUsed: historyContext.tokensUsed,
                    summary: historyContext.summaryText ?? undefined,
                  })}\n\n`
                )
              );
            }

            // Send sources first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "sources",
                sources: searchResults.map((r) => ({
                  chunkId: r.chunkId,
                  content: r.content,
                  similarity: r.similarity,
                })),
              })}\n\n`
            )
          );

            for await (const chunk of streamChatCompletion(
              provider as LLMProvider,
              messages,
              { model, temperature }
            )) {
            fullResponse += chunk.content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          // Save assistant message
          const latencyMs = Date.now() - startTime;

          // Count tokens accurately
          const inputTokens = countTokens(JSON.stringify(messages));
          const outputTokens = countTokens(fullResponse);

          await saveMessage({
            conversationId: convId,
            userId: user.id,
            role: "assistant",
            content: fullResponse,
            retrievedChunkIds: searchResults.map((r) => r.chunkId),
            tokensUsed: outputTokens,
            modelUsed: model,
            latencyMs,
          });

          // Log evaluation
          await logEval({
            userId: user.id,
            conversationId: convId,
            provider,
            model: model || "default",
            tokensInput: inputTokens,
            tokensOutput: outputTokens,
            latencyMs,
          });

            if (useMemory) {
              updateConversationSummary({
                conversationId: convId,
                userId: user.id,
                provider: provider as LLMProvider,
                model,
              }).catch((err) => {
                console.error("Failed to update conversation summary", err);
              });
            }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to process chat request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

