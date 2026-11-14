import type { MetricName } from "../types/horizon";

export function formatDurationHours(value: number, compact = false) {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return compact ? `${hours}h ${minutes}m` : `${hours} h ${minutes} min`;
}

export function formatMetricValue(metric: MetricName, value: number, unit: string, compact = false) {
  return metric === "sleep_hours" ? formatDurationHours(value, compact) : `${value} ${unit}`;
}
