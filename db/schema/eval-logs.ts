import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { conversations } from "./conversations";
import { messages } from "./messages";

export const evalLogs = pgTable("eval_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  requestData: jsonb("request_data"),
  responseData: jsonb("response_data"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  provider: text("provider"),
  model: text("model"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EvalLog = typeof evalLogs.$inferSelect;
export type NewEvalLog = typeof evalLogs.$inferInsert;

