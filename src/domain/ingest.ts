/**
 * Horizon ingestion pipeline: untrusted device data -> sanitized readings -> daily observations -> alerts.
 *
 * Horizon does not measure anything. External devices, files, or services send rows;
 * this module validates and cleans them, scores their quality, and hands only
 * trustworthy data to the existing alert engine. Nothing here sets alert thresholds.
 *
 * Rejected rows are always reported with a reason. Nothing is silently dropped.
 */
import { evaluateAlerts } from "./alertEngine";
import { metricUnits } from "./types";
import type { Alert, MetricName, Observation } from "./types";

export type DataSource = "simulated" | "file" | "bluetooth" | "api";
export type ReadingContext = "rest" | "exercise";
export type ReadingFlag = "spike" | "flatline";
export type IngestQuality = "good" | "limited" | "poor";

/** One untrusted input row, with its original position for error reporting. */
export interface RawRow { row: number; fields: Record<string, unknown>; }

export interface Reading {
  metric: MetricName;
  value: number;
  unit: (typeof metricUnits)[MetricName];
  observedAt: string; // ISO 8601 UTC
  deviceId: string;
  source: DataSource;
  context: ReadingContext;
  /** Set by artefact detection. Flagged readings stay visible but are excluded from analysis. */
  flag?: ReadingFlag;
}

export interface RejectedRow { row: number; reason: string; }

export interface SanitizeResult {
  accepted: Reading[];
  rejected: RejectedRow[];
  flagged: number;
  quality: IngestQuality;
  qualityNotes: string[];
}

export interface SanitizeOptions {
  source: DataSource;
  /** Injectable clock for deterministic tests. */
  now?: Date;
  defaultDeviceId?: string;
}

/** Plausible physiological ranges. Values outside these are treated as sensor errors, not findings. */
export const PLAUSIBLE_RANGE: Record<MetricName, [number, number]> = {
  heart_rate: [30, 220],
  hrv: [1, 300],
  sleep_hours: [0, 24],
  skin_temperature: [30, 42],
  spo2: [70, 100],
  radiation_dose: [0, 50],
};

/** A jump this large from the recent median is more likely a sensor artefact than a real change. */
const SPIKE_LIMIT: Record<MetricName, number> = { heart_rate: 40, hrv: 80, sleep_hours: 12, skin_temperature: 2, spo2: 6, radiation_dose: 10 };
const FLATLINE_RUN = 8;
const FLATLINE_METRICS: MetricName[] = ["heart_rate", "hrv", "spo2"];
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 366 * 86400000;
const MIN_ACCEPTED_FOR_ANALYSIS = 3;

const METRIC_ALIASES: Record<string, MetricName> = {
  heart_rate: "heart_rate", heartrate: "heart_rate", hr: "heart_rate", pulse: "heart_rate", bpm: "heart_rate",
  hrv: "hrv", heart_rate_variability: "hrv",
  sleep_hours: "sleep_hours", sleep: "sleep_hours", sleep_duration: "sleep_hours",
  skin_temperature: "skin_temperature", temperature: "skin_temperature", temp: "skin_temperature", skin_temp: "skin_temperature", core_temperature: "skin_temperature",
  spo2: "spo2", oxygen: "spo2", oxygen_saturation: "spo2",
  radiation_dose: "radiation_dose", radiation: "radiation_dose", dose: "radiation_dose",
};

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");
const cleanText = (value: unknown, max = 64) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

/** Converts to the canonical unit for the metric, or returns null when the unit is unknown. */
export function convertUnit(metric: MetricName, value: number, unitText: string): number | null {
  const unit = unitText.trim().toLowerCase().replace(/\s+/g, "");
  const canonical = metricUnits[metric].toLowerCase();
  if (unit === "" || unit === canonical) return value;
  switch (metric) {
    case "skin_temperature":
      if (unit === "f" || unit === "°f" || unit === "degf") return (value - 32) * 5 / 9;
      if (unit === "c" || unit === "°c") return value;
      if (unit === "k") return value - 273.15;
      return null;
    case "hrv":
      if (unit === "s" || unit === "sec") return value * 1000;
      if (unit === "ms") return value;
      return null;
    case "sleep_hours":
      if (unit === "min" || unit === "minutes") return value / 60;
      if (unit === "s" || unit === "sec") return value / 3600;
      if (unit === "hr" || unit === "hours" || unit === "h") return value;
      return null;
    case "heart_rate":
      return unit === "bpm" || unit === "beats/min" ? value : null;
    case "spo2":
      return unit === "percent" || unit === "%" ? value : null;
    case "radiation_dose":
      if (unit === "msv" || unit === "msv/day") return value;
      if (unit === "usv" || unit === "µsv" || unit === "μsv") return value / 1000;
      return null;
  }
}

