import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONNECT_PHASES, STALE_SYNC_AGE_MS, finalPhaseFor, readingAt, type DevicePhase } from "../domain/deviceSimulator";
import { sanitizeReadings, summarizeIngest, type RawRow } from "../domain/ingest";
import { analyzeLiveReadings } from "./liveAnalysis";
import type { Observation } from "../domain/types";
import { metricUnits, type MetricName as BackendMetric } from "../domain/types";
import type { Alert, MetricCardData, MetricName, MetricPoint, SimulationScenario } from "../types/horizon";

/** The simulated wearable speaks the dashboard's metric names; the ingest pipeline uses the backend's. */
const BACKEND_METRIC: Record<MetricName, BackendMetric> = { resting_hr: "heart_rate", hrv: "hrv", sleep_hours: "sleep_hours", core_temperature: "skin_temperature", spo2: "spo2", radiation_dose: "radiation_dose" };

/** Timing is a mutable object so tests can run instantly and control the clock. */
export const deviceTiming = { connectMs: 3600, tickMs: 4000, now: () => Date.now() };

export interface DeviceStatus {
  phase: DevicePhase;
  progress: number;
  label: string;
  detail: string;
  lastSyncAt: number | null;
  /** True while a connection attempt is in progress. */
  connecting: boolean;
  paired: boolean;
  pair: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

const BASE_STATUS = { label: "", detail: "" };
const DAY_MS = 86_400_000;
const SYNC_STEP_MS = 15 * 60_000;

/** One raw row exactly as a wearable would send it. */
function deviceRow(row: number, seed: number, personKey: string, metric: MetricCardData, t: number): RawRow {
  const reading = readingAt(seed, personKey, metric.metric, t, metric.value);
  const backend = BACKEND_METRIC[metric.metric];
  return { row, fields: { timestamp: new Date(t).toISOString(), metric: backend, value: reading.value, unit: metricUnits[backend], context: reading.context, signal_quality: reading.quality === "low" ? "low" : "good", deviceId: "simulated-wearable" } };
}
const SAMPLE_STEP_MS = 10 * 60_000;
const SAMPLES = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/**
 * Runs the staged connection (searching → pairing → syncing → streaming) and, once
 * streaming, re-reads the simulated sensor every `tickMs`. Daily history and
 * baselines still come from `baseMetrics`; this only replaces today's values.
 */
export function useDeviceStream({ enabled, personKey, scenario, seed, baseMetrics, history }: { enabled: boolean; personKey: string; scenario: SimulationScenario; seed: number; baseMetrics: MetricCardData[]; history?: Observation[] }) {
  const [phase, setPhase] = useState<DevicePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => deviceTiming.now());
  const [stopped, setStopped] = useState(false);
  const [paired, setPaired] = useState(enabled);
  const timers = useRef<number[]>([]);

