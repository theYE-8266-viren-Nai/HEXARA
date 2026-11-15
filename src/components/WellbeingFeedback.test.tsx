import { render, screen } from "@testing-library/react";
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
  // Wellbeing opens on the history calendar: start today's check-in and skip the optional mood screen.
  await user.click(await screen.findByRole("button", { name: "Check in for today" }));
  await user.click(screen.getByRole("button", { name: "Skip mood check-in" }));
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

describe("wellbeing summary: AI feedback only when the person asks for it", () => {
  beforeEach(() => { window.localStorage.clear(); generate.mockReset(); });

  it("never calls the AI on its own: the built-in summary is shown and the button waits", async () => {
    generate.mockResolvedValue({ text: "1. Wind down earlier tonight." });
    await reachSummary(userEvent.setup());
    // Give any hidden automatic call every chance to happen.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(generate).not.toHaveBeenCalled();
    const steps = screen.getByTestId("builtin-steps");
    expect(steps).toHaveTextContent("What you told us");
    expect(steps).toHaveTextContent("What might help");
    expect(steps).toHaveTextContent(/broken and you still feel tired/);
    expect(screen.getByRole("heading", { name: "Want more tailored next steps?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate reflection" })).toBeEnabled();
    expect(screen.getByText(/private note and wearable readings are not sent/)).toBeInTheDocument();
    expect(screen.queryByText(/ORBIT is preparing feedback/)).not.toBeInTheDocument();
  });

  it("calls the AI once when the button is pressed, sends only the themes, and shows the answer beside the built-in steps", async () => {
    generate.mockResolvedValue({ text: "1. Wind down earlier tonight.\n2. Talk with your mission team about workload." });
    const user = userEvent.setup();
    await reachSummary(user);
    await user.click(screen.getByRole("button", { name: "Generate reflection" }));
    expect(await screen.findByText(/Wind down earlier tonight/)).toBeInTheDocument();
    expect(generate).toHaveBeenCalledTimes(1);
    const sent = generate.mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(["concern", "headline", "lines", "stage"]);
    expect(screen.getByTestId("builtin-steps")).toBeInTheDocument(); // nothing disappears
    expect(screen.getByRole("button", { name: "Refresh reflection" })).toBeEnabled();
  });

  it("shows a loading line while the AI works, with the built-in steps still visible", async () => {
    let finish!: (value: { text: string }) => void;
    generate.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    await reachSummary(user);
    await user.click(screen.getByRole("button", { name: "Generate reflection" }));
    expect(screen.getByText(/ORBIT is preparing a reflection/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thinking…" })).toBeDisabled();
    expect(screen.getByTestId("builtin-steps")).toBeInTheDocument();
    finish({ text: "1. Keep your routine going." });
    expect(await screen.findByText(/Keep your routine going/)).toBeInTheDocument();
  });

  it("uses plain wording, never a raw code, when the AI fails after being asked, and offers Try again", async () => {
    generate.mockResolvedValueOnce({ error: FEEDBACK_ERROR_TEXT.upstream_unavailable }).mockResolvedValueOnce({ text: "1. Rest well tonight." });
    const user = userEvent.setup();
    await reachSummary(user);
    await user.click(screen.getByRole("button", { name: "Generate reflection" }));
    expect(await screen.findByText("The AI service could not be reached.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/upstream_unavailable/);
    expect(screen.getByTestId("builtin-steps")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Rest well tonight/)).toBeInTheDocument();
    expect(screen.queryByText("The AI service could not be reached.")).not.toBeInTheDocument();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate the support notice in the summary when pain is reported", async () => {
    generate.mockResolvedValue({ text: "1. Contact your crew medic." });
    await reachSummary(userEvent.setup(), true);
    // The support notice is shown once, at the top of the summary, and never repeated.
    expect(screen.getAllByText(/Some of your answers are worth talking through/)).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(generate).not.toHaveBeenCalled();
  });
});
