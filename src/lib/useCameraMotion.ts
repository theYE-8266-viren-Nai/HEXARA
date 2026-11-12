import { useCallback, useEffect, useRef, useState } from "react";
import { assessCameraQuality, frameStats, type CameraQuality, type MotionSample } from "../domain/visualCheck";
import type { Landmark, PoseFrame } from "../domain/poseFeatures";
import type { PoseDetector } from "./poseLandmarker";

/**
 * Local-only camera processing. Frames are drawn to a tiny off-screen canvas,
 * reduced to numbers (luminance, motion energy) and discarded immediately.
 * Nothing is recorded, uploaded, or persisted.
 */
export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";
const W = 64; const H = 48;

export function cameraSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useCameraMotion() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string>();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (!cameraSupported()) { setStatus("unavailable"); setError("This browser does not provide camera access."); return false; }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      setStatus("ready");
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") { setStatus("denied"); setError("Camera permission was denied."); }
      else if (name === "NotFoundError" || name === "OverconstrainedError") { setStatus("unavailable"); setError("No camera was found."); }
      else { setStatus("error"); setError("The camera could not be started."); }
      return false;
    }
  }, []);

  const grab = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    canvasRef.current ??= document.createElement("canvas");
    const canvas = canvasRef.current; canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H).data;
  }, []);

  const checkQuality = useCallback((): { quality: CameraQuality; notes: string[] } => {
    const frame = grab();
    if (!frame) return { quality: "poor", notes: ["The camera image is not available yet. Try again in a moment."] };
    const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
    return assessCameraQuality(frameStats(frame, 1), portrait);
  }, [grab]);

  /** Sample motion energy for `seconds`, ~10 times per second. */
  const captureMotion = useCallback((seconds: number, onTick?: (remaining: number) => void) => new Promise<MotionSample[]>((resolve) => {
    const samples: MotionSample[] = [];
    let previous: Uint8ClampedArray | null = null;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      const frame = grab();
      if (frame) {
        if (previous) {
          let energy = 0; let left = 0;
          for (let i = 0; i < frame.length; i += 4) {
            const d = Math.abs(frame[i] - previous[i]) + Math.abs(frame[i + 1] - previous[i + 1]) + Math.abs(frame[i + 2] - previous[i + 2]);
            const v = d > 45 ? 1 : 0;
            energy += v;
            // Preview is mirrored for the user; un-mirrored x < W/2 is the user's left side.
            if (((i / 4) % W) >= W / 2) left += v;
          }
          const px = W * H;
          samples.push({ t, energy: energy / px, leftEnergy: left / px });
        }
        previous = new Uint8ClampedArray(frame);
      }
      onTick?.(Math.max(0, Math.ceil(seconds - t)));
      if (t >= seconds) { window.clearInterval(timer); previous = null; resolve(samples); }
    }, 100);
  }), [grab]);

  /** Track body points for `seconds` at about 10 frames per second. Only numbers are kept; frames are discarded. */
  const capturePose = useCallback((detector: PoseDetector, seconds: number, onTick?: (remaining: number) => void, onFrame?: (landmarks: Landmark[] | null) => void) => new Promise<PoseFrame[]>((resolve) => {
    const frames: PoseFrame[] = [];
    const started = performance.now();
    const timer = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      let landmarks: Landmark[] | null = null;
      try { landmarks = videoRef.current ? detector.detect(videoRef.current, performance.now()) : null; } catch { landmarks = null; }
      onFrame?.(landmarks);
      if (landmarks) frames.push({ t, landmarks });
      onTick?.(Math.max(0, Math.ceil(seconds - t)));
      if (t >= seconds) { window.clearInterval(timer); onFrame?.(null); resolve(frames); }
    }, 100);
  }), []);

  return { videoRef, status, error, start, stop, checkQuality, captureMotion, capturePose };
}
