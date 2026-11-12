import type { BaselineCheckIn } from "../types/horizon";

/** A baseline needs a few check-ins before it says anything about "usual". */
export const MIN_BASELINE_CHECKINS = 3;

export interface RangeSummary { mean: number; min: number; max: number; count: number; }
export interface BaselineSummary {
  checkIns: number;
  needed: number;
  ready: boolean;
  heartRate?: RangeSummary;
  sleep?: RangeSummary;
  latestDate?: string;
}

const range = (values: number[], places: number): RangeSummary | undefined => {
  if (!values.length) return undefined;
  const f = 10 ** places;
  const round = (v: number) => Math.round(v * f) / f;
  return { mean: round(values.reduce((a, b) => a + b, 0) / values.length), min: round(Math.min(...values)), max: round(Math.max(...values)), count: values.length };
};

/**
 * Summarizes a person's own saved baseline check-ins. It is personal context only:
 * never a norm, a target, or a comparison with other people. One check-in per date counts once.
 */
export function summarizeBaseline(checkIns: BaselineCheckIn[]): BaselineSummary {
  const byDate = new Map<string, BaselineCheckIn>();
  for (const checkIn of checkIns) byDate.set(checkIn.checkInDate, checkIn);
  const days = [...byDate.values()].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  const finite = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value);
  return {
    checkIns: days.length,
    needed: MIN_BASELINE_CHECKINS,
    ready: days.length >= MIN_BASELINE_CHECKINS,
    heartRate: range(days.map((d) => d.restingHeartRate).filter(finite), 0),
    sleep: range(days.map((d) => d.sleepHours).filter(finite), 1),
    latestDate: days.at(-1)?.checkInDate,
  };
}
