import type { RawRow } from "../../domain/ingest";

/**
 * Web Bluetooth heart-rate adapter.
 *
 * This adapter only talks to the device and turns its notifications into untrusted raw rows.
 * Validation, cleaning, quality scoring and analysis belong to the shared pipeline in
 * domain/ingest, exactly as for files and the simulated wearable. Nothing is stored or uploaded.
 *
 * Supported: the standard Bluetooth "Heart Rate" service (chest straps and most watches that
 * broadcast heart rate). It provides heart rate and, when the device sends beat-to-beat
 * intervals, enough to estimate HRV. SpO₂, temperature, sleep and radiation are not part of it.
 */

/* ---------- Minimal Web Bluetooth types (not in TypeScript's DOM lib) ---------- */
interface CharacteristicLike {
  startNotifications(): Promise<unknown>;
  stopNotifications?(): Promise<unknown>;
  addEventListener(type: string, listener: (event: { target: { value?: DataView } | null }) => void): void;
  removeEventListener?(type: string, listener: (event: { target: { value?: DataView } | null }) => void): void;
}
interface ServiceLike { getCharacteristic(name: string): Promise<CharacteristicLike>; }
interface ServerLike { getPrimaryService(name: string): Promise<ServiceLike>; disconnect(): void; }
export interface DeviceLike {
  name?: string;
  gatt?: { connect(): Promise<ServerLike> };
  addEventListener(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}
export interface BluetoothLike { requestDevice(options: unknown): Promise<DeviceLike>; }

/** Indirection so tests can supply a fake device. In the browser it is `navigator.bluetooth`. */
export const bluetoothAccess = {
  get: (): BluetoothLike | undefined => (typeof navigator !== "undefined" ? (navigator as unknown as { bluetooth?: BluetoothLike }).bluetooth : undefined),
};
export const bluetoothSupported = () => Boolean(bluetoothAccess.get());

/* ---------- Heart Rate Measurement parsing ---------- */
export interface HeartRateMeasurement {
  bpm: number;
  contact: "unsupported" | "detected" | "not_detected";
  /** Beat-to-beat intervals in milliseconds, if the device sent them. */
  rrMs: number[];
}

/** Parses a Heart Rate Measurement characteristic value per the Bluetooth specification. */
export function parseHeartRateMeasurement(view: DataView): HeartRateMeasurement | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const wide = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRr = (flags & 0x10) !== 0;
  let offset = 1;
  let bpm: number;
  if (wide) {
    if (view.byteLength < 3) return null;
    bpm = view.getUint16(offset, true); offset += 2;
  } else { bpm = view.getUint8(offset); offset += 1; }
  if (hasEnergy) offset += 2;
  const rrMs: number[] = [];
  if (hasRr) while (offset + 1 < view.byteLength) { rrMs.push((view.getUint16(offset, true) / 1024) * 1000); offset += 2; }
  return { bpm, contact: !contactSupported ? "unsupported" : contactDetected ? "detected" : "not_detected", rrMs };
}

/** RMSSD (ms) of beat-to-beat intervals, a standard short-term HRV estimate. Implausible intervals are ignored. */
export function rmssd(rrMs: number[]): number | null {
  const clean = rrMs.filter((rr) => rr >= 300 && rr <= 2000);
  if (clean.length < 3) return null;
  let sum = 0;
  for (let i = 1; i < clean.length; i += 1) sum += (clean[i] - clean[i - 1]) ** 2;
  return Math.sqrt(sum / (clean.length - 1));
}

/** One untrusted heart-rate row, exactly as a wearable would send it. A device-reported lost contact is passed on as poor signal. */
export function heartRateRow(row: number, measurement: HeartRateMeasurement, t: number, deviceId: string): RawRow {
  return { row, fields: { timestamp: new Date(t).toISOString(), metric: "heart_rate", value: measurement.bpm, unit: "bpm", context: "rest", signal_quality: measurement.contact === "not_detected" ? "low" : "good", deviceId } };
}
export function hrvRow(row: number, valueMs: number, t: number, deviceId: string): RawRow {
  return { row, fields: { timestamp: new Date(t).toISOString(), metric: "hrv", value: Math.round(valueMs * 10) / 10, unit: "ms", context: "rest", signal_quality: "good", deviceId } };
}

/* ---------- Connecting ---------- */
export type ConnectError = "unsupported" | "cancelled" | "denied" | "failed";
export type ConnectResult =
  | { ok: true; deviceName: string; deviceId: string; disconnect: () => void }
  | { ok: false; error: ConnectError; message: string };

const HEART_RATE_SERVICE = "heart_rate";
const HEART_RATE_MEASUREMENT = "heart_rate_measurement";

export function describeConnectError(error: unknown): { error: ConnectError; message: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotFoundError") return { error: "cancelled", message: "No device was chosen. Nothing was connected." };
  if (name === "SecurityError" || name === "NotAllowedError") return { error: "denied", message: "Bluetooth permission was blocked. Allow it for this site in your browser and try again." };
  return { error: "failed", message: "Could not connect to that device. Check that it is on, nearby, and broadcasting heart rate, then try again." };
}

/**
 * Opens the browser's device chooser, connects, and streams measurements to `handlers`.
 * Must be called from a user click. Returns a handle that stops the stream.
 */
export async function connectHeartRateDevice(handlers: { onMeasurement: (measurement: HeartRateMeasurement) => void; onDisconnected: () => void }): Promise<ConnectResult> {
  const bluetooth = bluetoothAccess.get();
  if (!bluetooth) return { ok: false, error: "unsupported", message: "This browser does not support Web Bluetooth. Use Chrome or Edge on desktop or Android." };
  let server: ServerLike | undefined;
  try {
    const device = await bluetooth.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }] });
    const gatt = device.gatt;
    if (!gatt) return { ok: false, error: "failed", message: "That device does not allow a connection." };
    const onDisconnect = () => handlers.onDisconnected();
    device.addEventListener("gattserverdisconnected", onDisconnect);
    server = await gatt.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
    const onValue = (event: { target: { value?: DataView } | null }) => {
      const view = event.target?.value;
      const parsed = view ? parseHeartRateMeasurement(view) : null;
      if (parsed) handlers.onMeasurement(parsed);
    };
    characteristic.addEventListener("characteristicvaluechanged", onValue);
    await characteristic.startNotifications();
    const name = (device.name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 40) || "Heart-rate device";
    return {
      ok: true, deviceName: name, deviceId: `ble-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hr"}`,
      disconnect: () => {
        characteristic.removeEventListener?.("characteristicvaluechanged", onValue);
        device.removeEventListener?.("gattserverdisconnected", onDisconnect);
        void characteristic.stopNotifications?.()?.catch?.(() => undefined);
        try { server?.disconnect(); } catch { /* already disconnected */ }
      },
    };
  } catch (error) {
    try { server?.disconnect(); } catch { /* ignore */ }
    return { ok: false, ...describeConnectError(error) };
  }
}
