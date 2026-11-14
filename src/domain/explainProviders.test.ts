import { describe, expect, it } from "vitest";
import { ANTHROPIC_MODEL, OPENROUTER_MAX_TOKENS, buildProviderRequest, chooseProvider, isFreeModel, extractText, extractUpstreamMessage, completeSentences, retryWhenUnsafe, type AttemptOutcome } from "../../supabase/functions/_shared/providers";
import { buildSystemPrompt, buildUserPrompt, type ExplainRequest } from "../../supabase/functions/_shared/validate";

const summary: ExplainRequest = { stage: "active", level: "different", patternScore: 60, dataQuality: "good", source: "api", audience: "traveler", drivers: [{ metricLabel: "Sleep", direction: "lower", changePct: -12 }] };
const SECRET = "sk-test-secret-value";

describe("provider choice", () => {
  it("uses OpenRouter with the chosen model when its key is set, even if an Anthropic key also exists", () => {
    const choice = chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "vendor/some-model:free", ANTHROPIC_API_KEY: "other" });
    expect(choice).toEqual({ ok: true, provider: "openrouter", apiKey: SECRET, model: "vendor/some-model:free" });
  });

  it("uses Anthropic (which is paid) only when the owner deliberately allows paid models", () => {
    expect(chooseProvider({ ANTHROPIC_API_KEY: SECRET })).toEqual({ ok: false, error: "paid_model_blocked" });
    expect(chooseProvider({ ANTHROPIC_API_KEY: SECRET, ALLOW_PAID_MODELS: "false" })).toEqual({ ok: false, error: "paid_model_blocked" });
    expect(chooseProvider({ ANTHROPIC_API_KEY: SECRET, ALLOW_PAID_MODELS: "true" })).toEqual({ ok: true, provider: "anthropic", apiKey: SECRET, model: ANTHROPIC_MODEL });
  });

  it("says what is missing instead of guessing a model", () => {
    expect(chooseProvider({})).toEqual({ ok: false, error: "not_configured" });
    expect(chooseProvider({ OPENROUTER_API_KEY: "   ", ANTHROPIC_API_KEY: "" })).toEqual({ ok: false, error: "not_configured" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET })).toEqual({ ok: false, error: "model_missing" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "  " })).toEqual({ ok: false, error: "model_missing" });
  });

  it("accepts the free router and up to three fallback models, and rejects more", () => {
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "openrouter/free" })).toMatchObject({ ok: true, model: "openrouter/free" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "a/one:free, b/two:free ,c/three:free" })).toMatchObject({ ok: true, model: "a/one:free,b/two:free,c/three:free" });
    for (const model of ["a/1:free,b/2:free,c/3:free,d/4:free", "a/1,,b/2", "a/1,", ",a/1", "a/1,bad model"])
      expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: model }), model).toEqual({ ok: false, error: "model_invalid" });
  });

  it("rejects model ids with unexpected characters", () => {
    for (const model of ["bad model", "vendor/model;rm -rf", "a".repeat(101), "../etc", "vendor/model\nx", "-leading"])
      expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: model }), model).toEqual({ ok: false, error: "model_invalid" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: " vendor/model-1.5:free " })).toMatchObject({ ok: true, model: "vendor/model-1.5:free" });
  });
});

