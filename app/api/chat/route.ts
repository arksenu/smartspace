import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { vectorSearch, MIN_SIMILARITY_THRESHOLD } from "@/lib/vector/search";
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

// Helper function to count tokens for messages array
// Counts only the actual message content (role + content), not JSON syntax
// This matches how LLM APIs tokenize messages internally
function countMessageTokens(messages: Array<{ role: string; content: string }>, encodingName: TiktokenEncoding = "cl100k_base"): number {
  const encoding = get_encoding(encodingName);
  let totalTokens = 0;

  for (const message of messages) {
    // Count role name tokens (e.g., "user", "assistant", "system")
    const roleTokens = encoding.encode(message.role);
    // Count content tokens
    const contentTokens = encoding.encode(message.content);
    // Most LLM APIs format messages internally, typically as "role\ncontent" or "role: content"
    // We count role + content tokens, which is accurate and avoids counting JSON syntax
    // The +2 accounts for typical formatting overhead (newline/separator between role and content)
    totalTokens += roleTokens.length + contentTokens.length + 2;
  }

  encoding.free();
  return totalTokens;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const user = await requireAuth();
  const supabase = await createClient();

  try {
    // Load user settings as defaults
    const userSettings = await getSettings();
    const defaultProvider = userSettings?.provider || "openai";
    const defaultModel = userSettings?.model || "gpt-5.1";
    const defaultTemperature = userSettings?.temperature ?? 1.0;
    const defaultSystemPrompt = userSettings?.systemPrompt;
    const defaultWebSearchEnabled = userSettings?.webSearchEnabled ?? false;

    const { conversationId, message, provider = defaultProvider, model = defaultModel, temperature = defaultTemperature } = await request.json();

    // Log the incoming request configuration
    console.log(`[Chat Route] New chat request`);
    console.log(`[Chat Route] Provider: ${provider}`);
    console.log(`[Chat Route] Model: ${model}`);
    console.log(`[Chat Route] Temperature: ${temperature}`);
    console.log(`[Chat Route] Conversation ID: ${conversationId || 'New conversation'}`);

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
    // Use verified retrieval if enabled, otherwise use simple top-k retrieval
    let searchResults;
    const useVerifiedRetrieval = userSettings?.llmVerifiedRetrieval ?? false;
    
    if (useVerifiedRetrieval) {
      console.log("[Chat Route] 🔍 LLM-Verified Retrieval Filter is ENABLED - using advanced filtering pipeline");
      const { runVerifiedRetrieval } = await import("@/lib/vector/filter");
      const verifiedResult = await runVerifiedRetrieval(message, user.id);
      searchResults = verifiedResult.results;
      
      // If null-retrieval, log it but continue with empty results
      if (verifiedResult.isNullRetrieval) {
        console.log("[Chat Route] ⚠️ Verified retrieval returned null (all relevance scores = 0)");
      } else {
        console.log(`[Chat Route] ✅ Verified retrieval completed: ${searchResults.length} relevant chunks returned`);
      }
    } else {
      console.log("[Chat Route] Using simple top-k retrieval (LLM-Verified Filter is OFF)");
      searchResults = await vectorSearch(message, user.id, 5);
    }

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
          // Emit conversation ID if this is a new conversation
          if (!conversationId) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "conversation",
                  conversationId: convId,
                })}\n\n`
              )
            );
          }

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

          // Send sources only if there are meaningful results
          // Filter to only include sources that would display as at least 1% similarity
          const meaningfulSources = searchResults.filter((r) => {
            // Only filter out sources that are truly 0% or would round to 0%
            const displayedPercent = Math.round(r.similarity * 100);
            return r.similarity > MIN_SIMILARITY_THRESHOLD && displayedPercent > 0;
          });

          if (meaningfulSources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "sources",
                  sources: meaningfulSources.map((r) => ({
                    chunkId: r.chunkId,
                    content: r.content,
                    similarity: r.similarity,
                  })),
                })}\n\n`
              )
            );
          }

          // Log the LLM request details
          console.log(`[Chat Route] Calling LLM with:`);
          console.log(`[Chat Route] - Provider: ${provider}`);
          console.log(`[Chat Route] - Model: ${model}`);
          console.log(`[Chat Route] - Temperature: ${temperature}`);
          console.log(`[Chat Route] - Message count: ${messages.length}`);

          // Use web search setting from user settings if OpenAI provider
          const webSearchEnabled = provider === "openai" ? defaultWebSearchEnabled : false;

          for await (const chunk of streamChatCompletion(
            provider as LLMProvider,
            messages,
            { model, temperature, webSearchEnabled }
          )) {
            fullResponse += chunk.content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          // Save assistant message
          const latencyMs = Date.now() - startTime;

          // Count tokens accurately - only count actual message content, not JSON syntax
          const inputTokens = countMessageTokens(messages);
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

