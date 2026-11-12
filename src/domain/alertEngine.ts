import type { Alert as DomainAlert, MetricName, Observation } from "./types";

const BASELINE_DAYS = 30;
const SUSTAINED_DAYS = 5;

/**
 * Deterministic, explainable monitoring rules for synthetic observations.
 * The baseline is the 30 readings immediately before the latest reading for
 * each metric. Exercise heart-rate readings are excluded from recovery alerts.
 */
export function evaluateAlerts(observations: Observation[]): DomainAlert[] {
  const alerts: DomainAlert[] = [];
  const metrics = [...new Set(observations.map((observation) => observation.metric))];

  for (const metric of metrics) {
    const series = observations
      .filter((observation) => observation.metric === metric && (metric !== "heart_rate" || observation.context === "rest"))
      .sort((left, right) => left.observed_on.localeCompare(right.observed_on) || left.id.localeCompare(right.id));
    if (series.length <= BASELINE_DAYS) continue;

    const latest = series.at(-1)!;
    const baseline = series.slice(-BASELINE_DAYS - 1, -1).map((observation) => observation.value);
    const mean = average(baseline);
    const standardDeviation = sampleStandardDeviation(baseline);
    const latestZ = zScore(latest.value, mean, standardDeviation);
    const recent = series.slice(-SUSTAINED_DAYS);
    const sustainedCount = recent.filter((observation) => Math.abs(zScore(observation.value, mean, standardDeviation)) >= 2).length;
    const singleReading = Math.abs(latestZ) > 3;

    if (singleReading || sustainedCount >= 3) {
      const rule = singleReading ? "single-reading" : "sustained-shift";
      const explanation = singleReading
        ? `${label(metric)} was well outside your usual range on ${latest.observed_on}.`
        : `${label(metric)} was outside your usual range on ${sustainedCount} of the last ${SUSTAINED_DAYS} days.`;
      alerts.push({
        id: `alert-${latest.person_id}-${metric}-${latest.observed_on}-${rule}`,
        person_id: latest.person_id,
        metric,
        observed_on: latest.observed_on,
        rule,
        severity: "caution",
        explanation,
      });
    }
  }

  return alerts.sort((left, right) => right.observed_on.localeCompare(left.observed_on) || left.metric.localeCompare(right.metric));
}

export function rollingBaseline(observations: Observation[], metric: MetricName): number | null {
  const values = observations.filter((observation) => observation.metric === metric).slice(-BASELINE_DAYS).map((observation) => observation.value);
  return values.length ? average(values) : null;
}

function label(metric: MetricName): string {
  return metric === "heart_rate" ? "Resting heart rate" : metric === "hrv" ? "HRV" : metric === "sleep_hours" ? "Sleep" : metric === "skin_temperature" ? "Skin temperature" : metric === "spo2" ? "SpO₂" : "Radiation dose";
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function zScore(value: number, mean: number, standardDeviation: number): number {
  return standardDeviation === 0 ? (value === mean ? 0 : Number.POSITIVE_INFINITY) : (value - mean) / standardDeviation;
}
