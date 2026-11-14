/**
 * OrbitWell Visual Check — non-diagnostic movement practice contract.
 *
 * This module is the single home for visual-check rules:
 *  - typed results produced by camera processing or the synthetic demo mode;
 *  - deterministic feature extraction from per-frame motion samples (no pose AI);
 *  - comparison against the SAME traveler's previous sessions only;
 *  - neutral support wording and a crew-summary composer.
 *
 * Camera observations are practice context. They never produce a diagnosis,
 * probability, clearance, or emergency classification.
 */
import type { LifeStage } from "../types/horizon";
import { mulberry32 } from "../lib/prng";
import type { JointName } from "./poseFeatures";

export const VISUAL_CHECK_DISCLAIMER = "Camera observations are experimental movement context only. They are not medical measurements, diagnosis, injury prediction, or flight clearance.";

export type VisualCheckType = "standing_posture" | "shoulder_mobility" | "sit_to_stand" | "anchored_lower_body_flexion" | "single_leg_balance" | "reach_and_return";
export type VisualWorkflow = "movement_exercise" | "sensorimotor" | "recovery_context";
export type CompletionStatus = "completed" | "partial" | "not_assessable";
export type CameraQuality = "good" | "limited" | "poor";
export type ComparisonTrend = "first_session" | "similar" | "different";

export interface VisualCheckTask { type: VisualCheckType; label: string; workflow: VisualWorkflow; durationSeconds: number; repetitive: boolean; instructions: string; }

/** Said before every task: without gravity, an unanchored arm movement turns the whole body. */
export const ANCHOR_NOTE = "Anchor your feet in a foot restraint or hold a handrail first, so you do not drift.";

export const VISUAL_CHECK_TASKS: VisualCheckTask[] = [
  { type: "sit_to_stand", label: "Sit-to-stand", workflow: "movement_exercise", durationSeconds: 20, repetitive: true, instructions: "Stand up from a stable chair and sit down at a steady, comfortable pace." },
  { type: "anchored_lower_body_flexion", label: "Anchored lower-body flexion", workflow: "movement_exercise", durationSeconds: 20, repetitive: true, instructions: "With your feet secured, slowly bend and extend your hips and knees while holding a handrail." },
  { type: "shoulder_mobility", label: "Shoulder mobility", workflow: "movement_exercise", durationSeconds: 15, repetitive: true, instructions: "Raise both arms overhead and lower them slowly, keeping the movement even." },
  { type: "standing_posture", label: "Standing posture", workflow: "movement_exercise", durationSeconds: 10, repetitive: false, instructions: "Stand tall and still, facing the camera, with arms relaxed." },
  { type: "single_leg_balance", label: "Single-leg balance", workflow: "sensorimotor", durationSeconds: 15, repetitive: false, instructions: "Stand on one leg near a support you can hold. Stop if you feel unsteady." },
  { type: "reach_and_return", label: "Reach-and-return coordination", workflow: "sensorimotor", durationSeconds: 15, repetitive: true, instructions: "Reach forward to one side, return to centre, then reach to the other side." },
];

export const taskFor = (type: VisualCheckType) => VISUAL_CHECK_TASKS.find((task) => task.type === type)!;

/**
 * Where the person is decides what is sensible. In weightlessness standing up, standing still and balancing on one leg
 * mean nothing, so Active astronauts get only the tasks that work without gravity. Retired astronauts are back on Earth
 * and get the full set as reconditioning practice. Future travelers can use the same simple practice set.
 */
export const IN_ORBIT_TASK_TYPES: VisualCheckType[] = ["shoulder_mobility", "anchored_lower_body_flexion", "reach_and_return"];
export const RETIRED_TASK_TYPES: VisualCheckType[] = ["shoulder_mobility", "reach_and_return", "sit_to_stand", "single_leg_balance"];

export const tasksForStage = (stage: LifeStage): VisualCheckTask[] => (stage === "active" ? VISUAL_CHECK_TASKS.filter((task) => IN_ORBIT_TASK_TYPES.includes(task.type)) : VISUAL_CHECK_TASKS.filter((task) => RETIRED_TASK_TYPES.includes(task.type)));

/** The instructions to show, with the anchoring reminder added for astronauts in space. */
export const taskInstructions = (task: VisualCheckTask, stage: LifeStage): string => (stage === "active" ? `${ANCHOR_NOTE} ${task.instructions}` : task.instructions);

