import { Activity, ArrowDownRight, ArrowUpRight, Heart, Minus, Moon, Sun, Thermometer, Wind } from "lucide-react";
import type { MetricCardData } from "../types/horizon";
import { useDevice } from "../lib/deviceContext";

export function MetricTile({ metric }: { metric: MetricCardData }) {
  const live = useDevice()?.status.phase === "streaming";
  const TrendIcon = metric.trend === "up" ? ArrowUpRight : metric.trend === "down" ? ArrowDownRight : Minus;
  const MetricIcon = { sleep_hours: Moon, resting_hr: Heart, hrv: Activity, spo2: Wind, core_temperature: Thermometer, radiation_dose: Sun }[metric.metric];
  const values = metric.points.map((point) => point.value);
  const low = Math.min(...values);
  const range = Math.max(...values) - low || 1;
  const points = values.map((value, index) => `${2 + index * 77 / Math.max(values.length - 1, 1)},${25 - (value - low) / range * 21}`).join(" ");
  return <article className="tech-card metric-tile rev">
    <div className="metric-header"><p>{metric.label}{live ? <span className="live-dot" title="Live simulated reading" aria-label="Live" /> : null}</p><MetricIcon size={16} strokeWidth={1.5} aria-hidden="true" /></div>
    <div className="metric-value-row"><p className="metric-value">{metric.value}<span>{metric.unit}</span></p><svg className="metric-sparkline" viewBox="0 0 82 28" fill="none" aria-hidden="true"><polyline points={points} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg></div>
    <p className="metric-baseline">Usual: {metric.baseline} {metric.unit}<TrendIcon size={12} aria-hidden="true" /></p>
  </article>;
}
