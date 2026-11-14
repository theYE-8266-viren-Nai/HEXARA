import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";

export type WellbeingFeedbackInput = { stage: LifeStage; headline: string; lines: string[]; concern: "steady" | "watch" | "hard" };
/** What a person sees for each failure code. Raw codes and provider messages are never shown. */
export const FEEDBACK_ERROR_TEXT: Record<string, string> = {
  upstream_timeout: "The AI service took too long to answer.",
  upstream_unavailable: "The AI service could not be reached.",
  upstream_error: "The AI service could not give feedback just now.",
  unsafe_output: "The AI's answer did not pass Horizon's wording check, so it was not shown.",
  not_configured: "AI feedback is not set up yet.",
  model_missing: "AI feedback is not set up yet.",
  model_invalid: "AI feedback is not set up yet.",
  authentication_required: "Sign in again to get AI feedback.",
  rate_limited: "Too many requests. Please wait a moment.",
};
export const GENERIC_FEEDBACK_ERROR = "AI feedback is unavailable right now.";
export const friendlyFeedbackError = (code: string | undefined) => (code && FEEDBACK_ERROR_TEXT[code]) || GENERIC_FEEDBACK_ERROR;

export type WellbeingFeedbackResult = { text?: string; warning?: string; error?: string };

async function readFunctionError(result: { data?: unknown; error?: { message?: string; context?: unknown } | null }): Promise<string | undefined> {
  if (result.data && typeof result.data === "object" && result.data !== null) {
    const payload = result.data as Record<string, unknown>;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
  }
  const context = result.error?.context;
  if (context && typeof context === "object" && "json" in context && typeof context.json === "function") {
    try {
      const payload = await (context.json as () => Promise<unknown>)();
      if (payload && typeof payload === "object") {
        const detail = (payload as Record<string, unknown>).error;
        if (typeof detail === "string" && detail.trim()) return detail.trim();
      }
    } catch {
      // The response body can already be consumed by supabase-js.
    }
  }
  return undefined;
}

export function createWellbeingFeedbackRepository(client: SupabaseClient | null) {
  return {
    async generate(input: WellbeingFeedbackInput): Promise<WellbeingFeedbackResult> {
      if (!client) return { warning: "Cloud AI feedback is not connected, so the built-in steps are shown." };
      let result: Awaited<ReturnType<typeof client.functions.invoke<{ text?: string }>>>;
      try { result = await client.functions.invoke<{ text?: string }>("wellbeing-feedback", { body: input }); } catch { return { error: friendlyFeedbackError("upstream_unavailable") }; }
      const text = result.data?.text;
      if (result.error) return { error: friendlyFeedbackError(await readFunctionError(result)) };
      if (!isAllowedChatOutput(text)) return { error: "The AI returned feedback in an unusable format. Try again." };
      return { text: text.trim() };
    },
  };
}
