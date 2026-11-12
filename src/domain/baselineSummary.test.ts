import { describe, expect, it } from "vitest";
import { MIN_BASELINE_CHECKINS, summarizeBaseline } from "./baselineSummary";
import type { BaselineCheckIn } from "../types/horizon";

const c = (date: string, hr?: number, sleep?: number): BaselineCheckIn => ({ checkInDate: date, restingHeartRate: hr, sleepHours: sleep, exerciseCompleted: false, note: "" });

describe("summarizeBaseline", () => {
  it("is not ready until there are enough check-ins", () => {
    const s = summarizeBaseline([c("2026-11-01", 62, 7), c("2026-11-02", 64, 6.5)]);
    expect(s).toMatchObject({ checkIns: 2, needed: MIN_BASELINE_CHECKINS, ready: false });
  });

  it("summarizes the person's own range once ready", () => {
    const s = summarizeBaseline([c("2026-11-01", 60, 7), c("2026-11-02", 64, 6.5), c("2026-11-03", 62, 7.5)]);
    expect(s.ready).toBe(true);
    expect(s.heartRate).toEqual({ mean: 62, min: 60, max: 64, count: 3 });
    expect(s.sleep).toEqual({ mean: 7, min: 6.5, max: 7.5, count: 3 });
    expect(s.latestDate).toBe("2026-11-03");
  });

  it("counts one check-in per date (the latest wins) and skips missing or invalid values", () => {
    const s = summarizeBaseline([c("2026-11-01", 60), c("2026-11-01", 70), c("2026-11-02", undefined, 7), c("2026-11-03", Number.NaN, 8)]);
    expect(s.checkIns).toBe(3);
    expect(s.heartRate).toEqual({ mean: 70, min: 70, max: 70, count: 1 });
    expect(s.sleep).toEqual({ mean: 7.5, min: 7, max: 8, count: 2 });
  });

  it("handles no data", () => {
    expect(summarizeBaseline([])).toEqual({ checkIns: 0, needed: MIN_BASELINE_CHECKINS, ready: false, heartRate: undefined, sleep: undefined, latestDate: undefined });
  });
});
