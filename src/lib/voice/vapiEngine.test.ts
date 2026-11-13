import { describe, expect, it, vi } from "vitest";
import type VapiSdk from "@vapi-ai/web";
import type { AssistantOverrides } from "@vapi-ai/web/dist/api";
import { SAFE_CALL_OVERRIDES, callOverrides, createVapiEngine, describeVapiError, vapiConfigured, type VapiConstructor, type VapiLike } from "./vapiEngine";
import { createMockVoiceEngine } from "./mockVoiceEngine";
import { MAX_CALL_SECONDS } from "../../domain/voiceCheckIn";
import type { VoiceEvent } from "./voiceEngine";

// Compile-time checks against the REAL SDK types: if the SDK's API drifts, `tsc -b` fails here.
const overridesMatchSdk: AssistantOverrides = callOverrides({ questions: ["a"] });
const adapterMatchesSdk: VapiConstructor = null as unknown as typeof VapiSdk;
void overridesMatchSdk; void adapterMatchesSdk;

/** A fake SDK that records what the adapter does and lets a test fire events. */
function fakeSdk(options: { startFails?: unknown } = {}) {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const calls = { constructed: [] as string[], started: [] as Array<{ assistant: string; overrides?: Record<string, unknown> }>, stopped: 0 };
  class FakeVapi implements VapiLike {
    constructor(publicKey: string) { calls.constructed.push(publicKey); }
    on(event: string, listener: (...args: unknown[]) => void) { listeners.set(event, listener); return this; }
    async start(assistant: string, overrides?: Record<string, unknown>) { calls.started.push({ assistant, overrides }); if (options.startFails) throw options.startFails; }
    async stop() { calls.stopped += 1; }
  }
  return { Vapi: FakeVapi as VapiConstructor, calls, emit: (event: string, ...args: unknown[]) => listeners.get(event)?.(...args) };
}
const run = async (engine: ReturnType<typeof createVapiEngine>) => { const events: VoiceEvent[] = []; await engine.start((e) => events.push(e)); return events; };
const transcript = (role: string, text: string, transcriptType = "final") => ({ type: "transcript", role, transcriptType, transcript: text });

