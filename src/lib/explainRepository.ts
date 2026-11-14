import type { SupabaseClient } from "@supabase/supabase-js";
import { validateExplainRequest, isSafeExplanation, type ExplainRequest } from "../domain/explainTypes";
import { templateExplanation } from "../domain/explainTemplate";

export type ExplainResult = { text: string; source: "ai" | "template"; reason?: "not_configured" | "error" | "timeout" | "unsafe" | "invalid_request" };
type FunctionsClient = Pick<SupabaseClient, "functions">;

/**
 * Asks the cloud for a friendlier wording of a de-identified summary, and ALWAYS has an answer:
 * not configured, offline, error, timeout, or text that fails the safety check all fall back to the
 * built-in template. Only successful cloud answers are cached, so a failure can be retried.
 */
export function createExplainRepository(client: FunctionsClient | null, options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 28_000; // the function may fail over from OpenRouter to Groq/Gemini (up to 25 s)
  const cache = new Map<string, ExplainResult>();
  let calls = 0;
  return {
    get cloudCalls() { return calls; },
    async explain(request: ExplainRequest): Promise<ExplainResult> {
      const checked = validateExplainRequest(request);
      if (!checked.ok) return { text: templateExplanation(request), source: "template", reason: "invalid_request" };
      const fallback = (reason: NonNullable<ExplainResult["reason"]>): ExplainResult => ({ text: templateExplanation(checked.value), source: "template", reason });
      if (!client) return fallback("not_configured");
      const key = JSON.stringify(checked.value);
      const cached = cache.get(key);
      if (cached) return cached;
      calls += 1;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          client.functions.invoke("explain-pattern", { body: checked.value }),
          new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); }),
        ]);
        if (response === "timeout") return fallback("timeout");
        const text = (response.data as { text?: unknown } | null)?.text;
        if (response.error || !isSafeExplanation(text)) return fallback(response.error ? "error" : "unsafe");
        const result: ExplainResult = { text: text.trim(), source: "ai" };
        cache.set(key, result);
        return result;
      } catch {
        return fallback("error");
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
