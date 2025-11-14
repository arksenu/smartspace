import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// Profiles table extends Supabase auth.users
// The id references auth.users(id) in Supabase
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // References auth.users(id) in Supabase
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  settings: jsonb("settings"), // User preferences: { provider, model, temperature, systemPrompt }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

