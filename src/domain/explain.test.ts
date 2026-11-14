import { describe, expect, it } from "vitest";
import { buildExplainRequest, isSafeExplanation, validateExplainRequest, type ExplainRequest } from "./explainTypes";
import { templateExplanation } from "./explainTemplate";
import { NOT_ASSUMED } from "./deviceAssumptions";
import { NOT_ASSUMED_LINES, buildSystemPrompt, buildUserPrompt, DRIVER_LABELS, EXPLAIN_LEVELS, EXPLAIN_SOURCES } from "../../supabase/functions/_shared/validate";
import type { AssessmentView } from "../lib/useAssessment";
import type { AnomalyAssessment } from "./anomalyModel";
import type { MonthlyHistorySummary } from "./monthlyHistory";

const valid: ExplainRequest = { stage: "active", level: "notably_different", patternScore: 100, dataQuality: "good", source: "simulated", audience: "traveler",
  drivers: [{ metricLabel: "Sleep", direction: "lower", changePct: -14.8 }, { metricLabel: "Resting heart rate", direction: "higher", changePct: 20.4 }, { metricLabel: "HRV", direction: "lower", changePct: -31.8 }] };

const assessment = (over: Partial<AnomalyAssessment> = {}): AnomalyAssessment => ({ asOf: "2026-05-05", level: "notably_different", patternScore: 99.6, baselineDays: 30, metricsUsed: ["heart_rate"], elevatedDays: 2,
  drivers: [{ metric: "sleep_hours", label: "Sleep", direction: "lower", changePct: -14.84, contribution: 0.6, z: -3 }], ...over });
const ok = (a: AnomalyAssessment): AssessmentView => ({ status: "ok", basis: "stored history", assessment: a });
const monthly: MonthlyHistorySummary[] = [{ month: "2026-05", label: "May 2026", personalSummary: "Some signals were lower than your earlier personal pattern.", notableDays: 2, quality: "good", metrics: [{ metric: "sleep_hours", average: 6.1, minimum: 5.2, maximum: 7.1, observedDays: 31, direction: "lower" }] }];
const monthlyRequest: NonNullable<ExplainRequest["monthlyHistory"]> = [{ month: "2026-05", personalSummary: monthly[0].personalSummary, notableDays: 2, quality: "good", metrics: [{ metricLabel: "Sleep", average: 6.1, minimum: 5.2, maximum: 7.1, observedDays: 31, direction: "lower" }] }];

describe("explain request validation", () => {
  it("accepts a well-formed de-identified summary", () => {
    const result = validateExplainRequest(valid);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown fields so names, ids and free text cannot be smuggled in", () => {
    for (const extra of [{ name: "Maya" }, { personId: "traveler-01" }, { note: "I feel sick" }, { raw: [1, 2, 3] }]) expect(validateExplainRequest({ ...valid, ...extra }).ok).toBe(false);
    expect(validateExplainRequest({ ...valid, drivers: [{ ...valid.drivers[0], extra: 1 }] }).ok).toBe(false);
  });

  it("rejects bad enums, labels, scores, counts and shapes", () => {
    const bad: unknown[] = [null, "x", [], { ...valid, stage: "pilot" }, { ...valid, level: "insufficient_baseline" }, { ...valid, source: "cloud" }, { ...valid, dataQuality: "poor" }, { ...valid, audience: "doctor" },
      { ...valid, patternScore: 101 }, { ...valid, patternScore: 4.5 }, { ...valid, patternScore: "5" }, { ...valid, drivers: [valid.drivers[0], valid.drivers[0], valid.drivers[0], valid.drivers[0]] },
      { ...valid, drivers: [{ metricLabel: "Blood pressure", direction: "higher", changePct: 3 }] }, { ...valid, drivers: [{ ...valid.drivers[0], direction: "up" }] },
      { ...valid, drivers: [{ ...valid.drivers[0], changePct: Infinity }] }, { ...valid, drivers: [{ ...valid.drivers[0], changePct: 9999 }] }, { ...valid, drivers: "none" }];
    for (const candidate of bad) expect(validateExplainRequest(candidate).ok, JSON.stringify(candidate)).toBe(false);
  });

  it("allows api and every other source name used by the ingest pipeline", () => {
    for (const source of EXPLAIN_SOURCES) expect(validateExplainRequest({ ...valid, source }).ok).toBe(true);
    expect([...EXPLAIN_SOURCES].sort()).toEqual(["api", "bluetooth", "file", "simulated"]);
  });
});

