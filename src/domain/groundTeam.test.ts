import { describe, expect, it } from "vitest";
import { missionCounts, ongoingMissionCrew, syntheticCrewTrends, syntheticGroundMissions } from "./groundTeam";

describe("ground team training roster", () => {
  const today = new Date("2026-11-14T12:00:00Z");
  const missions = ongoingMissionCrew(syntheticGroundMissions(today), today);

  it("contains only active crew on board in ongoing missions", () => {
    expect(missions.map((mission) => mission.name)).toEqual(["Aurora Station Rotation", "Kepler Research Flight"]);
    expect(missions.flatMap((mission) => mission.crew)).toHaveLength(4);
    expect(missions.flatMap((mission) => mission.crew).every((person) => person.stage === "active" && person.assignment === "onboard")).toBe(true);
    expect(missionCounts(missions)).toEqual({ missions: 2, onboard: 4, needsReview: 2, dataGaps: 1 });
  });

  it("provides all six synthetic trends for every onboard crew member and labels a data gap", () => {
    for (const person of missions.flatMap((mission) => mission.crew)) {
      const trends = syntheticCrewTrends(person, today);
      expect(trends.map((trend) => trend.metric)).toEqual(["resting_hr", "hrv", "spo2", "sleep_hours", "core_temperature", "radiation_dose"]);
      expect(trends.every((trend) => trend.source.startsWith("Synthetic"))).toBe(true);
      expect(trends.every((trend) => trend.points.length === (person.dataQuality === "missing" ? 6 : 7))).toBe(true);
      if (person.dataQuality === "missing") expect(trends[0].aggregationPeriod).toContain("latest missing");
    }
  });
});
