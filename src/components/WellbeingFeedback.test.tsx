import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WellbeingCheckIn } from "./WellbeingCheckIn";
import { FEEDBACK_ERROR_TEXT } from "../lib/wellbeingFeedbackRepository";

const generate = vi.hoisted(() => vi.fn());
vi.mock("../lib/wellbeingFeedbackRepository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/wellbeingFeedbackRepository")>()),
  createWellbeingFeedbackRepository: () => ({ generate }),
}));

/** Answers the first question, skips the rest, and reaches the summary. `pain` answers the discomfort question with the urgent option. */
async function reachSummary(user: ReturnType<typeof userEvent.setup>, pain = false) {
  render(<WellbeingCheckIn stage="active" client={null} />);
  await user.click(await screen.findByRole("button", { name: "Broken sleep, still tired" }));
  for (let i = 0; i < 12; i += 1) {
    if (screen.queryByRole("button", { name: "See my summary" })) break;
    if (pain && screen.queryByRole("button", { name: "Pain, or symptoms getting worse" })) { await user.click(screen.getByRole("button", { name: "Pain, or symptoms getting worse" })); continue; }
    const next = screen.queryByRole("button", { name: /Skip this question|Continue/ });
    if (!next) break;
    await user.click(next);
  }
  await user.click(await screen.findByRole("button", { name: "See my summary" }));
  await screen.findByText(/Your wellbeing summary/);
}

describe("wellbeing summary when AI feedback is or is not available", () => {
  beforeEach(() => { window.localStorage.clear(); generate.mockReset(); });

  it("shows the AI text when it arrives, and not the built-in steps", async () => {
    generate.mockResolvedValue({ text: "1. Protect your next sleep period.\n2. Talk with your mission team about workload." });
    await reachSummary(userEvent.setup());
    expect(await screen.findByText(/Protect your next sleep period/)).toBeInTheDocument();
    expect(screen.queryByTestId("builtin-steps")).not.toBeInTheDocument();
  });

  it("shows built-in steps and plain wording, never a raw code, when the AI service fails", async () => {
    generate.mockResolvedValue({ error: FEEDBACK_ERROR_TEXT.upstream_unavailable });
    await reachSummary(userEvent.setup());
    expect(await screen.findByText("The AI service could not be reached.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/upstream_unavailable/);
    const steps = screen.getByTestId("builtin-steps");
    expect(steps).toHaveTextContent("What you told us");
    expect(steps).toHaveTextContent("What might help");
    expect(steps).toHaveTextContent(/not medical advice or diagnosis/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows nothing but a loading line while the AI is still working, then the result", async () => {
    let finish!: (value: { text: string }) => void;
    generate.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await reachSummary(userEvent.setup());
    expect(screen.getByText(/ORBIT is preparing feedback/)).toBeInTheDocument();
    expect(screen.queryByTestId("builtin-steps")).not.toBeInTheDocument();
    finish({ text: "1. Keep your routine going." });
    expect(await screen.findByText(/Keep your routine going/)).toBeInTheDocument();
  });

  it("always shows the crew-medic note when pain is reported, even if the AI fails or is slow", async () => {
    for (const outcome of [{ error: FEEDBACK_ERROR_TEXT.upstream_timeout }, { text: "1. Contact your crew medic." }]) {
      generate.mockResolvedValue(outcome);
      cleanup();
      window.localStorage.clear();
      await reachSummary(userEvent.setup(), true);
      expect(screen.getByRole("note")).toHaveTextContent("This app doesn't contact anyone for you.");
      await waitFor(() => expect(generate).toHaveBeenCalled());
    }
  });

  it("lets the person try again after a failure", async () => {
    generate.mockResolvedValueOnce({ error: FEEDBACK_ERROR_TEXT.upstream_timeout }).mockResolvedValueOnce({ text: "1. Rest well tonight." });
    const user = userEvent.setup();
    await reachSummary(user);
    await screen.findByText("The AI service took too long to answer.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Rest well tonight/)).toBeInTheDocument();
    expect(screen.queryByText("The AI service took too long to answer.")).not.toBeInTheDocument();
  });
});
