import type { IngestQuality, DataSource } from "./ingest";
import type { AssessmentView } from "../lib/useAssessment";
import { DRIVER_LABELS, type ExplainRequest } from "../../supabase/functions/_shared/validate";
import type { LifeStage } from "../types/horizon";
import type { MonthlyHistorySummary } from "./monthlyHistory";
import type { MetricName } from "./types";

export type { ExplainRequest, ExplainDriver } from "../../supabase/functions/_shared/validate";
export { validateExplainRequest, isSafeExplanation } from "../../supabase/functions/_shared/validate";

const MONTHLY_LABELS: Record<MetricName, ExplainRequest["drivers"][number]["metricLabel"]> = {
  heart_rate: "Resting heart rate",
  hrv: "HRV",
  spo2: "SpO₂",
  sleep_hours: "Sleep",
  skin_temperature: "Skin temperature",
  radiation_dose: "Radiation dose",
};

/**
 * Builds the ONLY thing that may leave the device when the user presses "Explain this pattern":
 * a de-identified summary. Returns null when there is nothing honest to explain (not enough history,
 * paused, or poor-quality data).
 */
export function buildExplainRequest(view: AssessmentView, context: { stage: LifeStage; ingestQuality?: IngestQuality; source: DataSource; monthlyHistory?: MonthlyHistorySummary[] }): ExplainRequest | null {
  if (view.status !== "ok" || context.ingestQuality === "poor") return null;
  const { assessment } = view;
  if (assessment.level === "insufficient_baseline") return null;
  const drivers = assessment.drivers
    .filter((driver) => (DRIVER_LABELS as readonly string[]).includes(driver.label))
    .map((driver) => ({ metricLabel: driver.label as ExplainRequest["drivers"][number]["metricLabel"], direction: driver.direction, changePct: Math.round(driver.changePct * 10) / 10 }));
  const monthlyHistory = context.monthlyHistory?.slice(-6).map((month) => ({
    month: month.month,
    personalSummary: month.personalSummary,
    notableDays: month.notableDays,
    quality: month.quality,
    metrics: month.metrics.map((metric) => ({ metricLabel: MONTHLY_LABELS[metric.metric], average: metric.average, minimum: metric.minimum, maximum: metric.maximum, observedDays: metric.observedDays, direction: metric.direction })),
  }));
  return {
    stage: context.stage,
    level: assessment.level,
    patternScore: Math.round(assessment.patternScore),
    drivers,
    dataQuality: context.ingestQuality === "limited" ? "limited" : "good",
    source: context.source,
    audience: "traveler",
    ...(monthlyHistory?.length ? { monthlyHistory } : {}),
  };
}
