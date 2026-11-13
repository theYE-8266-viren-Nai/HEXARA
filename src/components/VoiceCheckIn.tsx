import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, ShieldAlert, Square } from "lucide-react";
import { ALL_FIELDS, MAX_CALL_SECONDS, URGENT_MESSAGE, applyUserUtterance, questionsFor, startFlow, toFormValues, type CheckInField, type VoiceFlowState } from "../domain/voiceCheckIn";
import { isNonDiagnostic } from "../domain/visualCheck";
import { buildDemoScript, createMockVoiceEngine } from "../lib/voice/mockVoiceEngine";
import { createVapiEngine, vapiConfigured } from "../lib/voice/vapiEngine";
import type { VoiceEngine, VoiceEvent } from "../lib/voice/voiceEngine";

type Phase = "idle" | "consent" | "connecting" | "listening" | "review" | "urgent" | "error";
type Mode = "vapi" | "demo";
interface Line { role: "user" | "assistant"; text: string; }

export interface VoiceCheckInProps {
  /** Fills the on-screen check-in. The person still reviews and saves it themselves. */
  onApply: (values: Partial<Record<CheckInField, string>>, note?: string) => void;
  /** Called when pain or a severe symptom is mentioned, so the support options can open. */
  onUrgent: () => void;
  /** The fields this stage's form shows. Only these are asked, so nothing is filled in that the person cannot see. */
  fields?: CheckInField[];
  /** Injectable for tests. */
  createEngine?: (mode: Mode, fields: CheckInField[]) => VoiceEngine;
  /** Injectable for tests. Defaults to whether the Vapi keys are present in the environment. */
  vapiReady?: boolean;
}

const defaultCreateEngine = (mode: Mode, fields: CheckInField[]): VoiceEngine => mode === "demo"
  ? createMockVoiceEngine(buildDemoScript(fields))
  : createVapiEngine({ publicKey: import.meta.env.VITE_VAPI_PUBLIC_KEY, assistantId: import.meta.env.VITE_VAPI_ASSISTANT_ID });
const defaultVapiReady = vapiConfigured(import.meta.env.VITE_VAPI_PUBLIC_KEY, import.meta.env.VITE_VAPI_ASSISTANT_ID);

