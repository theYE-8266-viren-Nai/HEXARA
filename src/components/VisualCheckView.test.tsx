import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisualCheckView } from "./VisualCheckView";
import { createVisualCheckRepository, readLocalVisualChecks } from "../lib/visualCheckRepository";
import { VISUAL_CHECK_DISCLAIMER } from "../domain/visualCheck";
import type { SupabaseClient } from "@supabase/supabase-js";

function failingClient() {
  const chain = { upsert: () => chain, select: () => chain, single: async () => ({ data: null, error: { message: "permission denied for table visual_checks" } }) };
  return { from: () => chain } as unknown as SupabaseClient;
}

async function runSynthetic(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Synthetic demo/ }));
  await user.click(screen.getByRole("button", { name: "Run synthetic demo" }));
  await screen.findByRole("heading", { name: "How did that feel?" }, { timeout: 3000 });
}

describe("VisualCheckView", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("shows privacy limits and the camera disclaimer before any capture", () => {
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.getByText("Privacy and limits")).toBeInTheDocument();
    // The details are folded away until the person opens them, but stay in the page.
    expect(screen.getByText("Privacy and limits").closest("details")).not.toHaveAttribute("open");
    expect(screen.getAllByText(VISUAL_CHECK_DISCLAIMER).length).toBeGreaterThan(0);
    expect(screen.getByText(/never recorded or uploaded/)).toBeInTheDocument();
  });

  it("keeps the first screen short: no group headings, one how-to line, privacy folded away", () => {
    render(<VisualCheckView stage="retired" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.queryByText(/Recovery and fatigue context/)).not.toBeInTheDocument();
    expect(screen.queryByText("Movement and exercise")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /\d+ s/ })).toHaveLength(5);
    // Only the selected task shows its how-to line.
    expect(screen.getAllByText(/Stand up and sit down/)).toHaveLength(1);
    expect(screen.queryByText(/Raise both arms overhead/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow camera and continue|Run synthetic demo/ })).toBeInTheDocument();
  });

  it("shows the how-to line of whichever task is chosen, and keeps the anchor reminder for Active", async () => {
    const user = userEvent.setup();
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.getAllByRole("radio", { name: /\d+ s/ })).toHaveLength(2);
    expect(screen.getByText(/Anchor your feet in a foot restraint/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Reach-and-return/ }));
    expect(screen.getByText(/Reach forward to one side/)).toBeInTheDocument();
    expect(screen.queryByText(/Raise both arms overhead/)).not.toBeInTheDocument();
    expect(screen.getByText(/Anchor your feet in a foot restraint/)).toBeInTheDocument();
  });

  it("keeps the Retired practice-tracking note on one line", () => {
    render(<VisualCheckView stage="retired" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.getByText(/not a rehab programme/)).toBeInTheDocument();
  });

  it("falls back to synthetic mode when the camera is unavailable", () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.getByRole("radio", { name: /Use my camera/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Synthetic demo/ })).toBeChecked();
  });

  it("explains a denied camera permission and offers the synthetic demo", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    const start = screen.getByRole("button", { name: "Allow camera and continue" });
    expect(start).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Allow my camera for this practice/ }));
    await user.click(start);
    expect(await screen.findByText("Camera permission was denied.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use synthetic demo" }));
    expect(screen.getByRole("radio", { name: /Synthetic demo/ })).toBeChecked();
  });

  it("completes the synthetic flow, compares with own history, and composes a crew summary without sending it", async () => {
    const user = userEvent.setup();
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    await runSynthetic(user);
    await user.click(screen.getByRole("button", { name: "See observation summary" }));
    expect(screen.getByText("Synthetic demo result")).toBeInTheDocument();
    expect(screen.getByText(/You completed \d+ repetitions?\./)).toBeInTheDocument();
    expect(screen.getByText("This is a practice comparison, not a medical finding.")).toBeInTheDocument();
    expect(screen.getAllByText(/first practice of this task/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Crew medic summary preview")).toHaveTextContent(VISUAL_CHECK_DISCLAIMER);
    expect(screen.getByText(/Nothing is sent automatically/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/medical condition|diagnosed|probability/i);

    await user.click(screen.getByRole("button", { name: "Practise again" }));
    await runSynthetic(user);
    await user.click(screen.getByRole("button", { name: "See observation summary" }));
    expect(screen.getByText(/Based on your last 1 session of this task/)).toBeInTheDocument();
    expect(readLocalVisualChecks()).toHaveLength(2);
  });

  it("does not show false success when the cloud save fails", async () => {
    const user = userEvent.setup();
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(failingClient(), "user-1")} />);
    await runSynthetic(user);
    await user.click(screen.getByRole("button", { name: "See observation summary" }));
    await user.click(screen.getByRole("button", { name: "Save summary to cloud" }));
    expect(await screen.findByText(/Not saved to cloud: permission denied/)).toBeInTheDocument();
    expect(screen.queryByText(/^Saved\./)).not.toBeInTheDocument();
  });

  it("routes reported severe symptoms to the crew medic", async () => {
    const user = userEvent.setup();
    const onRequestCrewMedic = vi.fn();
    render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} onRequestCrewMedic={onRequestCrewMedic} />);
    await runSynthetic(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Discomfort" }), "severe_or_worsening");
    await user.click(screen.getByRole("button", { name: "See observation summary" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/contact the crew medic now/);
    await user.click(screen.getByRole("button", { name: "Open support contacts" }));
    expect(onRequestCrewMedic).toHaveBeenCalled();
  });

  it("keeps history separate per stage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VisualCheckView stage="active" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    await runSynthetic(user);
    await user.click(screen.getByRole("button", { name: "See observation summary" }));
    unmount();
    render(<VisualCheckView stage="retired" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.queryByRole("heading", { name: "Your practice history" })).not.toBeInTheDocument();
  });

  it("turns off the countdown pulse when the user prefers reduced motion", async () => {
    const user = userEvent.setup();
    const media = (matches: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches && query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }));
    for (const [reduced, expectPulse] of [[true, false], [false, true]] as const) {
      media(reduced);
      const { unmount } = render(<VisualCheckView stage="active" profileId={`rm-${reduced}`} seed={42} repository={createVisualCheckRepository(null, null)} />);
      await user.click(screen.getByRole("radio", { name: /Synthetic demo/ }));
      await user.click(screen.getByRole("button", { name: "Run synthetic demo" }));
      const countdown = await screen.findByLabelText(/Starting in/);
      expect(countdown.className.includes("animate-pulse"), `reduced=${reduced}`).toBe(expectPulse);
      await screen.findByRole("heading", { name: "How did that feel?" }, { timeout: 3000 });
      unmount();
    }
  });

  it("fails safe if it is ever rendered for a Future traveler: no tasks and no camera", () => {
    render(<VisualCheckView stage="future" profileId="p1" seed={42} repository={createVisualCheckRepository(null, null)} />);
    expect(screen.getByRole("heading", { name: "Movement checks are not part of this stage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Allow camera|Run synthetic demo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
