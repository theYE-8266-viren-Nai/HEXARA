// Supabase Edge Function (Deno). Turns a de-identified pattern summary into a short, calm explanation.
// The AI key lives ONLY in Supabase secrets (OPENROUTER_API_KEY + OPENROUTER_MODEL, or ANTHROPIC_API_KEY); the browser never sees it.
// Deploy with: supabase functions deploy explain-pattern   (see docs/explain-setup.md)
// Simulated data only. Not medical advice. Not diagnostic.
import { buildSystemPrompt, buildUserPrompt, isSafeExplanation, validateExplainRequest } from "../_shared/validate.ts";
import { buildProviderRequest, chooseProvider, completeSentences, extractText, extractUpstreamMessage, retryWhenUnsafe, type AttemptOutcome } from "../_shared/providers.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

const MAX_BODY_BYTES = 4_096;
const RATE_LIMIT = 8; // requests per user per minute (best effort, per instance)
const hits = new Map<string, number[]>();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** The platform already verified the JWT; this only reads the subject to rate-limit per user. */
function userKey(request: Request): string {
  try {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? "anonymous";
  } catch { return "anonymous"; }
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= RATE_LIMIT) { hits.set(key, recent); return true; }
  recent.push(now); hits.set(key, recent);
  return false;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const choice = chooseProvider({ OPENROUTER_API_KEY: Deno.env.get("OPENROUTER_API_KEY"), OPENROUTER_MODEL: Deno.env.get("OPENROUTER_MODEL"), ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY"), ALLOW_PAID_MODELS: Deno.env.get("ALLOW_PAID_MODELS") });
  if (!choice.ok) return json(503, { error: choice.error });
  if (rateLimited(userKey(request))) return json(429, { error: "rate_limited" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const checked = validateExplainRequest(body);
  if (!checked.ok) return json(400, { error: "invalid_request", detail: checked.error });

  const controller = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const send = (mergeSystem: boolean) => {
      const upstream = buildProviderRequest(choice, buildSystemPrompt(), buildUserPrompt(checked.value), { mergeSystem });
      return fetch(upstream.url, { method: "POST", headers: upstream.headers, body: upstream.body, signal: controller.signal });
    };
    const attempt = async (): Promise<AttemptOutcome> => {
      let response = await send(false);
      // Some models reject a separate system message with a 400; try once more with the instructions inside the user message.
      if (response.status === 400 && choice.provider === "openrouter") response = await send(true);
      if (!response.ok) {
        // Only the status code and a short, sanitized error message are passed on (never the key or the full body).
        const message = response.status >= 400 && response.status < 500 ? extractUpstreamMessage(await response.json().catch(() => undefined)) : undefined;
        return { kind: "error", status: response.status, message };
      }
      const text = completeSentences(extractText(choice.provider, await response.json()));
      // Never forward text that fails the same safety check the browser applies.
      return isSafeExplanation(text) ? { kind: "text", text: text.trim() } : { kind: "unsafe" };
    };
    // A rejected or cut-off reply is asked for once more, if there is still time; errors are not retried.
    const outcome = await retryWhenUnsafe(attempt, { elapsedMs: () => Date.now() - started, retryBeforeMs: 8_000 });
    if (outcome.kind === "text") return json(200, { text: outcome.text });
    if (outcome.kind === "unsafe") return json(502, { error: "unsafe_output", attempts: outcome.attempts });
    return json(502, { error: "upstream_error", provider: choice.provider, upstreamStatus: outcome.status, ...(outcome.message ? { upstreamMessage: outcome.message } : {}) });
  } catch {
    return json(502, { error: "upstream_unavailable" });
  } finally {
    clearTimeout(timer);
  }
});
