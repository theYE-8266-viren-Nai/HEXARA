import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceTiming, useDeviceStream } from "./useDeviceStream";
import { mockDashboardRepository } from "./mockDashboardRepository";
import { STALE_SYNC_AGE_MS } from "../domain/deviceSimulator";
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
    expect(result.current.metrics.every((m) => m.points.length === 7)).toBe(true);
  });

  it("ends in signal_lost or offline for those scenarios and shows no invented live values", () => {
    for (const [scenario, phase] of [["sensor_disconnected", "signal_lost"], ["offline", "offline"]] as const) {
      const { result, unmount } = setup(scenario);
      act(() => { vi.advanceTimersByTime(1100); });
      expect(result.current.status.phase).toBe(phase);
      expect(result.current.metrics).toBe(base);
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
});
