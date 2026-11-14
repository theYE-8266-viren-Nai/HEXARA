import { describe, expect, it } from "vitest";
import { generateSyntheticData } from "../data/synthetic";
import { summarizeMonthlyHistory } from "./monthlyHistory";

describe("monthly personal history", () => {
  it("groups the full synthetic window into deterministic UTC months", () => {
    const observations = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01");
    const first = summarizeMonthlyHistory(observations);
    expect(first).toHaveLength(6);
    expect(first[0].month).toBe("2026-01");
    expect(first.at(-1)?.month).toBe("2026-06");
    expect(first.reduce((sum, month) => sum + (month.metrics.find((metric) => metric.metric === "heart_rate")?.observedDays ?? 0), 0)).toBe(180);
    expect(summarizeMonthlyHistory(observations)).toEqual(first);
  });

  it("does not invent a comparison when a month has too little history", () => {
    const observations = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01" && observation.observed_on < "2026-01-05");
    const [month] = summarizeMonthlyHistory(observations);
    expect(month.quality).toBe("insufficient");
    expect(month.personalSummary).toMatch(/Not enough readings/);
    expect(month.metrics.every((metric) => metric.direction === "insufficient")).toBe(true);
  });

  it("uses personal-pattern wording only", () => {
    const months = summarizeMonthlyHistory(generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01"));
    const text = months.map((month) => month.personalSummary).join(" ").toLowerCase();
    expect(text).not.toMatch(/healthy|unhealthy|diagnos|disease|clearance/);
  });
});
