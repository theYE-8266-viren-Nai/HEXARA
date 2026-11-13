import { describe, expect, it } from "vitest";
import { createBackendDashboardRepository } from "./backendDashboardRepository";
import type { HorizonRepository, Observation } from "../domain/types";

describe("backend dashboard adapter", () => {
  it("maps backend profiles and observations while preserving source metadata", async () => {
    const repository: HorizonRepository = {
      listPeople: async () => ({
        data: [{ id: "traveler-01", name: "Synthetic Aster", life_stage: "active", mission_day: 180, is_synthetic: true }],
        source: "supabase",
      }),
      listObservations: async () => ({ data: observations, source: "local", warning: "Using deterministic fallback.", quality: "stale-data" }),
      listEvents: async () => ({ data: [], source: "local" }),
    };
    const adapter = createBackendDashboardRepository(repository);

    const profiles = await adapter.loadProfiles();
    const snapshot = await adapter.loadSnapshot("traveler-01", { seed: 42, replayCount: 0 });

    expect(profiles.data[0]).toMatchObject({ id: "traveler-01", name: "Synthetic Aster", stage: "active" });
    expect(snapshot.source).toBe("local");
    expect(snapshot.warning).toBe("Using deterministic fallback.");
    expect(snapshot.quality).toBe("stale");
    expect(snapshot.data.metrics).toHaveLength(6);
    expect(snapshot.data.metrics.find((metric) => metric.metric === "resting_hr")).toMatchObject({ value: 64, baseline: 64 });
    expect(snapshot.data.metrics.find((metric) => metric.metric === "radiation_dose")).toMatchObject({ value: 0.45, unit: "mSv", source: "Synthetic personal dosimeter", quality: "Simulated", aggregationPeriod: "Total today", plainLanguage: expect.stringContaining("Total today") });
  });
});

const observations: Observation[] = [
  { id: "heart-rate", person_id: "traveler-01", observed_on: "2026-06-29", metric: "heart_rate", value: 64, unit: "bpm", context: "rest", seed: 42, is_synthetic: true },
  { id: "hrv", person_id: "traveler-01", observed_on: "2026-06-29", metric: "hrv", value: 48, unit: "ms", context: "rest", seed: 42, is_synthetic: true },
  { id: "sleep", person_id: "traveler-01", observed_on: "2026-06-29", metric: "sleep_hours", value: 7.5, unit: "h", context: "rest", seed: 42, is_synthetic: true },
  { id: "temperature", person_id: "traveler-01", observed_on: "2026-06-29", metric: "skin_temperature", value: 33.2, unit: "degC", context: "rest", seed: 42, is_synthetic: true },
  { id: "spo2", person_id: "traveler-01", observed_on: "2026-06-29", metric: "spo2", value: 98, unit: "%", context: "rest", seed: 42, is_synthetic: true },
  { id: "radiation", person_id: "traveler-01", observed_on: "2026-06-29", metric: "radiation_dose", value: 0.45, unit: "mSv", context: "rest", seed: 42, is_synthetic: true },
];
