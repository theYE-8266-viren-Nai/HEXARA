import { describe, expect, it } from "vitest";
import { ANTHROPIC_MODEL, buildProviderRequest, chooseProvider, extractText } from "../../supabase/functions/_shared/providers";
import { buildSystemPrompt, buildUserPrompt, type ExplainRequest } from "../../supabase/functions/_shared/validate";

const summary: ExplainRequest = { stage: "active", level: "different", patternScore: 60, dataQuality: "good", source: "api", audience: "traveler", drivers: [{ metricLabel: "Sleep", direction: "lower", changePct: -12 }] };
const SECRET = "sk-test-secret-value";

describe("provider choice", () => {
  it("uses OpenRouter with the chosen model when its key is set, even if an Anthropic key also exists", () => {
    const choice = chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "vendor/some-model:free", ANTHROPIC_API_KEY: "other" });
    expect(choice).toEqual({ ok: true, provider: "openrouter", apiKey: SECRET, model: "vendor/some-model:free" });
  });

  it("falls back to Anthropic when only its key is set", () => {
    expect(chooseProvider({ ANTHROPIC_API_KEY: SECRET })).toEqual({ ok: true, provider: "anthropic", apiKey: SECRET, model: ANTHROPIC_MODEL });
  });

  it("says what is missing instead of guessing a model", () => {
    expect(chooseProvider({})).toEqual({ ok: false, error: "not_configured" });
    expect(chooseProvider({ OPENROUTER_API_KEY: "   ", ANTHROPIC_API_KEY: "" })).toEqual({ ok: false, error: "not_configured" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET })).toEqual({ ok: false, error: "model_missing" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: "  " })).toEqual({ ok: false, error: "model_missing" });
  });

  it("rejects model ids with unexpected characters", () => {
    for (const model of ["bad model", "vendor/model;rm -rf", "a".repeat(101), "../etc", "vendor/model\nx", "-leading"])
      expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: model }), model).toEqual({ ok: false, error: "model_invalid" });
    expect(chooseProvider({ OPENROUTER_API_KEY: SECRET, OPENROUTER_MODEL: " vendor/model-1.5:beta " })).toMatchObject({ ok: true, model: "vendor/model-1.5:beta" });
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
    expect(body).toMatchObject({ model: "vendor/model", max_tokens: 220, temperature: 0.2 });
    expect(body.messages).toEqual([{ role: "system", content: system }, { role: "user", content: user }]);
  });

  it("builds an Anthropic request with the key only in the header", () => {
    const request = buildProviderRequest({ ok: true, provider: "anthropic", apiKey: SECRET, model: ANTHROPIC_MODEL }, system, user);
    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.headers["x-api-key"]).toBe(SECRET);
    expect(request.body).not.toContain(SECRET);
    expect(JSON.parse(request.body)).toMatchObject({ model: ANTHROPIC_MODEL, system, messages: [{ role: "user", content: user }] });
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
