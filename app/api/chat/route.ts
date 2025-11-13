import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { vectorSearch } from "@/lib/vector/search";
import { buildPrompt } from "@/lib/rag/prompt-builder";
import { getConversationHistory } from "@/lib/chat/memory";
import { saveMessage } from "@/lib/chat/save-message";
import { streamChatCompletion } from "@/lib/llm";
import { logEval } from "@/lib/analytics/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const user = await requireAuth();
  const supabase = await createClient();

  try {
    const { conversationId, message, provider = "openai", model, temperature } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: message.substring(0, 50),
          model_provider: provider,
          model_name: model,
          temperature: temperature ?? 0.7,
        })
        .select()
        .single();

      if (convError) {
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }

      convId = newConv.id;
    }

    // Retrieve relevant chunks
    const searchResults = await vectorSearch(message, user.id, 5);

    // Get conversation history
    const history = await getConversationHistory(convId, user.id, 10);

    // Build prompt
    const messages = buildPrompt({
      contextChunks: searchResults,
      conversationHistory: history.map((h) => ({
        role: h.role,
        content: h.content,
      })),
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
          for await (const chunk of streamChatCompletion(
            provider as "openai" | "anthropic" | "groq",
            messages,
            { model, temperature }
          )) {
            fullResponse += chunk.content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          // Save assistant message
          const latencyMs = Date.now() - startTime;
          await saveMessage({
            conversationId: convId,
            userId: user.id,
            role: "assistant",
            content: fullResponse,
            retrievedChunkIds: searchResults.map((r) => r.chunkId),
            tokensUsed: fullResponse.split(/\s+/).length * 1.3, // Rough estimate
            modelUsed: model,
            latencyMs,
          });

          // Log evaluation
          await logEval({
            userId: user.id,
            conversationId: convId,
            provider,
            model: model || "default",
            tokensInput: message.split(/\s+/).length,
            tokensOutput: fullResponse.split(/\s+/).length,
            latencyMs,
          });

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

