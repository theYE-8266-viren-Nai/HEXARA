import type { LifeStage } from "../types/horizon";
import type { BodyRegionId } from "./bodyRegions";
import type { VisualCheck, VisualCheckType } from "./visualCheck";

export type BodyLayer = "signals" | "movement";
export type MovementBodyRegionId = "shoulder" | "arm" | "hip" | "knee" | "ankle";
export type OfferedMovementType = Exclude<VisualCheckType, "standing_posture">;

export const MOVEMENT_REGION_TASK: Record<MovementBodyRegionId, OfferedMovementType> = {
  shoulder: "shoulder_mobility",
  arm: "reach_and_return",
  hip: "sit_to_stand",
  knee: "sit_to_stand",
  ankle: "single_leg_balance",
};

export const MOVEMENT_TASK_REGIONS: Record<OfferedMovementType, readonly BodyRegionId[]> = {
  shoulder_mobility: ["shoulder", "arm", "back"],
  reach_and_return: ["arm", "shoulder", "chest"],
  sit_to_stand: ["hip", "knee", "legs", "back"],
  single_leg_balance: ["ankle", "knee", "hip", "back"],
};

export const movementRegionsForStage = (stage: LifeStage): MovementBodyRegionId[] =>
  stage === "active" ? ["shoulder", "arm"] : stage === "retired" ? ["shoulder", "arm", "hip", "knee", "ankle"] : [];

export const primaryMovementRegion = (task: VisualCheckType): MovementBodyRegionId => {
  switch (task) {
    case "reach_and_return": return "arm";
    case "single_leg_balance": return "ankle";
    case "sit_to_stand": return "knee";
    default: return "shoulder";
  }
};

export const latestMovementForRegion = (checks: VisualCheck[], region: MovementBodyRegionId): VisualCheck | undefined => {
  const task = MOVEMENT_REGION_TASK[region];
  return checks.filter((check) => check.checkType === task).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
};

export const isMovementRegion = (region: BodyRegionId | null | undefined): region is MovementBodyRegionId =>
  Boolean(region && region in MOVEMENT_REGION_TASK);
