// Supabase Edge Function (Deno). Turns a de-identified pattern summary into a short, calm explanation.
// The AI key lives ONLY in Supabase secrets (OPENROUTER_API_KEY + OPENROUTER_MODEL, or ANTHROPIC_API_KEY); the browser never sees it.
// Deploy with: supabase functions deploy explain-pattern   (see docs/explain-setup.md)
// Simulated data only. Not medical advice. Not diagnostic.
import { buildSystemPrompt, buildUserPrompt, isSafeExplanation, validateExplainRequest } from "../_shared/validate.ts";
import { buildProviderRequest, chooseProvider, extractText } from "../_shared/providers.ts";

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
  const choice = chooseProvider({ OPENROUTER_API_KEY: Deno.env.get("OPENROUTER_API_KEY"), OPENROUTER_MODEL: Deno.env.get("OPENROUTER_MODEL"), ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") });
  if (!choice.ok) return json(503, { error: choice.error });
  if (rateLimited(userKey(request))) return json(429, { error: "rate_limited" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const checked = validateExplainRequest(body);
  if (!checked.ok) return json(400, { error: "invalid_request", detail: checked.error });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = buildProviderRequest(choice, buildSystemPrompt(), buildUserPrompt(checked.value));
    const response = await fetch(upstream.url, { method: "POST", headers: upstream.headers, body: upstream.body, signal: controller.signal });
    // Only the status code is passed on (never the provider's body), so a wrong key, no credit or an unknown model can be told apart.
    if (!response.ok) return json(502, { error: "upstream_error", provider: choice.provider, upstreamStatus: response.status });
    const text = extractText(choice.provider, await response.json());
    // Never forward text that fails the same safety check the browser applies.
    if (!isSafeExplanation(text)) return json(502, { error: "unsafe_output" });
    return json(200, { text: text.trim() });
  } catch {
    return json(502, { error: "upstream_unavailable" });
  } finally {
    clearTimeout(timer);
  }
});
