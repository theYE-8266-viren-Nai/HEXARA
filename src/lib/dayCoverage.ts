import type { Reading, SanitizeResult } from "../domain/ingest";

/**
 * A "completed day" must actually be covered.
 *
 * A source can start posting just before midnight. Its few minutes of data would otherwise
 * count as a finished day, and a day-mean of five minutes carries the time-of-day swing of
 * heart rate and temperature, which looks like a change from a daily baseline. So an earlier
 * day only counts when a metric has readings in at least `MIN_COVERED_HOURS` distinct UTC hours.
 *
 * The latest day is always kept, because it is the marker that earlier days are over; it is
 * never analyzed itself (see analyzeLiveReadings).
 */
export const MIN_COVERED_HOURS = 18;

const dayOf = (reading: Reading) => reading.observedAt.slice(0, 10);
const hourOf = (reading: Reading) => reading.observedAt.slice(11, 13);
/** Same trust rules as the daily aggregation: no artefacts, and no exercise heart rate or HRV. */
const counts = (reading: Reading) => !reading.flag && (reading.context === "rest" || (reading.metric !== "heart_rate" && reading.metric !== "hrv"));

/** Keeps the latest day, plus earlier days per metric only when they are well covered. */
export function wellCoveredReadings(result: SanitizeResult, minHours = MIN_COVERED_HOURS): SanitizeResult {
  if (!result.accepted.length) return result;
  const latestDay = result.accepted.reduce((latest, reading) => (reading.observedAt > latest ? reading.observedAt : latest), "").slice(0, 10);
  const hours = new Map<string, Set<string>>();
  for (const reading of result.accepted) {
    if (dayOf(reading) >= latestDay || !counts(reading)) continue;
    const key = `${reading.metric}|${dayOf(reading)}`;
    if (!hours.has(key)) hours.set(key, new Set());
    hours.get(key)!.add(hourOf(reading));
  }
  const covered = (reading: Reading) => dayOf(reading) >= latestDay || (hours.get(`${reading.metric}|${dayOf(reading)}`)?.size ?? 0) >= minHours;
  return { ...result, accepted: result.accepted.filter(covered) };
}

/** True when at least one earlier day survived the coverage rule. */
export function hasCompletedDay(result: SanitizeResult): boolean {
  if (!result.accepted.length) return false;
  const latestDay = result.accepted.reduce((latest, reading) => (reading.observedAt > latest ? reading.observedAt : latest), "").slice(0, 10);
  return result.accepted.some((reading) => dayOf(reading) < latestDay);
}
