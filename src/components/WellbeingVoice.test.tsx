import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VoiceEngine } from "../lib/voice/voiceEngine";

// Replace the demo voice with a scripted engine that says something urgent.
let lines: string[] = [];
vi.mock("../lib/voice/mockVoiceEngine", () => ({
  DEMO_SCRIPT: [],
  buildDemoScript: () => [],
  demoVoiceTiming: { stepMs: 1 },
  createMockVoiceEngine: (): VoiceEngine => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    return {
      id: "demo",
      async start(onEvent) { onEvent({ type: "started" }); lines.forEach((text, i) => timers.push(setTimeout(() => onEvent({ type: "user", text }), 5 * (i + 1)))); },
      async stop() { timers.forEach(clearTimeout); },
    };
  },
}));

const { WellbeingView } = await import("./WorkspaceViews");
const checkIn = { mood: "3", stress: "3", sleepQuality: "3", energy: "3", purpose: "3", socialConnection: "3", note: "", transitionTags: [] as string[] };
const renderView = (onCheckInChange = vi.fn(), stage: "active" | "retired" = "active") => render(<WellbeingView stage={stage} checkIn={checkIn} onCheckInChange={onCheckInChange} privacy={{ mood: true, notes: false, trends: true }} onPrivacyChange={vi.fn()} />);

describe("voice check-in inside the Wellbeing page", () => {
  it("opens the support options when pain or a severe symptom is mentioned, and changes nothing on the form", async () => {
    lines = ["four", "I have chest pain"];
    const onCheckInChange = vi.fn();
    renderView(onCheckInChange);
    const user = userEvent.setup();
    expect(screen.queryByRole("region", { name: "Support options" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try the demo voice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/contact the crew medic or mission support now/);
    expect(screen.getByRole("region", { name: "Support options" })).toBeInTheDocument();
    expect(onCheckInChange).not.toHaveBeenCalled();
  });

  it("on the Active page it asks three questions and applies mood, stress and sleep only, leaving energy as it was", async () => {
    lines = ["five", "one", "two", "slept in short blocks"];
    const onCheckInChange = vi.fn();
    renderView(onCheckInChange);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try the demo voice" }));
    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(review).not.toHaveTextContent("Energy");
    await user.click(within(review).getByRole("checkbox", { name: /slept in short blocks/ }));
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    expect(onCheckInChange).toHaveBeenCalledTimes(1);
    const updater = onCheckInChange.mock.calls[0][0] as (current: typeof checkIn) => typeof checkIn;
    expect(updater(checkIn)).toMatchObject({ mood: "5", stress: "1", sleepQuality: "2", energy: "3", note: "slept in short blocks", purpose: "3" });
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });

  it("on the Retired page it also asks about energy, because that slider exists there", async () => {
    lines = ["five", "one", "two", "four", "no thanks"];
    const onCheckInChange = vi.fn();
    renderView(onCheckInChange, "retired");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try the demo voice" }));
    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(review).toHaveTextContent("Energy4 of 5");
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    const updater = onCheckInChange.mock.calls[0][0] as (current: typeof checkIn) => typeof checkIn;
    expect(updater(checkIn)).toMatchObject({ mood: "5", stress: "1", sleepQuality: "2", energy: "4", note: "" });
  });
});