/** Derived, non-identifying features only. No frames, images, or video are ever stored. */
export interface ObservedFeatures {
  repetitionCount?: number;
  movementDurationSeconds: number;
  /** 0–1 share of motion in the left half of the frame; 0.5 means even. */
  leftRightBalance: number;
  /** Relative sway for stillness/balance tasks; lower is steadier. Unitless. */
  balanceDeviation?: number;
  pauseCount: number;
  cameraQuality: CameraQuality;
  qualityNotes: string[];
  /** How the numbers were produced. Missing means the older motion-based or synthetic path. Only same-method sessions are compared for balance and range. */
  method?: "pose" | "motion";
  /** Approximate joint-angle ranges in degrees (5th to 95th percentile), from body tracking on this device. */
  jointAngleRanges?: Partial<Record<JointName, { min: number; max: number }>>;
}

export interface UserReportedContext {
  exertion?: number; // 1–5 self-rated
  discomfort: "none" | "mild" | "pain" | "severe_or_worsening";
  steadiness?: "steady" | "slightly_unsteady" | "very_unsteady";
  /** Retained for older saved records; the movement form no longer asks for these wellbeing fields. */
  sleepHours?: number;
  stress?: number; // 1–5
  energy?: number; // 1–5
  symptoms: string;
}

export interface ComparisonSummary { trend: ComparisonTrend; statements: string[]; priorSessionsUsed: number; }

export interface VisualCheck {
  checkId: string;
  ownerKey: string; // stage + profile; history never crosses owners
  stage: LifeStage;
  checkType: VisualCheckType;
  startedAt: string;
  duration: number;
  cameraConsent: boolean;
  completionStatus: CompletionStatus;
  observedFeatures: ObservedFeatures;
  userReportedSymptoms: UserReportedContext;
  comparisonSummary: ComparisonSummary;
  observationSummary: string[];
  supportRecommendation: string;
  disclaimer: typeof VISUAL_CHECK_DISCLAIMER;
  isSynthetic: boolean;
}

export const ownerKeyFor = (stage: LifeStage, profileId: string) => `${stage}:${profileId}`;

/* ---------- Camera quality ---------- */

/** Average luminance (0–255) and contrast (std-dev) of a sampled RGBA frame. */
export function frameStats(rgba: ArrayLike<number>, step = 16) {
  let sum = 0; let sumSq = 0; let n = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4 * step) {
    const y = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    sum += y; sumSq += y * y; n += 1;
  }
  const mean = n ? sum / n : 0;
  return { luminance: mean, contrast: n ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 0 };
}

export function assessCameraQuality(stats: { luminance: number; contrast: number }, portrait: boolean): { quality: CameraQuality; notes: string[] } {
  const notes: string[] = [];
  if (stats.luminance < 45) notes.push("The room looks dark. Add light in front of you.");
  else if (stats.luminance > 225) notes.push("The image looks washed out. Reduce bright light behind or near the camera.");
  if (stats.contrast < 12) notes.push("The scene looks very uniform; you may not be fully in frame.");
  if (portrait) notes.push("Portrait orientation may crop your arms or legs. Landscape usually frames the whole body better.");
  const severe = stats.luminance < 25 || stats.contrast < 6;
  return { quality: severe ? "poor" : notes.length ? "limited" : "good", notes };
}

/* ---------- Deterministic movement features from motion samples ---------- */

/** One sample per analysed frame: total motion energy and how much of it sat on the left half. */
export interface MotionSample { t: number; energy: number; leftEnergy: number; }

/**
 * Count repetitions as rising crossings of a hysteresis band around the median
 * motion energy, count pauses as ≥1 s stretches of near-zero motion, and use
 * motion variance as a sway proxy for still/balance tasks.
 */
