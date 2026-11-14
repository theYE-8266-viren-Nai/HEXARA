import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuidanceView } from "./WorkspaceViews";

describe("Astronaut in Training guidance", () => {
  it("explains how to respond when a reading looks different", () => {
    render(<GuidanceView stage="future" onViewChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "When a reading looks different" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check the data first" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Read the reason, not just the status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tell the appropriate person" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Record the agreed follow-up" })).toBeInTheDocument();
    const navigation = within(screen.getByRole("navigation", { name: "Future guidance sections" }));
    expect(navigation.getAllByRole("link")).toHaveLength(3);
    expect(navigation.getByRole("link", { name: "Using OrbitWell" })).toHaveAttribute("href", "#future-using-orbitwell");
    expect(navigation.getByRole("link", { name: "Training guidance" })).toHaveAttribute("href", "#future-training-guidance");
    expect(navigation.getByRole("link", { name: "When readings change" })).toHaveAttribute("href", "#future-changed-readings");
    expect(navigation.queryByRole("link", { name: "Physical readiness" })).not.toBeInTheDocument();
  });

  it("provides expandable training progress and reflection guidance", () => {
    render(<GuidanceView stage="future" onViewChange={vi.fn()} />);

    const trainingHeading = screen.getByRole("heading", { name: "Training progress & reflection" });
    const readinessHeading = screen.getByRole("heading", { name: "Physical & medical readiness" });
    expect(trainingHeading.compareDocumentPosition(readinessHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("How qualification progress works")).toBeInTheDocument();
    expect(screen.getByText("How baseline days are counted")).toBeInTheDocument();
    expect(screen.getByText("How to interpret training load")).toBeInTheDocument();
    expect(screen.getByText("How to use recovery information")).toBeInTheDocument();
    expect(screen.getByText("How to conduct a useful debrief")).toBeInTheDocument();
    expect(screen.getByText(/training progress only/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A simple training rhythm" })).toBeInTheDocument();
    expect(screen.getByText("Before training")).toBeInTheDocument();
    expect(screen.getByText("During training")).toBeInTheDocument();
    expect(screen.getByText("After training")).toBeInTheDocument();
  });
});
