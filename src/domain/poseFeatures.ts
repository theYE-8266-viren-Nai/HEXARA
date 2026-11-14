/**
 * Turns body landmarks (from any pose tracker) into plain movement measurements for practice:
 * joint angles, repetition counts, left/right range, balance sway, pauses, and camera quality.
 *
 * Pure and deterministic. It never produces a diagnosis; landmarks are reduced to numbers
 * immediately and never stored. Landmark indices follow MediaPipe Pose (33 points).
 * Research-demo data only.
 */
import type { CameraQuality, ObservedFeatures, VisualCheckTask } from "./visualCheck";

export interface Landmark { x: number; y: number; z?: number; visibility?: number }
/** One tracked frame. `t` is seconds from the start of the check. */
export interface PoseFrame { t: number; landmarks: Landmark[] }

export const LM = { lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28 } as const;
export type JointName = "left_knee" | "right_knee" | "left_hip" | "right_hip" | "left_shoulder" | "right_shoulder" | "left_elbow" | "right_elbow";
export interface JointRange { min: number; max: number }

const JOINTS: Record<JointName, [number, number, number]> = {
  left_knee: [LM.lHip, LM.lKnee, LM.lAnkle], right_knee: [LM.rHip, LM.rKnee, LM.rAnkle],
  left_hip: [LM.lShoulder, LM.lHip, LM.lKnee], right_hip: [LM.rShoulder, LM.rHip, LM.rKnee],
  left_shoulder: [LM.lElbow, LM.lShoulder, LM.lHip], right_shoulder: [LM.rElbow, LM.rShoulder, LM.rHip],
  left_elbow: [LM.lShoulder, LM.lElbow, LM.lWrist], right_elbow: [LM.rShoulder, LM.rElbow, LM.rWrist],
};

const KEY_POINTS: number[] = [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle];
const MIN_VISIBILITY = 0.5;
/** Video is wider than tall; without this, angles measured on 0-1 coordinates would be stretched. */
export const DEFAULT_ASPECT = 4 / 3;

export interface PoseOptions { aspect?: number; fps?: number }

/** The joints worth reporting for each task. */
export function relevantJoints(task: VisualCheckTask): JointName[] {
  switch (task.type) {
    case "sit_to_stand":
    case "anchored_lower_body_flexion": return ["left_knee", "right_knee", "left_hip", "right_hip"];
    case "shoulder_mobility": return ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow"];
    case "reach_and_return": return ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow"];
    case "single_leg_balance": return ["left_knee", "right_knee"];
    default: return ["left_hip", "right_hip"];
  }
}

/** The pair of joints whose range is compared left against right, for each task. */
function primaryPair(task: VisualCheckTask): [JointName, JointName] {
  return task.type === "shoulder_mobility" || task.type === "reach_and_return" ? ["left_shoulder", "right_shoulder"] : ["left_knee", "right_knee"];
}

