import { describe, expect, it } from "vitest";
import { finalPhaseFor, readingAt, smoothNoise, STALE_SYNC_AGE_MS } from "./deviceSimulator";
import type { MetricName } from "../types/horizon";

const at = (h: number, m = 0, day = 12) => new Date(2026, 10, day, h, m, 0).getTime();
const anchors: Record<MetricName, number> = { resting_hr: 63, hrv: 44, spo2: 97.4, core_temperature: 36.8, radiation_dose: 0.5, sleep_hours: 6.6 };
const metrics = Object.keys(anchors) as MetricName[];

describe("device simulator", () => {
  it("is a pure function of seed, person, metric, and time", () => {
    const series = (seed: number, person: string) => Array.from({ length: 24 }, (_, i) => readingAt(seed, person, "resting_hr", at(8) + i * 17 * 60_000, 63).restingValue);
    expect(series(42, "future:leon")).toEqual(series(42, "future:leon"));
    expect(series(7, "future:leon")).not.toEqual(series(42, "future:leon"));
    expect(series(42, "active:maya")).not.toEqual(series(42, "future:leon"));
  });

  it("changes over time instead of staying static", () => {
    for (const metric of metrics.filter((m) => m !== "sleep_hours")) {
      const values = new Set(Array.from({ length: 48 }, (_, i) => readingAt(42, "active:maya", metric, at(0) + i * 30 * 60_000, anchors[metric]).restingValue));
      expect(values.size, metric).toBeGreaterThan(5);
    }
  });

  it("stays inside plausible bounds and near the person's own usual level for a full week", () => {
    for (const metric of metrics) {
      for (let i = 0; i < 7 * 24 * 12; i++) {
        const { restingValue } = readingAt(42, "active:maya", metric, at(0, 0, 5) + i * 5 * 60_000, anchors[metric]);
        const rel = Math.abs(restingValue - anchors[metric]) / anchors[metric];
        expect(rel, `${metric} at step ${i}`).toBeLessThan(metric === "hrv" ? 0.5 : 0.25);
      }
    }
  });

  it("moves smoothly between 5 second ticks (no jumps like 58 → 90)", () => {
    const limit: Partial<Record<MetricName, number>> = { resting_hr: 3, hrv: 3, spo2: 0.6, core_temperature: 0.1, radiation_dose: 0.02 };
    for (const [metric, max] of Object.entries(limit) as Array<[MetricName, number]>) {
      let previous = readingAt(42, "active:maya", metric, at(0), anchors[metric]).restingValue;
      for (let i = 1; i < 24 * 12 * 12; i++) {
        const next = readingAt(42, "active:maya", metric, at(0) + i * 5_000, anchors[metric]).restingValue;
        expect(Math.abs(next - previous), `${metric} step ${i}`).toBeLessThanOrEqual(max);
        previous = next;
      }
    }
  });

  it("visibly wobbles within seconds, like a real sensor (not a flat line for half a minute)", () => {
    for (const metric of ["resting_hr", "hrv", "spo2"] as MetricName[]) {
      let changed = 0;
      for (let i = 0; i < 30; i++) {
        const t = at(10) + i * 4_000 * 5;
        if (readingAt(42, "active:maya", metric, t, anchors[metric]).restingValue !== readingAt(42, "active:maya", metric, t + 4_000, anchors[metric]).restingValue) changed++;
      }
      expect(changed, metric).toBeGreaterThan(6);
    }
  });

  it("follows a night/day rhythm: lower heart rate and higher HRV overnight", () => {
    const mean = (metric: MetricName, from: number, to: number) => {
      const xs: number[] = [];
      for (let day = 1; day <= 5; day++) for (let h = from; h < to; h += 0.25) xs.push(readingAt(42, "active:maya", metric, at(Math.floor(h), (h % 1) * 60, day), anchors[metric]).restingValue);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean("resting_hr", 2, 4)).toBeLessThan(mean("resting_hr", 14, 16));
    expect(mean("hrv", 2, 4)).toBeGreaterThan(mean("hrv", 14, 16));
  });

  it("flags short activity bumps as exercise while the resting value stays near usual", () => {
    let found: ReturnType<typeof readingAt> | undefined;
    for (let i = 0; i < 7 * 24 * 60 && !found; i++) {
      const reading = readingAt(42, "active:maya", "resting_hr", at(0, 0, 1) + i * 60_000, 63);
      if (reading.context === "exercise") found = reading;
    }
    expect(found).toBeDefined();
    expect(found!.value).toBeGreaterThan(found!.restingValue + 8);
    expect(Math.abs(found!.restingValue - 63)).toBeLessThan(10);
  });

  it("keeps last night's sleep fixed within a day and varied between days", () => {
    expect(readingAt(42, "a", "sleep_hours", at(9), 6.6).value).toBe(readingAt(42, "a", "sleep_hours", at(21), 6.6).value);
    const days = new Set(Array.from({ length: 14 }, (_, d) => readingAt(42, "a", "sleep_hours", at(9, 0, 1 + d), 6.6).value));
    expect(days.size).toBeGreaterThan(3);
  });

  it("produces occasional low-quality samples but never none or most", () => {
    const qualities = Array.from({ length: 4000 }, (_, i) => readingAt(42, "a", "spo2", at(0) + i * 30_000, 97.4).quality);
    const low = qualities.filter((q) => q === "low").length / qualities.length;
    expect(low).toBeGreaterThan(0.005);
    expect(low).toBeLessThan(0.15);
  });

  it("smooth noise stays within [-1, 1]", () => {
    for (let i = 0; i < 2000; i++) expect(Math.abs(smoothNoise(9, i * 7_321, 60_000))).toBeLessThanOrEqual(1);
  });

  it("maps demo scenarios to connection outcomes", () => {
    expect(finalPhaseFor("usual")).toBe("streaming");
    expect(finalPhaseFor("recovery_concern")).toBe("streaming");
    expect(finalPhaseFor("stale")).toBe("streaming");
    expect(finalPhaseFor("sensor_disconnected")).toBe("signal_lost");
    expect(finalPhaseFor("offline")).toBe("offline");
    expect(STALE_SYNC_AGE_MS).toBeGreaterThan(30 * 60_000);
  });
});
