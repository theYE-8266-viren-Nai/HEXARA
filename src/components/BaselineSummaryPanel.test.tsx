import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BaselineSummaryPanel } from "./BaselineSummaryPanel";
import type { PreparationRepository } from "../lib/preparationRepository";
import type { BaselineCheckIn } from "../types/horizon";

const c = (date: string, hr: number, sleep: number): BaselineCheckIn => ({ checkInDate: date, restingHeartRate: hr, sleepHours: sleep, exerciseCompleted: false, note: "" });
const repo = (data: BaselineCheckIn[], warning?: string) => ({ listBaselineCheckins: async () => ({ data, warning }) }) as unknown as PreparationRepository;

describe("BaselineSummaryPanel", () => {
  it("explains that the baseline is personal and never a norm or clearance", async () => {
    render(<BaselineSummaryPanel repository={repo([])} refreshKey={0} />);
    expect(await screen.findByText(/0 of 3 check-ins/)).toBeInTheDocument();
    expect(screen.getByText(/not a norm, a target, or flight clearance/)).toBeInTheDocument();
  });

  it("shows progress, but no 'usual' range, before there are enough check-ins", async () => {
    render(<BaselineSummaryPanel repository={repo([c("2026-11-01", 62, 7), c("2026-11-02", 64, 6.5)])} refreshKey={0} />);
    expect(await screen.findByText(/2 of 3 check-ins/)).toBeInTheDocument();
    expect(screen.queryByText(/Usually about/)).not.toBeInTheDocument();
    expect(screen.getByText(/another day to keep building/)).toBeInTheDocument();
  });

  it("shows the person's own range once the baseline is ready", async () => {
    render(<BaselineSummaryPanel repository={repo([c("2026-11-01", 60, 7), c("2026-11-02", 64, 6.5), c("2026-11-03", 62, 7.5)])} refreshKey={0} />);
    expect(await screen.findByText(/3 of 3 check-ins · baseline ready/)).toBeInTheDocument();
    expect(screen.getByText(/Usually about 62 bpm \(range 60–64, 3 days\)/)).toBeInTheDocument();
    expect(screen.getByText(/Usually about 7 h \(range 6.5–7.5, 3 days\)/)).toBeInTheDocument();
  });

  it("says so when cloud save is unavailable instead of pretending to have data", async () => {
    render(<BaselineSummaryPanel repository={undefined} refreshKey={0} />);
    expect(await screen.findByText(/0 of 3 check-ins/)).toBeInTheDocument();
    expect(screen.getByText(/Cloud save is unavailable for this session/)).toBeInTheDocument();
  });
});
