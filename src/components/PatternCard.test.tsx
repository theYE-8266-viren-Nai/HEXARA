import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { PatternCard, describeDriver } from "./PatternCard";
import { isNonDiagnostic } from "../domain/visualCheck";
import type { AnomalyAssessment, PatternLevel } from "../domain/anomalyModel";
import type { AssessmentView } from "../lib/useAssessment";
import type { ExplainRequest } from "../domain/explainTypes";
import type { ExplainResult } from "../lib/explainRepository";

const assessment = (level: PatternLevel, extra: Partial<AnomalyAssessment> = {}): AnomalyAssessment => ({
  asOf: "2026-05-05", level, patternScore: level === "usual" ? 8 : level === "different" ? 55 : level === "notably_different" ? 100 : 0, baselineDays: 28, metricsUsed: ["heart_rate", "hrv", "sleep_hours"], elevatedDays: 0,
  drivers: level === "usual" || level === "insufficient_baseline" ? [] : [
    { metric: "sleep_hours", label: "Sleep", direction: "lower", changePct: -12.4, contribution: 0.5, z: -3.1 },
    { metric: "heart_rate", label: "Resting heart rate", direction: "higher", changePct: 18.2, contribution: 0.3, z: 3.5 },
    { metric: "hrv", label: "HRV", direction: "lower", changePct: -22, contribution: 0.2, z: -2.4, caveat: "HRV is a rough, short-term estimate." },
  ], ...extra,
});
const ok = (level: PatternLevel, extra?: Partial<AnomalyAssessment>): AssessmentView => ({ status: "ok", basis: "stored history", assessment: assessment(level, extra) });

describe("PatternCard", () => {
  it("shows a calm usual state with no drivers", () => {
    render(<PatternCard view={ok("usual")} />);
    expect(screen.getByText("Close to your usual pattern")).toBeInTheDocument();
    expect(screen.getByText(/Compared with your earlier 28 days.*3 signal.*included/)).toBeInTheDocument();
    expect(screen.getByText(/Each of the 3 reviewed signals stayed inside its own usual range/)).toBeInTheDocument();
  });

  it("names the signals that changed together, with direction and percent", () => {
    render(<PatternCard view={ok("notably_different")} />);
    expect(screen.getByText("Noticeably different from your usual pattern")).toBeInTheDocument();
    expect(screen.getByText(/These signals changed together/)).toBeInTheDocument();
    expect(screen.getByText(/Sleep lower \(−12.4%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Resting heart rate higher \(\+18.2%\)/)).toBeInTheDocument();
    expect(screen.getByText(/HRV is a rough, short-term estimate/)).toBeInTheDocument();
    expect(screen.getByText(/Not a diagnosis. Alerts work as before/)).toBeInTheDocument();
  });

  it("explains too little history and each unavailable reason", () => {
    const { rerender } = render(<PatternCard view={ok("insufficient_baseline", { baselineDays: 9 })} />);
    expect(screen.getByText("Not enough history yet to compare")).toBeInTheDocument();
    expect(screen.getByText(/So far there are 9 days/)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    for (const [reason, text] of [["poor_quality", /too low quality/], ["data_unavailable", /not arriving/], ["no_history", /two weeks/], ["needs_full_day", /full completed day/]] as const) {
      rerender(<PatternCard view={{ status: "unavailable", reason }} />);
      expect(screen.getByText("Pattern view paused")).toBeInTheDocument();
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("never uses diagnostic, risk, or condition language at any level", () => {
    const levels: PatternLevel[] = ["usual", "different", "notably_different", "insufficient_baseline"];
    for (const level of levels) {
      const { container, unmount } = render(<PatternCard view={ok(level, { elevatedDays: 4 })} />);
      const text = container.textContent ?? "";
      expect(isNonDiagnostic(text.replace("Not a diagnosis.", "")), level).toBe(true);
      expect(text).not.toMatch(/\brisk\b|illness|disease|condition|abnormal|danger/i);
      unmount();
    }
    expect(describeDriver(assessment("different").drivers[0])).toBe("Sleep lower (−12.4%)");
  });
});

describe("PatternCard explain button", () => {
  const request: ExplainRequest = { stage: "active", level: "notably_different", patternScore: 100, dataQuality: "good", source: "simulated", audience: "traveler", drivers: [{ metricLabel: "Sleep", direction: "lower", changePct: -12 }] };

  it("is on demand: nothing runs until pressed, and the privacy line is shown first", async () => {
    const run = vi.fn<(r: ExplainRequest) => Promise<ExplainResult>>().mockResolvedValue({ text: "Sleep was lower than your usual range. Tell the crew medic if it continues.", source: "ai" });
    const user = userEvent.setup();
    render(<PatternCard view={ok("notably_different")} explain={{ request, run }} />);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByText(/de-identified summary.*Raw readings never leave your device/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Explain in plain English" }));
    expect(run).toHaveBeenCalledWith(request);
    expect(await screen.findByText("Explanation by OrbitWell (AI-assisted)")).toBeInTheDocument();
    expect(screen.getByText(/Sleep was lower than your usual range/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain again" })).toBeInTheDocument();
  });

  it("shows a loading state, and labels the built-in text with the reason it was used", async () => {
    let resolve!: (value: ExplainResult) => void;
    const run = vi.fn(() => new Promise<ExplainResult>((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<PatternCard view={ok("different")} explain={{ request, run }} />);
    await user.click(screen.getByRole("button", { name: "Explain in plain English" }));
    expect(screen.getByText("Writing a short explanation…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain in plain English" })).toBeDisabled();
    resolve({ text: "Sleep was lower, compared with your own usual range.", source: "template", reason: "timeout" });
    expect(await screen.findByText("Built-in explanation")).toBeInTheDocument();
    expect(screen.getByText(/took too long, so this is the built-in text/)).toBeInTheDocument();
    expect(screen.queryByText(/AI-assisted/)).not.toBeInTheDocument();
  });

  it("has no button when there is nothing to explain, and never for paused or too-little-history cards", () => {
    const { rerender } = render(<PatternCard view={ok("usual")} explain={{ request: null, run: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Explain/ })).not.toBeInTheDocument();
    rerender(<PatternCard view={{ status: "unavailable", reason: "poor_quality" }} explain={{ request, run: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Explain/ })).not.toBeInTheDocument();
    rerender(<PatternCard view={ok("insufficient_baseline")} explain={{ request, run: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Explain/ })).not.toBeInTheDocument();
  });

  it("keeps the explanation area free of diagnostic wording in every fallback state", async () => {
    const user = userEvent.setup();
    for (const reason of ["not_configured", "error", "timeout", "unsafe", "invalid_request"] as const) {
      const { container, unmount } = render(<PatternCard view={ok("notably_different")} explain={{ request, run: async () => ({ text: "Sleep was lower, compared with your own usual range.", source: "template", reason }) }} />);
      await user.click(screen.getByRole("button", { name: "Explain in plain English" }));
      await waitFor(() => expect(screen.getByText("Built-in explanation")).toBeInTheDocument());
      expect(isNonDiagnostic((container.textContent ?? "").replace("Not a diagnosis.", "").replace(/did not pass OrbitWell's wording check/, ""))).toBe(true);
      unmount();
    }
  });
});
