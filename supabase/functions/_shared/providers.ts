/**
 * Which cloud AI service writes the explanation, and how to talk to it. Pure TypeScript (no Deno, DOM or Node APIs)
 * so it can be unit-tested with the rest of the app.
 *
 * OpenRouter is used when OPENROUTER_API_KEY is set (the model is chosen by the OPENROUTER_MODEL secret, so it can
 * be changed without editing code). Otherwise Anthropic is used when ANTHROPIC_API_KEY is set. Keys only ever live
 * in Supabase secrets and are never placed in a request body.
 * Simulated data only. Not medical advice. Not diagnostic.
 */
export type ProviderName = "openrouter" | "anthropic" | "groq" | "gemini";

export type ProviderChoice =
  | { ok: true; provider: ProviderName; apiKey: string; model: string }
  | { ok: false; error: "not_configured" | "model_missing" | "model_invalid" | "paid_model_blocked" };

export interface ProviderEnv { OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string; ANTHROPIC_API_KEY?: string; ALLOW_PAID_MODELS?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string }

/** Free-tier fallback models used when no GROQ_MODEL / GEMINI_MODEL secret is set. */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const OPENAI_COMPATIBLE: Record<"groq" | "gemini", string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

/**
 * FREE ONLY BY DEFAULT. A model counts as free when it is OpenRouter's free router or its id ends in ":free". Anything else, and every
 * Anthropic call, can cost money, so it is refused unless the owner deliberately sets the secret ALLOW_PAID_MODELS=true. The refusal
 * happens before any request is sent, so a paid model put in OPENROUTER_MODEL by mistake can never spend credit.
 */
export const isFreeModel = (id: string): boolean => id === "openrouter/free" || id.endsWith(":free");

export const ANTHROPIC_MODEL = "claude-haiku-5-5";
const MAX_MODELS = 3;
/** Free models can spend part of the budget "thinking", so OpenRouter gets more room than the final text needs. */
export const OPENROUTER_MAX_TOKENS = 800;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:+\-/]{0,99}$/;

const clean = (value: string | undefined) => (value ?? "").trim();

export function chooseProvider(env: ProviderEnv): ProviderChoice {
  const allowPaid = clean(env.ALLOW_PAID_MODELS).toLowerCase() === "true";
  const openrouterKey = clean(env.OPENROUTER_API_KEY);
  if (openrouterKey) {
    // One model id, or up to three separated by commas: OpenRouter tries the next one if the first fails or is rate limited.
    const models = clean(env.OPENROUTER_MODEL).split(",").map((item) => item.trim());
    if (models.length === 1 && !models[0]) return { ok: false, error: "model_missing" };
    if (models.length > MAX_MODELS || models.some((item) => !MODEL_ID.test(item))) return { ok: false, error: "model_invalid" };
    if (!allowPaid && !models.every(isFreeModel)) return { ok: false, error: "paid_model_blocked" };
    return { ok: true, provider: "openrouter", apiKey: openrouterKey, model: models.join(",") };
  }
  const anthropicKey = clean(env.ANTHROPIC_API_KEY);
  if (anthropicKey) return allowPaid ? { ok: true, provider: "anthropic", apiKey: anthropicKey, model: ANTHROPIC_MODEL } : { ok: false, error: "paid_model_blocked" };
  return { ok: false, error: "not_configured" };
}

/**
 * Every provider to try, in order: the primary choice (OpenRouter, or Anthropic when paid models are allowed), then the free-tier
 * Groq and Gemini fallbacks whose keys are set. When the primary is not usable but a fallback is, the fallbacks still run, so a
 * missing or exhausted OpenRouter setup never leaves the app without AI. Returns the primary's error only when nothing is usable.
 */
export function chooseProviderChain(env: ProviderEnv): { ok: true; chain: Extract<ProviderChoice, { ok: true }>[] } | Extract<ProviderChoice, { ok: false }> {
  const primary = chooseProvider(env);
  const fallbacks: Extract<ProviderChoice, { ok: true }>[] = [];
  const groqKey = clean(env.GROQ_API_KEY), geminiKey = clean(env.GEMINI_API_KEY);
  if (groqKey) fallbacks.push({ ok: true, provider: "groq", apiKey: groqKey, model: clean(env.GROQ_MODEL) || GROQ_DEFAULT_MODEL });
  if (geminiKey) fallbacks.push({ ok: true, provider: "gemini", apiKey: geminiKey, model: clean(env.GEMINI_MODEL) || GEMINI_DEFAULT_MODEL });
  const chain = [...(primary.ok ? [primary] : []), ...fallbacks];
  return chain.length ? { ok: true, chain } : (primary as Extract<ProviderChoice, { ok: false }>);
}

