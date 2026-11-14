import { describe, expect, it } from "vitest";
import { latestMovementForRegion, movementRegionsForStage, MOVEMENT_TASK_REGIONS, primaryMovementRegion } from "./movementBody";
import { VISUAL_CHECK_DISCLAIMER, type VisualCheck } from "./visualCheck";

const check = (checkType: VisualCheck["checkType"], startedAt: string): VisualCheck => ({
  checkId: `${checkType}-${startedAt}`,
  ownerKey: "retired:p1",
  stage: "retired",
  checkType,
  startedAt,
  duration: 15,
  cameraConsent: false,
  completionStatus: "completed",
  observedFeatures: { movementDurationSeconds: 15, leftRightBalance: 0.5, pauseCount: 0, cameraQuality: "good", qualityNotes: [] },
  userReportedSymptoms: { discomfort: "none", symptoms: "" },
  comparisonSummary: { trend: "first_session", statements: [], priorSessionsUsed: 0 },
  observationSummary: [],
  supportRecommendation: "Personal context only.",
  disclaimer: VISUAL_CHECK_DISCLAIMER,
  isSynthetic: true,
});

describe("movement-to-body mapping", () => {
  it("offers only shoulder and arm in flight, all movement regions after flight, and none before flight", () => {
    expect(movementRegionsForStage("active")).toEqual(["shoulder", "arm"]);
    expect(movementRegionsForStage("retired")).toEqual(["shoulder", "arm", "hip", "knee", "ankle"]);
    expect(movementRegionsForStage("future")).toEqual([]);
  });

  it("maps each offered task to its intended primary and related body regions", () => {
    expect(primaryMovementRegion("shoulder_mobility")).toBe("shoulder");
    expect(primaryMovementRegion("reach_and_return")).toBe("arm");
    expect(primaryMovementRegion("sit_to_stand")).toBe("knee");
    expect(primaryMovementRegion("single_leg_balance")).toBe("ankle");
    expect(MOVEMENT_TASK_REGIONS.sit_to_stand).toEqual(["hip", "knee", "leg-muscle", "spine"]);
  });

  it("restores the newest saved session for a region", () => {
    const older = check("sit_to_stand", "2026-01-01T00:00:00.000Z");
    const newer = check("sit_to_stand", "2026-02-01T00:00:00.000Z");
    expect(latestMovementForRegion([older, newer, check("shoulder_mobility", "2026-03-01T00:00:00.000Z")], "knee")).toBe(newer);
  });
});
