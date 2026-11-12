import { useMemo } from "react";
import { assessAt, assessLatest, type AnomalyAssessment } from "../domain/anomalyModel";
import { dateAt, generateSyntheticData } from "../data/synthetic";
import { toDailyObservations, type IngestQuality } from "../domain/ingest";
import type { Observation } from "../domain/types";
import type { DataQualityState, SimulationScenario } from "../types/horizon";
import type { SourceReadings } from "./useWebhookSource";

/** Day of the synthetic illness-like episode (zero-based) that the "Recovery concern" demo points at. */
const RECOVERY_DAY = 124;

export type AssessmentBasis = "stored history" | "scenario" | "webhook";
export type AssessmentView =
  | { status: "ok"; assessment: AnomalyAssessment; basis: AssessmentBasis }
  | { status: "unavailable"; reason: "poor_quality" | "data_unavailable" | "no_history" | "needs_full_day" };

export interface AssessmentInput {
  history?: Observation[];
  scenario: SimulationScenario;
  seed: number;
  personId: string;
  dataQuality: DataQualityState;
  /** Quality of the readings currently on screen (any source). */
  ingestQuality?: IngestQuality;
  /** Cleaned readings from a source that brings its own days, and whether it is the one in use. */
  webhook?: SourceReadings | null;
  webhookActive?: boolean;
}

/**
 * Chooses what to score and scores it. Like alerts, it only uses COMPLETED days, never today's partial
 * day, and poor-quality or missing data never produces a score. It never changes alert decisions.
 */
export function buildAssessment(input: AssessmentInput): AssessmentView {
  if (input.dataQuality === "disconnected" || input.dataQuality === "offline") return { status: "unavailable", reason: "data_unavailable" };
  if (input.ingestQuality === "poor") return { status: "unavailable", reason: "poor_quality" };

  if (input.webhookActive && input.webhook) {
    const { accepted } = input.webhook.readings;
    const latestDay = accepted.reduce((latest, reading) => (reading.observedAt > latest ? reading.observedAt : latest), "").slice(0, 10);
    const completed = accepted.filter((reading) => reading.observedAt.slice(0, 10) < latestDay);
    if (!completed.length) return { status: "unavailable", reason: "needs_full_day" };
    const days = toDailyObservations(completed, "webhook-user");
    const lastDay = days.reduce((latest, observation) => (observation.observed_on > latest ? observation.observed_on : latest), "");
    return { status: "ok", basis: "webhook", assessment: assessAt([...(input.history ?? []), ...days], lastDay) };
  }

  if (input.scenario === "recovery_concern") {
    // The demo scenario is generic (its cards are the same for every profile), so a profile without its own
    // stored series, such as a demo-only Future/Retired/Maya profile, uses the first synthetic traveler's series.
    const all = generateSyntheticData(input.seed);
    const personId = all.people.some((person) => person.id === input.personId) ? input.personId : all.people[0].id;
    return { status: "ok", basis: "scenario", assessment: assessAt(all.observations.filter((observation) => observation.person_id === personId), dateAt(RECOVERY_DAY)) };
  }

  if (!input.history?.length) return { status: "unavailable", reason: "no_history" };
  return { status: "ok", basis: "stored history", assessment: assessLatest(input.history) };
}

export function useAssessment(input: AssessmentInput): AssessmentView {
  const { history, scenario, seed, personId, dataQuality, ingestQuality, webhook, webhookActive } = input;
  return useMemo(() => buildAssessment({ history, scenario, seed, personId, dataQuality, ingestQuality, webhook, webhookActive }), [history, scenario, seed, personId, dataQuality, ingestQuality, webhook, webhookActive]);
}
