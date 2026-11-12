import { Activity, AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";
import type { AlertSeverity } from "../types/horizon";

const styles = {
  normal: { label: "Normal", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", Icon: CheckCircle2 },
  watch: { label: "Watch", className: "border-amber-300/30 bg-amber-300/10 text-amber-100", Icon: AlertTriangle },
  talk_to_crew_medic: { label: "Talk to crew medic", className: "border-rose-400/30 bg-rose-400/10 text-rose-100", Icon: Activity },
  unavailable: { label: "Data unavailable", className: "border-slate-400/30 bg-slate-400/10 text-slate-200", Icon: WifiOff },
};

export function StatusChip({ severity }: { severity: AlertSeverity | "unavailable" }) {
  const { label, className, Icon } = styles[severity];
  return <span className={`status-chip ${className}`}><Icon aria-hidden="true" size={12} />{label}</span>;
}
