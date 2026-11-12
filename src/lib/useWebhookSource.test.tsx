import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWebhookCards, useWebhookSource, webhookTiming } from "./useWebhookSource";
import { deviceTiming } from "./useDeviceStream";
import { mockDashboardRepository } from "./mockDashboardRepository";
import { analyzeLiveReadings } from "./liveAnalysis";
import { sanitizeReadings } from "../domain/ingest";
import { metricUnits, type Observation } from "../domain/types";
import { createFakeReceiver } from "../test/fakeReceiverFetch";

const base = mockDashboardRepository.getSnapshot("usual", { seed: 42, replayCount: 0 }).metrics;
const START = new Date(2026, 10, 12, 9, 0, 0).getTime();
let clock = START;
const saved = { ...deviceTiming }; const savedTiming = { ...webhookTiming };

const reading = (offsetS: number, over: Record<string, unknown> = {}) => ({ timestamp: new Date(clock + offsetS * 1000).toISOString(), metric: "heart_rate", value: 64, unit: "bpm", deviceId: "svc", ...over });
const flush = async (ms = 2100) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

async function setup() {
  const fake = createFakeReceiver(() => clock);
  vi.stubGlobal("fetch", fake.fetchImpl);
  const hook = renderHook(() => useWebhookSource(base));
  await flush(10);
  return { fake, ...hook };
}

describe("useWebhookSource", () => {
  beforeEach(() => { vi.useFakeTimers(); clock = START; deviceTiming.now = () => clock; webhookTiming.pollMs = 500; });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Object.assign(deviceTiming, saved); Object.assign(webhookTiming, savedTiming); });

  it("says so when there is no receiver (production build or preview server)", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("<!doctype html>"); } }));
    const { result } = renderHook(() => useWebhookSource(base));
    await flush(10);
    expect(result.current.phase).toBe("unavailable");
    expect(result.current.message).toMatch(/only runs on the development server/);
    vi.stubGlobal("fetch", async () => { throw new TypeError("offline"); });
    const second = renderHook(() => useWebhookSource(base));
    await flush(10);
    expect(second.result.current.phase).toBe("unavailable");
  });

  it("waits for readings, then replaces only the signals it actually received", async () => {
    const { result, fake } = await setup();
    expect(result.current.phase).toBe("off");
    expect(result.current.token).toBe("test-token");
    act(() => { result.current.start(); });
    await flush();
    expect(result.current.phase).toBe("waiting");

    fake.send([reading(0, { value: 64 }), reading(1, { value: 65 }), reading(2, { value: 66 }), reading(0, { metric: "spo2", value: 97.2, unit: "%" }), reading(1, { metric: "spo2", value: 97.4, unit: "%" }), reading(2, { metric: "spo2", value: 97.3, unit: "%" })]);
    clock += 3000;
    await flush();
    expect(result.current.phase).toBe("receiving");
    expect(Object.keys(result.current.cards).sort()).toEqual(["resting_hr", "spo2"]);
    expect(result.current.cards.resting_hr!.value).toBe(66);
    expect(result.current.cards.resting_hr!.baseline).toBe(base.find((m) => m.metric === "resting_hr")!.baseline); // the person's own usual level
    expect(result.current.cards.hrv).toBeUndefined(); // never sent, so it stays simulated
    expect(result.current.ingest!.sourceLabel).toBe("Connected service (webhook): Heart rate, Blood oxygen (SpO₂) · other signals simulated");
    expect(result.current.ready).toBe(true);
  });

  it("needs at least 3 clean readings before a signal replaces the simulated one", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    fake.send([reading(0), reading(1, { value: 65 })]);
    clock += 2000; await flush();
    expect(result.current.phase).toBe("receiving");
    expect(result.current.ready).toBe(false);
    expect(result.current.message).toMatch(/at least 3 clean readings/);
  });

  it("keeps lost-contact zeros, impossible values, spikes and exercise readings out of the cards", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    fake.send([reading(0, { value: 64 }), reading(1, { value: 65 }), reading(2, { value: 66 }), reading(3, { value: 65 }), reading(4, { value: 0 }), reading(5, { value: 999 }), reading(6, { value: 190 }), reading(7, { value: 140, context: "exercise" }), reading(8, { value: 64, signal_quality: "low" })]);
    clock += 9000; await flush();
    const card = result.current.cards.resting_hr!;
    expect(card.value).toBe(65);
    expect(card.points.every((p) => p.value >= 64 && p.value <= 66)).toBe(true);
    expect(result.current.ingest!.rejected).toBeGreaterThanOrEqual(3); // zero, 999, poor contact
    expect(result.current.ingest!.flagged).toBeGreaterThanOrEqual(1); // the 190 spike
  });

  it("returns to the simulated wearable when the service goes quiet", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    fake.send([reading(0), reading(1, { value: 65 }), reading(2, { value: 66 })]);
    clock += 3000; await flush();
    expect(result.current.ready).toBe(true);
    clock += webhookTiming.freshMs + 5000; await flush();
    expect(result.current.phase).toBe("idle");
    expect(result.current.cards).toEqual({});
    expect(result.current.ingest).toBeNull();
    expect(result.current.message).toMatch(/simulated wearable again/);
  });

  it("reports a lost receiver instead of pretending to be live", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    await flush();
    fake.state.down = true;
    await flush();
    expect(result.current.phase).toBe("error");
    expect(result.current.message).toMatch(/Lost contact/);
    fake.state.down = false;
    await flush();
    expect(result.current.phase).toBe("waiting");
  });

  it("stop clears everything and stops polling", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    fake.send([reading(0), reading(1, { value: 65 }), reading(2, { value: 66 })]);
    clock += 3000; await flush();
    expect(result.current.received).toBe(3);
    act(() => { result.current.stop(); });
    const calls = fake.state.calls;
    await flush(3000);
    expect(fake.state.calls).toBe(calls);
    expect(result.current.phase).toBe("off");
    expect(result.current.cards).toEqual({});
    expect(result.current.completed).toBeNull();
  });

  it("exposes cleaned readings for every retained day in the agreed shape, and only completed days can be scored", async () => {
    const { result, fake } = await setup();
    act(() => { result.current.start(); });
    const day = (offsetDays: number, value: number) => [6, 10, 14, 18].map((h) => ({ timestamp: new Date(START - offsetDays * 86_400_000 + (h - 9) * 3_600_000).toISOString(), metric: "heart_rate", value: value + h * 0.01, unit: "bpm", deviceId: "svc" }));
    fake.send([...day(1, 62), ...day(0, 62)]);
    await flush();
    const completed = result.current.completed!;
    expect(completed.source).toBe("api");
    expect(new Set(completed.readings.accepted.map((r) => r.observedAt.slice(0, 10))).size).toBe(2);
    expect(completed.readings.accepted.every((r) => r.source === "api")).toBe(true);

    // The shared analysis accepts this shape. A usual day raises nothing...
    const history: Observation[] = Array.from({ length: 40 }, (_, i) => ({ id: `h${i}`, person_id: "p", observed_on: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10), metric: "heart_rate", unit: metricUnits.heart_rate, value: 62 + ((i * 7) % 5) - 2, context: "rest", seed: 1, is_synthetic: true }));
    expect(analyzeLiveReadings(history, completed.readings)).toBeNull();
  });
});

