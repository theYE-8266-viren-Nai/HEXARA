import type { Landmark } from "../domain/poseFeatures";

/**
 * Loads MediaPipe's pose tracker from files served by this app (nothing is fetched from a third party).
 * If the files are not there, or loading fails, it reports why and the Movement check keeps using the
 * motion-based method. Frames are read from the live preview, turned into numbers, and discarded.
 *
 * The files are added with `npm run setup:pose` (see docs/pose-setup.md). They are imported from a URL at
 * run time, so the app builds and works without them.
 */
export interface PoseDetector { detect(video: HTMLVideoElement, timestampMs: number): Landmark[] | null; close(): void }
export type PoseLoad = { ok: true; detector: PoseDetector } | { ok: false; reason: string };

/**
 * A native `import()` that Vite never rewrites. In the dev server Vite adds "?import" to every dynamic import it can see and then refuses
 * files from /public ("should not be imported from source code"). Building the call with `new Function` hides it from Vite, so the browser
 * loads the tracker file exactly as it is on disk. The same code is used in production builds.
 */
const nativeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

/** Mutable so tests can point at fakes and use short timeouts. */
export const poseAssets = { module: "/mediapipe/vision_bundle.mjs", wasm: "/mediapipe/wasm", model: "/mediapipe/pose_landmarker_lite.task", timeoutMs: 20_000, importModule: nativeImport };

interface VisionModule {
  FilesetResolver: { forVisionTasks(basePath: string): Promise<unknown> };
  PoseLandmarker: { createFromOptions(fileset: unknown, options: unknown): Promise<{ detectForVideo(video: HTMLVideoElement, timestampMs: number): { landmarks?: Landmark[][] }; close(): void }> };
}

let ready: Promise<PoseLoad> | null = null;


function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Pose model took too long to load.")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function load(): Promise<PoseLoad> {
  try {
    const vision = await withTimeout(poseAssets.importModule(poseAssets.module) as Promise<VisionModule>, poseAssets.timeoutMs);
    const fileset = await withTimeout(vision.FilesetResolver.forVisionTasks(poseAssets.wasm), poseAssets.timeoutMs);
    const landmarker = await withTimeout(vision.PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: poseAssets.model, delegate: "CPU" }, runningMode: "VIDEO", numPoses: 1 }), poseAssets.timeoutMs);
    return {
      ok: true,
      detector: {
        detect(video, timestampMs) {
          if (video.readyState < 2) return null;
          const first = landmarker.detectForVideo(video, timestampMs).landmarks?.[0];
          return first ? first.map(({ x, y, z, visibility }) => ({ x, y, z, visibility })) : null;
        },
        close() { landmarker.close(); },
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Pose model could not be loaded." };
  }
}

/** Loads once per page; a failure is not cached, so adding the files and reloading the camera retries. */
export function loadPoseDetector(): Promise<PoseLoad> {
  ready ??= load().then((result) => { if (!result.ok) ready = null; return result; });
  return ready;
}