/** Validates, converts, and de-duplicates rows; then flags artefacts and scores quality. */
export function sanitizeReadings(rows: RawRow[], options: SanitizeOptions): SanitizeResult {
  const now = (options.now ?? new Date()).getTime();
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  const accepted: Reading[] = [];

  for (const { row, fields } of rows) {
    const lookup = new Map(Object.entries(fields ?? {}).map(([key, value]) => [normalizeKey(key), value]));
    const pick = (...names: string[]) => names.map((name) => lookup.get(name)).find((value) => value !== undefined && value !== null && value !== "");

    const metricText = cleanText(pick("metric", "type", "measurement"));
    const metric = METRIC_ALIASES[normalizeKey(metricText)];
    if (!metric) { rejected.push({ row, reason: metricText ? `Unknown metric "${metricText}".` : "Missing metric." }); continue; }

    const rawValue = pick("value", "reading", "val");
    const numeric = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" && rawValue.trim() !== "" ? Number(rawValue) : NaN;
    if (!Number.isFinite(numeric)) { rejected.push({ row, reason: "Value is missing or not a finite number." }); continue; }

    const converted = convertUnit(metric, numeric, cleanText(pick("unit", "units"), 16));
    if (converted === null) { rejected.push({ row, reason: `Unit "${cleanText(pick("unit", "units"), 16)}" is not supported for ${metric}.` }); continue; }

    // Devices can report their own signal quality. A poor-contact sample is not trusted.
    const signal = cleanText(pick("signal_quality", "signalquality", "contact")).toLowerCase();
    if (signal === "low" || signal === "poor" || signal === "bad") { rejected.push({ row, reason: "Device reported poor sensor contact for this sample." }); continue; }

    const [min, max] = PLAUSIBLE_RANGE[metric];
    if (converted < min || converted > max) {
      const contact = metric === "heart_rate" && converted === 0 ? " Likely lost sensor contact." : "";
      rejected.push({ row, reason: `Value ${round(converted)} is outside the plausible ${min}–${max} range for ${metric}.${contact}` });
      continue;
    }

    const timeValue = pick("timestamp", "time", "ts", "datetime", "observed_at");
    const time = typeof timeValue === "number" ? new Date(timeValue < 1e12 ? timeValue * 1000 : timeValue) : new Date(cleanText(timeValue, 40));
    if (timeValue === undefined || Number.isNaN(time.getTime())) { rejected.push({ row, reason: "Timestamp is missing or invalid." }); continue; }
    if (time.getTime() > now + MAX_FUTURE_MS) { rejected.push({ row, reason: "Timestamp is in the future." }); continue; }
    if (time.getTime() < now - MAX_AGE_MS) { rejected.push({ row, reason: "Timestamp is more than a year old." }); continue; }

    const deviceId = cleanText(pick("deviceid", "device_id", "device")) || options.defaultDeviceId || `${options.source}-device`;
    const context: ReadingContext = cleanText(pick("context", "activity")).toLowerCase() === "exercise" ? "exercise" : "rest";
    const observedAt = time.toISOString();
    const key = `${deviceId}|${metric}|${observedAt}`;
    if (seen.has(key)) { rejected.push({ row, reason: "Duplicate reading for this device, metric and time." }); continue; }
    seen.add(key);

    accepted.push({ metric, value: round(converted), unit: metricUnits[metric], observedAt, deviceId, source: options.source, context });
  }

  accepted.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.metric.localeCompare(b.metric));
  const flagged = flagArtefacts(accepted);
  const { quality, notes } = scoreQuality(accepted.length, rejected.length, flagged);
  return { accepted, rejected, flagged, quality, qualityNotes: notes };
}

