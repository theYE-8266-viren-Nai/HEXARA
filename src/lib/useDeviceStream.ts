import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONNECT_PHASES, STALE_SYNC_AGE_MS, finalPhaseFor, readingAt, type DevicePhase } from "../domain/deviceSimulator";
import type { MetricCardData, MetricPoint, SimulationScenario } from "../types/horizon";

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
const SAMPLE_STEP_MS = 10 * 60_000;
const SAMPLES = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/**
 * Runs the staged connection (searching → pairing → syncing → streaming) and, once
 * streaming, re-reads the simulated sensor every `tickMs`. Daily history and
 * baselines still come from `baseMetrics`; this only replaces today's values.
 */
export function useDeviceStream({ enabled, personKey, scenario, seed, baseMetrics }: { enabled: boolean; personKey: string; scenario: SimulationScenario; seed: number; baseMetrics: MetricCardData[] }) {
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
  const metrics = useMemo(() => {
    if (phase !== "streaming") return baseMetrics;
    return baseMetrics.map((metric) => {
      const anchor = metric.value;
      const aligned = Math.floor(readingTime / SAMPLE_STEP_MS) * SAMPLE_STEP_MS;
      const stamps = Array.from({ length: SAMPLES - 1 }, (_, i) => aligned - (SAMPLES - 2 - i) * SAMPLE_STEP_MS);
      const alertFlag = Boolean(metric.points.at(-1)?.alert);
      const livePoints: MetricPoint[] = [...stamps, readingTime].map((t) => ({ day: clock(t), value: readingAt(seed, personKey, metric.metric, t, anchor).restingValue, baseline: metric.baseline, alert: alertFlag || undefined }));
      const value = livePoints.at(-1)!.value;
      const tolerance = Math.max(Math.abs(metric.baseline) * 0.01, 0.05);
      const delta = value - metric.baseline;
      return { ...metric, value, trend: delta > tolerance ? "up" as const : delta < -tolerance ? "down" as const : "steady" as const, points: livePoints };
    });
  }, [baseMetrics, phase, readingTime, seed, personKey]);

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
  return { status, metrics };
}
