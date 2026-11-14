/**
 * Wearables an active astronaut can pair for the 3D body overview. Each device unlocks only the body
 * parts it measures. All readings are simulated for the research demo; nothing is measured by OrbitWell.
 */
export type BodyDeviceId = "astroskin" | "actiwatch" | "dosimeter" | "motion";

export interface BodyDevice { id: BodyDeviceId; name: string; worn: string; measures: string; parts: string[] }

export const BODY_DEVICES: BodyDevice[] = [
  { id: "astroskin", name: "Astroskin shirt", worn: "Smart shirt and headband", measures: "Heart rate, HRV, SpO₂ and skin temperature", parts: ["Heart", "Lungs", "Skin"] },
  { id: "actiwatch", name: "Actiwatch", worn: "Wrist", measures: "Sleep hours", parts: ["Brain"] },
  { id: "dosimeter", name: "Personal dosimeter", worn: "Chest pocket", measures: "Radiation dose", parts: ["Chest"] },
  { id: "motion", name: "Motion sensors", worn: "Thighs and lower back", measures: "Leg and back movement", parts: ["Legs", "Back"] },
];

/** How long the simulated pairing and the "searching for devices" step take. Tests shorten them. */
export const bodyDeviceTiming = { pairMs: 1200, scanMs: 700 };

/** Which wearable supplies each trend metric (dashboard and monthly-history names). Motion sensors have no trend chart. */
const METRIC_DEVICE: Record<string, BodyDeviceId> = {
  resting_hr: "astroskin", heart_rate: "astroskin", hrv: "astroskin", spo2: "astroskin", core_temperature: "astroskin", skin_temperature: "astroskin",
  sleep_hours: "actiwatch",
  radiation_dose: "dosimeter",
};

export function metricFromPairedDevice(metric: string, paired: ReadonlySet<BodyDeviceId>): boolean {
  const device = METRIC_DEVICE[metric];
  return device !== undefined && paired.has(device);
}
