import type { BluetoothLike } from "../lib/adapters/webBluetoothHeartRate";

type Listener = (event: { target: { value?: DataView } | null }) => void;

/** A fake Bluetooth heart-rate strap for tests. */
export function createFakeBluetooth(options: { rejectWith?: string; connectFailsWith?: string; name?: string } = {}) {
  const valueListeners = new Set<Listener>();
  const dropListeners = new Set<() => void>();
  const state = { requested: 0, connected: false, notificationsStarted: false, notificationsStopped: false, serverDisconnected: false, filters: undefined as unknown };
  const characteristic = {
    startNotifications: async () => { state.notificationsStarted = true; },
    stopNotifications: async () => { state.notificationsStopped = true; },
    addEventListener: (_type: string, listener: Listener) => { valueListeners.add(listener); },
    removeEventListener: (_type: string, listener: Listener) => { valueListeners.delete(listener); },
  };
  const server = { getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }), disconnect: () => { state.serverDisconnected = true; state.connected = false; } };
  const device = {
    name: options.name ?? "Test Strap",
    gatt: { connect: async () => { if (options.connectFailsWith) { const e = new Error("fail"); e.name = options.connectFailsWith; throw e; } state.connected = true; return server; } },
    addEventListener: (_type: string, listener: () => void) => { dropListeners.add(listener); },
    removeEventListener: (_type: string, listener: () => void) => { dropListeners.delete(listener); },
  };
  const bluetooth: BluetoothLike = {
    requestDevice: async (opts) => {
      state.requested += 1; state.filters = opts;
      if (options.rejectWith) { const e = new Error("rejected"); e.name = options.rejectWith; throw e; }
      return device;
    },
  };
  return {
    bluetooth, state,
    /** Sends one raw Heart Rate Measurement notification. */
    emit: (bytes: number[]) => { const view = new DataView(new Uint8Array(bytes).buffer); for (const listener of valueListeners) listener({ target: { value: view } }); },
    dropConnection: () => { for (const listener of dropListeners) listener(); },
  };
}

/** Bytes for a measurement: 8-bit heart rate, optional contact flags and RR intervals (ms). */
export function hrBytes(bpm: number, opts: { contact?: "detected" | "lost"; rrMs?: number[] } = {}): number[] {
  const rr = opts.rrMs ?? [];
  let flags = 0;
  if (opts.contact) flags |= 0x04 | (opts.contact === "detected" ? 0x02 : 0);
  if (rr.length) flags |= 0x10;
  const bytes = [flags, bpm];
  for (const ms of rr) { const units = Math.round((ms / 1000) * 1024); bytes.push(units & 0xff, (units >> 8) & 0xff); }
  return bytes;
}