/** Marks spikes (huge jump from recent median) and flatlines (stuck sensor). Mutates the readings' `flag`. */
function flagArtefacts(readings: Reading[]): number {
  let flagged = 0;
  const byMetric = new Map<MetricName, Reading[]>();
  for (const reading of readings) byMetric.set(reading.metric, [...(byMetric.get(reading.metric) ?? []), reading]);
  for (const [metric, series] of byMetric) {
    const rest = series.filter((reading) => reading.context === "rest");
    const window: number[] = [];
    for (const reading of rest) {
      if (window.length >= 3 && Math.abs(reading.value - median(window.slice(-5))) > SPIKE_LIMIT[metric]) {
        reading.flag = "spike"; flagged += 1; continue; // spikes never enter the comparison window
      }
      window.push(reading.value);
    }
    if (FLATLINE_METRICS.includes(metric)) {
      let run: Reading[] = [];
      const closeRun = () => { if (run.length >= FLATLINE_RUN) for (const reading of run) if (!reading.flag) { reading.flag = "flatline"; flagged += 1; } run = []; };
      for (const reading of rest) {
        if (run.length && reading.value !== run[0].value) closeRun();
        run.push(reading);
      }
      closeRun();
    }
  }
  return flagged;
}

function scoreQuality(accepted: number, rejected: number, flagged: number): { quality: IngestQuality; notes: string[] } {
  const total = accepted + rejected;
  const notes: string[] = [];
  if (accepted < MIN_ACCEPTED_FOR_ANALYSIS) return { quality: "poor", notes: ["Too few valid readings to assess."] };
  const rejectedShare = total ? rejected / total : 0;
  const flaggedShare = flagged / accepted;
  if (rejected) notes.push(`${rejected} of ${total} rows were rejected.`);
  if (flagged) notes.push(`${flagged} readings look like sensor artefacts and are excluded from analysis.`);
  if (rejectedShare > 0.5 || flaggedShare > 0.5) return { quality: "poor", notes: [...notes, "Most of this data is unreliable."] };
  if (rejectedShare > 0.2 || flaggedShare > 0.2) return { quality: "limited", notes };
  return { quality: "good", notes };
}

/**
 * Collapses trusted readings into one observation per person/metric/day/context
 * (mean value; last value for sleep). Flagged artefacts are excluded.
 */
export function toDailyObservations(readings: Reading[], personId: string): Observation[] {
  const groups = new Map<string, Reading[]>();
  for (const reading of readings) {
    if (reading.flag) continue;
    const key = `${reading.metric}|${reading.observedAt.slice(0, 10)}|${reading.context}`;
    groups.set(key, [...(groups.get(key) ?? []), reading]);
  }
  const observations = [...groups.entries()].map(([key, group]) => {
    const [metric, day, context] = key.split("|") as [MetricName, string, ReadingContext];
    const value = metric === "sleep_hours" ? group[group.length - 1].value : group.reduce((sum, reading) => sum + reading.value, 0) / group.length;
    return { id: `ingest-${personId}-${day}-${metric}-${context}`, person_id: personId, observed_on: day, metric, unit: metricUnits[metric], value: round(value), context, seed: 0, is_synthetic: true } as Observation;
  });
  return observations.sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.metric.localeCompare(b.metric));
}

/** Compact, UI-friendly description of one ingest run. */
export interface IngestSummary { sourceLabel: string; quality: IngestQuality; notes: string[]; accepted: number; rejected: number; flagged: number; }

export function summarizeIngest(result: SanitizeResult, sourceLabel: string): IngestSummary {
  return { sourceLabel, quality: result.quality, notes: result.qualityNotes, accepted: result.accepted.length, rejected: result.rejected.length, flagged: result.flagged };
}

export interface IngestAnalysis {
  observations: Observation[];
  alerts: Alert[];
  quality: IngestQuality;
  /** Plain-language status shown instead of an alert when data is not reliable enough. */
  message: string;
}

/** Runs the existing alert engine, but only on trustworthy data. Poor-quality data never produces an alert. */
export function analyzeReadings(result: SanitizeResult, personId: string): IngestAnalysis {
  const observations = toDailyObservations(result.accepted, personId);
  if (result.quality === "poor") {
    return { observations, alerts: [], quality: "poor", message: "Not enough reliable data to assess. Check the device and try again." };
  }
  const alerts = evaluateAlerts(observations);
  const message = alerts.length
    ? "Some readings differ from your usual pattern. Review the reasons below."
    : observations.length ? "Your readings are close to your personal pattern, or there is not yet enough history to compare." : "No readings to analyze.";
  return { observations, alerts, quality: result.quality, message: result.quality === "limited" ? `${message} Data quality is limited, so treat this with caution.` : message };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function round(value: number): number { return Math.round(value * 1000) / 1000; }
