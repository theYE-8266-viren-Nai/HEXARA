import { Layers } from "lucide-react";
import type { AnomalyAssessment, PatternLevel } from "../domain/anomalyModel";
import type { AssessmentView } from "../lib/useAssessment";

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

/** Words for the driver list, e.g. "Sleep lower (−12%)". Never a condition, never "risk". */
export function describeDriver(driver: AnomalyAssessment["drivers"][number]): string {
  const sign = driver.changePct > 0 ? "+" : driver.changePct < 0 ? "−" : "";
  return `${driver.label} ${driver.direction} (${sign}${Math.abs(driver.changePct)}%)`;
}

export function PatternCard({ view }: { view: AssessmentView }) {
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
      <div className="pattern-meter" role="meter" aria-label="Pattern score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={assessment.patternScore}><span style={{ width: `${assessment.patternScore}%` }} /></div>
      <p className="mt-1 flex justify-between text-xs text-slate-500"><span>Typical day</span><span>Pattern score {assessment.patternScore}</span><span>Notably different</span></p>
      {assessment.drivers.length ? <>
        <p className="mt-4 text-sm font-medium text-slate-200">{assessment.drivers.length > 1 ? "These signals changed together:" : "This signal changed most:"}</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">{assessment.drivers.map((driver) => <li key={driver.metric}>{describeDriver(driver)}{driver.caveat ? <span className="text-xs text-slate-500"> · {driver.caveat}</span> : null}</li>)}</ul>
      </> : <p className="mt-4 text-sm text-slate-400">No single signal stands out from your usual range.</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Compared with your own earlier readings: {assessment.baselineDays} days, {assessment.metricsUsed.length} signal{assessment.metricsUsed.length === 1 ? "" : "s"}{basis === "scenario" ? " (demo scenario)" : basis === "webhook" ? " (webhook readings added)" : ""}.{assessment.elevatedDays >= 3 ? " Several recent days stood out, not just today." : ""}</p>
    </> : <p className="mt-2 text-sm leading-6 text-slate-400">A pattern needs about two weeks of your own readings across at least two signals. {assessment.baselineDays ? `So far there are ${assessment.baselineDays} days.` : ""}</p>}
    <Footer />
  </section>;
}

function Header() { return <div className="flex items-center gap-2"><Layers size={15} className="text-cyan-200" aria-hidden="true" /><p className="eyebrow">PATTERN ACROSS SIGNALS</p></div>; }
function Footer() { return <p className="mt-3 text-xs leading-5 text-slate-500">Context only, from simulated readings. Not a diagnosis. Alerts work as before.</p>; }