  // Pairing follows `enabled` (stage rules); the user can still disconnect locally.
  useEffect(() => { setPaired(enabled); setStopped(false); }, [enabled, personKey]);

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (!paired || stopped) { setPhase("idle"); setProgress(0); return; }
    const total = deviceTiming.connectMs;
    const at = (fraction: number, fn: () => void) => timers.current.push(window.setTimeout(fn, Math.round(total * fraction)));
    setPhase(CONNECT_PHASES[0].phase); setProgress(CONNECT_PHASES[0].progress);
    at(0.3, () => { setPhase("pairing"); setProgress(CONNECT_PHASES[1].progress); });
    at(0.6, () => { setPhase("syncing"); setProgress(CONNECT_PHASES[2].progress); });
    at(1, () => { setNow(deviceTiming.now()); setPhase(finalPhaseFor(scenario)); setProgress(1); });
    return () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
  }, [paired, stopped, scenario, seed, personKey, attempt]);

  // Live ticks only while streaming and not stale.
  useEffect(() => {
    if (phase !== "streaming" || scenario === "stale") return;
    const id = window.setInterval(() => setNow(deviceTiming.now()), deviceTiming.tickMs);
    return () => window.clearInterval(id);
  }, [phase, scenario]);

  const readingTime = scenario === "stale" ? now - STALE_SYNC_AGE_MS : now;
  // Alerts come from COMPLETED days only: the wearable "syncs" yesterday's full day, it is cleaned,
  // averaged to a daily value and compared with the 30-day baseline. Today's partial day is display-only.
  const dayKey = Math.floor(readingTime / DAY_MS);
  const dayAlert = useMemo((): Alert | null | undefined => {
    if (phase !== "streaming" || !history || !history.length) return undefined;
    const dayStart = (dayKey - 1) * DAY_MS;
    const rows: RawRow[] = [];
    for (const metric of baseMetrics) for (let t = dayStart; t < dayStart + DAY_MS; t += SYNC_STEP_MS) rows.push(deviceRow(rows.length + 1, seed, personKey, metric, t));
    const completedDay = sanitizeReadings(rows, { source: "simulated", now: new Date(deviceTiming.now()), defaultDeviceId: "simulated-wearable" });
    // A single "today" reading marks the end of that day so analyzeLiveReadings treats the synced day as complete.
    const marker = sanitizeReadings([deviceRow(1, seed, personKey, baseMetrics[0], dayKey * DAY_MS + 60_000)], { source: "simulated", now: new Date(Math.max(deviceTiming.now(), dayKey * DAY_MS + 120_000)) });
    return analyzeLiveReadings(history, { ...completedDay, accepted: [...completedDay.accepted, ...marker.accepted] });
  }, [phase, history, dayKey, baseMetrics, seed, personKey]);

  // The wearable only emits raw rows. Everything on screen comes back out of the shared sanitizer.
  const { metrics, ingest, alert } = useMemo((): { metrics: MetricCardData[]; ingest: ReturnType<typeof summarizeIngest> | null; alert: Alert | null | undefined } => {
    if (phase !== "streaming") return { metrics: baseMetrics, ingest: null, alert: undefined };
    const aligned = Math.floor(readingTime / SAMPLE_STEP_MS) * SAMPLE_STEP_MS;
    const stamps = [...Array.from({ length: SAMPLES - 1 }, (_, i) => aligned - (SAMPLES - 2 - i) * SAMPLE_STEP_MS), readingTime];
    const rows: RawRow[] = [];
    for (const metric of baseMetrics) for (const t of stamps) {
      rows.push(deviceRow(rows.length + 1, seed, personKey, metric, t));
    }
    const result = sanitizeReadings(rows, { source: "simulated", now: new Date(deviceTiming.now()), defaultDeviceId: "simulated-wearable" });
    const liveAlert = dayAlert;
    const cards = baseMetrics.map((metric) => {
      const backend = BACKEND_METRIC[metric.metric];
      const trusted = result.accepted.filter((reading) => reading.metric === backend && reading.context === "rest" && !reading.flag);
      if (!trusted.length) return metric;
      const alertFlag = liveAlert !== undefined ? liveAlert?.metric === metric.metric : Boolean(metric.points.at(-1)?.alert);
      const latestValue = trusted.at(-1)!.value;
      const dailyTrend = metric.metric === "sleep_hours" || metric.metric === "resting_hr";
      const points: MetricPoint[] = dailyTrend
        ? metric.points.map((point, index) => ({ ...point, ...(index === metric.points.length - 1 ? { value: latestValue, alert: alertFlag || undefined } : {}) }))
        : trusted.map((reading) => ({ day: clock(new Date(reading.observedAt).getTime()), value: reading.value, baseline: metric.baseline, alert: alertFlag || undefined }));
      const value = latestValue;
      const tolerance = Math.max(Math.abs(metric.baseline) * 0.01, 0.05);
      const delta = value - metric.baseline;
      return { ...metric, value, trend: delta > tolerance ? "up" as const : delta < -tolerance ? "down" as const : "steady" as const, points };
    });
    return { metrics: cards, ingest: summarizeIngest(result, "Simulated wearable"), alert: result.quality === "poor" ? null : liveAlert };
  }, [baseMetrics, dayAlert, phase, readingTime, seed, personKey]);

  const step = CONNECT_PHASES.find((item) => item.phase === phase);
  const status: DeviceStatus = {
    phase, progress,
    label: step?.label ?? BASE_STATUS.label,
    detail: step?.detail ?? BASE_STATUS.detail,
    lastSyncAt: phase === "streaming" || phase === "signal_lost" ? readingTime : null,
    connecting: phase === "searching" || phase === "pairing" || phase === "syncing",
    paired: paired && !stopped,
    pair: useCallback(() => { setPaired(true); setStopped(false); setAttempt((n) => n + 1); }, []),
    reconnect: useCallback(() => { setStopped(false); setPaired(true); setAttempt((n) => n + 1); }, []),
    disconnect: useCallback(() => setStopped(true), []),
  };
  /** `undefined` means no live analysis was possible, so the caller keeps the scenario alert. */
  return { status, metrics, ingest, alert };
}
