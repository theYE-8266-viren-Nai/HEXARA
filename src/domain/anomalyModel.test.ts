import { describe, expect, it } from "vitest";
import { assessAt, assessLatest } from "./anomalyModel";
import { generateSyntheticData, dateAt } from "../data/synthetic";
import { evaluateAlerts } from "./alertEngine";
import { metricUnits } from "./types";
import { mulberry32 } from "../lib/prng";
import type { MetricName, Observation } from "./types";

const METRICS = Object.keys(metricUnits) as MetricName[];
const BASE: Record<MetricName, number> = { heart_rate: 62, hrv: 45, sleep_hours: 7, skin_temperature: 33.2, spo2: 97.5, radiation_dose: 0.5 };
const SIGMA: Record<MetricName, number> = { heart_rate: 2, hrv: 3, sleep_hours: 0.3, skin_temperature: 0.15, spo2: 0.4, radiation_dose: 0.03 };
// Independent, seeded, bell-curve noise per signal and day (standard deviation = 1 sigma), so tests are deterministic.
const noiseFor = (day: number, m: number) => { const rand = mulberry32(day * 101 + m * 7919 + 13); return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand()); };

function observation(day: number, metric: MetricName, value: number, context: "rest" | "exercise" = "rest"): Observation {
  return { id: `t-${day}-${metric}-${context}`, person_id: "p1", observed_on: dateAt(day), metric, unit: metricUnits[metric], value, context, seed: 1, is_synthetic: true } as Observation;
}

/** `days` days of steady data, then optional per-metric shifts (in sigma) on the final `shiftDays`. */
function series(days: number, shifts: Partial<Record<MetricName, number>> = {}, shiftDays = 1): Observation[] {
  const out: Observation[] = [];
  for (let day = 0; day < days; day++) {
    METRICS.forEach((metric, m) => {
      const noise = noiseFor(day, m) * SIGMA[metric];
      const shift = day >= days - shiftDays ? (shifts[metric] ?? 0) * SIGMA[metric] : 0;
      out.push(observation(day, metric, BASE[metric] + noise + shift));
    });
  }
  return out;
}

