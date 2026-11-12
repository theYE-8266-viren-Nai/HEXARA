/**
 * Pattern model: how different is today from a person's OWN usual pattern, across signals together.
 *
 * This ADDS context to the alert engine. It never sets or changes alert decisions or thresholds
 * (those stay in alertEngine.ts). It is not a diagnosis and uses neutral wording only.
 *
 * Method, all from the person's own 30 days before the most recent 5 (so a lasting shift is not absorbed):
 *  1. Each signal is standardized with a robust median and MAD, so a few odd days do not distort "usual".
 *  2. The signals' joint spread is estimated from days where all of them exist, with outliers clipped
 *     and a little shrinkage so the estimate stays stable on short history.
 *  3. Mahalanobis distance of today's vector says how unusual the COMBINATION is, so three signals moving
 *     together count for more than one signal moving alone.
 *  4. Each signal's share of that distance gives the "drivers".
 *  5. Several recently elevated days lift a "usual" result to "different" (sustained shift).
 *
 * Exercise heart-rate readings are ignored, as in the alert engine. Pure and deterministic.
 */
import { label } from "./alertEngine";
import type { MetricName, Observation } from "./types";

export type PatternLevel = "usual" | "different" | "notably_different" | "insufficient_baseline";

export interface PatternDriver {
  metric: MetricName;
  label: string;
  direction: "higher" | "lower";
  /** Change from the person's usual (median), in percent. */
  changePct: number;
  /** Share (0-1) of the combined distance this signal explains. */
  contribution: number;
  /** Robust z-score of today's value. */
  z: number;
  caveat?: string;
}

export interface AnomalyAssessment {
  asOf: string;
  level: PatternLevel;
  /** 0 = typical day, 100 = at or beyond the "notably different" line. Always 0 when there is not enough history. */
  patternScore: number;
  drivers: PatternDriver[];
  /** Prior days used for the baseline. */
  baselineDays: number;
  metricsUsed: MetricName[];
  /** Of the last 5 days up to asOf, how many were already elevated. */
  elevatedDays: number;
}

export const MIN_BASELINE_DAYS = 14;
const BASELINE_DAYS = 30;
const RIDGE = 0.2;
const CLIP = 3;
const SUSTAIN_WINDOW = 5;
const SUSTAIN_COUNT = 3;
const HRV_CAVEAT = "HRV is a rough, short-term estimate.";

/** Chi-square 95th and 99.9th percentiles for 2-6 signals. */
const Q95: Record<number, number> = { 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.07, 6: 12.592 };
const Q999: Record<number, number> = { 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515, 6: 22.458 };

const ALL_METRICS: MetricName[] = ["heart_rate", "hrv", "sleep_hours", "skin_temperature", "spo2", "radiation_dose"];

export function assessLatest(observations: Observation[]): AnomalyAssessment {
  const asOf = observations.reduce((latest, observation) => (observation.observed_on > latest ? observation.observed_on : latest), "");
  return assessAt(observations, asOf);
}

