import { evaluateAlerts } from "./alertEngine";
import type { MetricName, Observation } from "./types";

export type MonthlyDirection = "usual" | "higher" | "lower" | "insufficient";
export type MonthlyQuality = "good" | "limited" | "insufficient";

export interface MonthlyMetricSummary {
  metric: MetricName;
  average: number;
  minimum: number;
  maximum: number;
  observedDays: number;
  direction: MonthlyDirection;
}

export interface MonthlyHistorySummary {
  month: string;
  label: string;
  metrics: MonthlyMetricSummary[];
  notableDays: number;
  quality: MonthlyQuality;
  personalSummary: string;
}

export interface MonthlyHistoryWindow {
  from?: string;
  to?: string;
  note?: string;
}

const METRIC_ORDER: MetricName[] = ["heart_rate", "hrv", "spo2", "sleep_hours", "skin_temperature", "radiation_dose"];
const round = (value: number, places = 2) => Number(value.toFixed(places));
const monthLabel = (month: string) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }

function spread(values: number[], mean: number) {
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1));
}

function direction(values: number[], prior: number[] | undefined): MonthlyDirection {
  if (!prior?.length) return "insufficient";
  const current = average(values);
  const earlier = average(prior);
  const threshold = Math.max(spread(prior, earlier), Math.abs(earlier) * 0.03, 0.01);
  if (current > earlier + threshold) return "higher";
  if (current < earlier - threshold) return "lower";
  return "usual";
}

function quality(observedDays: number): MonthlyQuality {
  return observedDays >= 18 ? "good" : observedDays >= 7 ? "limited" : "insufficient";
}

function personalSummary(metrics: MonthlyMetricSummary[], monthQuality: MonthlyQuality): string {
  if (monthQuality === "insufficient") return "Not enough readings to compare this month with your earlier pattern.";
  const higher = metrics.filter((metric) => metric.direction === "higher").length;
  const lower = metrics.filter((metric) => metric.direction === "lower").length;
  if (!higher && !lower) return "Most signals stayed close to your earlier personal pattern.";
  if (higher && lower) return "Some signals were higher and others lower than your earlier personal pattern.";
  return `${higher ? "Some signals were higher" : "Some signals were lower"} than your earlier personal pattern.`;
}

/** Aggregates daily synthetic observations without exposing raw readings to the AI layer. */
export function summarizeMonthlyHistory(observations: Observation[], window: MonthlyHistoryWindow = {}): MonthlyHistorySummary[] {
  const ordered = [...observations]
    .filter((observation) => (!window.from || observation.observed_on >= window.from) && (!window.to || observation.observed_on <= window.to))
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.metric.localeCompare(b.metric));
  const byMonth = new Map<string, Observation[]>();
  for (const observation of ordered) {
    const month = observation.observed_on.slice(0, 7);
    const bucket = byMonth.get(month) ?? [];
    bucket.push(observation);
    byMonth.set(month, bucket);
  }
  const alertsByMonth = new Map<string, number>();
  for (const alert of evaluateAlerts(ordered)) {
    const month = alert.observed_on.slice(0, 7);
    alertsByMonth.set(month, (alertsByMonth.get(month) ?? 0) + 1);
  }
  const summaries: MonthlyHistorySummary[] = [];
  const previousByMetric = new Map<MetricName, number[]>();
  for (const [month, monthObservations] of byMonth) {
    const days = new Set(monthObservations.map((observation) => observation.observed_on)).size;
    const monthMetrics: MonthlyMetricSummary[] = [];
    for (const metric of METRIC_ORDER) {
      const values = monthObservations.filter((observation) => observation.metric === metric).map((observation) => observation.value);
      if (!values.length) continue;
      const prior = previousByMetric.get(metric);
      monthMetrics.push({ metric, average: round(average(values)), minimum: round(Math.min(...values)), maximum: round(Math.max(...values)), observedDays: new Set(monthObservations.filter((observation) => observation.metric === metric).map((observation) => observation.observed_on)).size, direction: direction(values, prior) });
      previousByMetric.set(metric, [...(prior ?? []), ...values]);
    }
    const monthQuality = quality(days);
    summaries.push({ month, label: monthLabel(month), metrics: monthMetrics, notableDays: alertsByMonth.get(month) ?? 0, quality: monthQuality, personalSummary: personalSummary(monthMetrics, monthQuality) });
  }
  return summaries;
}
