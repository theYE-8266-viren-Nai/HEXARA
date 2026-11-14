/**
 * The assumed device and health-signal contract.
 *
 * OrbitWell analyzes readings; it does not measure anything. Because real hardware cannot be
 * tested in this research demo, every signal is ASSUMED to arrive from an imagined crew
 * wearable plus a personal dosimeter. This file is the single source of truth for that
 * assumption. The docs page and the in-app panel are both generated from it, and a test
 * keeps units and ranges identical to the sanitizer's (domain/ingest.ts).
 *
 * Simulated data only. Not medical advice. Not diagnostic.
 */
import { PLAUSIBLE_RANGE } from "./ingest";
import { metricUnits, type MetricName } from "./types";

export interface SignalAssumption {
  metric: MetricName;
  label: string;
  unit: string;
  /** Values outside this range are treated as sensor errors and rejected by the sanitizer. */
  range: [number, number];
  device: string;
  cadence: string;
  note: string;
}

const signal = (metric: MetricName, label: string, device: string, cadence: string, note: string): SignalAssumption => ({
  metric, label, unit: metricUnits[metric], range: PLAUSIBLE_RANGE[metric], device, cadence, note,
});

export const ASSUMED_SIGNALS: SignalAssumption[] = [
  signal("heart_rate", "Heart rate", "Wearable or chest strap", "Continuous (about once a second over Bluetooth)", "Resting and exercise readings are kept apart; exercise heart rate never raises a recovery alert."),
  signal("hrv", "Heart-rate variability (HRV)", "Wearable, or estimated from beat-to-beat intervals", "About every 10 seconds when intervals are sent", "Estimated as RMSSD from beat-to-beat intervals. A rough, short-term estimate."),
  signal("spo2", "Blood oxygen (SpO₂)", "Wearable pulse oximeter", "Periodic", "Brief dips are common sensor noise and are not treated as findings."),
  signal("skin_temperature", "Skin temperature", "Wearable skin sensor", "Periodic", "Skin temperature, not core body temperature. It normally sits several degrees below core."),
  signal("sleep_hours", "Sleep", "Wearable sleep tracking", "Once per day (last night's total)", "A daily total, so it only changes when a new night is synced."),
  signal("radiation_dose", "Radiation dose", "Personal dosimeter", "Periodic", "Consumer wearables do not measure radiation, so a separate dosimeter is assumed."),
];

/** Things OrbitWell never assumes and never reports. */
export const NOT_ASSUMED = [
  "Blood pressure, glucose, or ECG.",
  "Bone density, vision, or blood-clot detection.",
  "Any diagnosis, disease probability, or medical clearance.",
];

/** Context the user enters themselves, not from a device. */
export const USER_ENTERED = [
  "Baseline check-in: resting heart rate, sleep hours, mood, and stress.",
  "Wellbeing check-in: mood, stress, sleep quality, and an optional note.",
  "Movement check (optional; Future and Retired travelers use land-based practice, while astronauts in space use tasks suited to weightlessness): repetitions, timing, balance, approximate joint-angle ranges, and pauses from the camera (body points are tracked on the device and never stored), plus how it felt.",
];

/** What each data source can supply. */
export const SOURCE_SUPPORT: Array<{ source: string; supplies: string }> = [
  { source: "Simulated wearable (demo)", supplies: "All six signals." },
  { source: "File import (CSV or JSON)", supplies: "Any of the six signals present in the file." },
  { source: "Bluetooth heart-rate device", supplies: "Heart rate and, if the device sends beat-to-beat intervals, HRV. Other signals stay simulated." },
  { source: "Webhook (local demo receiver)", supplies: "Any of the six signals the sending service includes; the rest stay simulated. Readings are held in dev-server memory for up to 48 hours and are display-only for alerts until a full day is collected." },
];

/** Friendly unit for people; `unit` keeps the sanitizer's canonical code. */
export const displayUnit = (unit: string) => (unit === "degC" ? "°C" : unit);

const range = (s: SignalAssumption) => `${s.range[0]}–${s.range[1]}`;

/** Deterministic markdown for docs/device-assumptions.md. A test fails if the file differs. */
export function renderAssumptionsMarkdown(): string {
  const lines = [
    "# Assumed devices and health signals",
    "",
    "<!-- Generated from src/domain/deviceAssumptions.ts. Do not edit by hand; regenerate with: npm run docs:assumptions -->",
    "",
    "Simulated data only. Not medical advice. Not diagnostic.",
    "",
    "OrbitWell analyzes readings; it does not measure anything. Real hardware cannot be tested in this research demo, so every signal is **assumed** to arrive from an imagined crew wearable plus a personal dosimeter.",
    "",
    "## Assumed signals",
    "",
    "| Signal | Unit | Accepted range | Assumed device | How often | Note |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ASSUMED_SIGNALS.map((s) => `| ${s.label} | ${displayUnit(s.unit)} | ${range(s)} | ${s.device} | ${s.cadence} | ${s.note} |`),
    "",
    "Values outside the accepted range are treated as sensor errors and rejected with a reason.",
    "",
    "## Data flow",
    "",
    "Device or file, then a source adapter, then the sanitizer (shape, units, ranges, timestamps, duplicates, artefact flags), then a quality score (good, limited, poor), then the alert engine on completed days, then Home and Trends. Poor-quality data never produces an alert.",
    "",
    "## What each source can supply",
    "",
    ...SOURCE_SUPPORT.map((s) => `- **${s.source}:** ${s.supplies}`),
    "",
    "## Entered by the user, not from a device",
    "",
    ...USER_ENTERED.map((item) => `- ${item}`),
    "",
    "## Not assumed",
    "",
    ...NOT_ASSUMED.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}
