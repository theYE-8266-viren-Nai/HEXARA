/**
 * Which cloud AI service writes the explanation, and how to talk to it. Pure TypeScript (no Deno, DOM or Node APIs)
 * so it can be unit-tested with the rest of the app.
 *
 * OpenRouter is used when OPENROUTER_API_KEY is set (the model is chosen by the OPENROUTER_MODEL secret, so it can
 * be changed without editing code). Otherwise Anthropic is used when ANTHROPIC_API_KEY is set. Keys only ever live
 * in Supabase secrets and are never placed in a request body.
 * Simulated data only. Not medical advice. Not diagnostic.
 */
export type ProviderName = "openrouter" | "anthropic";

export type ProviderChoice =
  | { ok: true; provider: ProviderName; apiKey: string; model: string }
  | { ok: false; error: "not_configured" | "model_missing" | "model_invalid" };

export interface ProviderEnv { OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string; ANTHROPIC_API_KEY?: string }

export const ANTHROPIC_MODEL = "claude-haiku-5-5";
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:+\-/]{0,99}$/;

const clean = (value: string | undefined) => (value ?? "").trim();

export function chooseProvider(env: ProviderEnv): ProviderChoice {
  const openrouterKey = clean(env.OPENROUTER_API_KEY);
  if (openrouterKey) {
    const model = clean(env.OPENROUTER_MODEL);
    if (!model) return { ok: false, error: "model_missing" };
    if (!MODEL_ID.test(model)) return { ok: false, error: "model_invalid" };
    return { ok: true, provider: "openrouter", apiKey: openrouterKey, model };
  }
  const anthropicKey = clean(env.ANTHROPIC_API_KEY);
  if (anthropicKey) return { ok: true, provider: "anthropic", apiKey: anthropicKey, model: ANTHROPIC_MODEL };
  return { ok: false, error: "not_configured" };
}

export interface ProviderRequest { url: string; headers: Record<string, string>; body: string }

export function buildProviderRequest(choice: Extract<ProviderChoice, { ok: true }>, system: string, user: string): ProviderRequest {
  if (choice.provider === "openrouter") {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "content-type": "application/json", authorization: `Bearer ${choice.apiKey}` },
      body: JSON.stringify({ model: choice.model, max_tokens: 220, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    };
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: { "content-type": "application/json", "x-api-key": choice.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: choice.model, max_tokens: 220, temperature: 0.2, system, messages: [{ role: "user", content: user }] }),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Pulls the reply text out of a provider's JSON answer, or undefined when it is missing or not text. */
export function extractText(provider: ProviderName, data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (provider === "anthropic") {
    const blocks = Array.isArray(data.content) ? data.content : [];
    const block = blocks.find((item) => isRecord(item) && item.type === "text" && typeof item.text === "string");
    return isRecord(block) ? (block.text as string) : undefined;
  }
  const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;
  const message = isRecord(choice) ? choice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content.filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.text === "string").map((part) => part.text as string);
    return parts.length ? parts.join("") : undefined;
  }
  return undefined;
}
