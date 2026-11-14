import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";

export type WellbeingFeedbackInput = { stage: LifeStage; headline: string; lines: string[]; concern: "steady" | "watch" | "hard" };
export type WellbeingFeedbackResult = { text?: string; warning?: string; error?: string };

export function createWellbeingFeedbackRepository(client: SupabaseClient | null) {
  return {
    async generate(input: WellbeingFeedbackInput): Promise<WellbeingFeedbackResult> {
      if (!client) return { warning: "Cloud feedback is unavailable. Showing built-in guidance instead." };
      const result = await client.functions.invoke("wellbeing-feedback", { body: input });
      const text = result.data?.text;
      if (result.error || !isAllowedChatOutput(text)) return { error: result.data?.error ?? result.error?.message ?? "AI feedback was unavailable." };
      return { text: text.trim() };
    },
  };
}
