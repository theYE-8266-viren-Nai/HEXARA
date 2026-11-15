import { metricUnits } from '../domain/types';
import type { DemoDataset, DemoEvent, MetricName, Observation, Traveler } from '../domain/types';

export const DEFAULT_SEED = 42;
export const START_DATE = '2026-01-01';
export const DAYS = 180;
export function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000) throw new Error('Seed must be an integer from 0 to 1000000.');
}
export function dateAt(day: number): string {
  return new Date(Date.parse(START_DATE + 'T00:00:00Z') + day * 86400000).toISOString().slice(0, 10);
}

/** Fixed calendar and integer noise make the fallback reproducible across devices. */
export function generateSyntheticData(seed = DEFAULT_SEED): DemoDataset {
  validateSeed(seed);
  const people: Traveler[] = ['Aster', 'Nova', 'Orion', 'Vega'].map((name, p) => ({
    id: `traveler-0${p + 1}`, name: `Synthetic ${name}`, life_stage: 'active', mission_day: DAYS, is_synthetic: true,
  }));
  const metrics = Object.keys(metricUnits) as MetricName[];
  const bases = [64, 48, 7.5, 33.2, 98, 0.45];
  const scales = [3, 5, 0.4, 0.15, 0.5, 0.04];
  const offsets = [2, 1, 0.1, 0.1, -0.1, 0.01];
  const observations: Observation[] = [];
  const events: DemoEvent[] = [];
  for (const [p, person] of people.entries()) {
    for (const [kind, start, length, description] of [
      ['radiation_spike', 100, 3, 'Synthetic radiation spike for demonstration.'],
      ['illness_like', 120, 5, 'Synthetic recovery-concern episode; not a diagnosis.'],
      ['sleep_disruption', 150, 5, 'Synthetic sleep disruption for demonstration.'],
    ] as const) events.push({ id: `${person.id}-${kind}-${seed}`, person_id: person.id, kind,
      starts_on: dateAt(start), ends_on: dateAt(start + length - 1), description, seed, is_synthetic: true });
    for (let day = 0; day < DAYS; day++) {
      for (const [m, metric] of metrics.entries()) {
        const noise = (((day * 37 + p * 17 + m * 13 + seed * 7) % 101) - 50) / 50;
        let value = bases[m] + p * offsets[m] + noise * scales[m];
        if (day >= 100 && day < 103 && metric === 'radiation_dose') value += 1.2;
        if (day >= 120 && day < 125) value += [14, -15, -1.2, 0.8, -1.5, 0][m];
        if (day >= 150 && day < 155 && metric === 'sleep_hours') value -= 2;
        observations.push({ id: `${person.id}-${day}-${metric}-${seed}`, person_id: person.id,
          observed_on: dateAt(day), metric, unit: metricUnits[metric], value: Math.round(value * 10000) / 10000,
          context: 'rest', seed, is_synthetic: true } as Observation);
      }
    }
  }
  return { people, observations, events };
}

/** Longest window the monthly view generates readings for (about two years), so the replay of alert rules stays quick. */
export const MAX_WINDOW_DAYS = 731;

const dayMs = 86_400_000;
const parseDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Which of the four demo travelers a profile id maps to (0 to 3), so each person gets their own steady offsets. */
export function personIndexFor(profileId: string | undefined): number {
  const match = /(\d+)$/.exec(profileId ?? '');
  return match ? Math.min(3, Math.max(0, Number(match[1]) - 1)) : 0;
}

/**
 * Simulated daily readings for any date window (first and last day included), using the same rhythm, noise and
 * demo episodes as `generateSyntheticData`. The three episodes (radiation spike, illness-like, sleep disruption)
 * sit at the same share of the window as in the 180-day set, so a 180-day window reproduces it exactly.
 * Every reading is simulated, including days that have not happened yet. A window longer than MAX_WINDOW_DAYS
 * keeps its most recent days.
 */
export function generateWindowObservations(seed: number, personIndex: number, from: string, to: string, personId = `traveler-0${personIndex + 1}`): Observation[] {
  validateSeed(seed);
  const start = parseDay(from), end = parseDay(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const length = Math.min(MAX_WINDOW_DAYS, Math.round((end - start) / dayMs) + 1);
  const first = end - (length - 1) * dayMs;
  const metrics = Object.keys(metricUnits) as MetricName[];
  const bases = [64, 48, 7.5, 33.2, 98, 0.45];
  const scales = [3, 5, 0.4, 0.15, 0.5, 0.04];
  const offsets = [2, 1, 0.1, 0.1, -0.1, 0.01];
  // Episodes need room to read as episodes, so very short windows have none.
  const episodes = length >= 30 ? { radiation: Math.round(length * 100 / 180), illness: Math.round(length * 120 / 180), sleep: Math.round(length * 150 / 180) } : null;
  const p = personIndex;
  const observations: Observation[] = [];
  for (let day = 0; day < length; day++) {
    const observed_on = new Date(first + day * dayMs).toISOString().slice(0, 10);
    for (const [m, metric] of metrics.entries()) {
      const noise = (((day * 37 + p * 17 + m * 13 + seed * 7) % 101) - 50) / 50;
      let value = bases[m] + p * offsets[m] + noise * scales[m];
      if (episodes) {
        if (day >= episodes.radiation && day < episodes.radiation + 3 && metric === 'radiation_dose') value += 1.2;
        if (day >= episodes.illness && day < episodes.illness + 5) value += [14, -15, -1.2, 0.8, -1.5, 0][m];
        if (day >= episodes.sleep && day < episodes.sleep + 5 && metric === 'sleep_hours') value -= 2;
      }
      observations.push({ id: `${personId}-${observed_on}-${metric}-${seed}`, person_id: personId,
        observed_on, metric, unit: metricUnits[metric], value: Math.round(value * 10000) / 10000,
        context: 'rest', seed, is_synthetic: true } as Observation);
    }
  }
  return observations;
}
