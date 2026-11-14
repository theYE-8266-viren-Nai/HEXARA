import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";

export type WellbeingFeedbackInput = { stage: LifeStage; headline: string; lines: string[]; concern: "steady" | "watch" | "hard" };
export type WellbeingFeedbackResult = { text?: string; warning?: string; error?: string };

async function readFunctionError(result: { data?: unknown; error?: { message?: string; context?: unknown } | null }) {
  if (result.data && typeof result.data === "object" && result.data !== null) {
    const payload = result.data as Record<string, unknown>;
    const detail = payload.upstreamMessage ?? payload.error;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  const context = result.error?.context;
  if (context && typeof context === "object" && "json" in context && typeof context.json === "function") {
    try {
      const payload = await (context.json as () => Promise<unknown>)();
      if (payload && typeof payload === "object") {
        const detail = (payload as Record<string, unknown>).upstreamMessage ?? (payload as Record<string, unknown>).error;
        if (typeof detail === "string" && detail.trim()) return detail.trim();
      }
    } catch {
      // The response body can already be consumed by supabase-js.
    }
  }
  return result.error?.message ?? "AI feedback was unavailable. Try again.";
}

export function createWellbeingFeedbackRepository(client: SupabaseClient | null) {
  return {
    async generate(input: WellbeingFeedbackInput): Promise<WellbeingFeedbackResult> {
      if (!client) return { warning: "Cloud AI feedback is unavailable. Check the connection and try again." };
      const result = await client.functions.invoke("wellbeing-feedback", { body: input });
      const text = result.data?.text;
      if (result.error) return { error: await readFunctionError(result) };
      if (!isAllowedChatOutput(text)) return { error: "The AI returned feedback in an unusable format. Try again." };
      return { text: text.trim() };
    },
  };
}
