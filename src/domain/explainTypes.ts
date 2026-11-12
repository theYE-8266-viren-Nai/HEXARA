import type { IngestQuality, DataSource } from "./ingest";
import type { AssessmentView } from "../lib/useAssessment";
import { DRIVER_LABELS, type ExplainRequest } from "../../supabase/functions/_shared/validate";
import type { LifeStage } from "../types/horizon";

export type { ExplainRequest, ExplainDriver } from "../../supabase/functions/_shared/validate";
export { validateExplainRequest, isSafeExplanation } from "../../supabase/functions/_shared/validate";

/**
 * Builds the ONLY thing that may leave the device when the user presses "Explain this pattern":
 * a de-identified summary. Returns null when there is nothing honest to explain (not enough history,
 * paused, or poor-quality data).
 */
export function buildExplainRequest(view: AssessmentView, context: { stage: LifeStage; ingestQuality?: IngestQuality; source: DataSource }): ExplainRequest | null {
  if (view.status !== "ok" || context.ingestQuality === "poor") return null;
  const { assessment } = view;
  if (assessment.level === "insufficient_baseline") return null;
  const drivers = assessment.drivers
    .filter((driver) => (DRIVER_LABELS as readonly string[]).includes(driver.label))
    .map((driver) => ({ metricLabel: driver.label as ExplainRequest["drivers"][number]["metricLabel"], direction: driver.direction, changePct: Math.round(driver.changePct * 10) / 10 }));
  return {
    stage: context.stage,
    level: assessment.level,
    patternScore: Math.round(assessment.patternScore),
    drivers,
    dataQuality: context.ingestQuality === "limited" ? "limited" : "good",
    source: context.source,
    audience: "traveler",
  };
}
