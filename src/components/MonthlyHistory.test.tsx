import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlyHistorySection } from "./WorkspaceViews";
import type { MonthlyHistorySummary } from "../domain/monthlyHistory";

const summaries: MonthlyHistorySummary[] = [
  { month: "2026-01", label: "January 2026", personalSummary: "Not enough readings to compare this month with your earlier pattern.", notableDays: 0, quality: "insufficient", metrics: [] },
  { month: "2026-02", label: "February 2026", personalSummary: "Most signals stayed close to your earlier personal pattern.", notableDays: 1, quality: "good", metrics: [{ metric: "heart_rate", average: 62, minimum: 58, maximum: 67, observedDays: 28, direction: "usual" }] },
];

describe("MonthlyHistorySection", () => {
  it("shows the newest month expanded and older months collapsible", () => {
    render(<MonthlyHistorySection summaries={summaries} />);
    expect(screen.getByRole("heading", { name: "Monthly personal history" })).toBeInTheDocument();
    const newest = screen.getByText("February 2026").closest("details");
    const older = screen.getByText("January 2026").closest("details");
    expect(newest).toHaveAttribute("open");
    expect(older).not.toHaveAttribute("open");
    expect(screen.getByText("Resting heart rate")).toBeInTheDocument();
    expect(screen.getByText(/context, not a diagnosis/)).toBeInTheDocument();
  });
});
