import { LM, type Landmark, type PoseFrame } from "../domain/poseFeatures";

/** Fake body points for tests. Coordinates are 0-1 with y pointing down; joint angles are set exactly. */
export interface Body { kneeL?: number; kneeR?: number; shoulderL?: number; shoulderR?: number; hipX?: number; visibility?: number; wristReach?: number }

/** A standing body whose joint angles are set exactly. Coordinates are 0-1 with y pointing down. */
export function body({ kneeL = 175, kneeR = 175, shoulderL = 20, shoulderR = 20, hipX = 0, visibility = 1, wristReach = 0.1 }: Body = {}): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));
  const set = (index: number, x: number, y: number) => { landmarks[index] = { x, y, visibility }; };
  const rad = (deg: number) => (deg * Math.PI) / 180;
  set(LM.lShoulder, 0.45 + hipX, 0.3); set(LM.rShoulder, 0.55 + hipX, 0.3);
  set(LM.lHip, 0.46 + hipX, 0.55); set(LM.rHip, 0.54 + hipX, 0.55);
  for (const [side, x, hip, knee, ankle, angle] of [["l", 0.46 + hipX, LM.lHip, LM.lKnee, LM.lAnkle, kneeL], ["r", 0.54 + hipX, LM.rHip, LM.rKnee, LM.rAnkle, kneeR]] as const) {
    void side; void hip;
    set(knee, x, 0.75);
    set(ankle, x + 0.2 * Math.sin(rad(angle)), 0.75 - 0.2 * Math.cos(rad(angle)));
  }
  for (const [shoulder, elbow, wrist, angle, sx] of [[LM.lShoulder, LM.lElbow, LM.lWrist, shoulderL, 0.45 + hipX], [LM.rShoulder, LM.rElbow, LM.rWrist, shoulderR, 0.55 + hipX]] as const) {
    void shoulder;
    set(elbow, sx + 0.15 * Math.sin(rad(angle)), 0.3 + 0.15 * Math.cos(rad(angle)));
    set(wrist, sx + wristReach, 0.3 + 0.15 * Math.cos(rad(angle)));
  }
  return landmarks;
}

/** `cycles` squats between two knee angles over `seconds`, at 10 frames per second. */
export function squats(cycles: number, seconds: number, high = 175, low = 95, lowRight = low): PoseFrame[] {
  return Array.from({ length: seconds * 10 + 1 }, (_, i) => {
    const phase = (1 - Math.cos((i / (seconds * 10)) * cycles * 2 * Math.PI)) / 2; // 0 = standing, 1 = bent
    return { t: i / 10, landmarks: body({ kneeL: high - phase * (high - low), kneeR: high - phase * (high - lowRight) }) };
  });
}
