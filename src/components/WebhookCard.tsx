import { useState } from "react";
import { Copy, Webhook } from "lucide-react";
import { useDevice } from "../lib/deviceContext";
import { curlExample } from "../lib/adapters/webhookSource";

/** Profile card for the local webhook source. Shows availability, the token and a ready-to-copy request. */
export function WebhookCard() {
  const webhook = useDevice()?.webhook;
  const [copied, setCopied] = useState(false);
  if (!webhook) return null;
  const { phase } = webhook;
  const title = phase === "receiving" ? (webhook.ready ? "Live · receiving readings" : "Receiving…") : phase === "waiting" ? "Listening…" : phase === "idle" ? "Quiet" : phase === "error" ? "Lost contact" : phase === "unavailable" ? "Not available in this build" : phase === "checking" ? "Checking…" : "Not receiving";
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const command = webhook.token ? curlExample(origin, webhook.token) : "";
  const showDetails = phase !== "unavailable" && phase !== "checking" && Boolean(webhook.token);
  return <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4" aria-labelledby="webhook-card-title">
    <div className="flex items-center gap-2"><Webhook size={16} className="text-cyan-200" aria-hidden="true" /><p id="webhook-card-title" className="text-sm text-slate-400">Webhook source (local demo)</p></div>
    <p className="mt-1 text-lg font-semibold text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-400">{webhook.message ?? "Let a connected service or app post readings to OrbitWell. OrbitWell cleans them like any other source and replaces only the signals it receives; the rest stay simulated."}</p>
    {phase === "receiving" ? <p className="mt-2 text-sm text-slate-300" role="status">{webhook.received} readings received</p> : null}
    {showDetails && phase !== "off" ? <>
      <p className="mt-3 text-xs text-slate-500">Send readings to <code>{origin}/api/ingest</code> with this local demo token. Rows are kept in memory on your dev server for up to {webhook.retentionHours} hours, are cleaned in the app, and are never saved or sent to the cloud.</p>
      <pre aria-label="Example request" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-[#293d59] bg-[#080d21] p-3 font-mono text-xs leading-5 text-slate-200">{command}</pre>
      <button type="button" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100" onClick={() => { void navigator.clipboard?.writeText(command).then(() => setCopied(true), () => setCopied(false)); }}><Copy size={14} aria-hidden="true" />{copied ? "Copied" : "Copy request"}</button>
    </> : null}
    <div className="mt-3 flex flex-wrap gap-3">
      {phase === "unavailable" || phase === "checking" ? null
        : phase === "off" ? <button type="button" onClick={webhook.start} className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">Start receiving</button>
        : <button type="button" onClick={webhook.stop} className="rounded-xl border border-slate-500/50 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Stop receiving</button>}
    </div>
  </div>;
}
