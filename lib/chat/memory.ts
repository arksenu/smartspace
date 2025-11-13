import { createClient } from "@/lib/supabase/server";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

export async function getConversationHistory(
  conversationId: string,
  userId: string,
  limit: number = 20
): Promise<Message[]> {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch conversation history: ${error.message}`);
  }

  return (messages || []).map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    createdAt: new Date(msg.created_at),
  }));
}

