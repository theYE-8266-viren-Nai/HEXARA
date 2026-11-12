import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSUMED_SIGNALS } from "../domain/deviceAssumptions";
import { sanitizeReadings, summarizeIngest, type DataSource, type IngestSummary, type RawRow, type SanitizeResult } from "../domain/ingest";
import type { MetricName as BackendMetric } from "../domain/types";
import type { StoredRow } from "../server/ingestReceiver";
import type { MetricCardData, MetricName, MetricPoint } from "../types/horizon";
import { fetchWebhookRows, fetchWebhookStatus } from "./adapters/webhookSource";
import { deviceTiming } from "./useDeviceStream";

/** Mutable so tests can run quickly. */
export const webhookTiming = { pollMs: 2_000, freshMs: 120_000, windowMs: 10 * 60_000 };

export type WebhookPhase = "checking" | "unavailable" | "off" | "waiting" | "receiving" | "idle" | "error";

/** The shape every source with its own readings exposes, so the pattern model can score completed days. */
export interface SourceReadings { readings: SanitizeResult; source: DataSource; }

export interface WebhookSource {
  phase: WebhookPhase;
  message?: string;
  token?: string;
  retentionHours: number;
  /** Rows received from the service since start. */
  received: number;
  /** True while fresh, trusted readings are replacing simulated cards. */
  ready: boolean;
  cards: Partial<Record<MetricName, MetricCardData>>;
  ingest: IngestSummary | null;
  /** Cleaned readings for the retained period (all days). Null until something was received. */
  completed: SourceReadings | null;
  start: () => void;
  stop: () => void;
}

const UI_METRIC: Record<BackendMetric, MetricName> = { heart_rate: "resting_hr", hrv: "hrv", sleep_hours: "sleep_hours", skin_temperature: "core_temperature", spo2: "spo2", radiation_dose: "radiation_dose" };
const DECIMALS: Record<BackendMetric, number> = { heart_rate: 0, hrv: 0, sleep_hours: 1, skin_temperature: 2, spo2: 1, radiation_dose: 3 };
const MIN_READINGS = 3;
const POINTS = 7;
const MAX_BUFFER = 150_000;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const toRaw = (row: StoredRow): RawRow => ({ row: row.id, fields: row.fields });
const round = (value: number, places: number) => { const f = 10 ** places; return Math.round(value * f) / f; };

/**
 * Turns cleaned webhook readings into dashboard cards for the signals actually received.
 * Only trusted readings count: artefacts and (for heart rate and HRV) exercise readings are excluded.
 */
export function buildWebhookCards(result: SanitizeResult, baseMetrics: MetricCardData[]): { cards: WebhookSource["cards"]; metrics: BackendMetric[] } {
  const cards: WebhookSource["cards"] = {}; const present: BackendMetric[] = [];
  for (const backend of Object.keys(UI_METRIC) as BackendMetric[]) {
    const ui = UI_METRIC[backend];
    const base = baseMetrics.find((metric) => metric.metric === ui);
    const trusted = result.accepted.filter((reading) => reading.metric === backend && !reading.flag && (reading.context === "rest" || (backend !== "heart_rate" && backend !== "hrv")));
    if (!base || trusted.length < MIN_READINGS) continue;
    const points: MetricPoint[] = trusted.slice(-POINTS).map((reading) => ({ day: clock(Date.parse(reading.observedAt)), value: round(reading.value, DECIMALS[backend]), baseline: base.baseline }));
    const value = points.at(-1)!.value;
    const tolerance = Math.max(Math.abs(base.baseline) * 0.01, 0.05);
    const delta = value - base.baseline;
    cards[ui] = { ...base, value, trend: delta > tolerance ? "up" : delta < -tolerance ? "down" : "steady", plainLanguage: "From a connected service (webhook).", points };
    present.push(backend);
  }
  return { cards, metrics: present };
}

/**
 * Receives readings that an external service posts to the local webhook receiver (dev server only),
 * cleans them with the shared sanitizer, and replaces only the dashboard cards it actually has data for.
 * Webhook readings are display-only for alerts: only completed days may be scored, and that is
 * decided by the shared analysis, not here.
 */
