import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceTiming, useDeviceStream } from "./useDeviceStream";
import { mockDashboardRepository } from "./mockDashboardRepository";
import { STALE_SYNC_AGE_MS } from "../domain/deviceSimulator";
import { createBackendDashboardRepository } from "./backendDashboardRepository";
import { createHorizonRepository } from "../data/repository";
import type { SimulationScenario } from "../types/horizon";

const base = mockDashboardRepository.getSnapshot("usual", { seed: 42, replayCount: 0 }).metrics;
let clock = new Date(2026, 10, 12, 9, 0, 0).getTime();
const saved = { ...deviceTiming };

function setup(scenario: SimulationScenario = "usual", enabled = true) {
  return renderHook((props: { scenario: SimulationScenario; enabled: boolean }) => useDeviceStream({ enabled: props.enabled, personKey: "active:maya", scenario: props.scenario, seed: 42, baseMetrics: base }), { initialProps: { scenario, enabled } });
}

describe("useDeviceStream", () => {
  beforeEach(() => { vi.useFakeTimers(); clock = new Date(2026, 10, 12, 9, 0, 0).getTime(); deviceTiming.connectMs = 1000; deviceTiming.tickMs = 500; deviceTiming.now = () => clock; });
  afterEach(() => { vi.useRealTimers(); Object.assign(deviceTiming, saved); });

  it("walks through searching, pairing, syncing, then streaming", () => {
    const { result } = setup();
    expect(result.current.status.phase).toBe("searching");
    expect(result.current.status.connecting).toBe(true);
    act(() => { vi.advanceTimersByTime(350); });
    expect(result.current.status.phase).toBe("pairing");
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.status.phase).toBe("syncing");
    expect(result.current.metrics).toBe(base);
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.status.phase).toBe("streaming");
    expect(result.current.status.connecting).toBe(false);
    expect(result.current.metrics).not.toBe(base);
  });

  it("keeps changing while streaming, and keeps the person's own baselines", () => {
    const { result } = setup();
    act(() => { vi.advanceTimersByTime(1100); });
    const first = result.current.metrics.map((m) => m.value);
    clock += 3 * 60 * 60_000;
    act(() => { vi.advanceTimersByTime(600); });
    const second = result.current.metrics.map((m) => m.value);
    expect(second).not.toEqual(first);
    expect(result.current.metrics.map((m) => m.baseline)).toEqual(base.map((m) => m.baseline));
    // Poor-contact and exercise samples are filtered by the sanitizer, so a card has at most 7 trusted points.
    expect(result.current.metrics.every((m) => m.points.length >= 1 && m.points.length <= 7)).toBe(true);
  });

  it("keeps sleep and resting heart rate on daily trend labels", () => {
    const { result } = setup();
    act(() => { vi.advanceTimersByTime(1100); });
    for (const name of ["sleep_hours", "resting_hr", "core_temperature", "radiation_dose"] as const) {
      const metric = result.current.metrics.find((item) => item.metric === name)!;
      expect(metric.points.map((point) => point.day)).toEqual(["06-23", "06-24", "06-25", "06-26", "06-27", "06-28", "06-29"]);
      expect(metric.points.every((point) => !point.day.includes(":"))).toBe(true);
      expect(metric.points.at(-1)!.value).toBe(metric.value);
    }
    for (const name of ["hrv", "spo2"] as const) {
      const metric = result.current.metrics.find((item) => item.metric === name)!;
      expect(metric.points.some((point) => point.day.includes(":"))).toBe(true);
    }
  });

  it("routes the wearable through the sanitizer and reports where the data came from", () => {
    const { result } = setup();
    expect(result.current.ingest).toBeNull();
    act(() => { vi.advanceTimersByTime(1100); });
    const ingest = result.current.ingest!;
    expect(ingest.sourceLabel).toBe("Simulated wearable");
    expect(ingest.accepted + ingest.rejected).toBe(42); // 6 metrics x 7 samples
    expect(["good", "limited", "poor"]).toContain(ingest.quality);
    for (const metric of result.current.metrics) for (const point of metric.points) expect(Number.isFinite(point.value)).toBe(true);
  });

  it("ends in signal_lost or offline for those scenarios and shows no invented live values", () => {
    for (const [scenario, phase] of [["sensor_disconnected", "signal_lost"], ["offline", "offline"]] as const) {
      const { result, unmount } = setup(scenario);
      act(() => { vi.advanceTimersByTime(1100); });
      expect(result.current.status.phase).toBe(phase);
      expect(result.current.metrics).toBe(base);
      expect(result.current.ingest).toBeNull();
      unmount();
    }
  });

  it("stale devices stop at an old sync time and do not tick", () => {
    const { result } = setup("stale");
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.status.lastSyncAt).toBe(clock - STALE_SYNC_AGE_MS);
    const before = result.current.metrics.map((m) => m.value);
    clock += 60 * 60_000;
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.metrics.map((m) => m.value)).toEqual(before);
  });

  it("stays idle until paired when not enabled, and can disconnect and reconnect", () => {
    const { result } = setup("usual", false);
    expect(result.current.status.phase).toBe("idle");
    act(() => { result.current.status.pair(); });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.status.phase).toBe("streaming");
    act(() => { result.current.status.disconnect(); });
    expect(result.current.status.phase).toBe("idle");
    act(() => { result.current.status.reconnect(); });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.status.phase).toBe("streaming");
  });

  it("restarts the connection when the scenario changes", () => {
    const { result, rerender } = setup();
    act(() => { vi.advanceTimersByTime(1100); });
    rerender({ scenario: "offline", enabled: true });
    expect(result.current.status.phase).toBe("searching");
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.status.phase).toBe("offline");
  });

  it("analyzes the wearable itself when history exists, without false alerts through the day", async () => {
    const repo = createBackendDashboardRepository(createHorizonRepository(null, 42));
    const snapshot = (await repo.loadSnapshot("traveler-01", { seed: 42, replayCount: 0 })).data;
    expect(snapshot.history!.length).toBeGreaterThan(30);
    for (const hour of [0, 4, 8, 12, 15, 20]) {
      clock = new Date(2026, 10, 12, hour, 30, 0).getTime();
      const { result, unmount } = renderHook(() => useDeviceStream({ enabled: true, personKey: "active:traveler-01", scenario: "usual", seed: 42, baseMetrics: snapshot.metrics, history: snapshot.history }));
      act(() => { vi.advanceTimersByTime(1100); });
      expect(result.current.alert).toBeNull(); // analyzed (not undefined), and nothing unusual
      unmount();
    }
  });

  it("leaves the alert to the scenario when there is no stored history", () => {
    const { result } = setup("recovery_concern");
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.alert).toBeUndefined();
  });
});
