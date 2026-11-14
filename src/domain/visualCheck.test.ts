import { describe, expect, it } from "vitest";
import {
  tasksForStage, taskInstructions, ANCHOR_NOTE, IN_ORBIT_TASK_TYPES,
  VISUAL_CHECK_DISCLAIMER, VISUAL_CHECK_TASKS, assessCameraQuality, buildVisualCheck, combinedContextNote, compareWithPersonalHistory, composeCrewSummary, extractMovementFeatures,
  frameStats, generateSyntheticFeatures, isNonDiagnostic, ownerKeyFor, supportRecommendationFor, taskFor, type MotionSample, type ObservedFeatures, type UserReportedContext, type VisualCheck,
} from "./visualCheck";
import { toVisualCheckRow } from "../lib/visualCheckRepository";

const squat = taskFor("sit_to_stand");
const balance = taskFor("single_leg_balance");
const good = { quality: "good" as const, notes: [] };
const ctx: UserReportedContext = { discomfort: "none", symptoms: "" };

/** Synthetic motion: `reps` up-and-down movements → 2 bursts each. */
function motion(reps: number, seconds = 20, leftShare = 0.5): MotionSample[] {
  const samples: MotionSample[] = [];
  for (let i = 0; i <= seconds * 10; i += 1) {
    const t = i / 10;
    const energy = Math.max(0, Math.sin((t / seconds) * Math.PI * 2 * reps * 2)) * 0.3;
    samples.push({ t, energy, leftEnergy: energy * leftShare });
  }
  return samples;
}

function check(owner: string, features: Partial<ObservedFeatures>, type = squat.type): VisualCheck {
  const base = generateSyntheticFeatures(taskFor(type), 1);
  return buildVisualCheck({ checkId: crypto.randomUUID(), ownerKey: owner, stage: "future", task: taskFor(type), startedAt: "2026-11-01T10:00:00Z", cameraConsent: false, features: { ...base, ...features }, context: ctx, history: [], isSynthetic: true });
}

describe("camera quality", () => {
  it("flags dark and uniform frames as poor", () => {
    const dark = new Uint8ClampedArray(64 * 48 * 4).fill(10);
    const stats = frameStats(dark, 1);
    expect(assessCameraQuality(stats, false).quality).toBe("poor");
  });
  it("warns about portrait orientation", () => {
    const result = assessCameraQuality({ luminance: 120, contrast: 40 }, true);
    expect(result.quality).toBe("limited");
    expect(result.notes.join(" ")).toMatch(/Portrait/);
  });
  it("accepts a well-lit, varied frame", () => {
    expect(assessCameraQuality({ luminance: 120, contrast: 40 }, false)).toEqual({ quality: "good", notes: [] });
  });
});

describe("movement feature extraction", () => {
  it("counts repetitions from motion bursts deterministically", () => {
    const features = extractMovementFeatures(motion(8), squat, good);
    expect(features.repetitionCount).toBe(8);
    expect(features.movementDurationSeconds).toBe(20);
  });
  it("reports left/right differences", () => {
    const features = extractMovementFeatures(motion(5, 20, 0.8), squat, good);
    expect(features.leftRightBalance).toBeCloseTo(0.8);
  });
  it("reports sway instead of repetitions for balance tasks", () => {
    const features = extractMovementFeatures(motion(2, 15), balance, good);
    expect(features.repetitionCount).toBeUndefined();
    expect(features.balanceDeviation).toBeGreaterThan(0);
  });
  it("notes when no movement is visible", () => {
    const still = Array.from({ length: 100 }, (_, i) => ({ t: i / 10, energy: 0, leftEnergy: 0 }));
    expect(extractMovementFeatures(still, squat, good).qualityNotes.join(" ")).toMatch(/No clear movement/);
  });
});

describe("personal comparison", () => {
  it("only uses the same owner's prior sessions of the same task", () => {
    const mine = ownerKeyFor("future", "a");
    const someoneElse = ownerKeyFor("future", "b");
    const history = [check(someoneElse, { movementDurationSeconds: 5, repetitionCount: 2 }), check(ownerKeyFor("active", "a"), { movementDurationSeconds: 5 }), check(mine, { movementDurationSeconds: 20 }, "shoulder_mobility")];
    const summary = compareWithPersonalHistory({ ...generateSyntheticFeatures(squat, 1), movementDurationSeconds: 20 }, squat.type, mine, history);
    expect(summary.trend).toBe("first_session");
    expect(summary.priorSessionsUsed).toBe(0);
  });
  it("describes slower movement neutrally", () => {
    const mine = ownerKeyFor("future", "a");
    const history = [check(mine, { movementDurationSeconds: 18, repetitionCount: 8, pauseCount: 0 }), check(mine, { movementDurationSeconds: 19, repetitionCount: 8, pauseCount: 0 })];
    const summary = compareWithPersonalHistory({ ...generateSyntheticFeatures(squat, 1), movementDurationSeconds: 26, repetitionCount: 8, pauseCount: 0 }, squat.type, mine, history);
    expect(summary.trend).toBe("different");
    expect(summary.statements).toContain("Your movement took longer than your previous practice.");
    expect(summary.statements).toContain("Consider repeating this later under similar conditions.");
  });
  it("reports similar practice", () => {
    const mine = ownerKeyFor("future", "a");
    const history = [check(mine, { movementDurationSeconds: 20, repetitionCount: 8, pauseCount: 0 })];
    const summary = compareWithPersonalHistory({ ...generateSyntheticFeatures(squat, 1), movementDurationSeconds: 21, repetitionCount: 8, pauseCount: 0 }, squat.type, mine, history);
    expect(summary.statements[0]).toBe("Similar to your previous practice.");
  });
});