export function assessAt(observations: Observation[], asOf: string): AnomalyAssessment {
  const byMetric = new Map<MetricName, Map<string, number>>();
  const ordered = [...observations].sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.id.localeCompare(b.id));
  for (const observation of ordered) {
    if (observation.observed_on > asOf) continue;
    if (observation.metric === "heart_rate" && observation.context !== "rest") continue;
    if (!Number.isFinite(observation.value)) continue;
    if (!byMetric.has(observation.metric)) byMetric.set(observation.metric, new Map());
    byMetric.get(observation.metric)!.set(observation.observed_on, observation.value);
  }

  // The baseline is the 30 days BEFORE the recent window, so a shift that has lasted several days is judged
  // against the person's earlier pattern instead of quietly becoming part of "usual".
  const priorDates = (metric: MetricName) => [...(byMetric.get(metric)?.keys() ?? [])].filter((date) => date < asOf).sort().slice(0, -(SUSTAIN_WINDOW - 1) || undefined).slice(-BASELINE_DAYS);
  const usable = ALL_METRICS.filter((metric) => byMetric.get(metric)?.has(asOf) && priorDates(metric).length >= MIN_BASELINE_DAYS);
  const baselineDays = Math.max(0, ...ALL_METRICS.map((metric) => priorDates(metric).length));
  const insufficient = (): AnomalyAssessment => ({ asOf, level: "insufficient_baseline", patternScore: 0, drivers: [], baselineDays, metricsUsed: usable, elevatedDays: 0 });
  if (usable.length < 2) return insufficient();

  // Days with every used signal present, within the baseline window.
  const sharedDates = priorDates(usable[0]).filter((date) => usable.every((metric) => byMetric.get(metric)!.has(date)));
  if (sharedDates.length < MIN_BASELINE_DAYS) return insufficient();

  const k = usable.length;
  const stats = usable.map((metric) => {
    const values = sharedDates.map((date) => byMetric.get(metric)!.get(date)!);
    const center = median(values);
    const mad = median(values.map((value) => Math.abs(value - center)));
    const scale = Math.max(1.4826 * mad, Math.abs(center) * 0.02, 1e-6);
    return { metric, center, scale };
  });
  const z = (metricIndex: number, value: number) => (value - stats[metricIndex].center) / stats[metricIndex].scale;
  const vector = (date: string) => usable.map((metric, i) => z(i, byMetric.get(metric)!.get(date)!));

  // Joint spread from clipped baseline vectors, shrunk toward independence.
  const rows = sharedDates.map((date) => vector(date).map((value) => clamp(value, -CLIP, CLIP)));
  const means = usable.map((_, i) => rows.reduce((sum, row) => sum + row[i], 0) / rows.length);
  const covariance = usable.map((_, i) => usable.map((_, j) => rows.reduce((sum, row) => sum + (row[i] - means[i]) * (row[j] - means[j]), 0) / Math.max(rows.length - 1, 1)));
  const shrunk = covariance.map((row, i) => row.map((value, j) => (1 - RIDGE) * value + (i === j ? RIDGE : 0)));
  const precision = invert(shrunk) ?? identity(k);

  const distance = (vec: number[]) => { const projected = multiply(precision, vec); return { d2: vec.reduce((sum, value, i) => sum + value * projected[i], 0), projected }; };
  const todayVector = vector(asOf);
  const { d2, projected } = distance(todayVector);

  const recent = [...new Set(usable.flatMap((metric) => [...byMetric.get(metric)!.keys()]))].filter((date) => date <= asOf && usable.every((metric) => byMetric.get(metric)!.has(date))).sort().slice(-SUSTAIN_WINDOW);
  const elevatedDays = recent.filter((date) => distance(vector(date)).d2 >= Q95[k]).length;

  const level: PatternLevel = d2 >= Q999[k] ? "notably_different" : d2 >= Q95[k] ? "different" : elevatedDays >= SUSTAIN_COUNT ? "different" : "usual";
  const patternScore = clamp(Math.round((100 * (d2 - k)) / (Q999[k] - k)), 0, 100);

  const shares = todayVector.map((value, i) => value * projected[i]);
  const positive = shares.reduce((sum, share) => sum + Math.max(share, 0), 0);
  const drivers: PatternDriver[] = usable
    .map((metric, i): PatternDriver => ({
      metric, label: label(metric), direction: todayVector[i] >= 0 ? "higher" : "lower",
      changePct: round1(stats[i].center === 0 ? 0 : ((byMetric.get(metric)!.get(asOf)! - stats[i].center) / Math.abs(stats[i].center)) * 100),
      contribution: positive > 0 ? round3(Math.max(shares[i], 0) / positive) : 0, z: round1(todayVector[i]),
      ...(metric === "hrv" ? { caveat: HRV_CAVEAT } : {}),
    }))
    .filter((driver) => driver.contribution > 0 && Math.abs(driver.z) >= 1)
    .sort((a, b) => b.contribution - a.contribution || a.metric.localeCompare(b.metric))
    .slice(0, 3);

  return { asOf, level, patternScore, drivers: level === "usual" && elevatedDays < SUSTAIN_COUNT ? [] : drivers, baselineDays: sharedDates.length, metricsUsed: usable, elevatedDays };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const identity = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const multiply = (matrix: number[][], vec: number[]) => matrix.map((row) => row.reduce((sum, value, j) => sum + value * vec[j], 0));

/** Gauss-Jordan inverse with partial pivoting; null when the matrix is singular. */
function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...identity(n)[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor !== 0) for (let j = 0; j < 2 * n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}
