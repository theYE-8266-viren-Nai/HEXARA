import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { squats } from "../test/poseFixtures";

const camera = vi.hoisted(() => ({
  videoRef: { current: null }, status: "ready", error: undefined as string | undefined,
  start: vi.fn(async () => true), stop: vi.fn(),
  checkQuality: vi.fn(() => ({ quality: "good" as const, notes: [] as string[] })),
  captureMotion: vi.fn(async () => Array.from({ length: 200 }, (_, i) => ({ t: i / 10, energy: 0.1 * Math.max(0, Math.sin(i / 3)), leftEnergy: 0.05 * Math.max(0, Math.sin(i / 3)) }))),
  capturePose: vi.fn(),
}));
const detectorLoad = vi.hoisted(() => ({ loadPoseDetector: vi.fn() }));
vi.mock("../lib/useCameraMotion", () => ({ cameraSupported: () => true, useCameraMotion: () => camera }));
vi.mock("../lib/poseLandmarker", () => detectorLoad);

import { VisualCheckView } from "./VisualCheckView";
import { createVisualCheckRepository } from "../lib/visualCheckRepository";

const detector = { detect: vi.fn(), close: vi.fn() };
async function toQualityStep(user: ReturnType<typeof userEvent.setup>) {
  render(<VisualCheckView stage="retired" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
  await user.click(screen.getByRole("checkbox", { name: /choose to allow it/ }));
  await user.click(screen.getByRole("button", { name: "Allow camera and continue" }));
  await screen.findByRole("heading", { name: "Lighting and framing check" });
}
async function start(user: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole("button", { name: /Start sit-to-stand or squat/i });
  await waitFor(() => expect(button).toBeEnabled(), { timeout: 4000 });
  await user.click(button);
}
async function finish(user: ReturnType<typeof userEvent.setup>) {
  await start(user);
  await screen.findByRole("heading", { name: "How did that feel?" }, { timeout: 9000 });
  await user.click(screen.getByRole("button", { name: "See observation summary" }));
}

describe("Movement check with body tracking", () => {
  beforeEach(() => {
    window.localStorage.clear();
    camera.capturePose.mockReset().mockImplementation(async () => squats(8, 20));
    camera.captureMotion.mockClear(); camera.stop.mockClear();
    detectorLoad.loadPoseDetector.mockReset().mockResolvedValue({ ok: true, detector });
  });

  it("tracks body points, reports joint-angle ranges and repetitions, and says no video was saved", async () => {
    const user = userEvent.setup();
    await toQualityStep(user);
    expect(await screen.findByText(/Body tracking is ready/)).toBeInTheDocument();
    await finish(user);
    expect(camera.capturePose).toHaveBeenCalledTimes(1);
    expect(camera.captureMotion).not.toHaveBeenCalled();
    expect(screen.getByText("You completed 8 repetitions.")).toBeInTheDocument();
    expect(screen.getByText(/Your left knee moved through about \d+° and your right knee about \d+°/)).toBeInTheDocument();
    expect(screen.getByText(/Body points were tracked on your device; no video was recorded or saved/)).toBeInTheDocument();
    expect(screen.getByText("This is a practice comparison, not a medical finding.")).toBeInTheDocument();
  }, 20_000);

  it("falls back to the motion-based check and says so when body tracking cannot load", async () => {
    detectorLoad.loadPoseDetector.mockResolvedValue({ ok: false, reason: "Pose model files not found." });
    const user = userEvent.setup();
    await toQualityStep(user);
    expect(await screen.findByText(/Body tracking is not available here, so the motion-based check will be used/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Show body points/)).not.toBeInTheDocument();
    await finish(user);
    expect(camera.captureMotion).toHaveBeenCalledTimes(1);
    expect(camera.capturePose).not.toHaveBeenCalled();
    expect(screen.queryByText(/Body points were tracked/)).not.toBeInTheDocument();
  }, 20_000);

  it("waits for the tracker to load before starting", async () => {
    let release!: (value: unknown) => void;
    detectorLoad.loadPoseDetector.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const user = userEvent.setup();
    await toQualityStep(user);
    expect(await screen.findByText("Body tracking is loading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start sit-to-stand or squat/i })).toBeDisabled();
    release({ ok: false, reason: "no files" });
    await waitFor(() => expect(screen.getByRole("button", { name: /Start sit-to-stand or squat/i })).toBeEnabled());
  });

  it("reports poor tracking honestly when the person was found for only part of the check", async () => {
    camera.capturePose.mockImplementation(async () => squats(8, 20).slice(0, 40));
    const user = userEvent.setup();
    await toQualityStep(user);
    await screen.findByText(/Body tracking is ready/);
    await finish(user);
    expect(screen.getAllByText(/difficult to assess/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/may be affected by camera angle or lighting/).length).toBeGreaterThan(0);
  }, 20_000);

  it("only draws body points on the preview when the user turns that on", async () => {
    const user = userEvent.setup();
    await toQualityStep(user);
    const toggle = await screen.findByRole("checkbox", { name: "Show body points on the preview" });
    expect(toggle).not.toBeChecked();
    await start(user);
    await waitFor(() => expect(camera.capturePose).toHaveBeenCalled(), { timeout: 6000 });
    expect(camera.capturePose.mock.calls[0][3]).toBeUndefined();
  }, 20_000);
});
