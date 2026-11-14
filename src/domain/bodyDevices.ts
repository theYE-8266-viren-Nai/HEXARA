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

/** How long the simulated pairing takes. Tests shorten it. */
export const bodyDeviceTiming = { pairMs: 1200 };
