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

  const { error } = await supabase
    .from("profiles")
    .update({
      settings: settings,
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

  return data.settings as UserSettings | null;
}


