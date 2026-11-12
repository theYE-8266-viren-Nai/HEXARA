import { afterEach, describe, expect, it } from "vitest";
import { bluetoothAccess, bluetoothSupported, connectHeartRateDevice, describeConnectError, heartRateRow, parseHeartRateMeasurement, rmssd } from "./webBluetoothHeartRate";
import { sanitizeReadings } from "../../domain/ingest";
import { createFakeBluetooth, hrBytes } from "../../test/fakeBluetooth";

const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
const original = bluetoothAccess.get;
afterEach(() => { bluetoothAccess.get = original; });

describe("Heart Rate Measurement parsing", () => {
  it("reads an 8-bit heart rate", () => {
    expect(parseHeartRateMeasurement(view([0x00, 72]))).toEqual({ bpm: 72, contact: "unsupported", rrMs: [] });
  });
  it("reads a 16-bit heart rate", () => {
    expect(parseHeartRateMeasurement(view([0x01, 0x2c, 0x01]))!.bpm).toBe(300);
  });
  it("reads sensor-contact status", () => {
    expect(parseHeartRateMeasurement(view([0x06, 70]))!.contact).toBe("detected");
    expect(parseHeartRateMeasurement(view([0x04, 70]))!.contact).toBe("not_detected");
  });
  it("reads beat-to-beat intervals and skips the optional energy field", () => {
    const parsed = parseHeartRateMeasurement(view([0x18, 70, 0x10, 0x00, 0x33, 0x03, 0x00, 0x04]))!; // energy, then 819 and 1024 units
    expect(parsed.rrMs[0]).toBeCloseTo(799.8, 1);
    expect(parsed.rrMs[1]).toBeCloseTo(1000, 1);
  });
  it("rejects truncated data", () => {
    expect(parseHeartRateMeasurement(view([0x00]))).toBeNull();
    expect(parseHeartRateMeasurement(view([0x01, 0x40]))).toBeNull();
  });
});

describe("HRV estimate", () => {
  it("computes RMSSD", () => { expect(rmssd([800, 810, 790, 800])).toBeCloseTo(14.14, 1); });
  it("ignores implausible intervals and needs enough beats", () => {
    expect(rmssd([800, 5000, 810])).toBeNull();
    expect(rmssd([800, 810])).toBeNull();
  });
});

describe("rows enter the shared sanitizer", () => {
  it("passes lost contact on as poor signal so it is rejected with a reason", () => {
    const m = parseHeartRateMeasurement(view(hrBytes(70, { contact: "lost" })))!;
    const result = sanitizeReadings([heartRateRow(1, m, Date.now(), "ble-test")], { source: "bluetooth" });
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0].reason).toMatch(/poor sensor contact/);
  });
  it("rejects an impossible heart rate from the strap", () => {
    const m = parseHeartRateMeasurement(view([0x00, 0]))!;
    const result = sanitizeReadings([heartRateRow(1, m, Date.now(), "ble-test")], { source: "bluetooth" });
    expect(result.rejected[0].reason).toMatch(/lost sensor contact/);
  });
});

describe("connectHeartRateDevice", () => {
  it("reports unsupported browsers", async () => {
    bluetoothAccess.get = () => undefined;
    expect(bluetoothSupported()).toBe(false);
    const result = await connectHeartRateDevice({ onMeasurement: () => {}, onDisconnected: () => {} });
    expect(result).toMatchObject({ ok: false, error: "unsupported" });
  });

  it("treats a closed chooser as cancelled and a blocked permission as denied", () => {
    const err = (name: string) => Object.assign(new Error("x"), { name });
    expect(describeConnectError(err("NotFoundError")).error).toBe("cancelled");
    expect(describeConnectError(err("NotAllowedError")).error).toBe("denied");
    expect(describeConnectError(err("SecurityError")).error).toBe("denied");
    expect(describeConnectError(err("NetworkError")).error).toBe("failed");
  });

  it("returns a friendly error and cleans up when the device cannot be reached", async () => {
    const fake = createFakeBluetooth({ connectFailsWith: "NetworkError" });
    bluetoothAccess.get = () => fake.bluetooth;
    const result = await connectHeartRateDevice({ onMeasurement: () => {}, onDisconnected: () => {} });
    expect(result).toMatchObject({ ok: false, error: "failed" });
    expect(fake.state.notificationsStarted).toBe(false);
  });

  it("asks only for heart-rate devices, streams parsed measurements, and stops cleanly", async () => {
    const fake = createFakeBluetooth({ name: "Polar H10 \u0000 12345" });
    bluetoothAccess.get = () => fake.bluetooth;
    const seen: number[] = [];
    let dropped = 0;
    const result = await connectHeartRateDevice({ onMeasurement: (m) => seen.push(m.bpm), onDisconnected: () => { dropped += 1; } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(fake.state.filters)).toContain("heart_rate");
    expect(result.deviceName).toBe("Polar H10  12345"); // control characters removed
    fake.emit(hrBytes(64)); fake.emit([0x00]); fake.emit(hrBytes(66));
    expect(seen).toEqual([64, 66]); // malformed notification ignored
    fake.dropConnection();
    expect(dropped).toBe(1);
    result.disconnect();
    expect(fake.state.notificationsStopped).toBe(true);
    expect(fake.state.serverDisconnected).toBe(true);
    fake.emit(hrBytes(70));
    expect(seen).toEqual([64, 66]); // no more events after disconnect
  });
});
