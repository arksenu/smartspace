import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// Connection string for Supabase PostgreSQL
const connectionString = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
  /^https?:\/\//,
  "postgresql://postgres:"
).replace(/\/$/, "");

// For server-side use only
const client = postgres(connectionString, {
  prepare: false,
});

export const db = drizzle(client, { schema });

