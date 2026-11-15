import { describe, expect, it } from "vitest";
import { cleanProfile, displayValue, emptyProfile, missionDayFrom, profileGroups, validateProfile } from "./astronautAccount";

describe("astronaut profile", () => {
  it("gives each stage its own journey and care-team sections", () => {
    expect(profileGroups("future").map((group) => group.title)).toEqual(["Personal details", "Training", "Care team and contacts"]);
    expect(profileGroups("active")[1].fields.map((field) => field.key)).toEqual(["mission", "role", "launchDate", "plannedReturn", "exercisePlan"]);
    expect(profileGroups("retired")[2].fields.map((field) => field.label)).toContain("Primary doctor");
  });

  it("asks each stage for the two dates that bound its monthly history", () => {
    const keys = (stage: "future" | "active" | "retired") => profileGroups(stage)[1].fields.filter((field) => field.kind === "date").map((field) => field.key);
    expect(keys("active")).toEqual(["launchDate", "plannedReturn"]);
    expect(keys("retired")).toEqual(["lastLaunch", "lastLanding"]);
    expect(keys("future")).toEqual(["trainingStart", "targetLaunch"]);
  });

  it("rejects an end date before its start date, for every stage, and accepts same-day or later", () => {
    const pairs = [["active", "launchDate", "plannedReturn"], ["retired", "lastLaunch", "lastLanding"], ["future", "trainingStart", "targetLaunch"]] as const;
    for (const [stage, start, end] of pairs) {
      const base = { ...emptyProfile(stage), fullName: "Ada Vance" };
      expect(validateProfile({ ...base, journey: { [start]: "2026-05-01", [end]: "2026-04-30" } })[`journey.${end}`], stage).toBe("Choose a date on or after the start date.");
      expect(validateProfile({ ...base, journey: { [start]: "2026-05-01", [end]: "2026-05-01" } }), stage).toEqual({});
      expect(validateProfile({ ...base, journey: { [start]: "2026-05-01", [end]: "2026-12-31" } }), stage).toEqual({});
      expect(validateProfile({ ...base, journey: { [start]: "2026-05-01" } }), stage).toEqual({});
    }
  });

  it("requires a name and checks number ranges", () => {
    expect(validateProfile(emptyProfile("active")).fullName).toBe("Enter your full name.");
    const profile = { ...emptyProfile("active"), fullName: "Ada Vance", personal: { age: "7", height: "abc" } };
    const errors = validateProfile(profile);
    expect(errors["personal.age"]).toBe("Enter a value between 16 and 110.");
    expect(errors["personal.height"]).toBe("Enter a number.");
    expect(validateProfile({ ...profile, personal: { age: "41" } })).toEqual({});
  });

  it("drops fields that do not belong to the chosen stage", () => {
    const cleaned = cleanProfile({ ...emptyProfile("retired"), fullName: "  Ada  ", journey: { mission: "Expedition 12", missionsFlown: "3" }, careTeam: { crewMedic: "Dr. X", primaryDoctor: "Dr. Y" } });
    expect(cleaned.fullName).toBe("Ada");
    expect(cleaned.journey).toEqual({ missionsFlown: "3" });
    expect(cleaned.careTeam).toEqual({ primaryDoctor: "Dr. Y" });
  });

  it("counts the mission day from the launch date", () => {
    expect(missionDayFrom("2026-01-01", new Date("2026-01-01T12:00:00"))).toBe(1);
    expect(missionDayFrom("2026-01-01", new Date("2026-06-29T12:00:00"))).toBe(180);
    expect(missionDayFrom("2027-01-01", new Date("2026-06-29T12:00:00"))).toBeNull();
    expect(missionDayFrom(undefined)).toBeNull();
  });

  it("shows units and a clear empty value", () => {
    const height = profileGroups("active")[0].fields.find((field) => field.key === "height")!;
    expect(displayValue(height, "172")).toBe("172 cm");
    expect(displayValue(height, undefined)).toBe("Not provided");
  });
});