describe("vapi engine", () => {
  it("does nothing and says why when keys are missing", async () => {
    const sdk = fakeSdk();
    for (const options of [{}, { publicKey: "pk" }, { assistantId: "a" }, { publicKey: "  ", assistantId: "a" }]) {
      const events = await run(createVapiEngine({ ...options, loadSdk: async () => sdk.Vapi }));
      expect(events).toEqual([{ type: "error", code: "not_configured", message: expect.stringMatching(/not set up/) }]);
    }
    expect(sdk.calls.constructed).toEqual([]);
    expect(vapiConfigured("pk", "a")).toBe(true);
    expect(vapiConfigured("pk", "")).toBe(false);
  });

  it("starts with the public key and assistant, and always switches recording, logs and transcript storage off with a call limit", async () => {
    const sdk = fakeSdk();
    await run(createVapiEngine({ publicKey: "pk_test", assistantId: "asst_1", loadSdk: async () => sdk.Vapi }));
    expect(sdk.calls.constructed).toEqual(["pk_test"]);
    expect(sdk.calls.started).toHaveLength(1);
    expect(sdk.calls.started[0].assistant).toBe("asst_1");
    expect(sdk.calls.started[0].overrides).toMatchObject({
      maxDurationSeconds: MAX_CALL_SECONDS,
      artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false, loggingEnabled: false, pcapEnabled: false, transcriptPlan: { enabled: false } },
    });
    expect(MAX_CALL_SECONDS).toBeLessThanOrEqual(180);
  });

  it("gives the assistant exactly this stage's questions and a matching first message", async () => {
    const sdk = fakeSdk();
    await createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => sdk.Vapi }).start(() => {}, { questions: ["How is your mood?", "How stressed are you?", "How well did you sleep?"] });
    const overrides = sdk.calls.started[0].overrides as { firstMessage: string; variableValues: Record<string, string> };
    expect(overrides.firstMessage).toMatch(/three short questions/);
    expect(overrides.variableValues.questionCount).toBe("3");
    expect(overrides.variableValues.questions).toBe("1. How is your mood?\n2. How stressed are you?\n3. How well did you sleep?");
    expect(overrides.variableValues.finalQuestion).toMatch(/anything else/);
    expect(callOverrides().variableValues.questionCount).toBe("4"); // defaults to all four
    expect(callOverrides({ questions: [] }).variableValues.questionCount).toBe("4");
  });

  it("loads the SDK only when a session starts", async () => {
    const loader = vi.fn(async () => fakeSdk().Vapi);
    const engine = createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: loader });
    expect(loader).not.toHaveBeenCalled();
    await engine.start(() => {});
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reports only final transcripts, by role, and ignores everything else", async () => {
    const sdk = fakeSdk();
    const events: VoiceEvent[] = [];
    await createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => sdk.Vapi }).start((e) => events.push(e));
    sdk.emit("call-start");
    sdk.emit("message", transcript("user", "four", "partial"));
    sdk.emit("message", transcript("user", "four"));
    sdk.emit("message", transcript("assistant", "How stressed do you feel?"));
    sdk.emit("message", transcript("system", "ignored"));
    sdk.emit("message", { type: "speech-update", status: "started" });
    sdk.emit("message", transcript("user", "   "));
    sdk.emit("message", null);
    sdk.emit("call-end");
    expect(events).toEqual([{ type: "started" }, { type: "user", text: "four" }, { type: "assistant", text: "How stressed do you feel?" }, { type: "ended" }]);
  });

  it("maps a blocked microphone and other failures to friendly errors", async () => {
    const denied = fakeSdk({ startFails: new DOMException("Permission denied", "NotAllowedError") });
    expect((await run(createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => denied.Vapi })))[0]).toMatchObject({ type: "error", code: "mic_denied" });
    const broken = fakeSdk({ startFails: new Error("boom") });
    expect((await run(createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => broken.Vapi })))[0]).toMatchObject({ type: "error", code: "failed" });
    const sdk = fakeSdk(); const events: VoiceEvent[] = [];
    await createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => sdk.Vapi }).start((e) => events.push(e));
    sdk.emit("error", { error: { type: "daily-error", msg: "getUserMedia failed: NotAllowedError" } });
    expect(events.at(-1)).toMatchObject({ type: "error", code: "mic_denied" });
    expect(describeVapiError("something else").code).toBe("failed");
  });

  it("stops the session, and stopping twice or before starting is safe", async () => {
    const sdk = fakeSdk();
    const engine = createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: async () => sdk.Vapi });
    await engine.stop();
    expect(sdk.calls.stopped).toBe(0);
    await engine.start(() => {});
    await engine.stop(); await engine.stop();
    expect(sdk.calls.stopped).toBe(1);
  });

  it("does not start a call that was stopped while the SDK was still loading", async () => {
    const sdk = fakeSdk();
    let release: (value: VapiConstructor) => void = () => {};
    const engine = createVapiEngine({ publicKey: "pk", assistantId: "a", loadSdk: () => new Promise<VapiConstructor>((resolve) => { release = resolve; }) });
    const starting = engine.start(() => {});
    await engine.stop();
    release(sdk.Vapi);
    await starting;
    expect(sdk.calls.started).toEqual([]);
  });
});

describe("demo (mock) engine", () => {
  it("plays its script with the user's lines, is simulated, and can be stopped", async () => {
    vi.useFakeTimers();
    const engine = createMockVoiceEngine([{ role: "assistant", text: "Hi" }, { role: "user", text: "Four" }, { role: "user", text: "Two" }], 100);
    const events: VoiceEvent[] = [];
    await engine.start((e) => events.push(e));
    expect(engine.id).toBe("demo");
    await vi.advanceTimersByTimeAsync(250);
    expect(events).toEqual([{ type: "started" }, { type: "assistant", text: "Hi" }, { type: "user", text: "Four" }]);
    await engine.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toHaveLength(3);
    vi.useRealTimers();
  });
});