describe("support and safety language", () => {
  it("directs pain and severe symptoms to the crew medic without interpreting video", () => {
    const comparison = { trend: "similar" as const, statements: [], priorSessionsUsed: 1 };
    expect(supportRecommendationFor({ ...ctx, discomfort: "severe_or_worsening" }, comparison)).toMatch(/contact the crew medic now/);
    expect(supportRecommendationFor({ ...ctx, discomfort: "pain" }, comparison)).toMatch(/does not interpret the video/);
  });
  it("links sleep, stress, and movement changes without naming a condition", () => {
    const note = combinedContextNote({ ...ctx, sleepHours: 5, stress: 4 }, { trend: "different", statements: [], priorSessionsUsed: 2 });
    expect(note).toBe("Your recent sleep, stress, and movement practice changed together. Review the pattern and consider discussing it with a crew medic.");
    expect(combinedContextNote({ ...ctx, sleepHours: 5, stress: 4 }, { trend: "similar", statements: [], priorSessionsUsed: 2 })).toBeUndefined();
  });
  it("never produces diagnostic language across all tasks and contexts", () => {
    const contexts: UserReportedContext[] = [ctx, { ...ctx, discomfort: "pain" }, { ...ctx, discomfort: "severe_or_worsening" }, { discomfort: "mild", sleepHours: 4, stress: 5, energy: 1, exertion: 5, symptoms: "" }];
    for (const task of VISUAL_CHECK_TASKS) for (const context of contexts) for (const seed of [1, 2, 3]) {
      const history = [check(ownerKeyFor("active", "x"), {}, task.type)];
      const result = buildVisualCheck({ checkId: "id", ownerKey: ownerKeyFor("active", "x"), stage: "active", task, startedAt: "2026-11-02T10:00:00Z", cameraConsent: true, features: { ...generateSyntheticFeatures(task, seed), cameraQuality: "limited" }, context, history, isSynthetic: true });
      const text = [...result.observationSummary, ...result.comparisonSummary.statements, result.supportRecommendation, combinedContextNote(context, result.comparisonSummary) ?? "", composeCrewSummary(result, { task: true, symptoms: true, comparison: true, cameraLimits: true, context: true })].join(" ");
      expect(isNonDiagnostic(text)).toBe(true);
      expect(result.disclaimer).toBe(VISUAL_CHECK_DISCLAIMER);
    }
    expect(isNonDiagnostic("You may have a medical condition.")).toBe(false);
  });
});

describe("crew summary and persistence row", () => {
  it("includes only the selected fields and the disclaimer", () => {
    const result = check("future:a", { repetitionCount: 8 });
    const text = composeCrewSummary(result, { task: true, symptoms: false, comparison: false, cameraLimits: false, context: false });
    expect(text).toMatch(/Task: Sit-to-stand/);
    expect(text).not.toMatch(/Reported discomfort/);
    expect(text).toContain(VISUAL_CHECK_DISCLAIMER);
  });
  it("persists derived fields only — no frame, image, or video data", () => {
    const row = toVisualCheckRow(check("future:a", {}), "user-1");
    const serialized = JSON.stringify(row).toLowerCase();
    expect(serialized).not.toMatch(/frame"|image|video|blob|data:/);
    expect(Object.keys(row)).toEqual(["id", "user_id", "owner_key", "check_type", "started_at", "completed_at", "completion_status", "observed_features", "user_reported_context", "comparison_summary", "support_recommendation", "camera_quality", "is_synthetic"]);
  });
});

describe("which Movement tasks each stage is offered", () => {
  it("gives astronauts in space only the tasks that work without gravity", () => {
    const offered = tasksForStage("active").map((task) => task.type);
    expect(offered.sort()).toEqual(["reach_and_return", "shoulder_mobility"]);
    expect(offered.sort()).toEqual([...IN_ORBIT_TASK_TYPES].sort());
    for (const gravityTask of ["sit_to_stand", "standing_posture", "single_leg_balance"]) expect(offered).not.toContain(gravityTask);
  });

  it("gives retired astronauts, who are back on Earth, the full reconditioning set", () => {
    expect(tasksForStage("retired")).toEqual(VISUAL_CHECK_TASKS);
    expect(tasksForStage("retired")).toHaveLength(5);
  });

  it("offers Future travelers nothing", () => {
    expect(tasksForStage("future")).toEqual([]);
  });

  it("adds the anchoring reminder only in space, and keeps the balance task's own safety line on Earth", () => {
    for (const task of tasksForStage("active")) expect(taskInstructions(task, "active")).toBe(`${ANCHOR_NOTE} ${task.instructions}`);
    for (const task of tasksForStage("retired")) expect(taskInstructions(task, "retired")).toBe(task.instructions);
    expect(taskInstructions(taskFor("single_leg_balance"), "retired")).toMatch(/near a support you can hold. Stop if you feel unsteady/);
    expect(isNonDiagnostic(ANCHOR_NOTE)).toBe(true);
  });

  it("still knows every task, so sessions saved earlier can be labelled and shown", () => {
    for (const task of VISUAL_CHECK_TASKS) expect(taskFor(task.type).label.length).toBeGreaterThan(0);
  });
});
