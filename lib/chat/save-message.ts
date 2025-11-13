import { createClient } from "@/lib/supabase/server";

export interface SaveMessageParams {
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  retrievedChunkIds?: string[];
  tokensUsed?: number;
  modelUsed?: string;
  latencyMs?: number;
}

export async function saveMessage(params: SaveMessageParams): Promise<string> {
  const supabase = await createClient();

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      retrieved_chunk_ids: params.retrievedChunkIds || [],
      tokens_used: params.tokensUsed,
      model_used: params.modelUsed,
      latency_ms: params.latencyMs,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Update conversation updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.conversationId);

  return message.id;
}

