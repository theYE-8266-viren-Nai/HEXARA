import { describe, expect, it } from "vitest";
import doc from "../../docs/device-assumptions.md?raw";
import { ASSUMED_SIGNALS, NOT_ASSUMED, renderAssumptionsMarkdown } from "./deviceAssumptions";
import { PLAUSIBLE_RANGE, sanitizeReadings } from "./ingest";
import { metricUnits, type MetricName } from "./types";

describe("device assumptions contract", () => {
  it("covers every metric exactly once, with the sanitizer's own unit and range", () => {
    const metrics = Object.keys(metricUnits) as MetricName[];
    expect(ASSUMED_SIGNALS.map((s) => s.metric).sort()).toEqual([...metrics].sort());
    for (const s of ASSUMED_SIGNALS) {
      expect(s.unit).toBe(metricUnits[s.metric]);
      expect(s.range).toEqual(PLAUSIBLE_RANGE[s.metric]);
      expect(s.device.length).toBeGreaterThan(0);
      expect(s.cadence.length).toBeGreaterThan(0);
    }
  });

  it("states what the range means in practice: values just outside are rejected, values inside are accepted", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    for (const s of ASSUMED_SIGNALS) {
      const row = (value: number) => ({ row: 1, fields: { timestamp: "2026-11-10T08:00:00Z", metric: s.metric, value, unit: s.unit } });
      const [low, high] = s.range;
      expect(sanitizeReadings([row((low + high) / 2)], { source: "file", now }).accepted, s.metric).toHaveLength(1);
      expect(sanitizeReadings([row(high + 1)], { source: "file", now }).rejected, s.metric).toHaveLength(1);
    }
  });

  it("labels temperature as skin temperature, not core body temperature", () => {
    const temp = ASSUMED_SIGNALS.find((s) => s.metric === "skin_temperature")!;
    expect(temp.label).toBe("Skin temperature");
    expect(temp.note).toMatch(/not core body temperature/);
  });

  it("never lists diagnostic measures as assumed signals", () => {
    const labels = ASSUMED_SIGNALS.map((s) => s.label.toLowerCase()).join(" ");
    expect(labels).not.toMatch(/blood pressure|glucose|ecg|bone|clot/);
    expect(NOT_ASSUMED.join(" ")).toMatch(/diagnosis/);
  });

  it("keeps docs/device-assumptions.md in sync (run: npm run docs:assumptions)", () => {
    expect(doc.replace(/\r\n/g, "\n")).toBe(renderAssumptionsMarkdown());
  });
});