const panel = "tech-card p-5 sm:p-6";
const primary = "btn-square inline-flex items-center gap-2 bg-[#55e0f4] px-4 py-2.5 text-sm font-semibold text-[#080d21] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "btn-square inline-flex items-center gap-2 border border-[#526783] px-4 py-2.5 text-sm font-semibold text-[#f4f7ff]";

/**
 * Optional voice check-in. A voice engine only carries speech; the question order, the understanding of
 * answers and every safety decision live in domain/voiceCheckIn. Nothing is saved here: answers are held
 * in memory, shown for review, and only applied to the form when the person says so.
 */
export function VoiceCheckIn({ onApply, onUrgent, fields = ALL_FIELDS, createEngine = defaultCreateEngine, vapiReady = defaultVapiReady }: VoiceCheckInProps) {
  const questions = questionsFor(fields);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [mode, setMode] = useState<Mode>("vapi");
  const [understood, setUnderstood] = useState(false);
  const [flow, setFlow] = useState<VoiceFlowState>(() => startFlow(fields));
  const [lines, setLines] = useState<Line[]>([]);
  const [hidden, setHidden] = useState(0);
  const [message, setMessage] = useState<string | undefined>();
  const [includeNote, setIncludeNote] = useState(false);
  const flowRef = useRef(flow);
  const phaseRef = useRef(phase);
  const engineRef = useRef<VoiceEngine | null>(null);
  flowRef.current = flow; phaseRef.current = phase;
  /** Changes the phase and updates the "current phase" note at once, so events in the same moment see it. */
  const go = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };

  const stopEngine = useCallback(() => { const engine = engineRef.current; engineRef.current = null; void engine?.stop(); }, []);
  useEffect(() => stopEngine, [stopEngine]);

  const reset = () => { stopEngine(); const fresh = startFlow(fields); flowRef.current = fresh; setFlow(fresh); setLines([]); setHidden(0); setIncludeNote(false); setUnderstood(false); };

  const onEvent = useCallback((event: VoiceEvent) => {
    if (phaseRef.current === "review" || phaseRef.current === "urgent" || phaseRef.current === "idle") return; // ignore late events after the session ended
    if (event.type === "started") { go("listening"); return; }
    if (event.type === "assistant") {
      // The assistant's own words are shown only if they pass the same language guard as everything else.
      if (isNonDiagnostic(event.text)) setLines((current) => [...current, { role: "assistant", text: event.text }]); else setHidden((count) => count + 1);
      return;
    }
    if (event.type === "user") {
      setLines((current) => [...current, { role: "user", text: event.text }]);
      const next = applyUserUtterance(flowRef.current, event.text);
      flowRef.current = next; setFlow(next);
      if (next.urgent) { stopEngine(); go("urgent"); onUrgent(); }
      else if (next.done) { stopEngine(); go("review"); }
      return;
    }
    if (event.type === "ended") {
      stopEngine();
      if (Object.keys(flowRef.current.answers).length) go("review"); else { go("idle"); setMessage("The call ended before any answers were heard."); }
      return;
    }
    stopEngine(); go("error"); setMessage(event.message);
  }, [onUrgent, stopEngine]);

  const begin = async (chosen: Mode) => {
    reset(); setMessage(undefined); setMode(chosen); go("connecting");
    const engine = createEngine(chosen, fields);
    engineRef.current = engine;
    await engine.start(onEvent, { questions: questions.map((q) => q.ask) });
  };

  const stopNow = () => {
    stopEngine();
    if (Object.keys(flowRef.current.answers).length) go("review"); else { go("idle"); setMessage("Stopped before any answers were heard."); }
  };

  const apply = () => {
    onApply(toFormValues(flow.answers), includeNote && flow.note ? flow.note : undefined);
    reset(); go("idle"); setMessage("Filled in. Review the sliders, then press Save when you are happy with them.");
  };

  const answered = questions.filter((q) => flow.answers[q.field] !== undefined).length;

  return <section className={`${panel} space-y-4`} aria-labelledby="voice-title">
    <div className="flex items-start gap-3"><Mic className="mt-1 shrink-0 text-cyan-200" aria-hidden="true" /><div>
      <h2 id="voice-title" className="text-xl font-semibold text-white">Check in by voice</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Answer {questions.length === 1 ? "one short question" : `${questions.length} short questions`} out loud instead of using the sliders. You review everything before it is filled in, and the sliders below always work without voice.</p>
    </div></div>

    {message && (phase === "idle" || phase === "error") ? <p className={`text-sm ${phase === "error" ? "text-amber-100" : "text-slate-300"}`} role={phase === "error" ? "alert" : "status"}>{message}</p> : null}

    {phase === "idle" || phase === "error" ? <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {vapiReady ? <button type="button" className={primary} onClick={() => { setMessage(undefined); go("consent"); setMode("vapi"); }}><Mic size={16} aria-hidden="true" />Start voice check-in</button> : null}
        <button type="button" className={secondary} onClick={() => void begin("demo")}>Try the demo voice</button>
      </div>
      {!vapiReady ? <p className="text-xs text-slate-500">Voice with a real microphone is not set up yet. It needs a Vapi public key and assistant ID in your environment file (see docs/voice-setup.md). The demo voice is simulated and needs neither.</p> : null}
    </div> : null}

    {phase === "consent" ? <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4" role="group" aria-label="Before you start">
      <h3 className="font-semibold text-white">Before you start</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-amber-50">
        <li>Your voice is sent over the internet to Vapi and the speech and AI services it uses. Its voice library also includes error-reporting software from its makers, and Horizon cannot see what that reports. This is different from the rest of Horizon, where check-ins stay on your device.</li>
        <li>Horizon does not record or save audio or what you say. It asks Vapi not to record, log or keep transcripts, and to end the call after {MAX_CALL_SECONDS / 60} minutes, but Horizon cannot check that Vapi does this.</li>
        <li>Only the numbers you confirm (and a note, only if you choose) are added to the form. Nothing else is sent anywhere.</li>
        <li>For pain or severe symptoms, do not use this check-in. Contact the crew medic. Saying them stops the check-in.</li>
        <li>Your browser will ask for microphone access. You can stop at any time.</li>
      </ul>
      <label className="flex items-start gap-3 text-sm text-white"><input type="checkbox" className="mt-1 size-4" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />I understand and want to use voice for this check-in.</label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} disabled={!understood} onClick={() => void begin("vapi")}><Mic size={16} aria-hidden="true" />Start</button>
        <button type="button" className={secondary} onClick={() => { go("idle"); setUnderstood(false); }}>Cancel</button>
      </div>
    </div> : null}

    {phase === "connecting" ? <p className="text-sm text-slate-300" role="status">Connecting{mode === "vapi" ? ". Your browser may ask for microphone access." : " the demo voice…"}</p> : null}

    {phase === "listening" || phase === "review" || phase === "urgent" ? <>
      {mode === "demo" ? <p className="text-xs text-purple-100" role="note">Demo voice: simulated. No microphone is used and nothing is sent anywhere.</p> : null}
      {phase === "listening" ? <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-white" role="status">{mode === "vapi" ? "Listening" : "Playing the demo"} · {answered} of {questions.length} answered</p>
        <button type="button" className={secondary} onClick={stopNow}><Square size={14} aria-hidden="true" />Stop</button>
      </div> : null}
      <ol className="space-y-1.5 text-sm" role="log" aria-live="polite" aria-label="Conversation">
        {lines.map((line, index) => <li key={index} className={line.role === "user" ? "text-white" : "text-slate-400"}><span className="font-semibold">{line.role === "user" ? "You" : "Horizon"}:</span> {line.text}</li>)}
        {hidden ? <li className="text-xs text-slate-500">{hidden} assistant message{hidden === 1 ? "" : "s"} not shown.</li> : null}
      </ol>
    </> : null}

    {phase === "urgent" ? <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-sm text-rose-100">
      <p className="flex items-start gap-2 font-semibold"><ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{URGENT_MESSAGE}</p>
      <p className="mt-2">The support options are open below. Nothing from this voice check-in was kept.</p>
      <button type="button" className={`${secondary} mt-3`} onClick={() => { reset(); go("idle"); setMessage(undefined); }}>Close</button>
    </div> : null}

    {phase === "review" ? <div className="space-y-3" role="group" aria-label="Review your answers">
      <h3 className="font-semibold text-white">Review your answers</h3>
      <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        {questions.map((q) => <li key={q.field} className="rounded-xl border border-slate-600/40 p-3"><span className="font-semibold text-white">{q.label}</span><br />{flow.answers[q.field] !== undefined ? `${flow.answers[q.field]} of 5` : "Not answered. Left as it is on the form."}</li>)}
      </ul>
      {flow.note ? <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 size-4" checked={includeNote} onChange={(event) => setIncludeNote(event.target.checked)} /><span>Also add what I said as my note: “{flow.note}”</span></label> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} onClick={apply}>Fill in the form</button>
        <button type="button" className={secondary} onClick={() => { reset(); go("idle"); setMessage("Discarded. Nothing was changed."); }}>Discard</button>
      </div>
      <p className="text-xs text-slate-500">This only fills in the sliders, like moving them yourself: they stay on this device as a draft, and the check-in is recorded when you press Save.</p>
    </div> : null}
  </section>;
}
