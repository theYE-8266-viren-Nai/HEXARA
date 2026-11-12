import { describe, expect, it } from "vitest";
import { buildAssessment, type AssessmentInput } from "./useAssessment";
import { dateAt, generateSyntheticData } from "../data/synthetic";
import { sanitizeReadings, type RawRow } from "../domain/ingest";
import { metricUnits } from "../domain/types";

const person = generateSyntheticData(42).observations.filter((o) => o.person_id === "traveler-01");
const base: AssessmentInput = { history: person, scenario: "usual", seed: 42, personId: "traveler-01", dataQuality: "current" };

/** Raw device rows for the given days (UTC), one reading per hour per metric. */
function rowsFor(days: string[], metrics = ["heart_rate", "hrv", "spo2"] as const): RawRow[] {
  const rows: RawRow[] = [];
  for (const day of days) for (const metric of metrics) for (const hour of [6, 12, 18]) {
    const value = metric === "heart_rate" ? 64 + hour / 6 : metric === "hrv" ? 45 : 97.5;
    rows.push({ row: rows.length + 1, fields: { timestamp: `${day}T${String(hour).padStart(2, "0")}:00:00Z`, metric, value, unit: metricUnits[metric] } });
  }
  return rows;
}
const NOW = new Date("2026-11-12T12:00:00Z");
const readings = (days: string[]) => ({ readings: sanitizeReadings(rowsFor(days), { source: "api", now: NOW, defaultDeviceId: "webhook" }), source: "api" as const });

describe("buildAssessment", () => {
  it("scores stored history for the usual scenario", () => {
    const view = buildAssessment(base);
    expect(view.status).toBe("ok");
    if (view.status === "ok") { expect(view.basis).toBe("stored history"); expect(view.assessment.asOf).toBe(dateAt(179)); expect(view.assessment.level).not.toBe("insufficient_baseline"); }
  });

  it("points Recovery concern at the synthetic illness-like day and names heart rate and HRV", () => {
    const view = buildAssessment({ ...base, history: undefined, scenario: "recovery_concern" });
    expect(view.status).toBe("ok");
    if (view.status === "ok") {
      expect(view.basis).toBe("scenario");
      expect(view.assessment.asOf).toBe(dateAt(124));
      expect(view.assessment.level).toBe("notably_different");
      expect(view.assessment.drivers.map((driver) => driver.metric)).toEqual(expect.arrayContaining(["heart_rate", "hrv"]));
    }
  });

  it("has no scenario history for a demo-only profile", () => {
    expect(buildAssessment({ ...base, history: undefined, scenario: "recovery_concern", personId: "leon" })).toEqual({ status: "unavailable", reason: "no_history" });
    expect(buildAssessment({ ...base, history: undefined, personId: "leon" })).toEqual({ status: "unavailable", reason: "no_history" });
  });

  it("never scores when data is unavailable or poor quality", () => {
    expect(buildAssessment({ ...base, dataQuality: "disconnected" })).toEqual({ status: "unavailable", reason: "data_unavailable" });
    expect(buildAssessment({ ...base, dataQuality: "offline" })).toEqual({ status: "unavailable", reason: "data_unavailable" });
    expect(buildAssessment({ ...base, ingestQuality: "poor" })).toEqual({ status: "unavailable", reason: "poor_quality" });
  });

  it("webhook readings need a completed day; today's partial day is never scored", () => {
    const todayOnly = buildAssessment({ ...base, webhook: readings(["2026-11-12"]), webhookActive: true });
    expect(todayOnly).toEqual({ status: "unavailable", reason: "needs_full_day" });
  });

  it("scores webhook completed days added to stored history, but says so when history is too short", () => {
    const withHistory = buildAssessment({ ...base, webhook: readings(["2026-11-10", "2026-11-11", "2026-11-12"]), webhookActive: true });
    expect(withHistory.status).toBe("ok");
    if (withHistory.status === "ok") { expect(withHistory.basis).toBe("webhook"); expect(withHistory.assessment.asOf).toBe("2026-11-11"); }
    const alone = buildAssessment({ ...base, history: undefined, webhook: readings(["2026-11-10", "2026-11-11", "2026-11-12"]), webhookActive: true });
    expect(alone.status).toBe("ok");
    if (alone.status === "ok") expect(alone.assessment.level).toBe("insufficient_baseline");
  });

  it("ignores webhook data that is not the active source", () => {
    const view = buildAssessment({ ...base, webhook: readings(["2026-11-10", "2026-11-11", "2026-11-12"]), webhookActive: false });
    expect(view.status === "ok" && view.basis).toBe("stored history");
  });
});
