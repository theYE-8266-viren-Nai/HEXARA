import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlyHistorySection } from "./WorkspaceViews";
import type { MonthlyHistorySummary } from "../domain/monthlyHistory";

const summaries: MonthlyHistorySummary[] = [
  { month: "2026-01", label: "January 2026", personalSummary: "Not enough readings to compare this month with your earlier pattern.", notableDays: 0, quality: "insufficient", metrics: [] },
  { month: "2026-02", label: "February 2026", personalSummary: "Most signals stayed close to your earlier personal pattern.", notableDays: 1, quality: "good", metrics: [{ metric: "heart_rate", average: 62, minimum: 58, maximum: 67, observedDays: 28, direction: "usual" }] },
];

describe("MonthlyHistorySection", () => {
  it("marks months that have not begun yet as upcoming and opens the latest month that has", () => {
    const months = ["2026-05", "2026-06", "2026-07", "2026-08"].map((month, index) => ({ ...summaries[1], month, label: ["May", "June", "July", "August"][index] + " 2026" }));
    render(<MonthlyHistorySection summaries={months} now={new Date("2026-06-15T12:00:00Z")} />);
    expect(screen.getAllByText("Upcoming · simulated")).toHaveLength(2);
    expect(screen.getByText("August 2026").parentElement).toHaveTextContent("Upcoming · simulated");
    expect(screen.getByText("May 2026").parentElement).not.toHaveTextContent("Upcoming");
    expect(screen.getByText("June 2026").closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/July 2026/).closest("details")).not.toHaveAttribute("open");
    expect(months.filter((month) => screen.getByText(new RegExp(month.label)).closest("details")?.hasAttribute("open"))).toHaveLength(1);
  });

  it("opens the newest month when every month is still ahead or the window has no future months", () => {
    const months = ["2026-05", "2026-06"].map((month, index) => ({ ...summaries[1], month, label: ["May", "June"][index] + " 2026" }));
    const { unmount } = render(<MonthlyHistorySection summaries={months} now={new Date("2027-01-10T12:00:00Z")} />);
    expect(screen.getByText("June 2026").closest("details")).toHaveAttribute("open");
    expect(screen.queryByText("Upcoming · simulated")).not.toBeInTheDocument();
    unmount();
    render(<MonthlyHistorySection summaries={months} now={new Date("2026-01-10T12:00:00Z")} />);
    expect(screen.getAllByText("Upcoming · simulated")).toHaveLength(2);
    expect(screen.getByText("June 2026").closest("details")).toHaveAttribute("open");
  });

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
