import { MAX_CALL_SECONDS, NOTE_PROMPT, VOICE_QUESTIONS, firstMessage } from "../../domain/voiceCheckIn";
import type { VoiceContext, VoiceEngine, VoiceEvent } from "./voiceEngine";

/**
 * Vapi voice engine (cloud). Audio goes to Vapi and the speech and language providers it uses.
 * The SDK is imported only when a call starts, so it never adds to the main bundle.
 *
 * Vapi records calls and keeps logs and transcripts BY DEFAULT. Horizon asks for all of that to be
 * switched off on every call and caps the call length, whatever the dashboard assistant says.
 * Horizon cannot verify that Vapi honours this, which the consent screen says plainly.
 */
export const SAFE_CALL_OVERRIDES = {
  maxDurationSeconds: MAX_CALL_SECONDS,
  artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false, loggingEnabled: false, pcapEnabled: false, transcriptPlan: { enabled: false } },
};

/**
 * Per-call settings: the first message and the question list, so the assistant asks exactly the questions
 * this stage's form has. The assistant's prompt (docs/voice-setup.md) refers to them as {{questions}}.
 */
export function callOverrides(context?: VoiceContext) {
  const questions = context?.questions.length ? context.questions : VOICE_QUESTIONS.map((q) => q.ask);
  return {
    ...SAFE_CALL_OVERRIDES,
    firstMessage: firstMessage(questions.length),
    variableValues: { questions: questions.map((q, i) => `${i + 1}. ${q}`).join("\n"), questionCount: String(questions.length), finalQuestion: NOTE_PROMPT },
  };
}

/** The small part of the SDK that is used, so tests can supply a fake. */
export interface VapiLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  start(assistant: string, overrides?: Record<string, unknown>): Promise<unknown>;
  stop(): Promise<void> | void;
}
export type VapiConstructor = new (publicKey: string) => VapiLike;

export interface VapiEngineOptions {
  publicKey?: string;
  assistantId?: string;
  loadSdk?: () => Promise<VapiConstructor>;
}

const defaultLoader = async (): Promise<VapiConstructor> => (await import("@vapi-ai/web")).default as unknown as VapiConstructor;

export const vapiConfigured = (publicKey?: string, assistantId?: string) => Boolean(publicKey?.trim() && assistantId?.trim());

/** Maps whatever the SDK throws to a friendly code. */
export function describeVapiError(error: unknown): { code: "mic_denied" | "failed"; message: string } {
  // Read name and message from any object (a browser DOMException is not always an Error), plus its JSON.
  const parts: string[] = [];
  if (typeof error === "string") parts.push(error);
  else if (error && typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown };
    parts.push(String(e.name ?? ""), String(e.message ?? ""));
    try { parts.push(JSON.stringify(error)); } catch { /* circular */ }
  }
  const raw = parts.join(" ");
  if (/notallowed|permission|denied|microphone|getusermedia/i.test(raw)) return { code: "mic_denied", message: "Microphone permission was blocked. Allow it for this site in your browser, or use the on-screen check-in." };
  return { code: "failed", message: "The voice service could not start or was interrupted. You can try again or use the on-screen check-in." };
}

export function createVapiEngine(options: VapiEngineOptions): VoiceEngine {
  let vapi: VapiLike | null = null;
  let stopped = false;
  return {
    id: "vapi",
    async start(onEvent: (event: VoiceEvent) => void, context?: VoiceContext) {
      const { publicKey, assistantId } = options;
      if (!vapiConfigured(publicKey, assistantId)) { onEvent({ type: "error", code: "not_configured", message: "Voice check-in is not set up. It needs a Vapi public key and assistant ID (see docs/voice-setup.md)." }); return; }
      stopped = false;
      try {
        const Vapi = await (options.loadSdk ?? defaultLoader)();
        if (stopped) return;
        const client = new Vapi(publicKey!.trim());
        vapi = client;
        client.on("call-start", () => onEvent({ type: "started" }));
        client.on("call-end", () => onEvent({ type: "ended" }));
        client.on("error", (error) => { const { code, message } = describeVapiError(error); onEvent({ type: "error", code, message }); });
        client.on("message", (raw) => {
          const message = raw as { type?: string; role?: string; transcriptType?: string; transcript?: string };
          if (message?.type !== "transcript" || message.transcriptType !== "final" || typeof message.transcript !== "string" || !message.transcript.trim()) return;
          if (message.role === "user") onEvent({ type: "user", text: message.transcript });
          else if (message.role === "assistant") onEvent({ type: "assistant", text: message.transcript });
        });
        await client.start(assistantId!.trim(), callOverrides(context));
      } catch (error) {
        const { code, message } = describeVapiError(error);
        onEvent({ type: "error", code, message });
      }
    },
    async stop() {
      stopped = true;
      const client = vapi; vapi = null;
      try { await client?.stop(); } catch { /* already ended */ }
    },
  };
}
