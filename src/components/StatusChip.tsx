import { Activity, AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";
import type { AlertSeverity } from "../types/horizon";

const styles = {
  normal: { label: "Normal", Icon: CheckCircle2 },
  watch: { label: "Watch", Icon: AlertTriangle },
  talk_to_crew_medic: { label: "Talk to crew medic", Icon: Activity },
  unavailable: { label: "Data unavailable", Icon: WifiOff },
};

export function StatusChip({ severity }: { severity: AlertSeverity | "unavailable" }) {
  const { label, Icon } = styles[severity];
  return <span className="status-chip" data-severity={severity}><Icon aria-hidden="true" size={13} />{label}</span>;
}
