import { describe, expect, it, vi } from "vitest";
import { createExplainRepository } from "./explainRepository";
import { templateExplanation } from "../domain/explainTemplate";
import type { ExplainRequest } from "../domain/explainTypes";

const request: ExplainRequest = { stage: "active", level: "different", patternScore: 60, dataQuality: "good", source: "simulated", audience: "traveler", drivers: [{ metricLabel: "Sleep", direction: "lower", changePct: -12 }] };
const safe = "Sleep was lower than your usual range. The optional check-in may help. Tell the crew medic if it continues.";
const clientWith = (invoke: (...args: unknown[]) => Promise<unknown>) => ({ functions: { invoke } }) as never;

describe("explain repository", () => {
  it("uses the built-in template when cloud is not configured", async () => {
    const result = await createExplainRepository(null).explain(request);
    expect(result).toEqual({ text: templateExplanation(request), source: "template", reason: "not_configured" });
  });

  it("returns the cloud text, labelled AI, and sends only the validated summary", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { text: safe }, error: null });
    const result = await createExplainRepository(clientWith(invoke)).explain(request);
    expect(result).toEqual({ text: safe, source: "ai" });
    expect(invoke).toHaveBeenCalledWith("explain-pattern", { body: request });
  });

  it("falls back on a function error, thrown error, and timeout", async () => {
    expect((await createExplainRepository(clientWith(async () => ({ data: null, error: { message: "boom" } }))).explain(request)).reason).toBe("error");
    expect((await createExplainRepository(clientWith(async () => { throw new Error("offline"); })).explain(request)).reason).toBe("error");
    const slow = createExplainRepository(clientWith(() => new Promise(() => undefined)), { timeoutMs: 20 });
    const result = await slow.explain(request);
    expect(result.source).toBe("template");
    expect(result.reason).toBe("timeout");
  });

  it("rejects cloud text that fails the safety check and shows the built-in text instead", async () => {
    for (const text of ["You may have an infection and need treatment.", "", undefined, 7, "x".repeat(900)]) {
      const result = await createExplainRepository(clientWith(async () => ({ data: { text }, error: null }))).explain(request);
      expect(result).toEqual({ text: templateExplanation(request), source: "template", reason: "unsafe" });
    }
  });

  it("never calls the cloud for an invalid request", async () => {
    const invoke = vi.fn();
    const bad = { ...request, source: "cloud" } as unknown as ExplainRequest;
    const result = await createExplainRepository(clientWith(invoke)).explain(bad);
    expect(invoke).not.toHaveBeenCalled();
    expect(result.reason).toBe("invalid_request");
  });

  it("caches successful answers so live updates do not spam the cloud, but retries failures", async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ data: null, error: { message: "x" } }).mockResolvedValue({ data: { text: safe }, error: null });
    const repo = createExplainRepository(clientWith(invoke));
    expect((await repo.explain(request)).source).toBe("template");
    expect((await repo.explain(request)).source).toBe("ai");
    expect((await repo.explain(request)).source).toBe("ai");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(repo.cloudCalls).toBe(2);
    await repo.explain({ ...request, patternScore: 61 });
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
