import { evaluateAlerts } from "./alertEngine";
import type { AstronautProfile } from "./astronautAccount";
import { MAX_WINDOW_DAYS, generateWindowObservations, personIndexFor } from "../data/synthetic";
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

/**
 * How many days in each month the existing alert rules would have flagged.
 * `evaluateAlerts` only judges the latest reading of each signal ("how is today?"), so it is replayed once per day,
 * each time with only the readings up to that day. Readings before the journey window still count as baseline.
 * No thresholds or rules are changed here; a day counts once however many signals were outside the usual range.
 */
function notableDaysByMonth(observations: Observation[]): Map<string, number> {
  const all = [...observations].sort((a, b) => a.observed_on.localeCompare(b.observed_on));
  const dates = [...new Set(all.map((observation) => observation.observed_on))];
  const counts = new Map<string, number>();
  let end = 0;
  for (const date of dates) {
    while (end < all.length && all[end].observed_on <= date) end += 1;
    if (evaluateAlerts(all.slice(0, end)).some((alert) => alert.observed_on === date)) {
      const month = date.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  }
  return counts;
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
  const alertsByMonth = notableDaysByMonth(observations);
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

const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The two dates of each stage's journey that bound its monthly history, and how each pair is described. */
const JOURNEY_DATES = {
  active: { start: "launchDate", end: "plannedReturn", both: "Showing every month from your launch to your planned return.", startOnly: "No planned return was entered, so this demo assumes a 180-day mission from launch.", endOnly: "No launch date was entered, so this demo assumes the 180 days before planned return.", none: "No mission dates were entered, so all available synthetic readings are shown." },
  retired: { start: "lastLaunch", end: "lastLanding", both: "Showing every month from your last launch to your last landing.", startOnly: "No landing date was entered, so this demo assumes 180 days from your last launch.", endOnly: "No launch date was entered, so this demo assumes the 180 days before your last landing.", none: "No mission dates were entered, so all available synthetic readings are shown." },
  future: { start: "trainingStart", end: "targetLaunch", both: "Showing every month from your training start to your target launch.", startOnly: "No target launch was entered, so this demo assumes 180 days from training start.", endOnly: "No training start was entered, so this demo assumes the 180 days before your target launch.", none: "No training dates were entered, so all available synthetic practice readings are shown." },
} as const;

/** The period a profile's monthly history covers, from the dates entered when the account was made. */
export function monthlyHistoryWindow(profile: AstronautProfile | null | undefined): MonthlyHistoryWindow {
  if (!profile) return {};
  const dates = JOURNEY_DATES[profile.stage];
  const start = profile.journey[dates.start], end = profile.journey[dates.end];
  if (start && end) {
    if (end < start) return { note: "The end date is before the start date, so all available synthetic readings are shown." };
    const tooLong = daysBetween(start, end) + 1 > MAX_WINDOW_DAYS;
    return { from: tooLong ? addDays(end, -(MAX_WINDOW_DAYS - 1)) : start, to: end, note: tooLong ? `${dates.both} Only the most recent two years are shown.` : dates.both };
  }
  if (start) return { from: start, to: addDays(start, 179), note: dates.startOnly };
  if (end) return { from: addDays(end, -179), to: end, note: dates.endOnly };
  return { note: dates.none };
}

/**
 * Everything the Longer view needs. With a dated journey, simulated readings are generated for every day of it (including
 * days that have not happened yet), so every month from start to end has an analysis. Without dates, or when the scenario
 * has no stored readings (stale, offline, disconnected), the existing readings are summarised instead.
 */
export function buildMonthlyHistory(profile: AstronautProfile | null | undefined, history: Observation[], seed: number, profileId: string): { summaries: MonthlyHistorySummary[]; note?: string } {
  const window = monthlyHistoryWindow(profile);
  if (window.from && window.to && history.length) {
    const observations = generateWindowObservations(seed, personIndexFor(profileId), window.from, window.to, profileId);
    return { summaries: summarizeMonthlyHistory(observations), note: `${window.note} Readings are simulated for every month in this window, including months that have not happened yet.` };
  }
  return { summaries: summarizeMonthlyHistory(history, window), note: window.note };
}
