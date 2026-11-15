import { describe, expect, it } from "vitest";
import { generateSyntheticData } from "../data/synthetic";
import { buildMonthlyHistory, monthlyHistoryWindow, summarizeMonthlyHistory } from "./monthlyHistory";
import { emptyProfile, type AstronautProfile } from "./astronautAccount";

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

  it("limits the history to the profile journey window", () => {
    const observations = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01");
    const months = summarizeMonthlyHistory(observations, { from: "2026-03-01", to: "2026-05-31" });
    expect(months.map((month) => month.month)).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(months.some((month) => month.month === "2026-01" || month.month === "2026-06")).toBe(false);
  });

  it("counts notable days in every month with a seeded event, not only the last day of the history", () => {
    const observations = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01");
    const notable = Object.fromEntries(summarizeMonthlyHistory(observations).map((month) => [month.month, month.notableDays]));
    // Radiation spike (day 100, April), illness-like episode (day 120, April/May), sleep disruption (day 150, May/June).
    expect(notable["2026-04"]).toBeGreaterThan(0);
    expect(notable["2026-05"]).toBeGreaterThan(0);
    expect(notable["2026-06"]).toBeGreaterThan(0);
    // Months before any event stay quiet, and one month never counts more days than it has.
    expect(["2026-01", "2026-02", "2026-03"].map((month) => notable[month])).toEqual([0, 0, 0]);
    expect(Object.values(notable).every((count) => count <= 31)).toBe(true);
  });

  it("counts the same notable days inside a journey window, using earlier readings as baseline", () => {
    const observations = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01");
    const full = summarizeMonthlyHistory(observations);
    const windowed = summarizeMonthlyHistory(observations, { from: "2026-04-01", to: "2026-05-31" });
    expect(windowed.map((month) => month.notableDays)).toEqual(full.filter((month) => ["2026-04", "2026-05"].includes(month.month)).map((month) => month.notableDays));
  });

  it("uses personal-pattern wording only", () => {
    const months = summarizeMonthlyHistory(generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01"));
    const text = months.map((month) => month.personalSummary).join(" ").toLowerCase();
    expect(text).not.toMatch(/healthy|unhealthy|diagnos|disease|clearance/);
  });

  describe("window from the account's own dates", () => {
    const profile = (stage: AstronautProfile["stage"], journey: Record<string, string>): AstronautProfile => ({ ...emptyProfile(stage), fullName: "Ada", journey });
    const history = generateSyntheticData(42).observations.filter((observation) => observation.person_id === "traveler-01");

    it("covers launch to planned return for Active, last launch to last landing for Former, training start to target launch for In Training", () => {
      expect(monthlyHistoryWindow(profile("active", { launchDate: "2026-05-01", plannedReturn: "2026-12-31" }))).toMatchObject({ from: "2026-05-01", to: "2026-12-31" });
      expect(monthlyHistoryWindow(profile("retired", { lastLaunch: "2026-02-10", lastLanding: "2026-08-20" }))).toMatchObject({ from: "2026-02-10", to: "2026-08-20" });
      expect(monthlyHistoryWindow(profile("future", { trainingStart: "2026-03-01", targetLaunch: "2027-01-31" }))).toMatchObject({ from: "2026-03-01", to: "2027-01-31" });
    });

    it("explains what it assumed when only one date, no date, or backwards dates were entered", () => {
      expect(monthlyHistoryWindow(profile("active", { launchDate: "2026-05-01" }))).toMatchObject({ from: "2026-05-01", to: "2026-10-27", note: expect.stringMatching(/assumes a 180-day mission/) });
      expect(monthlyHistoryWindow(profile("retired", { lastLanding: "2026-08-20" }))).toMatchObject({ to: "2026-08-20", note: expect.stringMatching(/180 days before your last landing/) });
      expect(monthlyHistoryWindow(profile("future", { trainingStart: "2026-03-01" }))).toMatchObject({ from: "2026-03-01", note: expect.stringMatching(/180 days from training start/) });
      expect(monthlyHistoryWindow(profile("future", {}))).toEqual({ note: expect.stringMatching(/No training dates/) });
      expect(monthlyHistoryWindow(profile("active", { launchDate: "2026-12-01", plannedReturn: "2026-05-01" }))).toEqual({ note: expect.stringMatching(/before the start date/) });
      expect(monthlyHistoryWindow(null)).toEqual({});
    });

    it("keeps only the most recent two years of a very long window, and says so", () => {
      const window = monthlyHistoryWindow(profile("active", { launchDate: "2020-01-01", plannedReturn: "2026-12-31" }));
      expect(window.to).toBe("2026-12-31");
      expect(window.from).toBe("2024-12-31");
      expect(window.note).toMatch(/most recent two years/);
    });

    it("shows every month from May to December for an Active astronaut, for all three stages' own dates", () => {
      const cases: Array<[AstronautProfile, string[]]> = [
        [profile("active", { launchDate: "2026-05-01", plannedReturn: "2026-12-31" }), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]],
        [profile("retired", { lastLaunch: "2026-02-15", lastLanding: "2026-06-20" }), ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]],
        [profile("future", { trainingStart: "2026-09-01", targetLaunch: "2027-02-28" }), ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]],
      ];
      for (const [account, months] of cases) {
        const result = buildMonthlyHistory(account, history, 42, "traveler-01");
        expect(result.summaries.map((month) => month.month), account.stage).toEqual(months);
        expect(result.summaries.every((month) => month.metrics.length === 6), account.stage).toBe(true);
        expect(result.note).toMatch(/simulated for every month in this window, including months that have not happened yet/);
      }
    });

    it("gives full months good context, partial months limited context, and compares only against earlier months", () => {
      const result = buildMonthlyHistory(profile("active", { launchDate: "2026-05-20", plannedReturn: "2026-08-10" }), history, 42, "traveler-01");
      expect(result.summaries.map((month) => [month.month, month.quality])).toEqual([["2026-05", "limited"], ["2026-06", "good"], ["2026-07", "good"], ["2026-08", "limited"]]);
      expect(result.summaries[0].metrics.every((metric) => metric.direction === "insufficient")).toBe(true);
      expect(result.summaries[1].metrics.some((metric) => metric.direction !== "insufficient")).toBe(true);
    });

    it("places the demo episodes inside the window so some months have notable days and the first months do not", () => {
      const result = buildMonthlyHistory(profile("active", { launchDate: "2026-05-01", plannedReturn: "2026-12-31" }), history, 42, "traveler-01");
      const notable = Object.fromEntries(result.summaries.map((month) => [month.month, month.notableDays]));
      expect(Object.values(notable).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0);
      expect(notable["2026-05"]).toBe(0);
    });

    it("is deterministic for the same seed and different for another person", () => {
      const account = profile("active", { launchDate: "2026-05-01", plannedReturn: "2026-12-31" });
      expect(buildMonthlyHistory(account, history, 42, "traveler-01")).toEqual(buildMonthlyHistory(account, history, 42, "traveler-01"));
      expect(buildMonthlyHistory(account, history, 42, "traveler-02").summaries[0].metrics[0].average).not.toBe(buildMonthlyHistory(account, history, 42, "traveler-01").summaries[0].metrics[0].average);
    });

    it("falls back to the stored readings when there are no dates or the scenario has no readings", () => {
      const noDates = buildMonthlyHistory(profile("future", {}), history, 42, "traveler-01");
      expect(noDates.summaries.map((month) => month.month)).toEqual(summarizeMonthlyHistory(history).map((month) => month.month));
      expect(buildMonthlyHistory(profile("active", { launchDate: "2026-05-01", plannedReturn: "2026-12-31" }), [], 42, "traveler-01").summaries).toEqual([]);
    });
  });
});
