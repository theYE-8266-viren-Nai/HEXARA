import { describe, expect, it } from "vitest";
import { analyzeLiveReadings } from "./liveAnalysis";
import { sanitizeReadings, type RawRow } from "../domain/ingest";
import { metricUnits, type Observation } from "../domain/types";

const NOW = new Date("2026-11-12T12:00:00Z");
// 40 days of a steady resting heart rate with a little natural spread (SD ≈ 1.4 bpm).
const history: Observation[] = Array.from({ length: 40 }, (_, day) => ({
  id: `h-${day}`, person_id: "traveler-01", observed_on: new Date(Date.UTC(2026, 5, 1 + day)).toISOString().slice(0, 10),
  metric: "heart_rate", unit: metricUnits.heart_rate, value: 62 + ((day * 7) % 5) - 2, context: "rest", seed: 1, is_synthetic: true,
}));

/** Rows for a device day: `perDay` readings at `value` on each listed date. */
const rows = (days: string[], value: number): RawRow[] => days.flatMap((day, d) => [6, 10, 14, 18].map((hour, k) => ({
  row: d * 4 + k + 1, fields: { timestamp: `${day}T${String(hour).padStart(2, "0")}:00:00Z`, metric: "heart_rate", value: value + k * 0.2, unit: "bpm", deviceId: "band" },
})));
const clean = (r: RawRow[]) => sanitizeReadings(r, { source: "simulated", now: NOW });

describe("analyzeLiveReadings", () => {
  it("raises no alert when the completed day matches the person's usual pattern", () => {
    expect(analyzeLiveReadings(history, clean(rows(["2026-11-10", "2026-11-11"], 62)))).toBeNull();
  });

  it("raises an explained alert when a completed day is clearly different", () => {
    const alert = analyzeLiveReadings(history, clean(rows(["2026-11-10", "2026-11-11"], 90)));
    expect(alert).not.toBeNull();
    expect(alert!.reason).toMatch(/Resting heart rate .* outside your usual range/);
    expect(alert!.metric).toBe("resting_hr");
  });

  it("never alerts from today's unfinished day, however different it looks", () => {
    // Only 2026-11-12 exists, so there is no completed day to analyze.
    expect(analyzeLiveReadings(history, clean(rows(["2026-11-12"], 120)))).toBeNull();
    // A normal completed day followed by a very different partial day still gives no alert.
    expect(analyzeLiveReadings(history, clean([...rows(["2026-11-11"], 62), ...rows(["2026-11-12"], 120)]))).toBeNull();
  });

  it("never alerts on poor-quality data", () => {
    const junk = clean([...rows(["2026-11-11"], 120).slice(0, 2), { row: 9, fields: { timestamp: "bad", metric: "heart_rate", value: 1 } }, { row: 10, fields: { timestamp: "bad", metric: "heart_rate", value: 1 } }, { row: 11, fields: { timestamp: "bad", metric: "heart_rate", value: 1 } }]);
    expect(junk.quality).toBe("poor");
    expect(analyzeLiveReadings(history, junk)).toBeNull();
  });
});
