import { pgTable, text, timestamp, uuid, bigint, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"), // 'pdf', 'txt', 'url'
  fileSize: bigint("file_size", { mode: "number" }),
  storagePath: text("storage_path"),
  status: documentStatusEnum("status").default("pending").notNull(),
  chunkCount: bigint("chunk_count", { mode: "number" }).default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

