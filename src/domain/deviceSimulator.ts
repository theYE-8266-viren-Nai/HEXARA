/**
 * Simulated wearable device (synthetic data only, not a medical device).
 *
 * `readingAt` is a PURE function of (seed, person, metric, time, anchor):
 *  - values change continuously with time like a real sensor (circadian rhythm,
 *    slow drift, fast sensor wobble, short activity bumps);
 *  - reloading the page does not reset or jump the numbers, because nothing is
 *    stored — the same clock time always gives the same reading;
 *  - a different seed or person gives a different rhythm.
 *
 * `anchor` is the person's own usual level for the metric (from their history),
 * so readings stay personal. Alert thresholds are NOT here; see alertEngine.ts.
 */
import { hashString, lattice } from "../lib/prng";
import type { MetricName } from "../types/horizon";

export type ReadingContext = "rest" | "exercise";
export type ReadingQuality = "good" | "low";
export interface DeviceReading { metric: MetricName; value: number; restingValue: number; context: ReadingContext; quality: ReadingQuality; observedAt: number; }

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Smooth noise in [-1, 1]: cosine-interpolated lattice values, `periodMs` per lattice step. */
export function smoothNoise(seed: number, tMs: number, periodMs: number): number {
  const x = tMs / periodMs;
  const i = Math.floor(x);
  const f = x - i;
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  const a = lattice(seed, i) * 2 - 1;
  const b = lattice(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
}

const hourOfDay = (tMs: number) => { const d = new Date(tMs); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const round = (value: number, places: number) => { const f = 10 ** places; return Math.round(value * f) / f; };

/** Short activity bump (0–1). ~12% of 45-minute slots contain a 10-minute bump. */
function activityBump(seed: number, tMs: number): number {
  const slotMs = 45 * MINUTE;
  const slot = Math.floor(tMs / slotMs);
  if (lattice(seed ^ 0x51ed, slot) > 0.12) return 0;
  const startOffset = lattice(seed ^ 0xa11, slot) * 30 * MINUTE;
  const into = tMs - slot * slotMs - startOffset;
  if (into < 0 || into > 10 * MINUTE) return 0;
  return Math.sin((into / (10 * MINUTE)) * Math.PI);
}

/** Rare, short SpO₂ dip (0–1): ~3% of 20-minute slots contain a 2-minute dip. */
function spo2Dip(seed: number, tMs: number): number {
  const slotMs = 20 * MINUTE;
  const slot = Math.floor(tMs / slotMs);
  if (lattice(seed ^ 0xd1b, slot) > 0.03) return 0;
  const into = tMs - slot * slotMs - lattice(seed ^ 0xd1c, slot) * 15 * MINUTE;
  if (into < 0 || into > 2 * MINUTE) return 0;
  return Math.sin((into / (2 * MINUTE)) * Math.PI);
}

export function readingAt(seed: number, personKey: string, metric: MetricName, tMs: number, anchor: number): DeviceReading {
  const s = (hashString(`${personKey}:${metric}`) ^ Math.imul(seed + 1, 0x85ebca6b)) >>> 0;
  const h = hourOfDay(tMs);
  const slow = smoothNoise(s, tMs, 12 * MINUTE);
  const mid = smoothNoise(s ^ 0x77, tMs, 90_000);
  const fast = smoothNoise(s ^ 0x9e37, tMs, 7_000);
  const bump = activityBump(hashString(personKey) ^ seed, tMs);
  // Quality: ~4% of 30-second slots are a poor-contact sample; value is still plausible but flagged.
  const quality: ReadingQuality = lattice(s ^ 0x91, Math.floor(tMs / 30_000)) < 0.04 ? "low" : "good";

  // Heart-rate model shared with HRV so the two mirror each other. Trough ≈ 03:00, peak ≈ 15:00.
  const hrSeed = (hashString(`${personKey}:resting_hr`) ^ Math.imul(seed + 1, 0x85ebca6b)) >>> 0;
  const hrFactor = 1 + 0.07 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + 0.025 * smoothNoise(hrSeed, tMs, 12 * MINUTE) + 0.012 * smoothNoise(hrSeed ^ 0x77, tMs, 90_000) + 0.02 * smoothNoise(hrSeed ^ 0x9e37, tMs, 7_000);

  let resting: number; let value: number;
  switch (metric) {
    case "resting_hr": {
      resting = clamp(round(anchor * hrFactor, 0), 38, 120);
      value = clamp(round(resting + bump * 35, 0), 38, 190);
      break;
    }
    case "hrv": {
      // HRV moves opposite to heart rate (`anchor` is the person's usual HRV).
      resting = clamp(round(anchor * (1 - 1.1 * (hrFactor - 1)) + anchor * (0.03 * slow + 0.02 * fast), 0), 5, 200);
      value = clamp(round(resting - bump * 0.35 * anchor, 0), 5, 200);
      break;
    }
    case "spo2": {
      resting = clamp(round(anchor + 0.3 * slow + 0.12 * mid + 0.15 * fast - 1.6 * spo2Dip(s, tMs), 1), 90, 100);
      value = resting;
      break;
    }
    case "core_temperature": {
      resting = clamp(round(anchor + 0.3 * Math.sin(((h - 11) / 24) * 2 * Math.PI) + 0.05 * slow + 0.015 * mid + 0.02 * fast, 2), 34, 40);
      value = resting;
      break;
    }
    case "radiation_dose": {
      // Slow rate changes plus a gentle ~92-minute orbital pass pattern.
      const orbit = Math.max(0, Math.sin((2 * Math.PI * tMs) / (92 * MINUTE))) ** 6;
      resting = clamp(round(anchor * (1 + 0.04 * slow + 0.015 * mid + 0.012 * fast + 0.12 * orbit), 3), 0, 50);
      value = resting;
      break;
    }
    case "sleep_hours":
    default: {
      // Last night's total: fixed for the calendar day, changes only at the next sync.
      const day = Math.floor((tMs - new Date(tMs).getTimezoneOffset() * MINUTE) / DAY);
      resting = clamp(round(anchor + 0.35 * (lattice(s ^ 0x5, day) * 2 - 1), 1), 0, 14);
      value = resting;
      break;
    }
  }
  const context: ReadingContext = bump > 0.25 && (metric === "resting_hr" || metric === "hrv") ? "exercise" : "rest";
  return { metric, value, restingValue: resting, context, quality, observedAt: tMs };
}

/* ---------- Connection model ---------- */

export type DevicePhase = "idle" | "searching" | "pairing" | "syncing" | "streaming" | "signal_lost" | "offline";
export type DeviceScenario = "usual" | "recovery_concern" | "sensor_disconnected" | "stale" | "offline";

export const CONNECT_PHASES: Array<{ phase: "searching" | "pairing" | "syncing"; label: string; detail: string; progress: number }> = [
  { phase: "searching", label: "Searching for your wearable…", detail: "Looking for a nearby simulated device.", progress: 0.2 },
  { phase: "pairing", label: "Pairing securely…", detail: "Confirming the simulated device and permissions.", progress: 0.55 },
  { phase: "syncing", label: "Syncing recent readings…", detail: "Loading the last few days so today can be compared with your usual pattern.", progress: 0.85 },
];

/** The state a connection attempt ends in for each demo scenario. */
export function finalPhaseFor(scenario: DeviceScenario): "streaming" | "signal_lost" | "offline" {
  return scenario === "sensor_disconnected" ? "signal_lost" : scenario === "offline" ? "offline" : "streaming";
}

/** Readings from a stale device stop at its last sync, which is this far in the past. */
export const STALE_SYNC_AGE_MS = 6 * 60 * MINUTE;