describe("anomaly model", () => {
  it("calls ordinary days usual, with no drivers, and never notably different", () => {
    const steady = series(70);
    const results = Array.from({ length: 40 }, (_, i) => assessAt(steady, dateAt(25 + i)));
    const usual = results.filter((result) => result.level === "usual");
    expect(usual.length / results.length).toBeGreaterThanOrEqual(0.85);
    expect(results.some((result) => result.level === "notably_different")).toBe(false);
    expect(usual.every((result) => result.drivers.length === 0 && result.patternScore < 50)).toBe(true);
    const last = assessLatest(steady);
    expect(last.baselineDays).toBeGreaterThanOrEqual(14);
    expect(last.metricsUsed).toHaveLength(6);
  });

  it("flags three signals shifting together and names them with the right direction", () => {
    const result = assessLatest(series(40, { heart_rate: 4, hrv: -4, sleep_hours: -4 }));
    expect(result.level).toBe("notably_different");
    expect(result.patternScore).toBe(100);
    const top3 = result.drivers.map((driver) => driver.metric);
    expect(new Set(top3)).toEqual(new Set(["heart_rate", "hrv", "sleep_hours"]));
    const direction = Object.fromEntries(result.drivers.map((driver) => [driver.metric, driver.direction]));
    expect(direction).toMatchObject({ heart_rate: "higher", hrv: "lower", sleep_hours: "lower" });
    expect(result.drivers.every((driver) => driver.changePct !== 0 && driver.label.length > 0)).toBe(true);
  });

  it("treats one signal moving alone as less unusual than the same size shift across three", () => {
    const alone = assessLatest(series(40, { heart_rate: 3 }));
    const together = assessLatest(series(40, { heart_rate: 3, hrv: -3, sleep_hours: -3 }));
    expect(alone.patternScore).toBeLessThan(together.patternScore);
    expect(alone.level).toBe("usual");
    expect(together.level).not.toBe("usual");
  });

  it("uses a middle level for a moderate combined shift", () => {
    const result = assessLatest(series(40, { heart_rate: 2.4, hrv: -2.4, sleep_hours: -2.4 }));
    expect(["different", "notably_different"]).toContain(result.level);
    expect(result.patternScore).toBeGreaterThan(30);
  });

  it("raises a steady level to different when several recent days are elevated", () => {
    const sustained = assessLatest(series(40, { heart_rate: 2.2, hrv: -2.2, sleep_hours: -2.2, spo2: -2.2 }, 4));
    expect(sustained.level).not.toBe("usual");
    expect(sustained.elevatedDays).toBeGreaterThanOrEqual(3);
  });

  it("ignores exercise heart-rate readings", () => {
    const base = series(40);
    const withExercise = [...base, observation(39, "heart_rate", 150, "exercise")];
    expect(assessLatest(withExercise)).toEqual(assessLatest(base));
  });

  it("reports insufficient baseline with fewer than 14 prior days or fewer than 2 signals", () => {
    expect(assessLatest(series(10)).level).toBe("insufficient_baseline");
    const heartRateOnly = series(40).filter((o) => o.metric === "heart_rate");
    const result = assessLatest(heartRateOnly);
    expect(result.level).toBe("insufficient_baseline");
    expect(result.patternScore).toBe(0);
    expect(result.drivers).toEqual([]);
  });

  it("scores only the signals present and says which", () => {
    const partial = series(40, { heart_rate: 4, hrv: -4 }).filter((o) => o.metric === "heart_rate" || o.metric === "hrv" || o.metric === "spo2");
    const result = assessLatest(partial);
    expect(result.metricsUsed.sort()).toEqual(["heart_rate", "hrv", "spo2"]);
    expect(result.level).not.toBe("usual");
  });

  it("is deterministic and never returns NaN or Infinity, even for constant series", () => {
    const flat: Observation[] = [];
    for (let day = 0; day < 40; day++) for (const metric of METRICS) flat.push(observation(day, metric, BASE[metric]));
    flat.push(...METRICS.map((metric) => observation(40, metric, BASE[metric] * 1.2)));
    const a = assessLatest(flat);
    expect(assessLatest(flat)).toEqual(a);
    expect(Number.isFinite(a.patternScore)).toBe(true);
    for (const driver of a.drivers) { expect(Number.isFinite(driver.changePct)).toBe(true); expect(Number.isFinite(driver.contribution)).toBe(true); }
    expect(a.level).toBe("notably_different");
    const steadyConstant = assessLatest(flat.filter((o) => o.observed_on !== dateAt(40)));
    expect(steadyConstant.level).toBe("usual");
    expect(steadyConstant.patternScore).toBe(0);
  });

  it("gives the HRV driver a rough-estimate caveat", () => {
    const result = assessLatest(series(40, { hrv: -6, heart_rate: 6, sleep_hours: -6 }));
    const hrv = result.drivers.find((driver) => driver.metric === "hrv");
    expect(hrv?.caveat).toMatch(/rough/i);
    expect(result.drivers.filter((driver) => driver.metric !== "hrv").every((driver) => driver.caveat === undefined)).toBe(true);
  });

  it("assesses an earlier day using only the data before it", () => {
    const all = series(50, { heart_rate: 4, hrv: -4, sleep_hours: -4 }, 1);
    const earlier = assessAt(all, dateAt(30));
    expect(earlier.level).toBe("usual");
    expect(assessAt(all, dateAt(49)).level).toBe("notably_different");
  });
});

describe("anomaly model on the seed-42 synthetic dataset", () => {
  const data = generateSyntheticData(42);
  const person = data.observations.filter((o) => o.person_id === "traveler-01");

  it("mostly calls ordinary days usual", () => {
    const levels = Array.from({ length: 60 }, (_, i) => assessAt(person, dateAt(35 + i)).level);
    const usual = levels.filter((level) => level === "usual").length;
    expect(usual / levels.length).toBeGreaterThanOrEqual(0.85);
    expect(levels).not.toContain("insufficient_baseline");
  });

  it("separates the radiation spike (day 101) and names radiation", () => {
    const result = assessAt(person, dateAt(101));
    expect(result.level).not.toBe("usual");
    expect(result.drivers[0].metric).toBe("radiation_dose");
    expect(result.drivers[0].direction).toBe("higher");
  });

  it("separates the illness-like episode (day 124) with heart rate, HRV and sleep among the drivers", () => {
    const result = assessAt(person, dateAt(124));
    expect(result.level).toBe("notably_different");
    const names = result.drivers.map((driver) => driver.metric);
    expect(names).toEqual(expect.arrayContaining(["heart_rate", "hrv"]));
    expect(result.drivers.find((driver) => driver.metric === "heart_rate")?.direction).toBe("higher");
    expect(result.drivers.find((driver) => driver.metric === "hrv")?.direction).toBe("lower");
  });

  it("separates the sleep disruption (day 152) with sleep lower", () => {
    const result = assessAt(person, dateAt(152));
    expect(result.level).not.toBe("usual");
    const sleep = result.drivers.find((driver) => driver.metric === "sleep_hours");
    expect(sleep?.direction).toBe("lower");
  });

  it("leaves the existing alert engine's decisions unchanged", () => {
    const before = JSON.stringify(evaluateAlerts(person));
    assessAt(person, dateAt(124));
    assessLatest(person);
    expect(JSON.stringify(evaluateAlerts(person))).toBe(before);
  });
});
