import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeView } from "./WorkspaceViews";
import { DeviceContext } from "../lib/deviceContext";
import { mockDashboardRepository } from "../lib/mockDashboardRepository";
import type { IngestSummary } from "../domain/ingest";
import type { DeviceStatus } from "../lib/useDeviceStream";

const snapshot = mockDashboardRepository.getSnapshot("recovery_concern", { seed: 42, replayCount: 0 });
const status: DeviceStatus = { phase: "streaming", progress: 1, label: "", detail: "", lastSyncAt: Date.now(), connecting: false, paired: true, pair: () => {}, reconnect: () => {}, disconnect: () => {} };

function renderHome(ingest: IngestSummary, stage: 'active' | 'future' | 'retired' = 'active') {
  return render(<DeviceContext.Provider value={{ status, metrics: snapshot.metrics, ingest }}>
    <HomeView profile={mockDashboardRepository.getProfiles()[0]} stage={stage} scenario="recovery_concern" metrics={snapshot.metrics} alert={snapshot.alert} dataQuality="current" loading={false} onViewChange={() => {}} />
  </DeviceContext.Provider>);
}

describe("Home data trust", () => {
  it.each(['active', 'future', 'retired'] as const)('shows the body overview only for Active Home (%s)', async stage => {
    renderHome({ sourceLabel: 'Simulated wearable', quality: 'good', notes: [], accepted: 40, rejected: 0, flagged: 0 }, stage);
    expect(screen.queryByText("PATTERN ACROSS SIGNALS")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent activity" })).not.toBeInTheDocument();
    if (stage === 'active') {
      expect(await screen.findByRole('group', {name:'Rotatable 3D human figure'})).toBeInTheDocument();
      expect(screen.queryByRole('heading', {name:'Your signals'})).not.toBeInTheDocument();
      expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
    } else {
      expect(screen.queryByRole('group', {name:'Rotatable 3D human figure'})).not.toBeInTheDocument();
    }
  });
  it("shows the alert when data quality is good", () => {
    renderHome({ sourceLabel: "Simulated wearable", quality: "good", notes: [], accepted: 40, rejected: 2, flagged: 0 });
    expect(screen.getByText(/Sleep was below your usual range/)).toBeInTheDocument();
    expect(screen.getByText("A pattern is worth reviewing")).toBeInTheDocument();
  });

  it("replaces the alert with a clear message when data is not reliable enough", () => {
    renderHome({ sourceLabel: "Simulated wearable", quality: "poor", notes: ["Too few valid readings to assess."], accepted: 1, rejected: 30, flagged: 0 });
    expect(screen.getByText("Not enough reliable data")).toBeInTheDocument();
    expect(screen.getByText(/Check that the wearable is worn snugly/)).toBeInTheDocument();
    expect(screen.queryByText(/Sleep was below your usual range/)).not.toBeInTheDocument();
    expect(screen.queryByText("A pattern is worth reviewing")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Data source and quality" })).toHaveTextContent("Data quality: poor");
    expect(screen.getByRole("region", { name: "Data source and quality" })).toHaveTextContent("Not enough reliable data to assess");
  });
});
