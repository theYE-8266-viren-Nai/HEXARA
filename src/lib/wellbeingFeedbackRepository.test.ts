import { describe, expect, it, vi } from "vitest";
import { FEEDBACK_ERROR_TEXT, GENERIC_FEEDBACK_ERROR, createWellbeingFeedbackRepository, friendlyFeedbackError } from "./wellbeingFeedbackRepository";

describe("wellbeing feedback repository", () => {
  it("returns a safe cloud response", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { text: "1. Protect your next sleep period.\n2. Talk with your mission team about workload." }, error: null }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
    expect(result.text).toContain("Protect your next sleep period");
  });

  it("does not claim success when cloud feedback fails", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "future", headline: "Your answers look steady today.", concern: "steady", lines: ["Mood was steady."] });
    expect(result.text).toBeUndefined();
    // The person sees plain wording, never the raw message.
    expect(result.error).toBe(GENERIC_FEEDBACK_ERROR);
  });

  it("turns the function's error code into plain wording", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { error: "model_missing" }, error: { message: "Edge Function returned a non-2xx status code" } }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "future", headline: "A steady check-in", concern: "steady", lines: ["Sleep was steady."] });
    expect(result.text).toBeUndefined();
    expect(result.error).toBe(FEEDBACK_ERROR_TEXT.model_missing);
  });

  it("never shows a raw error code or provider message", async () => {
    for (const code of ["upstream_unavailable", "upstream_timeout", "upstream_error", "upstream_credit", "upstream_auth", "unsafe_output", "not_configured", "rate_limited", "something_new"]) {
      const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { error: code, upstreamMessage: "This request requires more credits, or fewer max_tokens. You requested up to 800 tokens, but can only afford 68. visit https://openrouter.ai/settings/credits" }, error: { message: "non-2xx" } }) } } as never;
      const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
      expect(result.error, code).toBe(friendlyFeedbackError(code));
      expect(result.error).not.toMatch(/upstream_|max_tokens|openrouter\.ai|https?:|non-2xx|\b800\b/i);
    }
  });

  it("reads the code from the error response body when the data is empty", async () => {
    const context = { json: async () => ({ error: "upstream_timeout" }) };
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: "non-2xx", context } }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
    expect(result.error).toBe(FEEDBACK_ERROR_TEXT.upstream_timeout);
  });

  it("falls back to plain wording when the call itself throws", async () => {
    const client = { functions: { invoke: vi.fn().mockRejectedValue(new Error("Failed to fetch")) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
    expect(result.error).toBe(FEEDBACK_ERROR_TEXT.upstream_unavailable);
    expect(result.text).toBeUndefined();
  });

  it("explains a no-credit failure in one short sentence, never the provider's long message", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { error: "upstream_credit", upstreamStatus: 402 }, error: { message: "non-2xx" } }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
    expect(result.error).toBe(FEEDBACK_ERROR_TEXT.upstream_credit);
    expect(result.error).toMatch(/no credit left/);
    expect(result.error!.length).toBeLessThan(140);
  });
});
