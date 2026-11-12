import { describe, expect, it } from "vitest";
import { analyzeReadings, convertUnit, sanitizeReadings, toDailyObservations, type RawRow } from "./ingest";
import { parseImportText, splitCsvLine } from "../lib/adapters/fileImport";

const NOW = new Date("2026-11-12T12:00:00Z");
const opts = { source: "file" as const, now: NOW };
const row = (n: number, fields: Record<string, unknown>): RawRow => ({ row: n, fields });
const good = (n: number, over: Record<string, unknown> = {}) => row(n, { timestamp: `2026-11-10T08:${String(n % 60).padStart(2, "0")}:00Z`, metric: "heart_rate", value: 62 + (n % 3), unit: "bpm", deviceId: "band-1", ...over });

describe("sanitizeReadings", () => {
  it("accepts a valid reading and normalizes aliases", () => {
    const result = sanitizeReadings([row(1, { Time: "2026-11-10T08:00:00Z", Type: "HR", Value: "64", Units: "bpm" })], opts);
    expect(result.rejected).toEqual([]);
    expect(result.accepted[0]).toMatchObject({ metric: "heart_rate", value: 64, unit: "bpm", source: "file", context: "rest", deviceId: "file-device" });
  });

  it("rejects each kind of bad row with a reason instead of dropping it", () => {
    const result = sanitizeReadings([
      row(1, { timestamp: "2026-11-10T08:00:00Z", metric: "blood_sugar", value: 5, unit: "mmol" }),
      row(2, { timestamp: "2026-11-10T08:00:00Z", metric: "heart_rate", value: "abc", unit: "bpm" }),
      row(3, { timestamp: "2026-11-10T08:00:00Z", metric: "heart_rate", value: "1e999", unit: "bpm" }),
      row(4, { timestamp: "2026-11-10T08:00:00Z", metric: "heart_rate", value: 0, unit: "bpm" }),
      row(5, { timestamp: "2026-11-10T08:00:00Z", metric: "heart_rate", value: 400, unit: "bpm" }),
      row(6, { timestamp: "2026-11-10T08:00:00Z", metric: "spo2", value: 120, unit: "%" }),
      row(7, { timestamp: "2027-01-01T00:00:00Z", metric: "heart_rate", value: 60, unit: "bpm" }),
      row(8, { timestamp: "2020-01-01T00:00:00Z", metric: "heart_rate", value: 60, unit: "bpm" }),
      row(9, { timestamp: "not a date", metric: "heart_rate", value: 60, unit: "bpm" }),
      row(10, { metric: "heart_rate", value: 60, unit: "bpm" }),
      row(11, { timestamp: "2026-11-10T08:00:00Z", metric: "heart_rate", value: 60, unit: "furlongs" }),
      row(12, { timestamp: "2026-11-10T08:00:00Z", value: 60 }),
    ], opts);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map((r) => r.row)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.rejected.find((r) => r.row === 1)!.reason).toMatch(/Unknown metric/);
    expect(result.rejected.find((r) => r.row === 4)!.reason).toMatch(/lost sensor contact/);
    expect(result.rejected.find((r) => r.row === 7)!.reason).toMatch(/future/);
    expect(result.rejected.find((r) => r.row === 11)!.reason).toMatch(/not supported/);
    expect(result.quality).toBe("poor");
  });

  it("rejects samples the device itself marks as poor contact", () => {
    const result = sanitizeReadings([good(1, { signal_quality: "low" }), good(2, { signal_quality: "good" })], opts);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toEqual([{ row: 1, reason: "Device reported poor sensor contact for this sample." }]);
  });

  it("converts units to the canonical unit", () => {
    expect(convertUnit("skin_temperature", 98.6, "F")).toBeCloseTo(37, 1);
    expect(convertUnit("skin_temperature", 310.15, "K")).toBeCloseTo(37, 1);
    expect(convertUnit("hrv", 0.045, "s")).toBeCloseTo(45);
    expect(convertUnit("sleep_hours", 420, "min")).toBe(7);
    expect(convertUnit("radiation_dose", 500, "µSv")).toBeCloseTo(0.5);
    expect(convertUnit("heart_rate", 60, "mph")).toBeNull();
  });

  it("removes duplicates and sorts by time", () => {
    const result = sanitizeReadings([
      good(5, { timestamp: "2026-11-10T09:00:00Z" }), good(6, { timestamp: "2026-11-10T08:00:00Z" }),
      good(7, { timestamp: "2026-11-10T09:00:00Z" }), good(8, { timestamp: "2026-11-10T10:00:00Z" }),
    ], opts);
    expect(result.accepted.map((r) => r.observedAt)).toEqual(["2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z", "2026-11-10T10:00:00.000Z"]);
    expect(result.rejected).toEqual([{ row: 7, reason: "Duplicate reading for this device, metric and time." }]);
  });

  it("flags spikes and stuck sensors and excludes them from analysis", () => {
    const values = [60, 61, 60, 62, 150, 61, 60];
    const spike = sanitizeReadings(values.map((value, i) => good(i, { timestamp: `2026-11-10T08:0${i}:00Z`, value })), opts);
    expect(spike.accepted.filter((r) => r.flag === "spike").map((r) => r.value)).toEqual([150]);

    const stuck = sanitizeReadings(Array.from({ length: 10 }, (_, i) => good(i, { timestamp: `2026-11-10T08:0${i}:00Z`, value: 70 })), opts);
    expect(stuck.accepted.every((r) => r.flag === "flatline")).toBe(true);
    expect(toDailyObservations(stuck.accepted, "p1")).toEqual([]);
  });

  it("scores quality and never lets poor data produce alerts", () => {
    const junk = sanitizeReadings([good(1), good(2), good(3, { value: "x" }), good(4, { value: "y" }), good(5, { value: "z" })], opts);
    expect(junk.quality).toBe("poor");
    const analysis = analyzeReadings(junk, "p1");
    expect(analysis.alerts).toEqual([]);
    expect(analysis.message).toMatch(/Not enough reliable data/);
  });

  it("keeps exercise heart rate out of the rest series", () => {
    const readings = sanitizeReadings([good(1), good(2), good(3), good(4, { context: "exercise", value: 150 })], opts);
    const daily = toDailyObservations(readings.accepted, "p1");
    expect(daily.filter((o) => o.context === "exercise")).toHaveLength(1);
    expect(daily.find((o) => o.context === "rest")!.value).toBeLessThan(70);
  });
});

