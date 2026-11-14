import type { LifeStage } from "../types/horizon";
import type { BodyRegionId } from "./bodyRegions";
import type { VisualCheck, VisualCheckType } from "./visualCheck";

export type BodyLayer = "signals" | "movement";
export type MovementBodyRegionId = "shoulder" | "arm" | "spine" | "hip" | "knee" | "movement_legs" | "ankle";
export type OfferedMovementType = Exclude<VisualCheckType, "standing_posture">;

export const MOVEMENT_REGION_TASK: Record<MovementBodyRegionId, OfferedMovementType> = {
  shoulder: "shoulder_mobility",
  arm: "reach_and_return",
  spine: "sit_to_stand",
  hip: "sit_to_stand",
  knee: "sit_to_stand",
  movement_legs: "sit_to_stand",
  ankle: "single_leg_balance",
};

export const MOVEMENT_TASK_REGIONS: Record<OfferedMovementType, readonly MovementBodyRegionId[]> = {
  shoulder_mobility: ["shoulder", "arm"],
  reach_and_return: ["arm", "shoulder"],
  sit_to_stand: ["spine", "hip", "knee", "movement_legs"],
  anchored_lower_body_flexion: ["spine", "hip", "knee", "movement_legs"],
  single_leg_balance: ["ankle", "knee", "hip", "spine", "movement_legs"],
};

export const movementTaskForRegion = (region: MovementBodyRegionId, stage: LifeStage): OfferedMovementType =>
  stage === "active" && ["spine", "hip", "knee", "movement_legs"].includes(region)
    ? "anchored_lower_body_flexion"
    : MOVEMENT_REGION_TASK[region];

export const movementRegionsForStage = (stage: LifeStage): MovementBodyRegionId[] =>
  stage === "active" ? ["shoulder", "arm", "spine", "hip", "knee", "movement_legs"] : stage === "retired" ? ["shoulder", "arm", "spine", "hip", "knee", "movement_legs", "ankle"] : [];

export const movementRegionsForTask = (task: VisualCheckType): MovementBodyRegionId[] =>
  task === "standing_posture" ? [] : [...MOVEMENT_TASK_REGIONS[task]];

export const primaryMovementRegion = (task: VisualCheckType): MovementBodyRegionId => {
  switch (task) {
    case "reach_and_return": return "arm";
    case "single_leg_balance": return "ankle";
    case "sit_to_stand": return "spine";
    case "anchored_lower_body_flexion": return "spine";
    default: return "shoulder";
  }
};

export const latestMovementForRegion = (checks: VisualCheck[], region: MovementBodyRegionId, task = MOVEMENT_REGION_TASK[region]): VisualCheck | undefined => {
  return checks.filter((check) => check.checkType === task).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
};

export const isMovementRegion = (region: BodyRegionId | null | undefined): region is MovementBodyRegionId =>
  Boolean(region && region in MOVEMENT_REGION_TASK);
