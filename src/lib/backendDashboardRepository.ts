import type { DashboardSnapshot } from "./dashboardRepository";
import { evaluateAlerts } from "../domain/alertEngine";
import type { Alert, LifeStage, MetricCardData, MetricName, SimulationControls, TravelerProfile } from "../types/horizon";
import type { Alert as DomainAlert, DataQualityState as BackendQuality, HorizonRepository, MetricName as BackendMetricName, Observation, RepositoryResult, Traveler } from "../domain/types";

export type DashboardSource = "supabase" | "local";

export interface DashboardLoadResult<T> {
  data: T;
  source: DashboardSource;
  warning?: string;
  quality?: "current" | "stale" | "disconnected" | "offline" | "insufficient_baseline";
}

export interface BackendDashboardRepository {
  loadProfiles(): Promise<DashboardLoadResult<TravelerProfile[]>>;
  loadSnapshot(personId: string, controls: SimulationControls): Promise<DashboardLoadResult<DashboardSnapshot>>;
}

const metricMap: Record<BackendMetricName, MetricName> = {
  heart_rate: "resting_hr",
  hrv: "hrv",
  sleep_hours: "sleep_hours",
  skin_temperature: "core_temperature",
  spo2: "spo2",
  radiation_dose: "radiation_dose",
};

const metricCopy: Record<MetricName, { label: string; unit: string }> = {
  resting_hr: { label: "Resting heart rate", unit: "bpm" },
  hrv: { label: "HRV", unit: "ms" },
  sleep_hours: { label: "Sleep", unit: "h" },
  core_temperature: { label: "Skin temperature", unit: "°C" },
  spo2: { label: "SpO₂", unit: "%" },
  radiation_dose: { label: "Radiation dose", unit: "mSv" },
};

const metricOrder: BackendMetricName[] = ["sleep_hours", "heart_rate", "hrv", "spo2", "skin_temperature", "radiation_dose"];

const metricMetadata: Record<BackendMetricName, Pick<MetricCardData, "source" | "quality" | "aggregationPeriod">> = {
  sleep_hours: { source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Last night" },
  heart_rate: { source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Daily resting summary" },
  hrv: { source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Latest reading" },
  spo2: { source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Latest reading" },
  skin_temperature: { source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Daily summary" },
  radiation_dose: { source: "Synthetic personal dosimeter", quality: "Simulated", aggregationPeriod: "Total today" },
};

export function createBackendDashboardRepository(repository: HorizonRepository): BackendDashboardRepository {
  return {
    async loadProfiles() {
      const result = await repository.listPeople();
      return { data: result.data.map(toProfile), source: result.source, warning: result.warning };
    },
    async loadSnapshot(personId, controls) {
      const [observations, events] = await Promise.all([
        repository.listObservations(personId, { from: "2026-01-01", to: "2026-06-29", controls: { seed: controls.seed, replayCount: controls.replayCount, scenario: "usual" } }),
        repository.listEvents(personId, { controls: { seed: controls.seed, replayCount: controls.replayCount, scenario: "usual" } }),
      ]);
      return {
        data: toDashboardSnapshot(observations.data, controls),
        source: mergeSource(observations, events),
        warning: [observations.warning, events.warning].filter(Boolean).join(" ") || undefined,
        quality: toQuality(observations.quality),
      };
    },
  };
}

function toQuality(quality?: BackendQuality): DashboardLoadResult<unknown>["quality"] {
  return quality === "stale-data" ? "stale" : quality === "missing-data" ? "disconnected" : quality === "offline" ? "offline" : quality === "insufficient-baseline" ? "insufficient_baseline" : "current";
}

function toProfile(person: Traveler): TravelerProfile {
  const role = person.life_stage === "retired" ? "Retired astronaut" : person.life_stage === "future" ? "Future traveler" : "Mission specialist";
  return { id: person.id, name: person.name, role, missionDay: person.mission_day, stage: person.life_stage as LifeStage };
}

function toMetricCards(result: Observation[], controls: SimulationControls): MetricCardData[] {
  const ordered = [...result].sort((left, right) => left.observed_on.localeCompare(right.observed_on) || left.id.localeCompare(right.id));
  return metricOrder.map((backendMetric) => {
    const observations = ordered.filter((observation) => observation.metric === backendMetric);
    const recent = observations.slice(-7);
    const baselineWindow = observations.slice(-30);
    const baseline = average(baselineWindow.map((observation) => observation.value));
    const latest = recent.at(-1)?.value ?? baseline;
    const copy = metricCopy[metricMap[backendMetric]];
    const delta = latest - baseline;
    const tolerance = Math.max(Math.abs(baseline) * 0.01, 0.05);
    return {
      metric: metricMap[backendMetric],
      label: copy.label,
      unit: copy.unit,
      value: round(latest),
      baseline: round(baseline),
      trend: delta > tolerance ? "up" : delta < -tolerance ? "down" : "steady",
      plainLanguage: backendMetric === "radiation_dose" ? `Total today. Compared with your last 30 simulated daily totals (seed ${controls.seed}, replay ${controls.replayCount}).` : `Compared with your last 30 simulated days (seed ${controls.seed}, replay ${controls.replayCount}).`,
      ...metricMetadata[backendMetric],
      points: recent.map((observation) => ({ day: observation.observed_on.slice(5), value: round(observation.value), baseline: round(baseline) })),
    };
  });
}

/** Maps a domain alert to the UI alert. Used for stored history and for live-device analysis. */
export function toUiAlert(domainAlert: DomainAlert): Alert {
  return {
    id: domainAlert.id,
    severity: "watch",
    metric: metricMap[domainAlert.metric],
    reason: domainAlert.explanation,
    nextAction: "Review the trend and complete the optional wellbeing check-in.",
  };
}

function toDashboardSnapshot(observations: Observation[], controls: SimulationControls): DashboardSnapshot {
  const domainAlert = evaluateAlerts(observations)[0];
  const metrics = toMetricCards(observations, controls);
  if (!domainAlert) return { metrics, alert: null, history: observations };
  return {
    metrics: metrics.map((metric) => metric.metric === metricMap[domainAlert.metric]
      ? { ...metric, points: metric.points.map((point) => ({ ...point, alert: point.day === domainAlert.observed_on.slice(5) })) }
      : metric),
    alert: toUiAlert(domainAlert),
    history: observations,
  };
}

function mergeSource(...results: Array<{ source: DashboardSource }>): DashboardSource {
  return results.some((result) => result.source === "supabase") ? "supabase" : "local";
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

