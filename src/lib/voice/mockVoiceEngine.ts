import { ALL_FIELDS, NOTE_PROMPT, firstMessage, questionsFor, type CheckInField } from "../../domain/voiceCheckIn";
import type { VoiceEngine, VoiceEvent } from "./voiceEngine";

export interface ScriptLine { role: "user" | "assistant"; text: string; }

const DEMO_ANSWERS: Record<CheckInField, string> = { mood: "Four", stress: "Two", sleepQuality: "Three out of five", energy: "High" };
export const DEMO_NOTE = "A bit tired after the exercise block";

/** What the demo "says" and "hears" for the given questions. Simulated: no microphone, no network, nothing real is captured. */
export function buildDemoScript(fields: CheckInField[] = ALL_FIELDS): ScriptLine[] {
  const questions = questionsFor(fields);
  return [
    { role: "assistant", text: firstMessage(questions.length) },
    ...questions.flatMap((q): ScriptLine[] => [{ role: "assistant", text: q.ask }, { role: "user", text: DEMO_ANSWERS[q.field] }]),
    { role: "assistant", text: NOTE_PROMPT },
    { role: "user", text: DEMO_NOTE },
  ];
}
export const DEMO_SCRIPT: ScriptLine[] = buildDemoScript();

/** Mutable so tests can run the demo quickly. */
export const demoVoiceTiming = { stepMs: 900 };

/** A scripted engine for the demo mode and for tests. `stepMs` is the pause between lines. */
export function createMockVoiceEngine(script: ScriptLine[] = DEMO_SCRIPT, stepMs: number = demoVoiceTiming.stepMs): VoiceEngine {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let active = false;
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  return {
    id: "demo",
    async start(onEvent: (event: VoiceEvent) => void) {
      clear(); active = true;
      onEvent({ type: "started" });
      script.forEach((line, index) => {
        timers.push(setTimeout(() => { if (active) onEvent({ type: line.role, text: line.text }); }, stepMs * (index + 1)));
      });
    },
    async stop() { clear(); active = false; },
  };
}
