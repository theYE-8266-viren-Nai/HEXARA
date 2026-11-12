import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { summarizeBaseline } from "../domain/baselineSummary";
import type { PreparationRepository } from "../lib/preparationRepository";
import type { BaselineCheckIn } from "../types/horizon";

/** Shows the Future traveler's own baseline as it builds from saved check-ins. Never a norm or a target. */
export function BaselineSummaryPanel({ repository, refreshKey }: { repository?: PreparationRepository; refreshKey: number }) {
  const [checkIns, setCheckIns] = useState<BaselineCheckIn[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (repository?.listBaselineCheckins() ?? Promise.resolve({ data: [] as BaselineCheckIn[], warning: "Cloud save is unavailable for this session." })).then((result) => {
      if (cancelled) return;
      setCheckIns(result.data); setWarning(result.warning); setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [repository, refreshKey]);

  const summary = summarizeBaseline(checkIns);
  return <section className="tech-card p-5 sm:p-6" aria-labelledby="baseline-summary-title">
    <div className="flex items-start gap-3"><TrendingUp className="mt-1 shrink-0 text-cyan-200" aria-hidden="true" /><div>
      <h2 id="baseline-summary-title" className="text-xl font-semibold text-white">Your baseline so far</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Horizon compares you only with your own pattern. It needs {summary.needed} check-ins on different days before it calls anything "usual". This is not a norm, a target, or flight clearance.</p>
    </div></div>
    {!loaded ? <p className="mt-4 text-sm text-slate-400" role="status">Loading your check-ins…</p> : <>
      <p className="mt-4 text-sm font-semibold text-white" role="status">{summary.checkIns} of {summary.needed} check-ins{summary.ready ? " · baseline ready" : ""}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/50" aria-hidden="true"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, (summary.checkIns / summary.needed) * 100)}%` }} /></div>
      {summary.ready ? <ul className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        {summary.heartRate ? <li className="rounded-xl border border-slate-600/40 p-3"><span className="font-semibold text-white">Resting heart rate</span><br />Usually about {summary.heartRate.mean} bpm (range {summary.heartRate.min}–{summary.heartRate.max}, {summary.heartRate.count} days)</li> : null}
        {summary.sleep ? <li className="rounded-xl border border-slate-600/40 p-3"><span className="font-semibold text-white">Sleep</span><br />Usually about {summary.sleep.mean} h (range {summary.sleep.min}–{summary.sleep.max}, {summary.sleep.count} days)</li> : null}
      </ul> : <p className="mt-3 text-sm text-slate-400">Save a baseline check-in on another day to keep building it. You can fill the form from the wearable's current readings.</p>}
      {warning && !checkIns.length ? <p className="mt-3 text-xs text-slate-500">{warning}</p> : null}
    </>}
  </section>;
}