export function extractMovementFeatures(samples: MotionSample[], task: VisualCheckTask, quality: { quality: CameraQuality; notes: string[] }): ObservedFeatures {
  const qualityNotes = [...quality.notes];
  const duration = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  const energies = samples.map((s) => s.energy);
  const sorted = [...energies].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const peak = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const high = median + (peak - median) * 0.5;
  const low = median + (peak - median) * 0.2;
  let reps = 0; let above = false;
  for (const e of energies) {
    if (!above && e > high && peak > 0) { reps += 1; above = true; }
    else if (above && e < low) above = false;
  }
  // Each up-and-down repetition typically produces two motion bursts.
  const repetitionCount = task.repetitive ? Math.round(reps / 2) : undefined;

  const stillThreshold = Math.max(peak * 0.08, 0.002);
  let pauses = 0; let stillStart: number | null = null;
  for (const s of samples) {
    if (s.energy < stillThreshold) { stillStart ??= s.t; }
    else { if (stillStart !== null && s.t - stillStart >= 1) pauses += 1; stillStart = null; }
  }

  const total = samples.reduce((acc, s) => acc + s.energy, 0);
  const left = samples.reduce((acc, s) => acc + s.leftEnergy, 0);
  const leftRightBalance = total > 0 ? left / total : 0.5;

  const mean = total / Math.max(1, samples.length);
  const variance = energies.reduce((acc, e) => acc + (e - mean) ** 2, 0) / Math.max(1, samples.length);
  const balanceDeviation = task.repetitive ? undefined : Number((Math.sqrt(variance) * 100).toFixed(2));

  if (samples.length < 10) qualityNotes.push("Too few frames were captured to assess the full movement.");
  if (task.repetitive && peak === 0) qualityNotes.push("No clear movement was detected. Check that your whole body is visible.");

  return { repetitionCount, movementDurationSeconds: Number(duration.toFixed(1)), leftRightBalance: Number(leftRightBalance.toFixed(2)), balanceDeviation, pauseCount: task.repetitive ? pauses : 0, cameraQuality: quality.quality, qualityNotes };
}

/* ---------- Synthetic demo mode ---------- */

/** Clearly labelled generated features for browsers without a camera. Deterministic per seed. */
export function generateSyntheticFeatures(task: VisualCheckTask, seed: number): ObservedFeatures {
  const rand = mulberry32(seed * 31 + task.type.length);
  return {
    repetitionCount: task.repetitive ? 6 + Math.floor(rand() * 5) : undefined,
    movementDurationSeconds: Number((task.durationSeconds * (0.85 + rand() * 0.3)).toFixed(1)),
    leftRightBalance: Number((0.4 + rand() * 0.2).toFixed(2)),
    balanceDeviation: task.repetitive ? undefined : Number((1 + rand() * 3).toFixed(2)),
    pauseCount: task.repetitive ? Math.floor(rand() * 3) : 0,
    cameraQuality: "good",
    qualityNotes: ["Synthetic demo result — generated, not observed by a camera."],
  };
}

/* ---------- Personal comparison ---------- */

const pct = (a: number, b: number) => (b === 0 ? 0 : (a - b) / b);
const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Compare with the same owner's previous sessions of the same task only.
 * There is no population norm and no cross-user comparison.
 */
/** Average range (degrees) across the tracked joints, or null when none were tracked. */
function totalRange(features: ObservedFeatures): number | null {
  const spans = Object.values(features.jointAngleRanges ?? {}).map((range) => range.max - range.min);
  return spans.length ? avg(spans) : null;
}

export function compareWithPersonalHistory(current: ObservedFeatures, checkType: VisualCheckType, ownerKey: string, history: VisualCheck[]): ComparisonSummary {
  const prior = history.filter((check) => check.ownerKey === ownerKey && check.checkType === checkType && check.completionStatus !== "not_assessable").slice(-5);
  const statements: string[] = [];
  if (current.cameraQuality !== "good") statements.push("The result may be affected by camera angle or lighting.");
  if (!prior.length) return { trend: "first_session", priorSessionsUsed: 0, statements: ["This is your first practice of this task, so there is nothing to compare yet.", ...statements] };

  let different = false;
  const durationChange = pct(current.movementDurationSeconds, avg(prior.map((p) => p.observedFeatures.movementDurationSeconds)));
  if (durationChange > 0.2) { different = true; statements.push("Your movement took longer than your previous practice."); }
  else if (durationChange < -0.2) { different = true; statements.push("Your movement was quicker than your previous practice."); }

  const priorReps = prior.map((p) => p.observedFeatures.repetitionCount).filter((v): v is number => v !== undefined);
  if (current.repetitionCount !== undefined && priorReps.length) {
    const change = current.repetitionCount - avg(priorReps);
    if (Math.abs(change) >= 2) { different = true; statements.push(`You completed ${change < 0 ? "fewer" : "more"} repetitions than your recent pattern.`); }
  }
  const priorSway = prior.filter((p) => (p.observedFeatures.method ?? "motion") === (current.method ?? "motion")).map((p) => p.observedFeatures.balanceDeviation).filter((v): v is number => v !== undefined);
  if (current.balanceDeviation !== undefined && priorSway.length && pct(current.balanceDeviation, avg(priorSway)) > 0.3) {
    different = true; statements.push("There was more visible sway than in your recent practice.");
  }
  // Range of movement: only against earlier sessions tracked the same way.
  const priorRanges = prior.filter((p) => (p.observedFeatures.method ?? "motion") === (current.method ?? "motion")).map((p) => totalRange(p.observedFeatures)).filter((v): v is number => v !== null);
  const currentRange = totalRange(current);
  if (currentRange !== null && priorRanges.length) {
    const change = currentRange - avg(priorRanges);
    if (Math.abs(change) >= 15) { different = true; statements.push(change < 0 ? "Your range of movement was smaller than in your recent practice." : "Your range of movement was larger than in your recent practice."); }
  }
  if (current.pauseCount > avg(prior.map((p) => p.observedFeatures.pauseCount)) + 1) { different = true; statements.push("You paused more often than in your recent practice."); }

  statements.unshift(different ? "Different from your recent pattern." : "Similar to your previous practice.");
  if (different) statements.push("Consider repeating this later under similar conditions.");
  return { trend: different ? "different" : "similar", priorSessionsUsed: prior.length, statements };
}

