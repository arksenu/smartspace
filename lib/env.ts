import { z } from "zod";

const envSchema = z.object({
  // Next.js
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3004"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1).optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // Groq
  GROQ_API_KEY: z.string().min(1).optional(),

  // VoyageAI (optional)
  VOYAGE_API_KEY: z.string().min(1).optional(),

  // OpenRouter (optional)
  OPENROUTER_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join(".")).join(", ");
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

export const env = getEnv();

