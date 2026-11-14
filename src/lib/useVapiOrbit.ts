import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

export type VapiOrbitState = "unavailable" | "idle" | "listening" | "thinking" | "speaking" | "error";

export function useVapiOrbit(onTranscript?: (text: string) => void) {
  const vapi = useRef<Vapi | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const [state, setState] = useState<VapiOrbitState>(() => import.meta.env.VITE_VAPI_PUBLIC_KEY && import.meta.env.VITE_VAPI_ASSISTANT_ID ? "idle" : "unavailable");
  const [error, setError] = useState<string>();

  useEffect(() => {
    const key = import.meta.env.VITE_VAPI_PUBLIC_KEY;
    const assistant = import.meta.env.VITE_VAPI_ASSISTANT_ID;
    if (!key || !assistant) return;
    const client = new Vapi(key);
    vapi.current = client;
    client.on("call-start", () => setState("listening"));
    client.on("call-end", () => setState("idle"));
    client.on("speech-start", () => setState("listening"));
    client.on("speech-end", () => setState("thinking"));
    client.on("message", (message: { type?: string; role?: string; transcript?: string; transcriptType?: string }) => {
      if (message.type === "transcript" && message.role === "user" && message.transcriptType === "final" && message.transcript?.trim()) onTranscriptRef.current?.(message.transcript.trim());
      if (message.type === "transcript" && message.role === "assistant") setState("speaking");
    });
    client.on("error", (err: unknown) => {
      console.error("[ORBIT Voice] Vapi error:", err);
      setState("error");
      setError("Voice is unavailable; you can still ask ORBIT by text.");
    });
    return () => { client.stop(); vapi.current = null; };
  }, []); // stable — onTranscript is accessed via ref

  const start = useCallback(async () => {
    const assistant = import.meta.env.VITE_VAPI_ASSISTANT_ID;
    if (!vapi.current || !assistant) return false;
    setError(undefined); setState("listening");
    try { await vapi.current.start(assistant); return true; } catch (err) { console.error("[ORBIT Voice] Vapi start failed:", err); setState("error"); setError("Microphone access was not available; you can still ask ORBIT by text."); return false; }
  }, []);
  const stop = useCallback(() => { vapi.current?.stop(); setState("idle"); }, []);
  // Read ORBIT's grounded answer aloud on the live call (citation markers removed).
  const speak = useCallback((text: string) => {
    const spoken = text.replace(/\s*\[\d+\]/g, "").trim();
    if (!vapi.current || !spoken) return;
    try { vapi.current.say(spoken, false, true); setState("speaking"); } catch (err) { console.error("[ORBIT Voice] Vapi say failed:", err); }
  }, []);
  return { state, error, available: state !== "unavailable", start, stop, speak };
}
