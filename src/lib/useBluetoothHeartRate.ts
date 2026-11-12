import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeReadings, summarizeIngest, type IngestSummary, type RawRow } from "../domain/ingest";
import type { MetricCardData, MetricPoint } from "../types/horizon";
import { bluetoothSupported, connectHeartRateDevice, heartRateRow, hrvRow, rmssd, type HeartRateMeasurement } from "./adapters/webBluetoothHeartRate";
import { deviceTiming } from "./useDeviceStream";

/** Mutable so tests can run quickly. */
export const bluetoothTiming = { refreshMs: 2_000 };

export type BluetoothPhase = "unsupported" | "idle" | "requesting" | "streaming" | "signal_lost" | "error";

export interface BluetoothHeartRate {
  phase: BluetoothPhase;
  message?: string;
  deviceName?: string;
  /** True once enough clean readings exist to show on the dashboard. */
  ready: boolean;
  cards: Partial<Record<"resting_hr" | "hrv", MetricCardData>>;
  ingest: IngestSummary | null;
  /** Resolves true when a device is connected and streaming. */
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

const WINDOW_MS = 5 * 60_000;
const MAX_ROWS = 1500;
const MIN_READY_READINGS = 5;
const HRV_WINDOW_MS = 60_000;
const HRV_EVERY_MS = 10_000;
const MIN_RR_FOR_HRV = 20;
const BUCKET_MS = 30_000;
const POINTS = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

/**
 * Connects a Bluetooth heart-rate device and exposes its readings as dashboard cards.
 * Everything passes through the shared sanitizer. Readings live in memory only for a few
 * minutes: nothing is saved or uploaded, and the device is not reconnected automatically.
 */
export function useBluetoothHeartRate(baseMetrics: MetricCardData[]): BluetoothHeartRate {
  const [phase, setPhase] = useState<BluetoothPhase>(() => (bluetoothSupported() ? "idle" : "unsupported"));
  const [message, setMessage] = useState<string | undefined>();
  const [deviceName, setDeviceName] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<{ cards: BluetoothHeartRate["cards"]; ingest: IngestSummary | null; ready: boolean }>({ cards: {}, ingest: null, ready: false });
  const rows = useRef<RawRow[]>([]);
  const rr = useRef<Array<{ t: number; ms: number }>>([]);
  const lastHrv = useRef(0);
  const counter = useRef(0);
  const deviceId = useRef("ble-hr");
  const session = useRef<{ disconnect: () => void } | null>(null);
  const baseRef = useRef(baseMetrics);
  baseRef.current = baseMetrics;

  const reset = useCallback(() => { rows.current = []; rr.current = []; lastHrv.current = 0; setSnapshot({ cards: {}, ingest: null, ready: false }); }, []);

  const onMeasurement = useCallback((measurement: HeartRateMeasurement) => {
    const t = deviceTiming.now();
    rows.current.push(heartRateRow(++counter.current, measurement, t, deviceId.current));
    for (const ms of measurement.rrMs) rr.current.push({ t, ms });
    rr.current = rr.current.filter((item) => item.t >= t - HRV_WINDOW_MS);
    if (rr.current.length >= MIN_RR_FOR_HRV && t - lastHrv.current >= HRV_EVERY_MS) {
      const value = rmssd(rr.current.map((item) => item.ms));
      if (value !== null) { rows.current.push(hrvRow(++counter.current, value, t, deviceId.current)); lastHrv.current = t; }
    }
    rows.current = rows.current.filter((row) => Date.parse(String(row.fields.timestamp)) >= t - WINDOW_MS).slice(-MAX_ROWS);
  }, []);

  const refresh = useCallback(() => {
    if (!rows.current.length) return;
    const now = deviceTiming.now();
    const result = sanitizeReadings(rows.current, { source: "bluetooth", now: new Date(now), defaultDeviceId: deviceId.current });
    const trustedHr = result.accepted.filter((reading) => reading.metric === "heart_rate" && reading.context === "rest" && !reading.flag);
    const ready = trustedHr.length >= MIN_READY_READINGS;
    const cards: BluetoothHeartRate["cards"] = {};
    for (const [uiMetric, backendMetric] of [["resting_hr", "heart_rate"], ["hrv", "hrv"]] as const) {
      const base = baseRef.current.find((metric) => metric.metric === uiMetric);
      const trusted = result.accepted.filter((reading) => reading.metric === backendMetric && reading.context === "rest" && !reading.flag);
      if (!base || !trusted.length || !ready) continue;
      const buckets = new Map<number, number[]>();
      for (const reading of trusted) { const key = Math.floor(Date.parse(reading.observedAt) / BUCKET_MS); buckets.set(key, [...(buckets.get(key) ?? []), reading.value]); }
      const points: MetricPoint[] = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-POINTS).map(([key, values]) => ({ day: clock(key * BUCKET_MS), value: Math.round(values.reduce((a, b) => a + b, 0) / values.length), baseline: base.baseline }));
      const value = points.at(-1)!.value;
      const tolerance = Math.max(Math.abs(base.baseline) * 0.01, 0.05);
      const delta = value - base.baseline;
      cards[uiMetric] = { ...base, value, trend: delta > tolerance ? "up" : delta < -tolerance ? "down" : "steady", plainLanguage: "Live from your Bluetooth heart-rate device.", points };
    }
    const summary = summarizeIngest(result, "Bluetooth heart-rate device");
    setSnapshot({ cards, ingest: ready ? { ...summary, sourceLabel: "Bluetooth heart-rate device (heart rate, HRV) · other signals simulated" } : null, ready });
  }, []);

  // Recompute at a gentle pace while streaming.
  useEffect(() => {
    if (phase !== "streaming") return;
    const id = window.setInterval(refresh, bluetoothTiming.refreshMs);
    return () => window.clearInterval(id);
  }, [phase, refresh]);

  const disconnect = useCallback(() => {
    session.current?.disconnect();
    session.current = null;
    reset();
    setDeviceName(undefined);
    setMessage(undefined);
    setPhase(bluetoothSupported() ? "idle" : "unsupported");
  }, [reset]);

  useEffect(() => () => { session.current?.disconnect(); session.current = null; }, []);

  const connect = useCallback(async () => {
    if (!bluetoothSupported()) { setPhase("unsupported"); setMessage("This browser does not support Web Bluetooth. Use Chrome or Edge on desktop or Android."); return false; }
    session.current?.disconnect(); session.current = null; reset();
    setPhase("requesting"); setMessage("Choose your heart-rate device in the browser's pop-up.");
    const result = await connectHeartRateDevice({
      onMeasurement,
      onDisconnected: () => { session.current = null; reset(); setPhase("signal_lost"); setMessage("The device disconnected. Move it closer or check its battery, then reconnect."); },
    });
    if (!result.ok) {
      setPhase(result.error === "unsupported" ? "unsupported" : result.error === "cancelled" ? "idle" : "error");
      setMessage(result.message);
      return false;
    }
    deviceId.current = result.deviceId;
    session.current = result;
    setDeviceName(result.deviceName);
    setMessage("Connected. Collecting readings…");
    setPhase("streaming");
    return true;
  }, [onMeasurement, reset]);

  return useMemo(() => ({ phase, message, deviceName, ready: snapshot.ready, cards: snapshot.cards, ingest: snapshot.ingest, connect, disconnect }), [phase, message, deviceName, snapshot, connect, disconnect]);
}
