import { createClient } from "@/lib/supabase/server";
import { get_encoding, TiktokenEncoding } from "tiktoken";
import { LLMProvider, streamChatCompletion } from "@/lib/llm";

interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  metadata?: Record<string, any> | null;
}

const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "gpt-4-turbo-preview": 128000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4.1": 128000,
  "gpt-4.1-mini": 128000,
  "gpt-4.1-nano": 65536,
  "gpt-3.5-turbo": 16385,
  "claude-3-opus-20240229": 200000,
  "claude-3.5-sonnet-20240620": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-3-haiku-20240307": 200000,
  "mixtral-8x7b": 32000,
  "mixtral-8x7b-32768": 32768,
  "llama3-70b-8192": 8192,
};

const SUMMARY_MODEL_FALLBACK: Partial<Record<LLMProvider, string>> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  groq: "mixtral-8x7b",
};

const DEFAULT_MODEL_TOKEN_LIMIT = 16000;
const RESPONSE_TOKEN_RESERVE = 1024;
const DEFAULT_CONTEXT_TOKEN_MAX = 12000;
const DEFAULT_CONTEXT_TOKEN_MIN = 1024;
const DEFAULT_RECENT_MESSAGES = 6;
const SUMMARY_TRIGGER_TOKENS = 2500;
const SUMMARY_TRIGGER_MIN_MESSAGES = 12;
const SUMMARY_RECENT_MESSAGES_TO_KEEP = 6;
const SUMMARY_MAX_TOKENS = 400;

function countTokens(text: string, encodingName: TiktokenEncoding = "cl100k_base"): number {
  const encoding = get_encoding(encodingName);
  const tokens = encoding.encode(text);
  encoding.free();
  return tokens.length;
}

function estimateMessageTokens(message: { role: string; content: string }): number {
  return countTokens(`${message.role}: ${message.content}`) + 4;
}

function getContextTokenBudget(model?: string, override?: number): number {
  if (override && override > 0) {
    return override;
  }

  const limit = model ? MODEL_TOKEN_LIMITS[model] ?? DEFAULT_MODEL_TOKEN_LIMIT : DEFAULT_MODEL_TOKEN_LIMIT;
  const budget = Math.min(DEFAULT_CONTEXT_TOKEN_MAX, limit - RESPONSE_TOKEN_RESERVE);
  return Math.max(DEFAULT_CONTEXT_TOKEN_MIN, budget);
}

async function fetchConversationMessages(conversationId: string, userId: string): Promise<StoredMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`Failed to fetch conversation messages: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    createdAt: new Date(row.created_at),
    metadata: row.metadata ?? undefined,
  }));
}

interface SelectMessagesResult {
  kept: StoredMessage[];
  omittedCount: number;
  tokenCount: number;
}

function selectMessagesWithBudget(
  messages: StoredMessage[],
  tokenBudget: number,
  recentMessagesToAlwaysInclude: number
): SelectMessagesResult {
  if (messages.length === 0) {
    return { kept: [], omittedCount: 0, tokenCount: 0 };
  }

  const minKeep = Math.min(messages.length, Math.max(1, recentMessagesToAlwaysInclude));
  const required = messages.slice(-minKeep);
  let kept = [...required];
  let usedTokens = kept.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

  for (let i = messages.length - minKeep - 1; i >= 0; i--) {
    const candidate = messages[i];
    const candidateTokens = estimateMessageTokens(candidate);
    if (usedTokens + candidateTokens > tokenBudget && kept.length >= minKeep) {
      return {
        kept,
        omittedCount: i + 1,
        tokenCount: usedTokens,
      };
    }

    kept = [candidate, ...kept];
    usedTokens += candidateTokens;
  }

  return {
    kept,
    omittedCount: 0,
    tokenCount: usedTokens,
  };
}

function formatMessagesForSummary(messages: StoredMessage[]): string {
  return messages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");
}

async function upsertSummaryMessage(
  conversationId: string,
  userId: string,
  summary: string,
  metadata: Record<string, any>
): Promise<void> {
  const supabase = await createClient();

  // Query for existing summary message using JSONB path query
  const { data: existing, error: fetchError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("role", "system")
    .filter("metadata->>type", "eq", "summary")
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(`Failed to read existing summary: ${fetchError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        content: summary,
        metadata,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update conversation summary: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "system",
      content: summary,
      metadata,
    });

    if (insertError) {
      throw new Error(`Failed to insert conversation summary: ${insertError.message}`);
    }
  }
}

