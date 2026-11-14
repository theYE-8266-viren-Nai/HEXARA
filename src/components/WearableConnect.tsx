import { Bluetooth, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BODY_DEVICES, bodyDeviceTiming, type BodyDeviceId } from "../domain/bodyDevices";

/**
 * "Connect wearables": one button that opens the device list every time, like a phone's Bluetooth
 * screen. Opening it scans briefly for nearby devices; each device can then be paired or disconnected.
 * `on` / `onToggle` are accepted for compatibility with existing callers and are not needed any more.
 */
export function WearableConnect({ open, paired, pairing, onOpenChange, onPair, onUnpair }: {
  on?: boolean;
  open: boolean;
  paired: ReadonlySet<BodyDeviceId>;
  pairing: BodyDeviceId | null;
  onToggle?: (on: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onPair: (id: BodyDeviceId) => void;
  onUnpair: (id: BodyDeviceId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) onOpenChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, onOpenChange]);
  // Each time the list opens, show a short "searching" step before the devices appear.
  useEffect(() => {
    if (!open) { setScanning(false); return; }
    setScanning(true);
    const timer = window.setTimeout(() => setScanning(false), bodyDeviceTiming.scanMs);
    return () => window.clearTimeout(timer);
  }, [open]);
  const connected = paired.size > 0;

  return <div className="wearable-connect" ref={root}>
    <button type="button" className="wearable-connect-button" data-connected={connected || undefined} aria-expanded={open} aria-controls="wearable-list" onClick={() => onOpenChange(!open)}>
      <span className="wearable-connect-icon" aria-hidden="true"><Bluetooth size={15} /></span>
      <span>Connect wearables</span>
      {connected ? <span className="wearable-connect-count">{paired.size}/{BODY_DEVICES.length}</span> : null}
      <ChevronDown size={15} className="wearable-connect-chevron" aria-hidden="true" />
    </button>
    {open ? <div id="wearable-list" className="wearable-dropdown" role="region" aria-label="Available wearables">
      {scanning ? <p className="wearable-scanning" role="status"><span className="wearable-scan-dot" aria-hidden="true" />Searching for nearby devices…</p> : <>
      <p className="wearable-dropdown-title">{paired.size ? `${paired.size} of ${BODY_DEVICES.length} paired` : "Available devices"}</p>
      <ul className="wearable-list">{BODY_DEVICES.map((device) => {
        const isPaired = paired.has(device.id);
        const isPairing = pairing === device.id;
        return <li key={device.id} className="wearable-item" data-paired={isPaired || undefined}>
          <span className="wearable-dot" aria-hidden="true" />
          <div className="wearable-text" title={`${device.worn} · ${device.measures}`}><p className="wearable-name">{device.name}</p><p className="wearable-meta">Body parts: {device.parts.join(", ")}</p></div>
          {isPaired
            ? <button type="button" className="wearable-action" aria-label={`Disconnect ${device.name}`} onClick={() => onUnpair(device.id)}>Connected</button>
            : <button type="button" className="wearable-action wearable-action-pair" aria-label={`Pair ${device.name}`} disabled={Boolean(pairing)} onClick={() => onPair(device.id)}>{isPairing ? "Pairing…" : "Pair"}</button>}
        </li>;
      })}</ul>
      </>}
    </div> : null}
  </div>;
}
