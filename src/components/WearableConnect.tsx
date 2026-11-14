import { Bluetooth } from "lucide-react";
import { useEffect, useRef } from "react";
import { BODY_DEVICES, type BodyDeviceId } from "../domain/bodyDevices";

/**
 * "Connect wearables": a Bluetooth-style switch. Turning it on opens a dropdown of the simulated
 * wearables (two visible, the rest scroll); turning it off disconnects every device, like real Bluetooth.
 */
export function WearableConnect({ on, open, paired, pairing, onToggle, onOpenChange, onPair, onUnpair }: {
  on: boolean;
  open: boolean;
  paired: ReadonlySet<BodyDeviceId>;
  pairing: BodyDeviceId | null;
  onToggle: (on: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onPair: (id: BodyDeviceId) => void;
  onUnpair: (id: BodyDeviceId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) onOpenChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, onOpenChange]);

  return <div className="wearable-connect" ref={root}>
    <div className="wearable-connect-bar">
      <button type="button" className="wearable-connect-label" aria-expanded={open} aria-controls="wearable-list" disabled={!on} onClick={() => onOpenChange(!open)}>
        <Bluetooth size={16} aria-hidden="true" />
        <span>Connect wearables</span>
        {on ? <span className="wearable-connect-count">{paired.size}/{BODY_DEVICES.length}</span> : null}
      </button>
      <button type="button" role="switch" aria-checked={on} aria-label="Connect wearables" className="bt-switch" onClick={() => onToggle(!on)}>
        <span className="bt-switch-thumb" aria-hidden="true" />
      </button>
    </div>
    {on && open ? <div id="wearable-list" className="wearable-dropdown" role="region" aria-label="Available wearables">
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
    </div> : null}
  </div>;
}
