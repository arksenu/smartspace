import { getSettings } from "@/app/actions/settings/update";

export async function getUserSettings() {
  try {
    return await getSettings();
  } catch {
    return null;
  }
}


