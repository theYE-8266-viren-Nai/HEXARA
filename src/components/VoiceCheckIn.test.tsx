import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import { VoiceCheckIn, type VoiceCheckInProps } from "./VoiceCheckIn";
import { buildDemoScript, createMockVoiceEngine } from "../lib/voice/mockVoiceEngine";
import type { VoiceEngine, VoiceEvent } from "../lib/voice/voiceEngine";
import { ALL_FIELDS, URGENT_MESSAGE, type CheckInField } from "../domain/voiceCheckIn";

/** A controllable engine: tests decide what is "heard" and when. */
function fakeEngine(id: "demo" | "vapi" = "vapi", onStart?: (emit: (e: VoiceEvent) => void) => void) {
  let emit: (event: VoiceEvent) => void = () => {};
  const state = { started: 0, stopped: 0 };
  const engine: VoiceEngine = {
    id,
    async start(listener) { state.started += 1; emit = listener; onStart?.(listener); },
    async stop() { state.stopped += 1; },
  };
  return { engine, state, say: (event: VoiceEvent) => act(() => emit(event)) };
}

const setup = (options: { vapiReady?: boolean; engine?: ReturnType<typeof fakeEngine>; onApply?: Mock<VoiceCheckInProps["onApply"]>; onUrgent?: Mock<VoiceCheckInProps["onUrgent"]> } = {}) => {
  const fake = options.engine ?? fakeEngine();
  const onApply = options.onApply ?? vi.fn<VoiceCheckInProps["onApply"]>();
  const onUrgent = options.onUrgent ?? vi.fn<VoiceCheckInProps["onUrgent"]>();
  const createEngine = vi.fn((mode: "vapi" | "demo", fields: CheckInField[]) => (mode === "demo" ? createMockVoiceEngine(buildDemoScript(fields), 5) : fake.engine));
  render(<VoiceCheckIn onApply={onApply} onUrgent={onUrgent} createEngine={createEngine} vapiReady={options.vapiReady ?? true} />);
  return { fake, onApply, onUrgent, createEngine, user: userEvent.setup() };
};

async function startVoice(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start voice check-in" }));
  await user.click(screen.getByRole("checkbox", { name: /I understand and want to use voice/ }));
  await user.click(screen.getByRole("button", { name: "Start" }));
}
const answerAll = async (fake: ReturnType<typeof fakeEngine>, note = "") => {
  await fake.say({ type: "started" });
  for (const text of ["four", "two", "three out of five", "high"]) await fake.say({ type: "user", text });
  await fake.say({ type: "user", text: note || "no thanks" });
};

