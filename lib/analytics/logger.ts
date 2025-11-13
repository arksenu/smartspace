import { createClient } from "@/lib/supabase/server";

export interface LogEvalParams {
  userId: string;
  conversationId?: string;
  messageId?: string;
  provider?: string;
  model?: string;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  requestData?: any;
  responseData?: any;
  error?: string;
}

export async function logEval(params: LogEvalParams): Promise<void> {
  const supabase = await createClient();

  await supabase.from("eval_logs").insert({
    user_id: params.userId,
    conversation_id: params.conversationId,
    message_id: params.messageId,
    provider: params.provider,
    model: params.model,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    latency_ms: params.latencyMs,
    request_data: params.requestData,
    response_data: params.responseData,
    error: params.error,
  });
}

