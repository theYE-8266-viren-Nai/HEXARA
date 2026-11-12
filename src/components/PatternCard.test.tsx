import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatternCard, describeDriver } from "./PatternCard";
import { isNonDiagnostic } from "../domain/visualCheck";
import type { AnomalyAssessment, PatternLevel } from "../domain/anomalyModel";
import type { AssessmentView } from "../lib/useAssessment";

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
    expect(screen.getByRole("meter", { name: "Pattern score" })).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByText(/No single signal stands out/)).toBeInTheDocument();
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