describe("buildExplainRequest", () => {
  const context = { stage: "active" as const, ingestQuality: "good" as const, source: "simulated" as const };

  it("keeps only the allowed summary fields and rounds numbers", () => {
    const request = buildExplainRequest(ok(assessment()), context)!;
    expect(Object.keys(request).sort()).toEqual(["audience", "dataQuality", "drivers", "level", "patternScore", "source", "stage"]);
    expect(request.patternScore).toBe(100);
    expect(request.drivers).toEqual([{ metricLabel: "Sleep", direction: "lower", changePct: -14.8 }]);
    expect(JSON.stringify(request)).not.toMatch(/traveler-|asOf|2026|baselineDays/);
    expect(validateExplainRequest(request).ok).toBe(true);
  });

  it("returns null when there is nothing honest to explain", () => {
    expect(buildExplainRequest({ status: "unavailable", reason: "no_history" }, context)).toBeNull();
    expect(buildExplainRequest(ok(assessment({ level: "insufficient_baseline", drivers: [] })), context)).toBeNull();
    expect(buildExplainRequest(ok(assessment()), { ...context, ingestQuality: "poor" })).toBeNull();
  });

  it("marks limited data quality and passes the api source through", () => {
    const request = buildExplainRequest(ok(assessment()), { ...context, ingestQuality: "limited", source: "api" })!;
    expect(request.dataQuality).toBe("limited");
    expect(request.source).toBe("api");
  });

  it("adds bounded monthly context without raw observations or private fields", () => {
    const request = buildExplainRequest(ok(assessment()), { ...context, monthlyHistory: monthly })!;
    expect(request.monthlyHistory).toEqual([{ month: "2026-05", personalSummary: monthly[0].personalSummary, notableDays: 2, quality: "good", metrics: [{ metricLabel: "Sleep", average: 6.1, minimum: 5.2, maximum: 7.1, observedDays: 31, direction: "lower" }] }]);
    expect(JSON.stringify(request)).not.toMatch(/traveler-|symptom|note|observed_on|2026-05-\d/);
    expect(validateExplainRequest(request).ok).toBe(true);
    expect(buildUserPrompt(request)).toContain("2026-05");
  });
});

describe("built-in template explanation", () => {
  it("is safe, short and readable for every level, driver count, source and quality", () => {
    for (const level of EXPLAIN_LEVELS) for (const source of EXPLAIN_SOURCES) for (const dataQuality of ["good", "limited"] as const) for (let count = 0; count <= 3; count++) {
      const request: ExplainRequest = { ...valid, level, source, dataQuality, drivers: valid.drivers.slice(0, count), patternScore: level === "usual" ? 5 : 80 };
      const text = templateExplanation(request);
      expect(isSafeExplanation(text), text).toBe(true);
      expect(text.length).toBeLessThan(700);
      expect(text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("names signals with direction in plain words and keeps acronyms", () => {
    const text = templateExplanation(valid);
    expect(text).toContain("Sleep was lower");
    expect(text).toContain("resting heart rate was higher");
    expect(text).toContain("HRV was lower");
    expect(text).toContain("HRV is a rough, short-term estimate.");
    expect(text).toContain("tell the crew medic");
    expect(templateExplanation({ ...valid, level: "usual", drivers: [] })).toContain("close to your own usual pattern");
    expect(templateExplanation({ ...valid, source: "api", dataQuality: "limited" })).toMatch(/webhook source.*Data quality was limited/s);
  });

  it("is deterministic", () => { expect(templateExplanation(valid)).toBe(templateExplanation({ ...valid })); });

  it("uses monthly context in the offline fallback", () => {
    const text = templateExplanation({ ...valid, monthlyHistory: monthlyRequest });
    expect(text).toContain("2026-05");
    expect(text).not.toMatch(/healthy|unhealthy|diagnos|clearance/i);
  });
});

describe("safety language guard", () => {
  it("rejects diagnostic, treatment, clearance, risk, and not-assumed topics", () => {
    for (const text of ["You may have a medical condition.", "This is likely an infection.", "There is a high probability of illness.", "Your blood pressure looks high.", "Glucose may be low.", "Possible ECG change.",
      "Bone density could be affected.", "Take some ibuprofen.", "Start treatment now.", "You are cleared for flight.", "This is a risk.", "Your heart rate was measured at 80.", "Possible SANS.", "You have a problem.", "Vision changes.", "A blood clot may form.", "This is an emergency."])
      expect(isSafeExplanation(text), text).toBe(false);
  });
  it("rejects empty, non-string and over-long text", () => {
    expect(isSafeExplanation("")).toBe(false); expect(isSafeExplanation("   ")).toBe(false); expect(isSafeExplanation(42)).toBe(false); expect(isSafeExplanation(null)).toBe(false); expect(isSafeExplanation("a".repeat(701))).toBe(false);
    expect(isSafeExplanation("Sleep was lower than your usual range. Tell the crew medic if it continues.")).toBe(true);
  });
  it("covers every topic OrbitWell says it never assumes, and the lists stay identical to deviceAssumptions", () => {
    expect(NOT_ASSUMED_LINES).toEqual(NOT_ASSUMED);
    for (const line of NOT_ASSUMED) expect(isSafeExplanation(line), line).toBe(false);
  });
});

describe("prompts", () => {
  it("system prompt forbids the not-assumed topics and the user prompt carries only the allowed facts", () => {
    const system = buildSystemPrompt();
    for (const line of NOT_ASSUMED) expect(system).toContain(line);
    expect(system).toMatch(/never diagnose/i);
    const user = buildUserPrompt(valid);
    expect(user).toContain("Sleep: lower than usual by about 15%");
    expect(user).toContain("Source: simulated");
    for (const label of DRIVER_LABELS) expect(typeof label).toBe("string");
    expect(user).not.toMatch(/traveler-|name|2026/i);
  });
});
