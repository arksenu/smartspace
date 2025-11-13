import { pgTable, text, timestamp, uuid, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { profiles } from "./users";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used"),
  modelUsed: text("model_used"),
  latencyMs: integer("latency_ms"),
  retrievedChunkIds: uuid("retrieved_chunk_ids").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