/** Angle at `b` between `a` and `c`, in degrees (0-180). Returns null for degenerate input. */
export function angleBetween(a: Landmark, b: Landmark, c: Landmark, aspect = DEFAULT_ASPECT): number | null {
  const v1 = [(a.x - b.x) * aspect, a.y - b.y];
  const v2 = [(c.x - b.x) * aspect, c.y - b.y];
  const n1 = Math.hypot(v1[0], v1[1]); const n2 = Math.hypot(v2[0], v2[1]);
  if (n1 < 1e-6 || n2 < 1e-6) return null;
  const cos = Math.min(1, Math.max(-1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const visible = (landmark: Landmark | undefined) => Boolean(landmark) && (landmark!.visibility ?? 1) >= MIN_VISIBILITY && Number.isFinite(landmark!.x) && Number.isFinite(landmark!.y);

/** One angle per frame; null where a needed landmark is missing or hard to see. */
export function jointAngleSeries(frames: PoseFrame[], joint: JointName, options: PoseOptions = {}): Array<number | null> {
  const [i, j, k] = JOINTS[joint];
  return frames.map(({ landmarks }) => (visible(landmarks[i]) && visible(landmarks[j]) && visible(landmarks[k]) ? angleBetween(landmarks[i], landmarks[j], landmarks[k], options.aspect ?? DEFAULT_ASPECT) : null));
}

const numbers = (series: Array<number | null>) => series.filter((value): value is number => value !== null);
function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index); const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Robust range: 5th to 95th percentile, so one noisy frame does not define the movement. */
export function robustRange(series: Array<number | null>): JointRange | null {
  const values = numbers(series);
  if (values.length < 5) return null;
  return { min: Math.round(percentile(values, 0.05)), max: Math.round(percentile(values, 0.95)) };
}

/** Fills short gaps by carrying the last value, then smooths with a small moving average. */
export function smoothSeries(series: Array<number | null>, window = 5): number[] {
  const filled: number[] = []; let last: number | null = null;
  for (const value of series) { if (value !== null) last = value; filled.push(last ?? NaN); }
  const first = filled.find((value) => !Number.isNaN(value));
  const base = filled.map((value) => (Number.isNaN(value) ? first ?? 0 : value));
  const half = Math.floor(window / 2);
  return base.map((_, i) => { const slice = base.slice(Math.max(0, i - half), i + half + 1); return slice.reduce((a, b) => a + b, 0) / slice.length; });
}

/**
 * Counts repetitions as moves between a "high" and a "low" zone of a smoothed signal, two moves per repetition, so it works
 * whether the person starts standing, seated, arms down or arms up. Zones sit at 30% and 70% of the person's own robust
 * range (hysteresis), so small tremor is ignored. A final single move counts as a repetition (stand up from seated = 1).
 * Movements smaller than `minRange` count as none.
 */
export function countRepetitions(series: Array<number | null>, minRange: number): number {
  if (numbers(series).length < 5) return 0;
  const smooth = smoothSeries(series);
  const low = percentile(smooth, 0.1); const high = percentile(smooth, 0.9);
  if (high - low < minRange) return 0;
  const upper = low + 0.7 * (high - low); const lower = low + 0.3 * (high - low);
  let zone: "high" | "low" | null = null; let moves = 0;
  for (const value of smooth) {
    const next: "high" | "low" | null = value >= upper ? "high" : value <= lower ? "low" : zone;
    if (zone !== null && next !== null && next !== zone) moves += 1;
    zone = next;
  }
  return Math.ceil(moves / 2);
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const std = (values: number[]) => { const m = mean(values); return Math.sqrt(mean(values.map((v) => (v - m) ** 2))); };

/** Mean of left and right when both exist, else whichever exists, per frame. */
function combine(left: Array<number | null>, right: Array<number | null>): Array<number | null> {
  return left.map((value, i) => (value !== null && right[i] !== null ? (value + right[i]!) / 2 : value ?? right[i]));
}

/** Sway of the hip midpoint across the check, as a percent of torso length. Lower is steadier. */
export function swayIndex(frames: PoseFrame[], aspect = DEFAULT_ASPECT): number | null {
  const xs: number[] = []; const torso: number[] = [];
  for (const { landmarks } of frames) {
    const parts = [landmarks[LM.lHip], landmarks[LM.rHip], landmarks[LM.lShoulder], landmarks[LM.rShoulder]];
    if (!parts.every(visible)) continue;
    const hipX = (landmarks[LM.lHip].x + landmarks[LM.rHip].x) / 2; const hipY = (landmarks[LM.lHip].y + landmarks[LM.rHip].y) / 2;
    const shX = (landmarks[LM.lShoulder].x + landmarks[LM.rShoulder].x) / 2; const shY = (landmarks[LM.lShoulder].y + landmarks[LM.rShoulder].y) / 2;
    const length = Math.hypot((hipX - shX) * aspect, hipY - shY);
    if (length < 1e-6) continue;
    xs.push(hipX * aspect); torso.push(length);
  }
  if (xs.length < 5) return null;
  return Math.round((std(xs) / mean(torso)) * 10000) / 100;
}

/** Overall tracking quality: how often the person was found, how visible the key points were, and whether they stayed in frame. */
export function assessPoseQuality(frames: PoseFrame[], expectedFrames: number): { quality: CameraQuality; notes: string[] } {
  const notes: string[] = [];
  if (!frames.length) return { quality: "poor", notes: ["No body was found by the camera. Step back so your whole body is in frame."] };
  const found = frames.length / Math.max(expectedFrames, 1);
  const visibility = mean(frames.flatMap(({ landmarks }) => KEY_POINTS.map((index) => landmarks[index]?.visibility ?? 0)));
  const inFrame = frames.filter(({ landmarks }) => KEY_POINTS.every((index) => landmarks[index] && landmarks[index].x > 0.02 && landmarks[index].x < 0.98 && landmarks[index].y > 0.02 && landmarks[index].y < 0.98)).length / frames.length;
  let quality: CameraQuality = "good";
  if (found < 0.5) { quality = "poor"; notes.push("The camera lost track of you for much of the check."); }
  else if (found < 0.8) { quality = "limited"; notes.push("The camera lost track of you for part of the check."); }
  if (visibility < 0.5) { quality = "poor"; notes.push("Many body points were hard to see. Try better light and a plainer background."); }
  else if (visibility < 0.75) { if (quality === "good") quality = "limited"; notes.push("Some body points were hard to see."); }
  if (inFrame < 0.5) { quality = "poor"; notes.push("Part of your body was outside the picture. Step back so your whole body fits."); }
  else if (inFrame < 0.85) { if (quality === "good") quality = "limited"; notes.push("Part of your body left the picture at times."); }
  return { quality, notes };
}

const worse = (a: CameraQuality, b: CameraQuality): CameraQuality => (a === "poor" || b === "poor" ? "poor" : a === "limited" || b === "limited" ? "limited" : "good");

/** The signal whose cycles are counted as repetitions for each task. */
function repetitionSignal(frames: PoseFrame[], task: VisualCheckTask, options: PoseOptions): { series: Array<number | null>; minRange: number } {
  if (task.type === "sit_to_stand" || task.type === "anchored_lower_body_flexion") return { series: combine(jointAngleSeries(frames, "left_knee", options), jointAngleSeries(frames, "right_knee", options)), minRange: 25 };
  if (task.type === "shoulder_mobility") return { series: combine(jointAngleSeries(frames, "left_shoulder", options), jointAngleSeries(frames, "right_shoulder", options)), minRange: 40 };
  // Reach and return: how far the furthest wrist is from the body centre, in shoulder widths.
  const aspect = options.aspect ?? DEFAULT_ASPECT;
  const series = frames.map(({ landmarks }) => {
    const parts = [landmarks[LM.lShoulder], landmarks[LM.rShoulder], landmarks[LM.lWrist], landmarks[LM.rWrist]];
    if (!parts.every(visible)) return null;
    const centre = (landmarks[LM.lShoulder].x + landmarks[LM.rShoulder].x) / 2; const width = Math.abs(landmarks[LM.lShoulder].x - landmarks[LM.rShoulder].x) * aspect;
    if (width < 1e-6) return null;
    return Math.max(Math.abs(landmarks[LM.lWrist].x - centre), Math.abs(landmarks[LM.rWrist].x - centre)) * aspect / width;
  });
  return { series, minRange: 0.5 };
}

/**
 * Builds the observed features for one check from tracked frames. `lightingQuality` is the quality from the
 * lighting/framing step; the worse of it and the tracking quality is reported.
 */
export function extractPoseFeatures(frames: PoseFrame[], task: VisualCheckTask, lightingQuality: { quality: CameraQuality; notes: string[] }, options: PoseOptions = {}): ObservedFeatures {
  const fps = options.fps ?? 10;
  const tracking = assessPoseQuality(frames, task.durationSeconds * fps);
  const qualityNotes = [...lightingQuality.notes, ...tracking.notes];
  const duration = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;

  const jointAngleRanges: Partial<Record<JointName, JointRange>> = {};
  for (const joint of relevantJoints(task)) {
    const series = jointAngleSeries(frames, joint, options);
    if (numbers(series).length >= Math.max(5, frames.length * 0.5)) { const range = robustRange(series); if (range) jointAngleRanges[joint] = range; }
  }

  const [leftJoint, rightJoint] = primaryPair(task);
  const left = jointAngleRanges[leftJoint]; const right = jointAngleRanges[rightJoint];
  const leftSpan = left ? left.max - left.min : 0; const rightSpan = right ? right.max - right.min : 0;
  const leftRightBalance = leftSpan + rightSpan > 0 && left && right ? Math.round((leftSpan / (leftSpan + rightSpan)) * 100) / 100 : 0.5;

  let repetitionCount: number | undefined; let pauseCount = 0;
  if (task.repetitive) {
    const { series, minRange } = repetitionSignal(frames, task, options);
    repetitionCount = countRepetitions(series, minRange);
    if (repetitionCount === 0 && frames.length >= 10) qualityNotes.push("No clear repeated movement was found. Check that your whole body is visible and the movement is large enough.");
    // A pause is one second or more where the signal barely changes.
    const smooth = smoothSeries(series); const span = percentile(smooth, 0.95) - percentile(smooth, 0.05);
    let stillStart: number | null = null;
    smooth.forEach((value, i) => {
      const t = frames[i].t; const previous = i > 0 ? smooth[i - 1] : value; const dt = i > 0 ? Math.max(t - frames[i - 1].t, 1e-3) : 1;
      const slow = span > 0 && Math.abs(value - previous) / dt < span * 0.1;
      if (slow) stillStart ??= t; else { if (stillStart !== null && t - stillStart >= 1) pauseCount += 1; stillStart = null; }
    });
  }

  const sway = task.repetitive ? null : swayIndex(frames, options.aspect);
  if (frames.length < 10) qualityNotes.push("Too few frames were tracked to assess the full movement.");

  return {
    repetitionCount,
    movementDurationSeconds: Math.round(duration * 10) / 10,
    leftRightBalance,
    balanceDeviation: sway ?? undefined,
    pauseCount,
    cameraQuality: worse(lightingQuality.quality, tracking.quality),
    qualityNotes,
    method: "pose",
    jointAngleRanges,
  };
}
