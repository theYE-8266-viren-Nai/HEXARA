import type { Observation } from "../domain/types";
import type { Alert, MetricCardData, SimulationControls, SimulationScenario, TravelerProfile } from "../types/horizon";

export interface DashboardSnapshot {
  metrics: MetricCardData[];
  alert: Alert | null;
  /** Daily history behind the cards. Lets a live source be analyzed against the same 30-day baseline. */
  history?: Observation[];
}

/**
 * UI-facing data boundary. A Supabase-backed implementation can replace the
 * mock adapter without requiring views to know how records are fetched.
 */
export interface DashboardRepository {
  getProfiles(): TravelerProfile[];
  getSnapshot(scenario: SimulationScenario, controls: SimulationControls): DashboardSnapshot;
}
