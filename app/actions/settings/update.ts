"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UserSettings {
  provider: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
  webSearchEnabled?: boolean;
  llmVerifiedRetrieval?: boolean;
}

export async function saveSettings(settings: UserSettings) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Default llmVerifiedRetrieval to false for better performance
  // (LLM-verified retrieval can add 5-10 seconds to response time)
  const optimizedSettings = {
    ...settings,
    llmVerifiedRetrieval: settings.llmVerifiedRetrieval ?? false,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      settings: optimizedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function getSettings(): Promise<UserSettings | null> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  const settings = data.settings as UserSettings | null;
  
  // Default llmVerifiedRetrieval to false if not set
  if (settings && settings.llmVerifiedRetrieval === undefined) {
    settings.llmVerifiedRetrieval = false;
  }

  return settings;
}


