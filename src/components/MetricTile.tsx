import { Activity, Heart, Moon, Sun, Thermometer, Wind } from "lucide-react";
import type { MetricCardData } from "../types/horizon";
import { describeDelta, formatDisplayValue, formatValue } from "../lib/formatMetric";

const ICONS = { sleep_hours: Moon, resting_hr: Heart, hrv: Activity, spo2: Wind, core_temperature: Thermometer, radiation_dose: Sun };

/** One signal: latest value, difference from the person's usual value, and a sparkline with the usual line. */
export function MetricTile({ metric, flagged = false, onOpen }: { metric: MetricCardData; flagged?: boolean; onOpen?: () => void }) {
  const Icon = ICONS[metric.metric];
  const delta = describeDelta(metric);
  const values = metric.points.map((point) => point.value);
  // Sparklines show shape, so they scale to the data (with padding) rather than to a fixed range.
  const min = Math.min(...values, metric.baseline);
  const max = Math.max(...values, metric.baseline);
  const pad = (max - min || Math.abs(max) * 0.05 || 1) * 0.2;
  const low = min - pad;
  const high = max + pad;
  const y = (value: number) => 31 - ((value - low) / (high - low)) * 30;
  const points = values.map((value, index) => `${(index * 200) / Math.max(values.length - 1, 1)},${y(value)}`).join(" ");
  const displayValue = formatDisplayValue(metric.metric, metric.value, metric.unit);
  const usualValue = formatDisplayValue(metric.metric, metric.baseline, metric.unit);
  const body = <>
    <div className="metric-header">
      <span className="metric-icon" aria-hidden="true"><Icon size={15} strokeWidth={1.75} /></span>
      <p>{metric.label}</p>
      {flagged ? <span className="metric-flag">Review</span> : null}
    </div>
    <p className="metric-value">{metric.metric === "sleep_hours" ? displayValue : <>{formatValue(metric.metric, metric.value)}<span>{metric.unit}</span></>}</p>
    <p className="metric-delta" data-direction={delta.direction}>{delta.text}<span> · usual {usualValue}</span></p>
    <svg className="metric-sparkline" viewBox="0 0 200 32" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="200" y1={y(metric.baseline)} y2={y(metric.baseline)} className="metric-spark-baseline" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
    <MetricMetadata metric={metric} />
  </>;
  return onOpen
    ? <button type="button" className="metric-tile" data-flagged={flagged || undefined} onClick={onOpen} aria-label={`${metric.label}: ${displayValue}, ${delta.text}. Open trends`}>{body}</button>
    : <article className="metric-tile" data-flagged={flagged || undefined}>{body}</article>;
}

export function MetricMetadata({ metric }: { metric: Pick<MetricCardData, "source" | "quality" | "aggregationPeriod"> }) {
  return <p className="metric-metadata" aria-label={`Source: ${metric.source}. Quality: ${metric.quality}. Period: ${metric.aggregationPeriod}.`}>{metric.source} · {metric.quality} · {metric.aggregationPeriod}</p>;
}