async function callLLM(
  provider: LLMProvider,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  let response = "";

  for await (const chunk of streamChatCompletion(provider, messages, options)) {
    response += chunk.content;
  }

  return response.trim();
}

async function buildUpdatedSummary(params: {
  provider: LLMProvider;
  model?: string;
  previousSummary?: string | null;
  newMessages: StoredMessage[];
  maxTokens?: number;
}): Promise<string> {
  const { provider, model, previousSummary, newMessages, maxTokens } = params;
  const transcript = formatMessagesForSummary(newMessages);
  const summaryModel = model ?? SUMMARY_MODEL_FALLBACK[provider];

  const instructions = previousSummary
    ? `You maintain an evolving summary of a conversation between a user and an AI assistant. Update the previous summary to include the new conversation segment. Keep the summary concise (<=200 words), factual, and ordered chronologically. Track user preferences, decisions, unresolved questions, and action items.`
    : `You maintain a concise summary of a conversation between a user and an AI assistant. Summarize the conversation segment below in <=200 words. Capture user preferences, open tasks, decisions, and important facts.`;

  const userPrompt = [
    previousSummary ? `Previous summary:\n${previousSummary}\n\n` : "",
    `New conversation segment:\n${transcript}\n\n`,
    "Produce the updated summary now.",
  ].join("");

  const summary = await callLLM(
    provider,
    [
      { role: "system", content: instructions },
      { role: "user", content: userPrompt },
    ],
    {
      model: summaryModel,
      temperature: 0.2,
      maxTokens: maxTokens ?? SUMMARY_MAX_TOKENS,
    }
  );

  if (!summary) {
    throw new Error("LLM returned an empty summary.");
  }

  return summary;
}

export interface ConversationHistoryOptions {
  conversationId: string;
  userId: string;
  useMemory?: boolean;
  model?: string;
  maxContextTokens?: number;
  recentMessagesToAlwaysInclude?: number;
}

export interface ConversationHistoryResult {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  summaryIncluded: boolean;
  summaryText?: string | null;
  tokensUsed: number;
  truncatedMessages: number;
}

export async function getConversationHistory(options: ConversationHistoryOptions): Promise<ConversationHistoryResult> {
  const {
    conversationId,
    userId,
    useMemory = true,
    model,
    maxContextTokens,
    recentMessagesToAlwaysInclude = DEFAULT_RECENT_MESSAGES,
  } = options;

  const allMessages = await fetchConversationMessages(conversationId, userId);

  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Memory] Fetching history for conversation ${conversationId}: ${allMessages.length} total messages`);
  }

  const summaryCandidates = allMessages.filter((msg) => msg.metadata?.type === "summary");
  const summaryMessage =
    summaryCandidates.length > 0
      ? summaryCandidates.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest
      )
      : undefined;

  const conversationMessages = allMessages.filter((msg) => msg.metadata?.type !== "summary");

  if (!useMemory) {
    const recentOnly = conversationMessages.slice(-recentMessagesToAlwaysInclude);
    const tokens = recentOnly.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
    return {
      messages: recentOnly.map((msg) => ({ role: msg.role, content: msg.content })),
      summaryIncluded: false,
      summaryText: undefined,
      tokensUsed: tokens,
      truncatedMessages: conversationMessages.length - recentOnly.length,
    };
  }

  const summaryCutoff = summaryMessage?.metadata?.summarized_until
    ? new Date(summaryMessage.metadata.summarized_until as string)
    : null;

  const unsummarizedMessages = summaryCutoff
    ? conversationMessages.filter((msg) => msg.createdAt > summaryCutoff)
    : conversationMessages;

  const tokenBudget = getContextTokenBudget(model, maxContextTokens);
  let tokensUsed = 0;

  const historyMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
  let summaryTokens = 0;

  if (summaryMessage) {
    const summaryContent = `High-level summary of earlier conversation:\n${summaryMessage.content}`;
    summaryTokens = estimateMessageTokens({ role: "system", content: summaryContent });
    tokensUsed += summaryTokens;
    historyMessages.push({ role: "system", content: summaryContent });
  }

  const remainingBudget = Math.max(tokenBudget - summaryTokens, DEFAULT_CONTEXT_TOKEN_MIN);

  const selection = selectMessagesWithBudget(unsummarizedMessages, remainingBudget, recentMessagesToAlwaysInclude);

  tokensUsed += selection.tokenCount;

  historyMessages.push(
    ...selection.kept.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
  );

  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Memory] Returning ${historyMessages.length} messages (${selection.kept.length} from history, ${summaryMessage ? "1 summary" : "no summary"}), ${tokensUsed} tokens used, ${Math.max(0, unsummarizedMessages.length - selection.kept.length)} truncated`);
  }

  return {
    messages: historyMessages,
    summaryIncluded: Boolean(summaryMessage),
    summaryText: summaryMessage?.content ?? null,
    tokensUsed,
    truncatedMessages: Math.max(0, unsummarizedMessages.length - selection.kept.length),
  };
}

