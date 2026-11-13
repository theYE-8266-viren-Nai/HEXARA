/**
 * A voice engine only carries speech: it reports what was said and what the assistant said.
 * Understanding the answers, the question order and every safety decision stay in
 * domain/voiceCheckIn, so engines are interchangeable (demo, Vapi, or an on-device one later).
 */
export type VoiceErrorCode = "not_configured" | "mic_denied" | "failed";

export type VoiceEvent =
  | { type: "started" }
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "ended" }
  | { type: "error"; code: VoiceErrorCode; message: string };

/** What the session should cover. The assistant must ask exactly these questions, in this order. */
export interface VoiceContext { questions: string[]; }

export interface VoiceEngine {
  /** "demo" is simulated and needs no microphone; "vapi" sends audio to Vapi. */
  id: "demo" | "vapi";
  /** Begins a session. Must only be called from a user click. Events arrive through `onEvent`. */
  start(onEvent: (event: VoiceEvent) => void, context?: VoiceContext): Promise<void>;
  /** Ends the session and releases the microphone. Safe to call more than once. */
  stop(): Promise<void>;
}
