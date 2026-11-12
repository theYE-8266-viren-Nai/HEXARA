import { evaluateAlerts } from "../domain/alertEngine";
import { toDailyObservations, type SanitizeResult } from "../domain/ingest";
import type { Observation } from "../domain/types";
import type { Alert } from "../types/horizon";
import { toUiAlert } from "./backendDashboardRepository";

/**
 * Analyzes a live device's cleaned readings with the existing alert engine.
 *
 * Only COMPLETED days are analyzed. The stored history holds one daily value per day, so
 * comparing it with a partial day would mix time-of-day swings (heart rate and temperature
 * move through the day) into the comparison and raise false alerts. The current, still
 * unfinished day is shown on the cards but never used to raise an alert.
 *
 * Completed days are appended to the person's history so the usual 30-day baseline and rules
 * apply unchanged. Poor-quality data never produces an alert.
 */
export function analyzeLiveReadings(history: Observation[], result: SanitizeResult): Alert | null {
  if (result.quality === "poor" || !result.accepted.length) return null;
  const latestDay = result.accepted.reduce((latest, reading) => (reading.observedAt > latest ? reading.observedAt : latest), "").slice(0, 10);
  const completed = result.accepted.filter((reading) => reading.observedAt.slice(0, 10) < latestDay);
  if (!completed.length) return null;
  const personId = history.at(-1)?.person_id ?? "device-user";
  const days = toDailyObservations(completed, personId);
  const lastCompleted = days.reduce((latest, observation) => (observation.observed_on > latest ? observation.observed_on : latest), days[0]?.observed_on ?? "");
  const alert = evaluateAlerts([...history, ...days]).find((candidate) => candidate.observed_on === lastCompleted);
  return alert ? toUiAlert(alert) : null;
}
