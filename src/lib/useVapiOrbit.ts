import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

export type VapiOrbitState = "unavailable" | "idle" | "listening" | "thinking" | "speaking" | "error";

export function useVapiOrbit(onTranscript?: (text: string) => void) {
  const vapi = useRef<Vapi | null>(null);
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
      if (message.type === "transcript" && message.role === "user" && message.transcriptType === "final" && message.transcript?.trim()) onTranscript?.(message.transcript.trim());
      if (message.type === "transcript" && message.role === "assistant") setState("speaking");
    });
    client.on("error", () => { setState("error"); setError("Voice is unavailable; you can still ask ORBIT by text."); });
    return () => { client.stop(); vapi.current = null; };
  }, [onTranscript]);

  const start = async () => {
    const assistant = import.meta.env.VITE_VAPI_ASSISTANT_ID;
    if (!vapi.current || !assistant) return false;
    setError(undefined); setState("listening");
    try { await vapi.current.start(assistant); return true; } catch { setState("error"); setError("Microphone access was not available; you can still ask ORBIT by text."); return false; }
  };
  const stop = () => { vapi.current?.stop(); setState("idle"); };
  return { state, error, available: state !== "unavailable", start, stop };
}