/* ---------- Observation summary and support ---------- */

export function completionFor(features: ObservedFeatures, task: VisualCheckTask): CompletionStatus {
  if (features.cameraQuality === "poor") return "not_assessable";
  if (features.movementDurationSeconds < task.durationSeconds * 0.5) return "partial";
  if (task.repetitive && !features.repetitionCount) return "partial";
  return "completed";
}

/** The left/right range to quote in words: the task's main joint pair, when both sides were tracked. */
function rangePair(features: ObservedFeatures, task: VisualCheckTask): { noun: string; left: number; right: number } | null {
  const ranges = features.jointAngleRanges;
  if (!ranges) return null;
  const arms = task.type === "shoulder_mobility" || task.type === "reach_and_return";
  const left = ranges[arms ? "left_shoulder" : "left_knee"]; const right = ranges[arms ? "right_shoulder" : "right_knee"];
  return left && right ? { noun: arms ? "shoulder" : "knee", left: left.max - left.min, right: right.max - right.min } : null;
}

export function describeObservations(features: ObservedFeatures, task: VisualCheckTask): string[] {
  const lines: string[] = [];
  if (features.repetitionCount !== undefined) lines.push(`You completed ${features.repetitionCount} repetition${features.repetitionCount === 1 ? "" : "s"}.`);
  if (features.method === "pose") lines.push("Body points were tracked on your device; no video was recorded or saved.");
  lines.push(`The ${task.label.toLowerCase()} lasted about ${Math.round(features.movementDurationSeconds)} seconds.`);
  const pair = rangePair(features, task);
  if (pair) lines.push(`Your left ${pair.noun} moved through about ${pair.left}° and your right ${pair.noun} about ${pair.right}°.`);
  if (Math.abs(features.leftRightBalance - 0.5) > 0.12) lines.push("Your left and right movement ranges were different during this session.");
  if (features.pauseCount > 0) lines.push(`There ${features.pauseCount === 1 ? "was 1 pause" : `were ${features.pauseCount} pauses`} during the movement.`);
  if (features.cameraQuality !== "good") lines.push("The camera angle or lighting made part of the movement difficult to assess.");
  lines.push("This is a practice comparison, not a medical finding.");
  return lines;
}

/**
 * Support wording. Reported pain or severe/worsening symptoms always go to the
 * crew medic and the video is not interpreted.
 */
export function supportRecommendationFor(context: UserReportedContext, comparison: ComparisonSummary): string {
  if (context.discomfort === "severe_or_worsening") return "You reported severe or worsening symptoms. Stop the practice and contact the crew medic now. OrbitWell does not interpret the video for symptoms.";
  if (context.discomfort === "pain") return "You reported pain. Stop this movement and tell the crew medic. OrbitWell does not interpret the video for pain.";
  if (context.steadiness === "very_unsteady") return "You reported feeling very unsteady. Stop the practice and contact your approved support person. OrbitWell does not assess balance or injury.";
  if (comparison.trend === "different") return "Tell the crew medic if this change is persistent, worsening, or concerning.";
  return "Keep practising under similar conditions so your personal comparison stays meaningful.";
}

/**
 * Combine movement self-report with the camera-derived comparison.
 * Returns a neutral practice note, never a condition or health score.
 */
