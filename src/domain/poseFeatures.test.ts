import { describe, expect, it } from "vitest";
import { body, squats } from "../test/poseFixtures";
import { LM, angleBetween, assessPoseQuality, countRepetitions, extractPoseFeatures, jointAngleSeries, robustRange, swayIndex, type PoseFrame } from "./poseFeatures";
import { VISUAL_CHECK_TASKS, buildVisualCheck, compareWithPersonalHistory, describeObservations, isNonDiagnostic, taskFor, type ObservedFeatures, type VisualCheck } from "./visualCheck";

const OPTS = { aspect: 1, fps: 10 };
const good = { quality: "good" as const, notes: [] };

const sit = taskFor("sit_to_stand");
const balance = taskFor("single_leg_balance");

describe("angles", () => {
  it("measures right, straight, and acute angles", () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, 1)).toBeCloseTo(90);
    expect(angleBetween({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }, 1)).toBeCloseTo(180);
    expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBeCloseTo(45);
    expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it("reads exact knee angles from a built body and ignores hard-to-see points", () => {
    const series = jointAngleSeries([{ t: 0, landmarks: body({ kneeL: 120, kneeR: 150 }) }], "left_knee", OPTS);
    expect(series[0]).toBeCloseTo(120, 0);
    expect(jointAngleSeries([{ t: 0, landmarks: body({ kneeR: 150 }) }], "right_knee", OPTS)[0]).toBeCloseTo(150, 0);
    const hidden = body(); hidden[LM.lKnee] = { x: 0.46, y: 0.75, visibility: 0.2 };
    expect(jointAngleSeries([{ t: 0, landmarks: hidden }], "left_knee", OPTS)).toEqual([null]);
    expect(jointAngleSeries([{ t: 0, landmarks: [] }], "left_knee", OPTS)).toEqual([null]);
  });

  it("reports a robust range that ignores one noisy frame", () => {
    const series = [...Array.from({ length: 40 }, (_, i) => 100 + (i % 10) * 7), 10];
    const range = robustRange(series)!;
    expect(range.min).toBeGreaterThan(95); expect(range.max).toBeLessThan(170);
    expect(robustRange([1, 2])).toBeNull();
  });
});

describe("repetition counting", () => {
  it("counts the squats actually done", () => {
    for (const cycles of [3, 5, 8]) {
      const reps = countRepetitions(jointAngleSeries(squats(cycles, 20), "left_knee", OPTS), 25);
      expect(reps, `${cycles} cycles`).toBe(cycles);
    }
  });

  it("ignores small tremor and shallow movement", () => {
    expect(countRepetitions(jointAngleSeries(squats(8, 20, 175, 160), "left_knee", OPTS), 25)).toBe(0);
    expect(countRepetitions(Array.from({ length: 200 }, () => 170), 25)).toBe(0);
    expect(countRepetitions([null, null, null], 25)).toBe(0);
  });

  it("survives brief tracking dropouts", () => {
    const series = jointAngleSeries(squats(5, 20), "left_knee", OPTS).map((value, i) => (i % 17 === 0 ? null : value));
    expect(countRepetitions(series, 25)).toBe(5);
  });
});

