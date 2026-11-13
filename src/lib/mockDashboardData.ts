import type { Alert, MetricCardData, SimulationControls, SimulationScenario, TravelerProfile } from "../types/horizon";

const days = ["06-23", "06-24", "06-25", "06-26", "06-27", "06-28", "06-29"];
const points = (values: number[], baseline: number, alertedDays: number[] = []) => values.map((value, index) => ({ day: days[index], value, baseline, alert: alertedDays.includes(index) }));

export const profiles: TravelerProfile[] = [
  { id: "maya", name: "Maya Chen", role: "Mission specialist", missionDay: 46, stage: "active" },
  { id: "leon", name: "Leon Hart", role: "First-time traveler", missionDay: 8, stage: "future" },
  { id: "elena", name: "Elena Ruiz", role: "Retired astronaut", missionDay: 0, stage: "retired" },
];

const usualMetrics: MetricCardData[] = [
  { metric: "sleep_hours", label: "Sleep", unit: "h", value: 6.6, baseline: 6.5, trend: "steady", plainLanguage: "Close to your usual sleep range.", source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Last night", points: points([6.4,6.6,6.7,6.5,6.4,6.6,6.6], 6.5) },
  { metric: "resting_hr", label: "Resting heart rate", unit: "bpm", value: 63, baseline: 62, trend: "up", plainLanguage: "One beat above your usual range.", source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Daily resting summary", points: points([61,62,62,63,62,63,63], 62) },
  { metric: "hrv", label: "HRV", unit: "ms", value: 44, baseline: 45, trend: "down", plainLanguage: "Close to your usual recovery pattern.", source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Latest reading", points: points([46,45,45,44,45,44,44], 45) },
  { metric: "spo2", label: "SpO₂", unit: "%", value: 97.4, baseline: 97.5, trend: "steady", plainLanguage: "Within your usual range.", source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Latest reading", points: points([97.5,97.4,97.6,97.5,97.3,97.4,97.4], 97.5) },
  { metric: "core_temperature", label: "Skin temperature", unit: "°C", value: 33.2, baseline: 33.2, trend: "steady", plainLanguage: "Close to your usual range.", source: "Synthetic crew wearable", quality: "Simulated", aggregationPeriod: "Daily summary", points: points([33.2,33.2,33.1,33.2,33.2,33.3,33.2], 33.2) },
  { metric: "radiation_dose", label: "Radiation dose", unit: "mSv", value: 0.5, baseline: 0.5, trend: "steady", plainLanguage: "Total today. At your usual simulated daily level.", source: "Synthetic personal dosimeter", quality: "Simulated", aggregationPeriod: "Total today", points: points([.5,.5,.48,.5,.51,.5,.5], .5) },
];

export function getScenarioData(scenario: SimulationScenario, _controls: SimulationControls): { metrics: MetricCardData[]; alert: Alert | null } {
  if (scenario !== "recovery_concern") return { metrics: usualMetrics, alert: null };
  const metrics = usualMetrics.map((metric) => ({ ...metric, points: [...metric.points] }));
  metrics[0] = { ...metrics[0], value: 4.9, trend: "down", plainLanguage: "Below your usual sleep range for four of the last five days.", points: points([6.4,5.4,5.1,4.8,4.9,4.7,4.9], 6.5, [2,3,4,5,6]) };
  metrics[1] = { ...metrics[1], value: 71, trend: "up", plainLanguage: "Higher than your usual resting pattern.", points: points([62,64,67,69,70,72,71], 62, [3,4,5,6]) };
  metrics[2] = { ...metrics[2], value: 34, trend: "down", plainLanguage: "Lower than your usual recovery pattern.", points: points([45,43,40,37,35,33,34], 45, [3,4,5,6]) };
  return { metrics, alert: { id: "sleep-shift", severity: "watch", metric: "sleep_hours", reason: "Sleep was below your usual range on 4 of the last 5 days. Resting heart rate also rose while HRV fell.", nextAction: "Take the optional wellbeing check-in and review your recovery routine." } };
}
