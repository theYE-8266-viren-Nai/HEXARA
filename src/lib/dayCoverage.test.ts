import { describe, expect, it } from "vitest";
import { MIN_COVERED_HOURS, hasCompletedDay, wellCoveredReadings } from "./dayCoverage";
import { analyzeLiveReadings } from "./liveAnalysis";
import { sanitizeReadings, type RawRow } from "../domain/ingest";
import { metricUnits, type Observation } from "../domain/types";

const NOW = new Date("2026-11-12T12:00:00Z");
const clean = (rows: RawRow[]) => sanitizeReadings(rows, { source: "api", now: NOW });
let n = 0;
const row = (iso: string, metric: string, value: number, over: Record<string, unknown> = {}): RawRow => ({ row: ++n, fields: { timestamp: iso, metric, value, unit: metric === "heart_rate" ? "bpm" : "%", deviceId: "svc", ...over } });
/** One reading in each of the listed UTC hours of a day. */
const hours = (day: string, hourList: number[], metric = "heart_rate", base = 62) => hourList.map((h) => row(`${day}T${String(h).padStart(2, "0")}:30:00Z`, metric, base + (h % 3) * 0.4));
const all = Array.from({ length: 24 }, (_, h) => h);

describe("wellCoveredReadings", () => {
  it("keeps a fully covered earlier day and drops a thinly covered one", () => {
    const result = wellCoveredReadings(clean([...hours("2026-11-09", all), ...hours("2026-11-10", [22, 23]), ...hours("2026-11-11", all.slice(0, MIN_COVERED_HOURS)), ...hours("2026-11-12", [8, 9])]));
    const days = new Set(result.accepted.map((r) => r.observedAt.slice(0, 10)));
    expect([...days].sort()).toEqual(["2026-11-09", "2026-11-11", "2026-11-12"]);
  });

  it("just below the threshold is not enough", () => {
    const result = wellCoveredReadings(clean([...hours("2026-11-10", all.slice(0, MIN_COVERED_HOURS - 1)), ...hours("2026-11-11", [8])]));
    expect(hasCompletedDay(result)).toBe(false);
  });

  it("always keeps the latest, still-open day as the end marker", () => {
    const result = wellCoveredReadings(clean(hours("2026-11-12", [8, 9, 10])));
    expect(result.accepted).toHaveLength(3);
    expect(hasCompletedDay(result)).toBe(false);
  });

  it("judges each signal separately", () => {
    const result = wellCoveredReadings(clean([...hours("2026-11-10", all), ...hours("2026-11-10", [3, 4], "spo2", 97), ...hours("2026-11-11", [8])]));
    expect(result.accepted.filter((r) => r.metric === "heart_rate" && r.observedAt.startsWith("2026-11-10"))).toHaveLength(24);
    expect(result.accepted.filter((r) => r.metric === "spo2" && r.observedAt.startsWith("2026-11-10"))).toHaveLength(0);
  });

  it("does not count exercise heart rate or sensor artefacts toward coverage", () => {
    const exercise = all.slice(0, 20).map((h) => row(`2026-11-10T${String(h).padStart(2, "0")}:30:00Z`, "heart_rate", 120 + (h % 3), { context: "exercise" }));
    expect(hasCompletedDay(wellCoveredReadings(clean([...exercise, ...hours("2026-11-11", [8])])))).toBe(false);
  });

  it("returns an empty result unchanged", () => {
    expect(wellCoveredReadings(clean([])).accepted).toEqual([]);
    expect(hasCompletedDay(clean([]))).toBe(false);
  });
});

describe("alerts from a webhook day (regression: a few minutes before midnight must not look like a day)", () => {
  const history: Observation[] = Array.from({ length: 40 }, (_, i) => ({ id: `h${i}`, person_id: "p", observed_on: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10), metric: "heart_rate", unit: metricUnits.heart_rate, value: 62 + ((i * 7) % 5) - 2, context: "rest", seed: 1, is_synthetic: true }));
  const minutes = (day: string, startHour: number, count: number, base: number) => Array.from({ length: count }, (_, i) => row(`${day}T${String(startHour + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`, "heart_rate", base + (i % 4) * 0.5));

  it("a short unusual burst on the last evening raises no alert, even though a plain 'earlier day' rule would", () => {
    const readings = clean([...minutes("2026-11-11", 23, 5, 95), ...hours("2026-11-12", [0, 1], "heart_rate", 62)]);
    expect(analyzeLiveReadings(history, readings)).not.toBeNull(); // without the coverage rule this is a false alert
    expect(analyzeLiveReadings(history, wellCoveredReadings(readings))).toBeNull();
  });

  it("a fully covered unusual day does raise an explained alert", () => {
    const readings = wellCoveredReadings(clean([...hours("2026-11-11", all, "heart_rate", 95), ...hours("2026-11-12", [0, 1])]));
    const alert = analyzeLiveReadings(history, readings);
    expect(alert).not.toBeNull();
    expect(alert!.reason).toMatch(/Resting heart rate .* outside your usual range/);
  });

  it("a fully covered usual day raises none", () => {
    expect(analyzeLiveReadings(history, wellCoveredReadings(clean([...hours("2026-11-11", all, "heart_rate", 62), ...hours("2026-11-12", [0])])))).toBeNull();
  });
});
