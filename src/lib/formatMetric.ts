import type { MetricCardData, MetricName } from "../types/horizon";
import { formatDurationHours } from "./formatMetricValue";

/** One display precision per metric so headline, baseline, and chart values always agree. */
const DECIMALS: Record<MetricName, number> = {
  sleep_hours: 1,
  resting_hr: 0,
  hrv: 0,
  spo2: 1,
  core_temperature: 1,
  radiation_dose: 2,
};

/** Smallest y-axis span per metric, so ordinary noise never looks like a dramatic swing. */
const MIN_SPAN: Record<MetricName, number> = {
  sleep_hours: 3,
  resting_hr: 16,
  hrv: 24,
  spo2: 4,
  core_temperature: 2,
  radiation_dose: 0.3,
};

export function formatValue(metric: MetricName, value: number): string {
  return value.toFixed(DECIMALS[metric]);
}

/** Plain-language difference from the usual value, e.g. "+0.3 h vs usual" or "At your usual". */
export function describeDelta(card: MetricCardData): { text: string; direction: "up" | "down" | "steady" } {
  const step = 10 ** -DECIMALS[card.metric];
  const delta = Number((card.value - card.baseline).toFixed(DECIMALS[card.metric]));
  if (Math.abs(delta) < step) return { text: "At your usual", direction: "steady" };
  const sign = delta > 0 ? "+" : "−";
  if (card.metric === "sleep_hours") {
    return { text: `${sign}${Math.round(Math.abs(delta) * 60)} min vs usual`, direction: delta > 0 ? "up" : "down" };
  }
  return { text: `${sign}${formatValue(card.metric, Math.abs(delta))} ${card.unit} vs usual`, direction: delta > 0 ? "up" : "down" };
}

export function formatDisplayValue(metric: MetricName, value: number, unit: string): string {
  return metric === "sleep_hours" ? formatDurationHours(value) : `${formatValue(metric, value)} ${unit}`;
}

/** Rounded y-axis domain and ticks that include the data and baseline, never narrower than the metric's minimum span. */
export function chartScale(card: MetricCardData, values: number[]): { domain: [number, number]; ticks: number[] } {
  const all = [...values, card.baseline];
  const low = Math.min(...all);
  const high = Math.max(...all);
  const span = Math.max(high - low, MIN_SPAN[card.metric]);
  const centre = (low + high) / 2;
  const step = niceStep(span / 3);
  let lower = Math.floor((centre - span / 2) / step) * step;
  let upper = Math.ceil((centre + span / 2) / step) * step;
  if (card.metric === "spo2" && upper > 100) { lower -= upper - 100; upper = 100; }
  if (card.metric !== "core_temperature" && lower < 0) { upper -= lower; lower = 0; }
  const ticks: number[] = [];
  for (let tick = lower; tick <= upper + step / 2; tick += step) ticks.push(Number(tick.toFixed(6)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
}

/** Ticks need enough decimals to stay distinct, even when the reading itself uses fewer. */
export function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
