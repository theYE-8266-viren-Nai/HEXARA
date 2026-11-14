import { afterEach, describe, expect, it } from "vitest";
import { loadPoseDetector, poseAssets } from "./poseLandmarker";
import loaderSource from "./poseLandmarker.ts?raw";

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

  it("never uses an import() that Vite can see, because the dev server adds ?import and refuses files from /public", () => {
    const code = loaderSource.split("\n").filter((line: string) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*")).join("\n");
    // The only dynamic import is the one hidden inside `new Function`.
    const withoutSafeCall = code.split("\n").filter((line: string) => !line.includes("new Function(")).join("\n");
    expect(withoutSafeCall).not.toMatch(/(^|[^\w."'`])import\s*\(/m);
    expect(code).toMatch(/new Function\("specifier", "return import\(specifier\)"\)/);
  });

  it("loads the tracker module it is given and wraps it, passing on only the numbers (runs last: a success is cached)", async () => {
    const fakeModule = {
      FilesetResolver: { forVisionTasks: async (path: string) => ({ path }) },
      PoseLandmarker: { createFromOptions: async () => ({
        detectForVideo: () => ({ landmarks: [[{ x: 0.5, y: 0.25, z: 0.1, visibility: 0.9, presence: 1 }]] }),
        close() { (globalThis as { __poseClosed?: boolean }).__poseClosed = true; },
      }) },
    };
    let requested = "";
    poseAssets.importModule = async (specifier: string) => { requested = specifier; return fakeModule; };
    poseAssets.timeoutMs = 5_000;
    const result = await loadPoseDetector();
    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
    expect(requested).toBe("/mediapipe/vision_bundle.mjs");
    if (!result.ok) return;
    expect(result.detector.detect({ readyState: 1 } as HTMLVideoElement, 1)).toBeNull();
    expect(result.detector.detect({ readyState: 4 } as HTMLVideoElement, 2)).toEqual([{ x: 0.5, y: 0.25, z: 0.1, visibility: 0.9 }]);
    result.detector.close();
    expect((globalThis as { __poseClosed?: boolean }).__poseClosed).toBe(true);
  });
});