export function useWebhookSource(baseMetrics: MetricCardData[]): WebhookSource {
  const [availability, setAvailability] = useState<"checking" | "unavailable" | "available">("checking");
  const [token, setToken] = useState<string | undefined>();
  const [retentionHours, setRetentionHours] = useState(48);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => deviceTiming.now());
  const buffer = useRef<StoredRow[]>([]);
  const cursor = useRef(0);
  const baseRef = useRef(baseMetrics);
  baseRef.current = baseMetrics;

  useEffect(() => {
    let cancelled = false;
    void fetchWebhookStatus().then((status) => {
      if (cancelled) return;
      if (status.available) { setAvailability("available"); setToken(status.token); setRetentionHours(status.retentionHours); }
      else setAvailability("unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  const poll = useCallback(async () => {
    let more = true; let changed = false;
    while (more) {
      const page = await fetchWebhookRows(cursor.current);
      if (!page) { setFailed(true); return; }
      setFailed(false);
      if (page.rows.length) { buffer.current = [...buffer.current, ...page.rows].slice(-MAX_BUFFER); changed = true; }
      cursor.current = page.lastId;
      more = page.more;
    }
    setNow(deviceTiming.now());
    if (changed) setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!enabled || availability !== "available") return;
    void poll();
    const id = window.setInterval(() => { void poll(); }, webhookTiming.pollMs);
    return () => window.clearInterval(id);
  }, [enabled, availability, poll]);

  const start = useCallback(() => { buffer.current = []; cursor.current = 0; setVersion((v) => v + 1); setFailed(false); setEnabled(true); }, []);
  const stop = useCallback(() => { setEnabled(false); buffer.current = []; cursor.current = 0; setVersion((v) => v + 1); }, []);

  const rows = buffer.current;
  const lastArrival = rows.length ? rows[rows.length - 1].receivedAt : 0;
  const phase: WebhookPhase = availability === "checking" ? "checking" : availability === "unavailable" ? "unavailable" : !enabled ? "off" : failed ? "error" : !rows.length ? "waiting" : now - lastArrival <= webhookTiming.freshMs ? "receiving" : "idle";

  const completed = useMemo<SourceReadings | null>(() => {
    if (!buffer.current.length) return null;
    return { readings: sanitizeReadings(buffer.current.map(toRaw), { source: "api", now: new Date(deviceTiming.now()), defaultDeviceId: "webhook" }), source: "api" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const live = useMemo(() => {
    if (phase !== "receiving") return { cards: {} as WebhookSource["cards"], ingest: null as IngestSummary | null };
    const recent = buffer.current.filter((row) => row.receivedAt >= now - webhookTiming.windowMs);
    const result = sanitizeReadings(recent.map(toRaw), { source: "api", now: new Date(now), defaultDeviceId: "webhook" });
    const { cards, metrics } = buildWebhookCards(result, baseRef.current);
    if (!metrics.length) return { cards, ingest: null };
    const names = metrics.map((metric) => ASSUMED_SIGNALS.find((signal) => signal.metric === metric)?.label ?? metric).join(", ");
    return { cards, ingest: { ...summarizeIngest(result, `Connected service (webhook): ${names} · other signals simulated`) } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, version, now]);

  const message = phase === "unavailable" ? "The webhook receiver only runs on the development server (npm run dev). It is not part of a production build."
    : phase === "error" ? "Lost contact with the receiver. Check that the dev server is still running."
    : phase === "waiting" ? "Listening. Send a reading with the command below."
    : phase === "idle" ? "No new readings for a couple of minutes. Home is using the simulated wearable again."
    : phase === "receiving" && !Object.keys(live.cards).length ? "Receiving. Waiting for at least 3 clean readings of a signal before it appears on Home."
    : undefined;

  return { phase, message, token, retentionHours, received: rows.length, ready: Object.keys(live.cards).length > 0, cards: live.cards, ingest: live.ingest, completed, start, stop };
}
