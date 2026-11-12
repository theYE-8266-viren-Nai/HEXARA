import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bluetoothTiming, useBluetoothHeartRate } from "./useBluetoothHeartRate";
import { bluetoothAccess } from "./adapters/webBluetoothHeartRate";
import { deviceTiming } from "./useDeviceStream";
import { mockDashboardRepository } from "./mockDashboardRepository";
import { createFakeBluetooth, hrBytes } from "../test/fakeBluetooth";

const base = mockDashboardRepository.getSnapshot("usual", { seed: 42, replayCount: 0 }).metrics;
let clock = new Date(2026, 10, 12, 9, 0, 0).getTime();
const saved = { ...deviceTiming }; const savedBt = { ...bluetoothTiming }; const savedGet = bluetoothAccess.get;

/** Sends `count` one-per-second measurements; each may carry RR intervals. */
function stream(fake: ReturnType<typeof createFakeBluetooth>, bpms: number[], rr?: number[]) {
  for (const bpm of bpms) { clock += 1000; fake.emit(hrBytes(bpm, rr ? { rrMs: rr } : {})); }
}
const connected = async (fake: ReturnType<typeof createFakeBluetooth>) => {
  bluetoothAccess.get = () => fake.bluetooth;
  const hook = renderHook(() => useBluetoothHeartRate(base));
  await act(async () => { await hook.result.current.connect(); });
  return hook;
};

describe("useBluetoothHeartRate", () => {
  beforeEach(() => { vi.useFakeTimers(); clock = new Date(2026, 10, 12, 9, 0, 0).getTime(); deviceTiming.now = () => clock; bluetoothTiming.refreshMs = 500; });
  afterEach(() => { vi.useRealTimers(); Object.assign(deviceTiming, saved); Object.assign(bluetoothTiming, savedBt); bluetoothAccess.get = savedGet; });

  it("is unsupported without Web Bluetooth and never pretends to connect", async () => {
    bluetoothAccess.get = () => undefined;
    const { result } = renderHook(() => useBluetoothHeartRate(base));
    expect(result.current.phase).toBe("unsupported");
    let ok = true;
    await act(async () => { ok = await result.current.connect(); });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("unsupported");
    expect(result.current.message).toMatch(/Chrome or Edge/);
  });

  it("returns to idle without error when the chooser is closed, and shows a clear message when blocked", async () => {
    const cancelled = createFakeBluetooth({ rejectWith: "NotFoundError" });
    bluetoothAccess.get = () => cancelled.bluetooth;
    const a = renderHook(() => useBluetoothHeartRate(base));
    await act(async () => { await a.result.current.connect(); });
    expect(a.result.current.phase).toBe("idle");
    expect(a.result.current.message).toMatch(/No device was chosen/);

    const blocked = createFakeBluetooth({ rejectWith: "NotAllowedError" });
    bluetoothAccess.get = () => blocked.bluetooth;
    const b = renderHook(() => useBluetoothHeartRate(base));
    await act(async () => { await b.result.current.connect(); });
    expect(b.result.current.phase).toBe("error");
    expect(b.result.current.message).toMatch(/permission was blocked/);
  });

  it("collects first, then shows cleaned heart-rate cards labelled with the real source", async () => {
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    expect(result.current.phase).toBe("streaming");
    expect(result.current.ready).toBe(false);
    act(() => { stream(fake, [64, 65]); vi.advanceTimersByTime(600); });
    expect(result.current.ready).toBe(false); // too little data to trust yet
    expect(result.current.ingest).toBeNull();

    act(() => { stream(fake, [64, 65, 66, 65, 64, 65]); vi.advanceTimersByTime(600); });
    expect(result.current.ready).toBe(true);
    expect(result.current.cards.resting_hr!.value).toBeGreaterThanOrEqual(64);
    expect(result.current.cards.resting_hr!.value).toBeLessThanOrEqual(66);
    expect(result.current.cards.resting_hr!.baseline).toBe(base.find((m) => m.metric === "resting_hr")!.baseline); // the person's own usual level
    expect(result.current.ingest!.sourceLabel).toMatch(/Bluetooth heart-rate device .* other signals simulated/);
    expect(result.current.cards.hrv).toBeUndefined(); // no beat-to-beat data was sent
  });

  it("estimates HRV when the device sends beat-to-beat intervals", async () => {
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    act(() => { stream(fake, [62, 63, 64, 63, 62, 63, 64, 65, 64, 63, 62, 63], [800, 815, 790, 810]); vi.advanceTimersByTime(600); });
    expect(result.current.cards.hrv).toBeDefined();
    expect(result.current.cards.hrv!.value).toBeGreaterThan(5);
  });

  it("treats a perfectly constant heart rate as a stuck sensor, not a reading", async () => {
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    act(() => { stream(fake, Array(12).fill(62)); vi.advanceTimersByTime(600); });
    expect(result.current.ready).toBe(false);
    expect(result.current.cards).toEqual({});
  });

  it("keeps lost-contact samples, impossible values and spikes out of the cards", async () => {
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    act(() => {
      stream(fake, [64, 65, 66, 65, 64, 65]);
      clock += 1000; fake.emit(hrBytes(70, { contact: "lost" }));
      clock += 1000; fake.emit(hrBytes(0));
      clock += 1000; fake.emit(hrBytes(190)); // sudden spike from a resting level
      vi.advanceTimersByTime(600);
    });
    expect(result.current.cards.resting_hr!.value).toBeLessThanOrEqual(66);
    expect(result.current.ingest!.rejected).toBeGreaterThanOrEqual(2);
    expect(result.current.ingest!.flagged).toBeGreaterThanOrEqual(1);
  });

  it("reports signal lost when the device drops, clears its readings, and can disconnect cleanly", async () => {
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    act(() => { stream(fake, [64, 65, 66, 65, 64, 65]); vi.advanceTimersByTime(600); });
    expect(result.current.ready).toBe(true);
    act(() => { fake.dropConnection(); });
    expect(result.current.phase).toBe("signal_lost");
    expect(result.current.ready).toBe(false);
    expect(result.current.cards).toEqual({});

    await act(async () => { await result.current.connect(); });
    expect(result.current.phase).toBe("streaming");
    act(() => { result.current.disconnect(); });
    expect(result.current.phase).toBe("idle");
    expect(fake.state.serverDisconnected).toBe(true);
  });

  it("never persists readings: nothing is written to local storage", async () => {
    window.localStorage.clear();
    const fake = createFakeBluetooth();
    const { result } = await connected(fake);
    act(() => { stream(fake, [64, 65, 66, 65, 64, 65]); vi.advanceTimersByTime(600); });
    expect(result.current.ready).toBe(true);
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/heart|bpm|ble-/i);
  });
});