export function combinedContextNote(context: UserReportedContext, comparison: ComparisonSummary): string | undefined {
  const signals = [
    context.exertion !== undefined && `effort ${context.exertion}/5`,
    context.steadiness === "slightly_unsteady" && "some unsteadiness",
    context.steadiness === "very_unsteady" && "marked unsteadiness",
    context.discomfort === "mild" && "mild discomfort",
    comparison.trend === "different" && "a difference from earlier practice",
  ].filter(Boolean) as string[];
  if (!signals.length) return undefined;
  return `Your movement notes include ${signals.join(", ")}. This is context for your own practice, not a medical finding.`;
}

/* ---------- Language guard ---------- */

const DISALLOWED = [/\bdiagnos/i, /\bprobability\b/i, /\bbone[- ]density estimate/i, /blood clot detected/i, /\bcleared for flight\b/i, /\bmedical condition\b/i, /\bemergency\b/i, /\bdisease\b/i, /\bSANS\b/];

/** True when generated text avoids diagnostic or clearance language. Used in tests and as a runtime check. */
export function isNonDiagnostic(text: string) {
  return !DISALLOWED.some((pattern) => pattern.test(text.replace(VISUAL_CHECK_DISCLAIMER, "")));
}

/* ---------- Crew communication summary ---------- */

export interface CrewSummaryFields { task: boolean; symptoms: boolean; comparison: boolean; cameraLimits: boolean; context: boolean; }

export function composeCrewSummary(check: VisualCheck, fields: CrewSummaryFields): string {
  const task = taskFor(check.checkType);
  const lines = [`OrbitWell practice summary — ${new Date(check.startedAt).toLocaleDateString()}`];
  if (fields.task) lines.push(`Task: ${task.label} (${check.completionStatus.replace("_", " ")}).`);
  if (fields.symptoms) lines.push(`Reported discomfort: ${check.userReportedSymptoms.discomfort.replace(/_/g, " ")}.${check.userReportedSymptoms.symptoms ? ` Notes: ${check.userReportedSymptoms.symptoms}` : ""}`);
  if (fields.comparison) lines.push(`Compared with my previous practice: ${check.comparisonSummary.statements.join(" ")}`);
  if (fields.cameraLimits) lines.push(`Camera quality: ${check.observedFeatures.cameraQuality}.${check.observedFeatures.qualityNotes.length ? ` ${check.observedFeatures.qualityNotes.join(" ")}` : ""}`);
  if (fields.context) {
    const c = check.userReportedSymptoms;
    lines.push(`Movement context: comfort ${c.discomfort.replace(/_/g, " ")}, effort ${c.exertion ?? "not given"}/5, steadiness ${c.steadiness?.replace(/_/g, " ") ?? "not given"}.`);
  }
  if (check.isSynthetic) lines.push("Synthetic demo data.");
  lines.push(VISUAL_CHECK_DISCLAIMER);
  return lines.join("\n");
}

function describeSelfReportedContext(context: UserReportedContext): string[] {
  const lines: string[] = [];
  if (context.exertion !== undefined) lines.push(`You marked the effort as ${context.exertion} out of 5.`);
  if (context.steadiness) lines.push(`You marked your steadiness as ${context.steadiness.replace(/_/g, " ")}.`);
  if (context.discomfort !== "none") lines.push(`You marked comfort as ${context.discomfort.replace(/_/g, " ")}.`);
  return lines;
}

/* ---------- Assembly ---------- */

export function buildVisualCheck(input: { checkId: string; ownerKey: string; stage: LifeStage; task: VisualCheckTask; startedAt: string; cameraConsent: boolean; features: ObservedFeatures; context: UserReportedContext; history: VisualCheck[]; isSynthetic: boolean }): VisualCheck {
  const comparison = compareWithPersonalHistory(input.features, input.task.type, input.ownerKey, input.history);
  return {
    checkId: input.checkId,
    ownerKey: input.ownerKey,
    stage: input.stage,
    checkType: input.task.type,
    startedAt: input.startedAt,
    duration: input.features.movementDurationSeconds,
    cameraConsent: input.cameraConsent,
    completionStatus: completionFor(input.features, input.task),
    observedFeatures: input.features,
    userReportedSymptoms: input.context,
    comparisonSummary: comparison,
    observationSummary: [...describeObservations(input.features, input.task), ...describeSelfReportedContext(input.context)],
    supportRecommendation: supportRecommendationFor(input.context, comparison),
    disclaimer: VISUAL_CHECK_DISCLAIMER,
    isSynthetic: input.isSynthetic,
  };
}
