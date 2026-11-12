import { afterEach, describe, expect, it } from "vitest";
import { loadPoseDetector, poseAssets } from "./poseLandmarker";

const original = { ...poseAssets };
afterEach(() => { Object.assign(poseAssets, original); });

describe("pose loader", () => {
  it("reports why when the model files are not present, instead of throwing", async () => {
    poseAssets.module = "/mediapipe/definitely-not-here.mjs"; poseAssets.timeoutMs = 500;
    const result = await loadPoseDetector();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it("does not cache a failure, so adding the files and trying again can work", async () => {
    poseAssets.module = "/mediapipe/definitely-not-here.mjs"; poseAssets.timeoutMs = 500;
    const first = loadPoseDetector(); const second = loadPoseDetector();
    await Promise.all([first, second]);
    const third = loadPoseDetector();
    expect(third).not.toBe(first);
    expect((await third).ok).toBe(false);
  });
});
