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
import { withRetry } from "@/lib/utils/retry";
import { jobQueue, JobType } from "@/lib/queue";
import { initializeJobProcessors } from "@/lib/queue/processors";
import { performanceTracker, OperationType } from "@/lib/analytics/performance";

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

  // Initialize job processors on first request
  initializeJobProcessors();

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
      const verifiedResult = await performanceTracker.measure(
        OperationType.RELEVANCE_SCORING,
        () => runVerifiedRetrieval(message, user.id, undefined, true),  // Force verification when setting is enabled
        { verified_retrieval: true }
      );
      searchResults = verifiedResult.results;

      // Flush metrics after verified retrieval to ensure nested operations are saved
      await performanceTracker.flushMetrics().catch(() => {
        // Silently handle flush errors
      });

      // If null-retrieval, log it but continue with empty results
      if (verifiedResult.isNullRetrieval) {
        console.log("[Chat Route] ⚠️ Verified retrieval returned null (all relevance scores = 0)");
      } else {
        console.log(`[Chat Route] ✅ Verified retrieval completed: ${searchResults.length} relevant chunks returned`);
      }
    } else {
      console.log("[Chat Route] Using simple top-k retrieval (LLM-Verified Filter is OFF)");
      searchResults = await performanceTracker.measure(
        OperationType.VECTOR_SEARCH,
        () => vectorSearch(message, user.id, 5),
        { verified_retrieval: false }
      );
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

    // Save user message with retry mechanism - this is critical data
    try {
      await withRetry(
        () => saveMessage({
          conversationId: convId,
          userId: user.id,
          role: "user",
          content: message,
          retrievedChunkIds: searchResults.map((r) => r.chunkId),
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          onRetry: (error, attempt) => {
            console.error(`Failed to save user message (attempt ${attempt}/3):`, error);
          }
        }
      );
    } catch (error) {
      console.error("Failed to save user message after all retries:", error);
      // Return error response instead of continuing with potentially lost data
      return new Response(
        JSON.stringify({
          error: "Failed to save message. Please try again.",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

          // Send metrics data to the frontend before closing the stream
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "metrics",
                latencyMs,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
              })}\n\n`
            )
          );

          // Save assistant message with retry - critical for conversation history
          // We'll save it async but add to a queue if it fails
          const saveAssistantMessage = async () => {
            try {
              await withRetry(
                () => saveMessage({
                  conversationId: convId,
                  userId: user.id,
                  role: "assistant",
                  content: fullResponse,
                  retrievedChunkIds: searchResults.map((r) => r.chunkId),
                  tokensUsed: outputTokens,
                  modelUsed: model,
                  latencyMs,
                }),
                {
                  maxAttempts: 3,
                  initialDelayMs: 200,
                  onRetry: (error, attempt) => {
                    console.error(`Failed to save assistant message (attempt ${attempt}/3):`, error);
                  }
                }
              );
            } catch (error) {
              console.error("Failed to save assistant message after retries:", error);
              // Add to job queue for later retry
              await jobQueue.addJob(JobType.SAVE_MESSAGE, {
                conversationId: convId,
                userId: user.id,
                role: "assistant",
                content: fullResponse,
                retrievedChunkIds: searchResults.map((r) => r.chunkId),
                tokensUsed: outputTokens,
                modelUsed: model,
                latencyMs,
              });
              console.log("Added assistant message to job queue for retry");
            }
          };

          // Log evaluation with retry but don't let it block
          const logEvaluation = async () => {
            try {
              await withRetry(
                () => logEval({
                  userId: user.id,
                  conversationId: convId,
                  provider,
                  model: model || "default",
                  tokensInput: inputTokens,
                  tokensOutput: outputTokens,
                  latencyMs,
                }),
                {
                  maxAttempts: 2, // Less critical, fewer retries
                  initialDelayMs: 500,
                  onRetry: (error, attempt) => {
                    console.error(`Failed to log evaluation (attempt ${attempt}/2):`, error);
                  }
                }
              );
            } catch (error) {
              console.error("Failed to log evaluation after retries:", error);
              // Add to job queue for later retry
              await jobQueue.addJob(JobType.LOG_EVAL, {
                userId: user.id,
                conversationId: convId,
                provider,
                model: model || "default",
                tokensInput: inputTokens,
                tokensOutput: outputTokens,
                latencyMs,
              });
              console.log("Added evaluation logging to job queue for retry");
            }
          };

          // Execute both operations in parallel, but don't block the response
          Promise.all([saveAssistantMessage(), logEvaluation()]).catch((err) => {
            console.error("Unexpected error in post-response operations:", err);
          });

          // Update conversation summary with retry (non-critical operation)
          if (useMemory) {
            const updateSummary = async () => {
              try {
                await withRetry(
                  () => updateConversationSummary({
                    conversationId: convId,
                    userId: user.id,
                    provider: provider as LLMProvider,
                    model,
                  }),
                  {
                    maxAttempts: 2,
                    initialDelayMs: 1000,
                    onRetry: (error, attempt) => {
                      console.error(`Failed to update summary (attempt ${attempt}/2):`, error);
                    }
                  }
                );
              } catch (error) {
                console.error("Failed to update conversation summary after retries:", error);
                // Add to job queue for later retry
                await jobQueue.addJob(JobType.UPDATE_SUMMARY, {
                  conversationId: convId,
                  userId: user.id,
                  provider: provider as LLMProvider,
                  model,
                });
                console.log("Added summary update to job queue for retry");
              }
            };

            updateSummary().catch((err) => {
              console.error("Unexpected error updating summary:", err);
            });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          // Try to flush performance metrics at end of request
          performanceTracker.flushMetrics().catch(() => {
            // Silently ignore flush errors
          });

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