describe("analysis through the existing alert engine", () => {
  const history = (lastValue: number, source: "file" | "bluetooth" = "file"): RawRow[] => {
    const rows: RawRow[] = [];
    for (let day = 0; day < 32; day += 1) {
      const date = new Date(Date.UTC(2026, 8, 1 + day)).toISOString().slice(0, 10);
      const value = day === 31 ? lastValue : 60 + (day % 5);
      for (let k = 0; k < 3; k += 1) rows.push(row(day * 3 + k + 1, { timestamp: `${date}T${String(6 + k * 2).padStart(2, "0")}:00:00Z`, metric: "heart_rate", value: value + k * 0.3, unit: "bpm", deviceId: source }));
    }
    return rows;
  };

  it("reports no alert for a usual pattern", () => {
    const result = analyzeReadings(sanitizeReadings(history(62), opts), "p1");
    expect(result.quality).toBe("good");
    expect(result.alerts).toEqual([]);
  });

  it("raises an explained alert for a clear single-day change", () => {
    const result = analyzeReadings(sanitizeReadings(history(100), opts), "p1");
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].explanation).toMatch(/outside your usual range|well outside/);
  });

  it("gives the same analysis regardless of source", () => {
    const a = analyzeReadings(sanitizeReadings(history(100, "file"), { ...opts, source: "file" }), "p1");
    const b = analyzeReadings(sanitizeReadings(history(100, "file"), { ...opts, source: "bluetooth" }), "p1");
    expect(b.alerts).toEqual(a.alerts);
    expect(b.observations).toEqual(a.observations);
  });
});

describe("robustness: junk never reaches the alert engine", () => {
  it("handles hostile and malformed input without NaN or out-of-range values", () => {
    const junk: unknown[] = [null, undefined, "", 0, NaN, [], {}, "<script>", { __proto__: { value: 1 } }, { metric: "heart_rate", value: Infinity, timestamp: "2026-11-10T00:00:00Z" }, { metric: "heart_rate", value: -5, timestamp: "2026-11-10T00:00:00Z" }, { metric: "hr\u0000", value: 60, timestamp: "2026-11-10T00:00:00Z", deviceId: "x".repeat(500) }];
    const rows = junk.map((fields, i) => ({ row: i + 1, fields: (fields && typeof fields === "object" ? fields : {}) as Record<string, unknown> }));
    const result = sanitizeReadings(rows, opts);
    for (const reading of result.accepted) {
      expect(Number.isFinite(reading.value)).toBe(true);
      expect(reading.deviceId.length).toBeLessThanOrEqual(64);
      expect(reading.deviceId).not.toMatch(/[\u0000-\u001f]/);
    }
    expect(() => analyzeReadings(result, "p1")).not.toThrow();
  });
});

describe("file import adapter", () => {
  it("parses CSV with quotes, BOM, CRLF and blank lines", () => {
    const csv = '﻿timestamp,metric,value,unit,deviceId\r\n2026-11-10T08:00:00Z,heart_rate,64,bpm,"band, left"\r\n\r\n2026-11-10T08:01:00Z,spo2,97,%,band\r\n';
    const parsed = parseImportText(csv, "export.csv");
    expect(parsed.format).toBe("csv");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].fields.deviceId).toBe("band, left");
    expect(sanitizeReadings(parsed.rows, opts).accepted).toHaveLength(2);
  });

  it("reports malformed rows with their line numbers", () => {
    const parsed = parseImportText("timestamp,metric,value,unit\n2026-11-10T08:00:00Z,heart_rate,64\n2026-11-10T08:01:00Z,heart_rate,65,bpm", "a.csv");
    expect(parsed.errors).toEqual([{ row: 2, reason: "Expected 4 columns but found 3." }]);
    expect(parsed.rows.map((r) => r.row)).toEqual([3]);
  });

  it("parses JSON arrays and { readings } objects, and rejects invalid JSON", () => {
    const item = { timestamp: "2026-11-10T08:00:00Z", metric: "hr", value: 60, unit: "bpm" };
    expect(parseImportText(JSON.stringify([item, 5]), "a.json")).toMatchObject({ format: "json", rows: [{ row: 1 }], errors: [{ row: 2 }] });
    expect(parseImportText(JSON.stringify({ readings: [item] })).rows).toHaveLength(1);
    expect(parseImportText("{oops", "a.json").errors[0].reason).toMatch(/not valid JSON/);
    expect(parseImportText("   ").errors[0].reason).toMatch(/empty/);
  });

  it("splits escaped quotes", () => {
    expect(splitCsvLine('a,"b ""q"" c",d')).toEqual(["a", 'b "q" c', "d"]);
  });
});
