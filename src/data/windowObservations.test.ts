import { describe, expect, it } from "vitest";
import { DAYS, START_DATE, MAX_WINDOW_DAYS, dateAt, generateSyntheticData, generateWindowObservations, personIndexFor } from "./synthetic";

describe("simulated readings for a date window", () => {
  it("reproduces the 180-day demo readings exactly when the window is those 180 days", () => {
    const original = generateSyntheticData(42).observations;
    for (const index of [0, 1, 3]) {
      const personId = `traveler-0${index + 1}`;
      const expected = original.filter((observation) => observation.person_id === personId).map((observation) => [observation.observed_on, observation.metric, observation.value]);
      const windowed = generateWindowObservations(42, index, START_DATE, dateAt(DAYS - 1)).map((observation) => [observation.observed_on, observation.metric, observation.value]);
      expect(windowed).toEqual(expected);
    }
  });

  it("makes one reading per signal per day, first and last day included, all marked simulated", () => {
    const observations = generateWindowObservations(7, 0, "2026-05-01", "2026-12-31");
    expect(new Set(observations.map((observation) => observation.observed_on)).size).toBe(245);
    expect(observations).toHaveLength(245 * 6);
    expect(observations[0].observed_on).toBe("2026-05-01");
    expect(observations.at(-1)?.observed_on).toBe("2026-12-31");
    expect(observations.every((observation) => observation.is_synthetic === true)).toBe(true);
  });

  it("keeps the demo episodes proportionally placed and skips them in very short windows", () => {
    const radiation = (from: string, to: string) => generateWindowObservations(42, 0, from, to).filter((observation) => observation.metric === "radiation_dose" && observation.value > 1);
    expect(radiation("2026-05-01", "2026-12-31").length).toBe(3);
    expect(radiation("2026-05-01", "2026-05-20").length).toBe(0);
  });

  it("returns nothing for a backwards or invalid window and caps very long ones", () => {
    expect(generateWindowObservations(42, 0, "2026-12-31", "2026-05-01")).toEqual([]);
    expect(generateWindowObservations(42, 0, "nope", "2026-05-01")).toEqual([]);
    const long = generateWindowObservations(42, 0, "2015-01-01", "2026-12-31");
    expect(new Set(long.map((observation) => observation.observed_on)).size).toBe(MAX_WINDOW_DAYS);
    expect(long.at(-1)?.observed_on).toBe("2026-12-31");
  });

  it("maps a profile id to one of the four demo travelers", () => {
    expect([personIndexFor("traveler-01"), personIndexFor("traveler-04"), personIndexFor("traveler-09"), personIndexFor(undefined), personIndexFor("maya")]).toEqual([0, 3, 3, 0, 0]);
  });
});