describe("buildWebhookCards", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const row = (n: number, fields: Record<string, unknown>) => ({ row: n, fields: { deviceId: "d", ...fields } });
  const at = (minute: number) => `2026-11-12T11:${String(minute).padStart(2, "0")}:00Z`;

  it("builds cards only for signals present with enough trusted readings, and accepts common aliases and units", () => {
    const rows = [
      ...[1, 2, 3].map((n) => row(n, { timestamp: at(n), metric: "temperature", value: 91.8 + n / 10, unit: "F" })), // Fahrenheit, converted
      ...[1, 2, 3].map((n) => row(n + 10, { timestamp: at(n), metric: "sleep", value: 7 + n / 10, unit: "h" })),
      ...[1, 2].map((n) => row(n + 20, { timestamp: at(n), metric: "hrv", value: 40 + n, unit: "ms" })), // only 2: not enough
    ];
    const { cards, metrics } = buildWebhookCards(sanitizeReadings(rows, { source: "api", now }), base);
    expect([...metrics].sort()).toEqual(["skin_temperature", "sleep_hours"]);
    expect(Object.keys(cards).sort()).toEqual(["core_temperature", "sleep_hours"]);
    expect(cards.core_temperature!.value).toBeGreaterThan(33); // 92-ish F is about 33.5 C
    expect(cards.core_temperature!.value).toBeLessThan(34.5);
  });

  it("never builds a card from a stuck sensor", () => {
    const rows = Array.from({ length: 10 }, (_, n) => row(n + 1, { timestamp: at(n + 1), metric: "spo2", value: 97, unit: "%" }));
    const { cards } = buildWebhookCards(sanitizeReadings(rows, { source: "api", now }), base);
    expect(cards.spo2).toBeUndefined();
  });
});