describe("pose features for a sit-to-stand", () => {
  it("returns reps, duration, ranges, method and no diagnosis words", () => {
    const features = extractPoseFeatures(squats(8, 20), sit, good, OPTS);
    expect(features.method).toBe("pose");
    expect(features.repetitionCount).toBe(8);
    expect(features.movementDurationSeconds).toBe(20);
    expect(features.cameraQuality).toBe("good");
    const knee = features.jointAngleRanges!.left_knee!;
    expect(knee.max - knee.min).toBeGreaterThan(65);
    expect(knee.max).toBeGreaterThan(165);
    expect(features.balanceDeviation).toBeUndefined();
    const lines = describeObservations(features, sit).join(" ");
    expect(lines).toContain("You completed 8 repetitions.");
    expect(lines).toMatch(/Your left knee moved through about \d+° and your right knee about \d+°\./);
    expect(lines).toContain("no video was recorded or saved");
    expect(isNonDiagnostic(lines)).toBe(true);
  });

  it("reports a left/right difference when one knee bends less", () => {
    const features = extractPoseFeatures(squats(6, 20, 175, 95, 135), sit, good, OPTS);
    expect(features.leftRightBalance).toBeGreaterThan(0.6);
    expect(describeObservations(features, sit).join(" ")).toContain("left and right movement ranges were different");
    const even = extractPoseFeatures(squats(6, 20), sit, good, OPTS);
    expect(Math.abs(even.leftRightBalance - 0.5)).toBeLessThan(0.05);
  });

  it("notes when there is no clear repeated movement", () => {
    const still = Array.from({ length: 200 }, (_, i) => ({ t: i / 10, landmarks: body() }));
    const features = extractPoseFeatures(still, sit, good, OPTS);
    expect(features.repetitionCount).toBe(0);
    expect(features.qualityNotes.join(" ")).toMatch(/No clear repeated movement/);
  });

  it("counts pauses of a second or more", () => {
    const frames = squats(4, 20).map((frame, i) => (i >= 60 && i < 90 ? { ...frame, landmarks: body({ kneeL: 175, kneeR: 175 }) } : frame));
    expect(extractPoseFeatures(frames, sit, good, OPTS).pauseCount).toBeGreaterThanOrEqual(1);
    expect(extractPoseFeatures(squats(8, 20), sit, good, OPTS).pauseCount).toBe(0);
  });
});

describe("balance sway", () => {
  const frames = (amplitude: number, jitter = 0): PoseFrame[] => Array.from({ length: 151 }, (_, i) => ({ t: i / 10, landmarks: body({ hipX: amplitude * Math.sin(i / 4) + jitter * ((i * 7919) % 13 - 6) / 6 }) }));

  it("reports more sway when the body moves more, and a steady hold stays small", () => {
    const steady = swayIndex(frames(0.002), 1)!; const swaying = swayIndex(frames(0.03), 1)!;
    expect(steady).toBeLessThan(1.5);
    expect(swaying).toBeGreaterThan(steady * 5);
    expect(swayIndex(frames(0), 1)).toBe(0);
    expect(swayIndex([], 1)).toBeNull();
  });

  it("fills balanceDeviation for a balance task and not repetitions", () => {
    const features = extractPoseFeatures(frames(0.02), balance, good, OPTS);
    expect(features.balanceDeviation).toBeGreaterThan(2);
    expect(features.repetitionCount).toBeUndefined();
    expect(features.pauseCount).toBe(0);
  });
});

describe("tracking quality", () => {
  it("is good for a clear, full-body, always-found check", () => {
    expect(assessPoseQuality(squats(3, 10), 100)).toEqual({ quality: "good", notes: [] });
  });

  it("says so when the person was found for only part of the check", () => {
    const half = squats(3, 10).slice(0, 40);
    expect(assessPoseQuality(half, 100)).toMatchObject({ quality: "poor" });
    expect(assessPoseQuality(squats(3, 10).slice(0, 70), 100)).toMatchObject({ quality: "limited" });
    expect(assessPoseQuality([], 100).quality).toBe("poor");
  });

  it("flags hard-to-see points and a body outside the picture", () => {
    const faint = squats(3, 10).map((frame) => ({ ...frame, landmarks: frame.landmarks.map((l) => ({ ...l, visibility: 0.3 })) }));
    const result = assessPoseQuality(faint, 101);
    expect(result.quality).toBe("poor");
    expect(result.notes.join(" ")).toMatch(/hard to see/);
    const cropped = squats(3, 10).map((frame) => ({ ...frame, landmarks: frame.landmarks.map((l, i) => (i === LM.lAnkle || i === LM.rAnkle ? { ...l, y: 1.05 } : l)) }));
    const outside = assessPoseQuality(cropped, 101);
    expect(outside.quality).toBe("poor");
    expect(outside.notes.join(" ")).toMatch(/outside the picture/);
  });

  it("takes the worse of lighting and tracking quality and keeps both sets of notes", () => {
    const features = extractPoseFeatures(squats(5, 20), sit, { quality: "limited", notes: ["The room looks dark."] }, OPTS);
    expect(features.cameraQuality).toBe("limited");
    expect(features.qualityNotes).toContain("The room looks dark.");
    expect(extractPoseFeatures(squats(5, 20).slice(0, 60), sit, good, OPTS).cameraQuality).toBe("poor");
  });
});