/** A failure the next provider might not have: no key/credit, unknown model, rate limit, timeout or server error. */
export const shouldFailOver = (status: number) => status === 401 || status === 402 || status === 403 || status === 404 || status === 408 || status === 429 || status >= 500;

export interface ProviderRequest { url: string; headers: Record<string, string>; body: string }

/**
 * `mergeSystem` puts the instructions at the top of the user message instead of in a separate "system" message.
 * Some models reject a system message, so the function retries once this way after a 400.
 */
export function buildProviderRequest(choice: Extract<ProviderChoice, { ok: true }>, system: string, user: string, options: { mergeSystem?: boolean } = {}): ProviderRequest {
  if (choice.provider === "openrouter") {
    const models = choice.model.split(",");
    const messages = options.mergeSystem ? [{ role: "user", content: `${system}\n\n${user}` }] : [{ role: "system", content: system }, { role: "user", content: user }];
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "content-type": "application/json", authorization: `Bearer ${choice.apiKey}` },
      body: JSON.stringify({ ...(models.length > 1 ? { models } : { model: models[0] }), max_tokens: OPENROUTER_MAX_TOKENS, temperature: 0.2, messages }),
    };
  }
  if (choice.provider === "groq" || choice.provider === "gemini") {
    const messages = options.mergeSystem ? [{ role: "user", content: `${system}\n\n${user}` }] : [{ role: "system", content: system }, { role: "user", content: user }];
    return {
      url: OPENAI_COMPATIBLE[choice.provider],
      headers: { "content-type": "application/json", authorization: `Bearer ${choice.apiKey}` },
      // gpt-oss models on Groq reason before answering; low effort keeps the reply inside the token budget.
      body: JSON.stringify({ model: choice.model, max_tokens: OPENROUTER_MAX_TOKENS, temperature: 0.2, messages, ...(choice.provider === "groq" && /gpt-oss/i.test(choice.model) ? { reasoning_effort: "low" } : {}) }),
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

/**
 * A short, safe reason from a provider's error JSON (for example "No auth credentials found"), so a wrong key,
 * a rate limit or an unknown model can be told apart. Control characters are removed, anything shaped like an API key
 * is redacted, and the text is cut to 200 characters. Returns undefined when there is nothing usable.
 */
export function extractUpstreamMessage(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const error = data.error;
  const raw = isRecord(error) ? error.message : typeof error === "string" ? error : undefined;
  if (typeof raw !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/gi, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 200);
  return text || undefined;
}

/**
 * Keeps only complete sentences. A model that runs out of reply space stops mid-sentence ("... let"), which must never be
 * shown. Cuts back to the last sentence end; returns undefined if less than a short, meaningful sentence is left.
 */
export function completeSentences(text: string | undefined): string | undefined {
  if (typeof text !== "string") return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (/[.!?]["')\]]*$/.test(trimmed)) return trimmed;
  const cut = Math.max(...[".", "!", "?"].map((mark) => trimmed.lastIndexOf(`${mark} `)), -1);
  if (cut < 0) return undefined;
  const kept = trimmed.slice(0, cut + 1).trim();
  return kept.length >= 40 ? kept : undefined;
}

/** What one call to the AI service produced. */
export type AttemptOutcome =
  | { kind: "text"; text: string }
  | { kind: "unsafe" }
  | { kind: "error"; status: number; message?: string };

/**
 * Runs `attempt`, and runs it once more only when the reply was unusable (it failed the wording check or was cut off).
 * Errors such as a wrong key, no credit or a rate limit are returned at once, because asking again would not help.
 * The retry only starts while `elapsedMs()` is under `retryBeforeMs`, so it still has time to finish before the deadline.
 */
export async function retryWhenUnsafe(
  attempt: () => Promise<AttemptOutcome>,
  options: { elapsedMs: () => number; retryBeforeMs: number; maxAttempts?: number },
): Promise<AttemptOutcome & { attempts: number }> {
  const maxAttempts = options.maxAttempts ?? 2;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const outcome = await attempt();
    if (outcome.kind !== "unsafe" || attempts >= maxAttempts || options.elapsedMs() >= options.retryBeforeMs) return { ...outcome, attempts };
  }
}
