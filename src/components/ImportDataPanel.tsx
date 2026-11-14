import { useRef, useState } from "react";
import { FileUp, ShieldCheck, Trash2 } from "lucide-react";
import { analyzeReadings, sanitizeReadings, type IngestAnalysis, type SanitizeResult } from "../domain/ingest";
import { parseImportText, readImportFile, type ParseResult } from "../lib/adapters/fileImport";
import { buildSampleCsv } from "../lib/adapters/sampleImport";

interface Outcome { name: string; parse: ParseResult; result: SanitizeResult; analysis: IngestAnalysis; }
const panelClass = "tech-card p-5 sm:p-6";
const MAX_LISTED = 10;

/**
 * Separate from the live wearable: an uploaded file is parsed in the browser, cleaned by the
 * shared sanitizer, and analyzed by the existing alert engine. Nothing is uploaded or stored.
 */
export function ImportDataPanel({ personKey }: { personKey: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const run = (name: string, parse: ParseResult) => {
    const result = sanitizeReadings(parse.rows, { source: "file", defaultDeviceId: "imported-file" });
    setOutcome({ name, parse, result, analysis: analyzeReadings(result, personKey) });
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try { run(file.name, await readImportFile(file)); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const issues = outcome ? [...outcome.parse.errors, ...outcome.result.rejected] : [];
  const quality = outcome?.analysis.quality;
  // The sanitizer's own "N of M rows rejected" note ignores rows the parser already refused, so state one total here.
  const totalRows = outcome ? outcome.result.accepted.length + issues.length : 0;
  const notes = outcome ? [...(issues.length ? [`${issues.length} of ${totalRows} rows could not be used.`] : []), ...outcome.result.qualityNotes.filter((note) => !/rows were rejected/.test(note))] : [];
  return <section className={`${panelClass} space-y-4`} aria-labelledby="import-title">
    <div className="flex items-start gap-3"><FileUp className="mt-1 shrink-0 text-cyan-200" aria-hidden="true" /><div>
      <h2 id="import-title" className="text-xl font-semibold text-white">Import device data</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">OrbitWell does not measure anything itself. Bring a CSV or JSON export from another device or app and OrbitWell will clean it and explain what it sees. Columns: <code>timestamp, metric, value, unit, deviceId</code> (optional <code>context</code>).</p>
    </div></div>
    <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />The file is read on this device only. It is not uploaded or saved.</p>
    <div className="flex flex-wrap gap-3">
      <label className="btn-square inline-flex cursor-pointer items-center gap-2 bg-[#55e0f4] px-4 py-2.5 text-sm font-semibold text-[#080d21]">
        <FileUp size={16} aria-hidden="true" />{busy ? "Reading…" : "Choose a file"}
        <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" aria-label="Choose a CSV or JSON file" onChange={(event) => void onFile(event.target.files?.[0])} />
      </label>
      <button type="button" onClick={() => run("Built-in sample export", parseImportText(buildSampleCsv(), "sample.csv"))} className="btn-square inline-flex items-center gap-2 border border-[#526783] px-4 py-2.5 text-sm font-semibold text-[#f4f7ff]">Try a messy sample file</button>
      {outcome ? <button type="button" onClick={() => setOutcome(null)} className="btn-square inline-flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-300"><Trash2 size={15} aria-hidden="true" />Clear</button> : null}
    </div>

    {outcome ? <div className="space-y-4" role="region" aria-label="Import result">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-semibold text-white">{outcome.name}</p>
        <span className="rounded-full border border-slate-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200" data-quality={quality}>Data quality: {quality}</span>
      </div>
      <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
        <li><span className="font-semibold text-white">{outcome.result.accepted.length}</span> readings accepted</li>
        <li><span className="font-semibold text-white">{issues.length}</span> rows rejected</li>
        <li><span className="font-semibold text-white">{outcome.result.flagged}</span> flagged as sensor artefacts</li>
      </ul>
      {notes.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">{notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4" role="status">
        <p className="text-sm font-semibold text-white">What OrbitWell sees</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{outcome.analysis.message}</p>
        {outcome.analysis.alerts.length ? <ul className="mt-2 space-y-1 text-sm text-amber-100">{outcome.analysis.alerts.map((alert) => <li key={alert.id}>{alert.explanation}</li>)}</ul> : null}
        <p className="mt-2 text-xs text-slate-500">Processed on this device only. Nothing is uploaded or saved.</p>
      </div>
      {issues.length ? <div><h3 className="text-sm font-semibold text-white">Rejected rows</h3>
        <ul className="mt-2">{issues.slice(0, MAX_LISTED).map((issue, index) => <li key={`${issue.row}-${index}`} className="stream-row">Row {issue.row}: {issue.reason}</li>)}</ul>
        {issues.length > MAX_LISTED ? <p className="mt-2 text-xs text-slate-500">…and {issues.length - MAX_LISTED} more.</p> : null}
      </div> : null}
    </div> : null}
  </section>;
}
