import { Watch } from "lucide-react";
import { ASSUMED_SIGNALS, NOT_ASSUMED, SOURCE_SUPPORT, USER_ENTERED, displayUnit } from "../domain/deviceAssumptions";

const panelClass = "tech-card p-5 sm:p-6";

/** Plain-language statement of which devices and signals OrbitWell assumes. Generated from the same contract as the docs. */
export function AssumedDevicesPanel() {
  return <section className={`${panelClass} space-y-4`} aria-labelledby="assumed-title">
    <div className="flex items-start gap-3"><Watch className="mt-1 shrink-0 text-cyan-200" aria-hidden="true" /><div>
      <h2 id="assumed-title" className="text-xl font-semibold text-white">Assumed data sources</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">OrbitWell analyzes readings; it does not measure anything. Real hardware is not connected in this demo, so every signal is illustrative and assumed to arrive from a crew wearable plus a personal dosimeter.</p>
    </div></div>
    <ul aria-label="Assumed signals">
      {ASSUMED_SIGNALS.map((signal) => <li key={signal.metric} className="stream-row">
        <p className="font-semibold text-white">{signal.label} <span className="font-normal text-slate-400">· {displayUnit(signal.unit)}</span></p>
        <p className="mt-1 text-sm text-slate-300">{signal.device} · {signal.cadence}</p>
        <p className="mt-1 text-xs text-slate-500">Accepted range {signal.range[0]}–{signal.range[1]} {displayUnit(signal.unit)}. {signal.note}</p>
      </li>)}
    </ul>
    <div className="grid gap-4 text-sm text-slate-300 md:grid-cols-3">
      <div><h3 className="font-semibold text-white">What each source supplies</h3><ul className="mt-2 space-y-2">{SOURCE_SUPPORT.map((item) => <li key={item.source}><span className="font-medium text-white">{item.source}:</span> {item.supplies}</li>)}</ul></div>
      <div><h3 className="font-semibold text-white">Entered by you</h3><ul className="mt-2 list-disc space-y-1 pl-5">{USER_ENTERED.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h3 className="font-semibold text-white">Not assumed</h3><ul className="mt-2 list-disc space-y-1 pl-5">{NOT_ASSUMED.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </div>
  </section>;
}
