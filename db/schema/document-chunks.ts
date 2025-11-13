import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { documents } from "./documents";
import { profiles } from "./users";

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  contentTokens: integer("content_tokens"),
  embedding: sql`vector(1536)`, // PGVector column
  metadata: jsonb("metadata"), // page_number, section, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