describe("VoiceCheckIn", () => {
  it("says voice is not set up when there are no keys, and still offers the demo", () => {
    setup({ vapiReady: false });
    expect(screen.queryByRole("button", { name: "Start voice check-in" })).not.toBeInTheDocument();
    expect(screen.getByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try the demo voice" })).toBeInTheDocument();
  });

  it("requires an explicit, informed consent before the real voice service starts", async () => {
    const { user, fake, createEngine } = setup();
    await user.click(screen.getByRole("button", { name: "Start voice check-in" }));
    const consent = screen.getByRole("group", { name: "Before you start" });
    expect(consent).toHaveTextContent(/sent over the internet to Vapi/);
    expect(consent).toHaveTextContent(/does not record or save audio/);
    expect(consent).toHaveTextContent(/cannot check that Vapi does this/);
    expect(consent).toHaveTextContent(/after 3 minutes/);
    expect(consent).toHaveTextContent(/do not use this check-in/);
    expect(within(consent).getByRole("button", { name: "Start" })).toBeDisabled();
    expect(createEngine).not.toHaveBeenCalled();
    await user.click(within(consent).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Before you start" })).not.toBeInTheDocument();
    expect(fake.state.started).toBe(0);
  });

  it("turns a spoken conversation into reviewable values, and only fills the form when told to", async () => {
    const { user, fake, onApply } = setup();
    await startVoice(user);
    expect(fake.state.started).toBe(1);
    await fake.say({ type: "started" });
    expect(await screen.findByText(/Listening · 0 of 4 answered/)).toBeInTheDocument();
    await fake.say({ type: "assistant", text: "How is your mood today?" });
    await fake.say({ type: "user", text: "Four" });
    expect(screen.getByText(/Listening · 1 of 4 answered/)).toBeInTheDocument();
    for (const text of ["two", "three out of five", "high"]) await fake.say({ type: "user", text });
    await fake.say({ type: "user", text: "a bit tired after exercise" });

    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(review).toHaveTextContent("Mood4 of 5");
    expect(review).toHaveTextContent("Stress2 of 5");
    expect(review).toHaveTextContent("Sleep quality3 of 5");
    expect(review).toHaveTextContent("Energy4 of 5");
    expect(fake.state.stopped).toBeGreaterThanOrEqual(1);
    expect(onApply).not.toHaveBeenCalled(); // nothing happens until the person confirms
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    expect(onApply).toHaveBeenCalledWith({ mood: "4", stress: "2", sleepQuality: "3", energy: "4" }, undefined);
    expect(screen.getByText(/Review the sliders, then press Save/)).toBeInTheDocument();
  });

  it("adds the spoken note only when the person opts in", async () => {
    const { user, fake, onApply } = setup();
    await startVoice(user);
    await answerAll(fake, "slept lightly");
    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(within(review).getByRole("checkbox", { name: /slept lightly/ })).not.toBeChecked();
    await user.click(within(review).getByRole("checkbox", { name: /slept lightly/ }));
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ mood: "4" }), "slept lightly");
  });

  it("lets the person discard everything", async () => {
    const { user, fake, onApply } = setup();
    await startVoice(user);
    await answerAll(fake);
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/Discarded. Nothing was changed/)).toBeInTheDocument();
  });

  it("re-asks instead of guessing when an answer is unclear", async () => {
    const { user, fake } = setup();
    await startVoice(user);
    await fake.say({ type: "started" });
    await fake.say({ type: "user", text: "hmm, somewhere between three and four" });
    expect(screen.getByText(/Listening · 0 of 4 answered/)).toBeInTheDocument();
    await fake.say({ type: "user", text: "three" });
    expect(screen.getByText(/Listening · 1 of 4 answered/)).toBeInTheDocument();
  });

  it("an urgent word stops the check-in, opens support, keeps nothing and ignores anything said afterwards", async () => {
    const { user, fake, onApply, onUrgent } = setup();
    await startVoice(user);
    await fake.say({ type: "started" });
    await fake.say({ type: "user", text: "four" });
    await fake.say({ type: "user", text: "actually I have chest pain" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(URGENT_MESSAGE);
    expect(onUrgent).toHaveBeenCalledTimes(1);
    expect(fake.state.stopped).toBeGreaterThanOrEqual(1);
    await fake.say({ type: "user", text: "five" });
    expect(screen.queryByRole("group", { name: "Review your answers" })).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    expect(onUrgent).toHaveBeenCalledTimes(1);
    await user.click(within(alert).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show assistant words that fail the language guard", async () => {
    const { user, fake } = setup();
    await startVoice(user);
    await fake.say({ type: "started" });
    await fake.say({ type: "assistant", text: "Based on that I diagnose a condition." });
    await fake.say({ type: "assistant", text: "How stressed do you feel?" });
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log).toHaveTextContent("How stressed do you feel?");
    expect(log).not.toHaveTextContent(/diagnose/);
    expect(log).toHaveTextContent("1 assistant message not shown.");
  });

  it("shows a clear error and allows trying again", async () => {
    const { user, fake } = setup();
    await startVoice(user);
    await fake.say({ type: "error", code: "mic_denied", message: "Microphone permission was blocked." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone permission was blocked.");
    expect(screen.getByRole("button", { name: "Start voice check-in" })).toBeInTheDocument();
    expect(fake.state.stopped).toBeGreaterThanOrEqual(1);
  });

  it("handles an error raised during the very first moment of starting", async () => {
    const fake = fakeEngine("vapi", (emit) => emit({ type: "error", code: "not_configured", message: "Voice check-in is not set up." }));
    const { user } = setup({ engine: fake });
    await startVoice(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Voice check-in is not set up.");
  });

  it("stopping early keeps what was heard for review, or explains when nothing was", async () => {
    const first = setup();
    await startVoice(first.user);
    await first.fake.say({ type: "started" });
    await first.fake.say({ type: "user", text: "four" });
    await first.user.click(screen.getByRole("button", { name: "Stop" }));
    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(review).toHaveTextContent("Mood4 of 5");
    expect(review).toHaveTextContent("Not answered. Left as it is on the form.");
    expect(first.fake.state.stopped).toBeGreaterThanOrEqual(1);
  });

  it("stopping before any answer returns to the start with a note", async () => {
    const { user, fake } = setup();
    await startVoice(user);
    await fake.say({ type: "started" });
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(await screen.findByText(/Stopped before any answers were heard/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Review your answers" })).not.toBeInTheDocument();
  });

  it("runs the demo end to end without consent or a microphone, and labels it simulated", async () => {
    const { user, onApply, createEngine } = setup({ vapiReady: false });
    await user.click(screen.getByRole("button", { name: "Try the demo voice" }));
    expect(createEngine).toHaveBeenCalledWith("demo", ALL_FIELDS);
    expect(await screen.findByText(/Demo voice: simulated. No microphone is used/)).toBeInTheDocument();
    const review = await screen.findByRole("group", { name: "Review your answers" }, { timeout: 3000 });
    expect(review).toHaveTextContent("Mood4 of 5");
    expect(review).toHaveTextContent("Stress2 of 5");
    expect(review).toHaveTextContent("Sleep quality3 of 5");
    expect(review).toHaveTextContent("Energy4 of 5");
    await user.click(within(review).getByRole("checkbox", { name: /A bit tired after the exercise block/ }));
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    expect(onApply).toHaveBeenCalledWith({ mood: "4", stress: "2", sleepQuality: "3", energy: "4" }, "A bit tired after the exercise block");
  });

  it("releases the microphone when the component goes away mid-session", async () => {
    const fake = fakeEngine();
    const onApply = vi.fn<VoiceCheckInProps["onApply"]>(); const onUrgent = vi.fn<VoiceCheckInProps["onUrgent"]>();
    const { unmount } = render(<VoiceCheckIn onApply={onApply} onUrgent={onUrgent} createEngine={() => fake.engine} vapiReady />);
    const user = userEvent.setup();
    await startVoice(user);
    await waitFor(() => expect(fake.state.started).toBe(1));
    unmount();
    expect(fake.state.stopped).toBeGreaterThanOrEqual(1);
  });

  it("asks, shows and applies only the questions it was given, and tells the engine the same list", async () => {
    const fake = fakeEngine();
    const onApply = vi.fn<VoiceCheckInProps["onApply"]>();
    const startSpy = vi.spyOn(fake.engine, "start");
    render(<VoiceCheckIn onApply={onApply} onUrgent={vi.fn()} fields={["mood", "stress", "sleepQuality"]} createEngine={() => fake.engine} vapiReady />);
    const user = userEvent.setup();
    expect(screen.getByText(/Answer 3 short questions/)).toBeInTheDocument();
    await startVoice(user);
    expect(startSpy.mock.calls[0][1]?.questions).toHaveLength(3);
    expect(startSpy.mock.calls[0][1]?.questions.join(" ")).not.toMatch(/energy/i);
    await fake.say({ type: "started" });
    expect(screen.getByText(/Listening · 0 of 3 answered/)).toBeInTheDocument();
    for (const text of ["five", "one", "two"]) await fake.say({ type: "user", text });
    await fake.say({ type: "user", text: "no thanks" });
    const review = await screen.findByRole("group", { name: "Review your answers" });
    expect(review).not.toHaveTextContent("Energy");
    await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
    expect(onApply).toHaveBeenCalledWith({ mood: "5", stress: "1", sleepQuality: "2" }, undefined);
  });
});