describe("other tasks", () => {
  it("counts shoulder raises from the shoulder angle", () => {
    const frames: PoseFrame[] = Array.from({ length: 151 }, (_, i) => { const phase = (1 - Math.cos((i / 150) * 4 * 2 * Math.PI)) / 2; return { t: i / 10, landmarks: body({ shoulderL: 20 + phase * 140, shoulderR: 20 + phase * 140 }) }; });
    const features = extractPoseFeatures(frames, taskFor("shoulder_mobility"), good, OPTS);
    expect(features.repetitionCount).toBe(4);
    expect(features.jointAngleRanges!.left_shoulder).toBeDefined();
  });

  it("counts reach-and-return from wrist distance from the body centre", () => {
    const frames: PoseFrame[] = Array.from({ length: 151 }, (_, i) => { const phase = (1 - Math.cos((i / 150) * 3 * 2 * Math.PI)) / 2; return { t: i / 10, landmarks: body({ wristReach: 0.05 + phase * 0.3 }) }; });
    const features = extractPoseFeatures(frames, taskFor("reach_and_return"), good, OPTS);
    expect(features.repetitionCount).toBe(3);
  });

  it("every task returns finite, well-formed features for an empty or tiny input", () => {
    for (const task of VISUAL_CHECK_TASKS) for (const frames of [[], [{ t: 0, landmarks: body() }]]) {
      const features = extractPoseFeatures(frames, task, good, OPTS);
      expect(Number.isFinite(features.movementDurationSeconds)).toBe(true);
      expect(features.leftRightBalance).toBe(0.5);
      expect(features.cameraQuality).toBe(frames.length ? features.cameraQuality : "poor");
    }
  });
});

describe("personal comparison with pose data", () => {
  const owner = "future:p1";
  const make = (features: ObservedFeatures): VisualCheck => buildVisualCheck({ checkId: crypto.randomUUID(), ownerKey: owner, stage: "future", task: sit, startedAt: "2026-11-01T10:00:00Z", cameraConsent: true, features, context: { discomfort: "none", symptoms: "" }, history: [], isSynthetic: false });
  const pose = (min: number) => extractPoseFeatures(squats(8, 20, 175, min), sit, good, OPTS);

  it("says range of movement was smaller than recent practice, using only same-method sessions", () => {
    const history = [make(pose(95)), make(pose(95))];
    const smaller = compareWithPersonalHistory(pose(140), "sit_to_stand", owner, history);
    expect(smaller.trend).toBe("different");
    expect(smaller.statements).toContain("Your range of movement was smaller than in your recent practice.");
    expect(compareWithPersonalHistory(pose(95), "sit_to_stand", owner, history).statements[0]).toBe("Similar to your previous practice.");
    const legacy = make({ movementDurationSeconds: 20, leftRightBalance: 0.5, pauseCount: 0, cameraQuality: "good", qualityNotes: [], repetitionCount: 8 });
    expect(compareWithPersonalHistory(pose(140), "sit_to_stand", owner, [legacy, legacy]).statements.join(" ")).not.toMatch(/range of movement/);
  });
});
