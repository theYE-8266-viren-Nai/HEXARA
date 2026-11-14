import { useState } from "react";
import { Layers, Sparkles } from "lucide-react";
import type { AnomalyAssessment, PatternLevel } from "../domain/anomalyModel";
import type { AssessmentView } from "../lib/useAssessment";
import type { ExplainRequest } from "../domain/explainTypes";
import type { ExplainResult } from "../lib/explainRepository";

/** Optional "Explain this pattern" support. `request` is null when there is nothing honest to explain. */
export interface ExplainSupport { request: ExplainRequest | null; run: (request: ExplainRequest) => Promise<ExplainResult>; }

const LEVEL_TITLE: Record<PatternLevel, string> = {
  usual: "Close to your usual pattern",
  different: "A little different from your usual pattern",
  notably_different: "Noticeably different from your usual pattern",
  insufficient_baseline: "Not enough history yet to compare",
};

const UNAVAILABLE: Record<Extract<AssessmentView, { status: "unavailable" }>["reason"], string> = {
  poor_quality: "The latest readings are too low quality to compare, so no pattern is shown.",
  data_unavailable: "Readings are not arriving right now, so no pattern is shown.",
  no_history: "A pattern needs about two weeks of your own readings. There is not enough history yet.",
  needs_full_day: "Webhook readings need a full completed day before they can be compared with your usual pattern.",
};

const SIGNAL_NAMES = "resting heart rate, HRV, oxygen level (SpO₂), sleep, skin temperature, and radiation dose";

/** Words for the driver list, e.g. "Sleep lower (−12%)". Never a condition, never "risk". */
export function describeDriver(driver: AnomalyAssessment["drivers"][number]): string {
  const sign = driver.changePct > 0 ? "+" : driver.changePct < 0 ? "−" : "";
  return `${driver.label} ${driver.direction} (${sign}${Math.abs(driver.changePct)}%)`;
}

export function PatternCard({ view, explain }: { view: AssessmentView; explain?: ExplainSupport }) {
  if (view.status === "unavailable") {
    return <section className="tech-card pattern-card p-5 sm:p-6" aria-labelledby="pattern-title" data-tone="unavailable">
      <Header />
      <p id="pattern-title" className="mt-2 font-semibold text-white">Pattern view paused</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{UNAVAILABLE[view.reason]}</p>
      <Footer />
    </section>;
  }
  const { assessment, basis } = view;
  const known = assessment.level !== "insufficient_baseline";
  return <section className="tech-card pattern-card p-5 sm:p-6" aria-labelledby="pattern-title" data-tone={assessment.level}>
    <Header />
      <p id="pattern-title" className="mt-2 text-lg font-semibold text-white">{LEVEL_TITLE[assessment.level]}</p>
    {known ? <>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">This checks whether your latest readings look like your own recent routine. It compares your latest readings with your earlier readings; it does not compare you with other people.</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">Compared with your earlier {assessment.baselineDays} days. Available signals include {SIGNAL_NAMES}; {assessment.metricsUsed.length} signal{assessment.metricsUsed.length === 1 ? " was" : "s were"} included in this comparison.</p>
      {assessment.drivers.length ? <>
        <p className="mt-4 text-sm font-medium text-slate-200">{assessment.drivers.length > 1 ? "These signals changed together:" : "This signal changed most:"}</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">{assessment.drivers.map((driver) => <li key={driver.metric}>{describeDriver(driver)}{driver.caveat ? <span className="text-xs text-slate-500"> · {driver.caveat}</span> : null}</li>)}</ul>
      </> : <p className="mt-4 text-sm text-slate-400">Each of the {assessment.metricsUsed.length} reviewed signal{assessment.metricsUsed.length === 1 ? " stayed" : "s stayed"} inside its own usual range. In plain English: the recent readings look similar to this person’s earlier readings.</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">This is a comparison aid from {basis === "scenario" ? "simulated demo readings" : basis === "webhook" ? "webhook readings" : "the available readings"}; it is not a medical conclusion.{assessment.elevatedDays >= 3 ? " Several recent days stood out, not just today." : ""}</p>
      {explain?.request ? <ExplainSection key={JSON.stringify(explain.request)} request={explain.request} run={explain.run} /> : null}
    </> : <p className="mt-2 text-sm leading-6 text-slate-400">A pattern needs about two weeks of your own readings across at least two signals. {assessment.baselineDays ? `So far there are ${assessment.baselineDays} days.` : ""}</p>}
    <Footer />
  </section>;
}

function Header() { return <div className="flex items-center gap-2"><Layers size={15} className="text-cyan-200" aria-hidden="true" /><p className="eyebrow">PATTERN ACROSS SIGNALS</p></div>; }
function Footer() { return <p className="mt-3 text-xs leading-5 text-slate-500">Context only, from simulated readings. Not a diagnosis. Alerts work as before.</p>; }

const FALLBACK_NOTE: Record<NonNullable<ExplainResult["reason"]>, string> = {
  not_configured: "Cloud explanations are not set up, so this is the built-in text.",
  error: "The cloud explanation was unavailable, so this is the built-in text.",
  timeout: "The cloud explanation took too long, so this is the built-in text.",
  unsafe: "The cloud text did not pass OrbitWell's wording check, so this is the built-in text.",
  invalid_request: "The summary could not be sent, so this is the built-in text.",
};

function ExplainSection({ request, run }: { request: ExplainRequest; run: ExplainSupport["run"] }) {
  const [state, setState] = useState<{ phase: "idle" | "loading" | "done"; result?: ExplainResult }>({ phase: "idle" });
  const press = async () => {
    setState({ phase: "loading" });
    const result = await run(request);
    setState({ phase: "done", result });
  };
  return <div className="mt-5 border-t border-slate-700/60 pt-4">
    <button type="button" onClick={() => void press()} disabled={state.phase === "loading"} className="btn-square inline-flex items-center gap-2 border border-cyan-300/40 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10 disabled:cursor-wait disabled:opacity-60"><Sparkles size={15} aria-hidden="true" />{state.phase === "done" ? "Explain again" : "Explain in plain English"}</button>
    <p className="mt-2 text-xs leading-5 text-slate-500">Pressing this may send a de-identified summary (level, score, top signals, data quality, source) to a cloud AI service. Raw readings never leave your device. If the cloud is unavailable, a built-in explanation is shown.</p>
    {state.phase === "loading" ? <p className="mt-3 text-sm text-slate-400" role="status">Writing a short explanation…</p> : null}
    {state.phase === "done" && state.result ? <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-950/30 p-4" role="status">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{state.result.source === "ai" ? "Explanation by OrbitWell (AI-assisted)" : "Built-in explanation"}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{state.result.text}</p>
      {state.result.source === "template" && state.result.reason ? <p className="mt-2 text-xs text-slate-500">{FALLBACK_NOTE[state.result.reason]}</p> : null}
    </div> : null}
  </div>;
}