describe("provider requests", () => {
  const system = buildSystemPrompt(); const user = buildUserPrompt(summary);

  it("builds an OpenRouter chat request with the key only in the header", () => {
    const request = buildProviderRequest({ ok: true, provider: "openrouter", apiKey: SECRET, model: "vendor/model" }, system, user);
    expect(request.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(request.body).not.toContain(SECRET);
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({ model: "vendor/model", max_tokens: OPENROUTER_MAX_TOKENS, temperature: 0.2 });
    expect(body.models).toBeUndefined();
    expect(body.messages).toEqual([{ role: "system", content: system }, { role: "user", content: user }]);
  });

  it("builds an Anthropic request with the key only in the header", () => {
    const request = buildProviderRequest({ ok: true, provider: "anthropic", apiKey: SECRET, model: ANTHROPIC_MODEL }, system, user);
    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.headers["x-api-key"]).toBe(SECRET);
    expect(request.body).not.toContain(SECRET);
    expect(JSON.parse(request.body)).toMatchObject({ model: ANTHROPIC_MODEL, system, messages: [{ role: "user", content: user }] });
  });

  it("sends a fallback list as `models` instead of `model` when several are chosen", () => {
    const body = JSON.parse(buildProviderRequest({ ok: true, provider: "openrouter", apiKey: SECRET, model: "a/one:free,b/two:free" }, system, user).body);
    expect(body.models).toEqual(["a/one:free", "b/two:free"]);
    expect(body.model).toBeUndefined();
  });

  it("can fold the instructions into the user message for models that reject a system message", () => {
    const request = buildProviderRequest({ ok: true, provider: "openrouter", apiKey: SECRET, model: "vendor/model" }, system, user, { mergeSystem: true });
    const body = JSON.parse(request.body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toBe(`${system}\n\n${user}`);
    expect(body.messages.some((message: { role: string }) => message.role === "system")).toBe(false);
    expect(request.body).not.toContain(SECRET);
    expect(JSON.parse(buildProviderRequest({ ok: true, provider: "openrouter", apiKey: SECRET, model: "vendor/model" }, system, user).body).messages).toHaveLength(2);
  });

  it("sends only the de-identified summary text to either provider", () => {
    for (const provider of ["openrouter", "anthropic"] as const) {
      const request = buildProviderRequest({ ok: true, provider, apiKey: SECRET, model: "m" }, system, user);
      expect(request.body).toContain("Sleep: lower than usual by about 12%");
      expect(request.body).toContain("Source: api");
      expect(request.body).not.toMatch(/traveler-|2026|@/);
    }
  });
});

describe("reading replies", () => {
  it("reads OpenRouter replies, including content given as parts", () => {
    expect(extractText("openrouter", { choices: [{ message: { role: "assistant", content: "Sleep was lower." } }] })).toBe("Sleep was lower.");
    expect(extractText("openrouter", { choices: [{ message: { content: [{ type: "text", text: "Sleep " }, { type: "text", text: "was lower." }] } }] })).toBe("Sleep was lower.");
  });

  it("reads Anthropic replies", () => {
    expect(extractText("anthropic", { content: [{ type: "thinking", thinking: "x" }, { type: "text", text: "Sleep was lower." }] })).toBe("Sleep was lower.");
  });

  it("returns undefined for anything that is not text, so the caller falls back", () => {
    for (const data of [null, undefined, "x", 5, {}, { choices: [] }, { choices: [{ message: { content: null } }] }, { choices: [{ message: { content: [] } }] }, { choices: [{}] }, { error: { message: "no credit" } }])
      expect(extractText("openrouter", data), JSON.stringify(data)).toBeUndefined();
    for (const data of [null, {}, { content: [] }, { content: [{ type: "text" }] }]) expect(extractText("anthropic", data)).toBeUndefined();
  });
});

describe("upstream error messages", () => {
  it("returns a short readable reason from the provider's error JSON", () => {
    expect(extractUpstreamMessage({ error: { code: 401, message: "No auth credentials found" } })).toBe("No auth credentials found");
    expect(extractUpstreamMessage({ error: "Rate limit exceeded: free-models-per-day" })).toBe("Rate limit exceeded: free-models-per-day");
  });

  it("removes control characters, redacts anything shaped like a key, and cuts the length", () => {
    const text = extractUpstreamMessage({ error: { message: `bad key sk-or-v1-abcdef1234567890\nline two\u0000 ${"x".repeat(400)}` } })!;
    expect(text).not.toContain("sk-or-v1-abcdef");
    expect(text).toContain("[redacted]");
    expect(text).not.toMatch(/[\u0000-\u001f]/);
    expect(text.length).toBeLessThanOrEqual(200);
  });

  it("returns undefined when there is nothing usable", () => {
    for (const data of [null, undefined, "x", {}, { error: {} }, { error: { message: 5 } }, { error: { message: "   " } }, { error: 7 }]) expect(extractUpstreamMessage(data), JSON.stringify(data)).toBeUndefined();
  });
});

describe("complete sentences only", () => {
  it("keeps a finished reply as it is", () => {
    const text = "Sleep was lower than your usual range. Tell the crew medic if it continues.";
    expect(completeSentences(`  ${text}\n`)).toBe(text);
    expect(completeSentences("Sleep was lower (about 15%).")).toBe("Sleep was lower (about 15%).");
  });

  it("cuts a reply that stopped mid-sentence back to the last full sentence", () => {
    expect(completeSentences("Your readings were different from your usual pattern. Please consider the optional check-in. If this change continues, gets worse, or seems concerning, let"))
      .toBe("Your readings were different from your usual pattern. Please consider the optional check-in.");
  });

  it("returns undefined when too little is left to be meaningful", () => {
    for (const text of ["", "   ", "Sleep was lo", "Short. And then a cut off thing without end", undefined]) expect(completeSentences(text), String(text)).toBeUndefined();
  });
});

describe("retry when a reply is unusable", () => {
  const sequence = (...outcomes: AttemptOutcome[]) => { let i = 0; const calls = { count: 0 }; return { calls, attempt: async () => { calls.count += 1; return outcomes[Math.min(i++, outcomes.length - 1)]; } }; };
  const early = { elapsedMs: () => 1_000, retryBeforeMs: 8_000 };

  it("returns a good first reply without asking again", async () => {
    const { calls, attempt } = sequence({ kind: "text", text: "Sleep was lower." });
    expect(await retryWhenUnsafe(attempt, early)).toEqual({ kind: "text", text: "Sleep was lower.", attempts: 1 });
    expect(calls.count).toBe(1);
  });

  it("asks once more after a rejected reply and returns the good second one", async () => {
    const { calls, attempt } = sequence({ kind: "unsafe" }, { kind: "text", text: "Sleep was lower." });
    expect(await retryWhenUnsafe(attempt, early)).toEqual({ kind: "text", text: "Sleep was lower.", attempts: 2 });
    expect(calls.count).toBe(2);
  });

  it("stops after two rejected replies", async () => {
    const { calls, attempt } = sequence({ kind: "unsafe" }, { kind: "unsafe" }, { kind: "text", text: "never reached" });
    expect(await retryWhenUnsafe(attempt, early)).toEqual({ kind: "unsafe", attempts: 2 });
    expect(calls.count).toBe(2);
  });

  it("never retries errors such as a wrong key, no credit or a rate limit", async () => {
    for (const status of [401, 402, 429, 500]) {
      const { calls, attempt } = sequence({ kind: "error", status, message: "x" }, { kind: "text", text: "never reached" });
      expect(await retryWhenUnsafe(attempt, early)).toEqual({ kind: "error", status, message: "x", attempts: 1 });
      expect(calls.count).toBe(1);
    }
  });

  it("does not start a retry when too little time is left", async () => {
    const { calls, attempt } = sequence({ kind: "unsafe" }, { kind: "text", text: "never reached" });
    expect(await retryWhenUnsafe(attempt, { elapsedMs: () => 9_000, retryBeforeMs: 8_000 })).toEqual({ kind: "unsafe", attempts: 1 });
    expect(calls.count).toBe(1);
  });
});

describe("free models only (never spends credit)", () => {
  it("recognises exactly the free ids", () => {
    for (const id of ["openrouter/free", "google/gemma-4-31b-it:free", "a/b:free"]) expect(isFreeModel(id), id).toBe(true);
    for (const id of ["openrouter/auto", "openai/gpt-4o-mini", "anthropic/claude-haiku-5-5", "google/gemma-4-31b-it", "vendor/model:free-trial", "free/model", "a/b:FREE", ""]) expect(isFreeModel(id), id).toBe(false);
  });

  it("refuses a paid OpenRouter model before any request could be made", () => {
    for (const model of ["openai/gpt-4o-mini", "anthropic/claude-haiku-5-5", "google/gemma-4-31b-it", "openrouter/auto"])
      expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: model }), model).toEqual({ ok: false, error: "paid_model_blocked" });
  });

  it("refuses a fallback list if ANY model in it is paid", () => {
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "a/one:free,openai/gpt-4o-mini" })).toEqual({ ok: false, error: "paid_model_blocked" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "a/one:free,b/two:free" })).toMatchObject({ ok: true });
  });

  it("does not quietly fall back to a paid Anthropic key when the OpenRouter model is blocked", () => {
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "openai/gpt-4o-mini", ANTHROPIC_API_KEY: "other" })).toEqual({ ok: false, error: "paid_model_blocked" });
  });

  it("allows paid models only with the explicit owner switch", () => {
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "openai/gpt-4o-mini", ALLOW_PAID_MODELS: "true" })).toMatchObject({ ok: true, model: "openai/gpt-4o-mini" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "openai/gpt-4o-mini", ALLOW_PAID_MODELS: "yes" })).toEqual({ ok: false, error: "paid_model_blocked" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "openai/gpt-4o-mini", ALLOW_PAID_MODELS: " TRUE " })).toMatchObject({ ok: true });
  });

  it("the functions that use the shared chooser pass the owner switch through, and none can hard-code paid models", () => {
    const sources = import.meta.glob("../../supabase/functions/*/index.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const usingChooser = Object.entries(sources).filter(([, code]) => code.includes("chooseProvider("));
    const names = usingChooser.map(([path]) => path.split("/").slice(-2)[0]);
    expect(names).toEqual(expect.arrayContaining(["explain-pattern", "wellbeing-feedback"]));
    for (const [path, code] of usingChooser.filter(([path]) => !path.includes("chat-assistant"))) expect(code, path).toContain('ALLOW_PAID_MODELS: Deno.env.get("ALLOW_PAID_MODELS")');
    // Without the switch the chooser blocks paid models, so a function that does not pass it is strict by default.
    for (const [path, code] of usingChooser) expect(code, path).not.toMatch(/ALLOW_PAID_MODELS:\s*["'`]true/);
  });
});
