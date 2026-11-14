// Generates optional, non-diagnostic feedback from a completed synthetic wellbeing check-in.
// No private note or raw device reading is accepted. AI keys remain Supabase secrets.
import { buildProviderRequest, chooseProvider, completeSentences, extractText, extractUpstreamMessage, retryWhenUnsafe, type AttemptOutcome } from "../_shared/providers.ts";
import { isAllowedChatOutput } from "../_shared/chatSafety.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const stages = new Set(["future", "active", "retired"]);
const system = "You are Horizon's wellbeing feedback editor. Give brief, useful, plain-English feedback after a traveler completes a check-in. Do not diagnose, predict illness, prescribe, recommend medication, provide flight clearance, or call a result safe. Do not repeat every answer. Return exactly 2 or 3 numbered next steps, each one sentence, and make them specific to the supplied themes. If the themes include pain, worsening symptoms, severe symptoms, very low mood, dizziness, or anything that may need urgent help, make the first step contacting the appropriate qualified mission medical or support team. Say that this is educational and not medical advice only when relevant. Use synthetic data only.";
const getUserId = (request: Request) => { try { const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""); const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(part)).sub as string; } catch { return ""; } };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!getUserId(request)) return json(401, { error: "authentication_required" });
  const raw = await request.text(); if (raw.length > 6_000) return json(413, { error: "too_large" });
  let body: Record<string, unknown>; try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const stage = typeof body.stage === "string" ? body.stage : ""; const headline = typeof body.headline === "string" ? body.headline.slice(0, 240) : ""; const concern = typeof body.concern === "string" ? body.concern : ""; const lines = Array.isArray(body.lines) ? body.lines.filter((line): line is string => typeof line === "string").slice(0, 8).map((line) => line.slice(0, 240)) : [];
  if (!stages.has(stage) || !headline || !["steady", "watch", "hard"].includes(concern) || !lines.length) return json(400, { error: "invalid_request" });
  const provider = chooseProvider({ OPENROUTER_API_KEY: Deno.env.get("OPENROUTER_API_KEY"), OPENROUTER_MODEL: Deno.env.get("OPENROUTER_MODEL"), ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") });
  if (!provider.ok) return json(503, { error: provider.error });
  const user = `Stage: ${stage}\nOverall check-in state: ${concern}\nSummary headline: ${headline}\nThemes the traveler selected:\n${lines.map((line) => `- ${line}`).join("\n")}\n\nGive only the useful numbered next steps.`;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 40_000); const started = Date.now();
  try {
    const send = (mergeSystem: boolean) => { const upstream = buildProviderRequest(provider, system, user, { mergeSystem }); return fetch(upstream.url, { method: "POST", headers: upstream.headers, body: upstream.body, signal: controller.signal }); };
    const attempt = async (): Promise<AttemptOutcome> => {
      let response = await send(false);
      // Some models reject a separate system message with a 400; try once more with the instructions inside the user message.
      if (response.status === 400 && provider.provider === "openrouter") response = await send(true);
      if (!response.ok) return { kind: "error", status: response.status, message: response.status >= 400 && response.status < 500 ? extractUpstreamMessage(await response.json().catch(() => undefined)) : undefined };
      const text = completeSentences(extractText(provider.provider, await response.json()));
      return isAllowedChatOutput(text) ? { kind: "text", text } : { kind: "unsafe" };
    };
    const outcome = await retryWhenUnsafe(attempt, { elapsedMs: () => Date.now() - started, retryBeforeMs: 20_000 });
    if (outcome.kind === "text") return json(200, { text: outcome.text });
    return json(502, { error: outcome.kind === "unsafe" ? "unsafe_output" : "upstream_error", ...(outcome.kind === "error" && outcome.message ? { upstreamMessage: outcome.message } : {}) });
  } catch { return json(502, { error: controller.signal.aborted ? "upstream_timeout" : "upstream_unavailable" }); } finally { clearTimeout(timer); }
});