export interface UpdateConversationSummaryOptions {
  conversationId: string;
  userId: string;
  provider: LLMProvider;
  model?: string;
  maxSummaryTokens?: number;
  triggerTokenThreshold?: number;
  recentMessagesToRetain?: number;
}

export async function updateConversationSummary(options: UpdateConversationSummaryOptions): Promise<void> {
  const {
    conversationId,
    userId,
    provider,
    model,
    maxSummaryTokens = SUMMARY_MAX_TOKENS,
    triggerTokenThreshold = SUMMARY_TRIGGER_TOKENS,
    recentMessagesToRetain = SUMMARY_RECENT_MESSAGES_TO_KEEP,
  } = options;

  const allMessages = await fetchConversationMessages(conversationId, userId);

  const summaryCandidates = allMessages.filter((msg) => msg.metadata?.type === "summary");
  const summaryMessage =
    summaryCandidates.length > 0
      ? summaryCandidates.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest
      )
      : undefined;

  const conversationMessages = allMessages.filter((msg) => msg.metadata?.type !== "summary");

  const summaryCutoff = summaryMessage?.metadata?.summarized_until
    ? new Date(summaryMessage.metadata.summarized_until as string)
    : null;

  const unsummarizedMessages = summaryCutoff
    ? conversationMessages.filter((msg) => msg.createdAt > summaryCutoff)
    : conversationMessages;

  if (unsummarizedMessages.length <= recentMessagesToRetain) {
    return;
  }

  const indexToKeep = unsummarizedMessages.length - recentMessagesToRetain;
  const messagesToSummarize = unsummarizedMessages.slice(0, indexToKeep);

  const tokensToSummarize = messagesToSummarize.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

  if (
    messagesToSummarize.length < SUMMARY_TRIGGER_MIN_MESSAGES &&
    tokensToSummarize < triggerTokenThreshold
  ) {
    return;
  }

  if (messagesToSummarize.length === 0) {
    return;
  }

  const updatedSummary = await buildUpdatedSummary({
    provider,
    model,
    previousSummary: summaryMessage?.content,
    newMessages: messagesToSummarize,
    maxTokens: maxSummaryTokens,
  });

  const finalSummarizedMessage = messagesToSummarize[messagesToSummarize.length - 1];
  const metadata = {
    type: "summary",
    summarized_until: finalSummarizedMessage.createdAt.toISOString(),
    summarized_message_id: finalSummarizedMessage.id,
    summarized_message_count: messagesToSummarize.length,
    recent_messages_retained: recentMessagesToRetain,
    trigger_token_threshold: triggerTokenThreshold,
    token_count: countTokens(updatedSummary),
    updated_at: new Date().toISOString(),
    version: 1,
    source: "memory-manager",
  };

  await upsertSummaryMessage(conversationId, userId, updatedSummary, metadata);
}
