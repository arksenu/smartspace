import { pgTable, text, timestamp, uuid, decimal, boolean } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title"),
  modelProvider: text("model_provider"), // 'openai', 'anthropic', 'groq'
  modelName: text("model_name"),
  systemPrompt: text("system_prompt"),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  useMemory: boolean("use_memory").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

