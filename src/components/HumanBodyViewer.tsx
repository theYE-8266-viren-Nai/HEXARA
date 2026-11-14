import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { BodyScene } from '../lib/bodyScene';
import { bodyRegions, enabledRegions, type BodyHotspot, type BodyRegionId } from '../domain/bodyRegions';
import { BODY_DEVICES, type BodyDeviceId } from '../domain/bodyDevices';
import type { MotionReadings } from '../domain/motionSensor';
import type { Alert, MetricCardData } from '../types/horizon';
import type { ViewName } from './AppShell';
import { MetricTile } from './MetricTile';
import { formatDisplayValue } from '../lib/formatMetric';

export const clampBodyRotation = (degrees: number) => Math.round(Math.max(-180, Math.min(180, degrees)));

export type BodySignalState = 'ready' | 'loading' | 'unpaired' | 'unavailable' | 'stale' | 'insufficient_baseline';
interface BodyViewerProps { metrics?: MetricCardData[]; alert?: Alert | null; signalState?: BodySignalState; onViewChange?: (view: ViewName) => void; pairedDevices?: ReadonlySet<BodyDeviceId>; pairingDevice?: BodyDeviceId | null; onPairDevice?: (id: BodyDeviceId) => void; onUnpairDevice?: (id: BodyDeviceId) => void; motion?: MotionReadings }
const NO_DEVICES: ReadonlySet<BodyDeviceId> = new Set();

export default function HumanBodyViewer({ metrics = [], alert = null, signalState = 'ready', onViewChange, pairedDevices = NO_DEVICES, pairingDevice = null, onPairDevice, onUnpairDevice, motion }: BodyViewerProps) {
  const [findOpen, setFindOpen] = useState(false);
  const enabled = enabledRegions(pairedDevices);
  const enabledIds = new Set<string>(enabled.map(item => item.id));
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BodyScene | null>(null);
  const angleRef = useRef(0);
  const drag = useRef<{ x: number; angle: number; id: number } | null>(null);
  const [angle, setAngle] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hotspots, setHotspots] = useState<BodyHotspot[]>([]);
  const [selected, setSelected] = useState<BodyRegionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dotButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    let cancelled = false;
    let instance: BodyScene | null = null;
    setState('loading');
    setHotspots([]);
    void import('../lib/bodyScene').then(({ createBodyScene }) => {
      if (cancelled || !host.current) return;
      instance = createBodyScene(host.current,
        () => { if (!cancelled) setState('ready'); },
        () => { if (!cancelled) { setState('unavailable'); setHotspots([]); } },
        points => { if (!cancelled) setHotspots(points); });
      scene.current = instance; instance.rotate(angleRef.current);
    }).catch(() => { if (!cancelled) setState('unavailable'); });
    return () => { cancelled = true; instance?.dispose(); scene.current = null; };
  }, [attempt]);
  useEffect(() => {
    if (state === 'unavailable') setMenuOpen(true);
    if (state === 'loading') setMenuOpen(false);
  }, [state]);
  const turn = (degrees: number) => {
    const next = clampBodyRotation(degrees);
    angleRef.current = next; setAngle(next); scene.current?.rotate(next);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (state !== 'ready' || !event.isPrimary || event.button !== 0) return;
    drag.current = { x: event.clientX, angle: angleRef.current, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const endDrag = () => { drag.current = null; };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (state !== 'ready' || event.target !== event.currentTarget) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home') {
      event.preventDefault(); turn(event.key === 'Home' ? 0 : angleRef.current + (event.key === 'ArrowLeft' ? -15 : 15));
    }
  };
  const toggle = (id: BodyRegionId) => setSelected(previous => previous === id ? null : id);
  const closePanel = () => { const id = selected; setSelected(null); if (id) dotButtons.current[id]?.focus({ preventScroll: true }); };
  const region = bodyRegions.find(item => item.id === selected);
  const related = region ? metrics.filter(metric => region.metrics.some(name => name === metric.metric)) : [];
  const canShowReadings = ['ready', 'stale', 'insufficient_baseline'].includes(signalState);
  return <section className="body-viewer" aria-label="Body signals" onKeyDown={event => { if (event.key === 'Escape' && selected) { event.stopPropagation(); closePanel(); } }}>
    <div className="body-viewer-layout">
    <div className="body-viewer-stage" role="group" aria-label="Rotatable 3D human figure" aria-describedby="body-viewer-instructions" tabIndex={state === 'ready' ? 0 : -1}
      onKeyDown={onKeyDown} onPointerDown={onPointerDown}
      onPointerMove={event => { if (drag.current && event.pointerId === drag.current.id) turn(drag.current.angle + (event.clientX - drag.current.x) * 0.6); }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
      <div className="body-viewer-halo" aria-hidden="true" />
      <div ref={host} className="body-viewer-canvas" />
      {state === 'ready' ? hotspots.map(point => {
        const item = bodyRegions.find(candidate => candidate.id === point.id)!;
        const connected = enabledIds.has(item.id);
        return <button key={point.id} type="button" ref={node => { dotButtons.current[point.id] = node; }}
          className="body-hotspot" data-connected={connected ? "true" : "false"} data-label-side={point.x > 60 ? 'left' : 'right'} style={{ left: `${point.x}%`, top: `${point.y}%`, display: point.visible ? undefined : 'none' }}
          aria-label={connected ? item.label : `${item.label}, not connected`} aria-pressed={selected === item.id} aria-controls={region ? 'body-region-signals' : undefined}
          onPointerDown={event => event.stopPropagation()} onClick={() => toggle(item.id)}>
          <span className="body-hotspot-light" aria-hidden="true" /><span className="body-hotspot-label" aria-hidden="true">{item.label}{connected ? null : " · not connected"}</span>
        </button>;
      }) : null}
      {state !== 'ready' ? <div className="body-viewer-notice" role="status">{state === 'loading' ? <><span className="loading-dot" />Loading 3D body…</> : <><strong>3D view unavailable</strong><span>Enable WebGL or choose a body region below to review its available readings.</span><button type="button" className="body-control" onClick={() => setAttempt(a => a + 1)}>Try again</button></>}</div> : null}
      {state === 'ready' ? <span className="body-viewer-orientation">{Math.abs(angle) < 15 ? 'Front view' : Math.abs(angle) > 165 ? 'Back view' : 'Side view'} · {Math.abs(angle)}°{angle < 0 ? ' left' : angle > 0 ? ' right' : ''}</span> : null}
    </div>
    {region ? <aside id="body-region-signals" className="body-region-panel tech-card" data-side={['brain', 'chest', 'back'].includes(region.id) ? 'left' : 'right'} aria-labelledby="body-region-title">
      <div className="body-region-heading"><div><p className="eyebrow">Selected region</p><h3 id="body-region-title" aria-live="polite">{region.label} signals</h3></div><button type="button" className="body-panel-close" onClick={closePanel} aria-label={`Close ${region.label} signals`}>×</button></div>
      <p className="body-region-note">{region.note}</p>
      {!enabledIds.has(region.id) ? (() => {
        const needed = BODY_DEVICES.find(item => item.id === region.device)!;
        return <div className="body-unpaired"><p className="body-signal-notice" role="status">Not connected. Pair the {needed.name} to see {region.label.toLowerCase()} signals.</p>
          <button type="button" className="btn-primary" disabled={Boolean(pairingDevice)} onClick={() => onPairDevice?.(needed.id)}>{pairingDevice === needed.id ? 'Pairing…' : `Pair ${needed.name}`}</button></div>;
      })() : 'motion' in region && motion ? <div className="body-region-readings">{motion[region.motion].map(reading => <div className="body-reading" key={reading.label}><h4>{reading.label}</h4><p>{reading.value}</p><small>{reading.usual} · {reading.note}</small></div>)}</div> : region.metrics.length ? <>
        {!canShowReadings ? <p className="body-signal-notice" role="status">{signalState === 'loading' ? 'Waiting for the current source to finish syncing.' : signalState === 'unpaired' ? 'No device paired. Connect a source to see readings for this region.' : 'Readings unavailable. The source is offline, disconnected, or has insufficient reliable data.'}</p> : <>
          {signalState === 'stale' ? <p className="body-signal-notice" role="status">These readings are stale. Review the source and last sync before interpreting them.</p> : null}
          {signalState === 'insufficient_baseline' ? <p className="body-signal-notice">Not enough history for a personal baseline. Current readings are shown without a comparison.</p> : null}
          <div className="body-region-readings">{related.length ? related.map(metric => signalState === 'insufficient_baseline'
            ? <div className="body-reading" key={metric.metric}><h4>{metric.label}</h4><p>{formatDisplayValue(metric.metric, metric.value, metric.unit)}</p><small>{metric.source} · {metric.quality}</small></div>
            : <MetricTile key={metric.metric} metric={metric} flagged={alert?.metric === metric.metric} onOpen={onViewChange ? () => onViewChange('trends') : undefined} />)
            : <p className="body-signal-notice">No readings for this region from the current source.</p>}</div>
        </>}
        {onViewChange ? <button type="button" className="body-control" onClick={() => onViewChange(canShowReadings ? 'trends' : 'profile')}>{canShowReadings ? 'Open Trends' : 'Review connection'}</button> : null}
      </> : <><p className="body-signal-notice">No direct measurement available</p>{onViewChange ? <button type="button" className="body-control" onClick={() => onViewChange('movement')}>Open Movement</button> : null}</>}
    </aside> : null}
    </div>
    <div className="body-viewer-controls">
      <div className="body-viewer-buttons"><button type="button" className="body-control" disabled={state !== 'ready' || angle <= -180} onClick={() => turn(angleRef.current - 15)}>Turn left</button><button type="button" className="body-control" disabled={state !== 'ready'} onClick={() => turn(0)}>Front view</button><button type="button" className="body-control" disabled={state !== 'ready' || angle >= 180} onClick={() => turn(angleRef.current + 15)}>Turn right</button></div>
      <label className="body-viewer-range"><span>Left 180°</span><span className="sr-only">Body rotation</span><input type="range" min="-180" max="180" step="1" value={angle} disabled={state !== 'ready'} onChange={event => turn(Number(event.target.value))} aria-label="Body rotation" aria-valuetext={`${Math.abs(angle)} degrees ${angle < 0 ? 'left' : angle > 0 ? 'right' : 'front'}`} /><span>180° Right</span></label>
    </div>
    <div className="body-region-menu"><button type="button" aria-expanded={menuOpen} aria-controls="body-region-options" onClick={() => setMenuOpen(open => !open)}>Choose a body region</button>{menuOpen ? <div id="body-region-options">{bodyRegions.map(item => <button type="button" className="body-control body-region-option" data-connected={enabledIds.has(item.id) ? "true" : "false"} key={item.id} aria-pressed={selected === item.id} onClick={() => toggle(item.id)}><span className="body-region-dot" aria-hidden="true" />{item.label}<span className="sr-only">{enabledIds.has(item.id) ? '' : ', not connected'}</span></button>)}</div> : null}</div>
    <div className="body-devices">
      <button type="button" className="btn-primary body-devices-toggle" aria-expanded={findOpen} aria-controls="body-device-list" onClick={() => setFindOpen(open => !open)}>{findOpen ? 'Hide devices' : 'Find devices'}</button>
      <p className="body-devices-summary" role="status">{pairedDevices.size ? `${pairedDevices.size} of ${BODY_DEVICES.length} devices paired` : 'No devices paired'}</p>
      {findOpen ? <ul id="body-device-list" className="body-device-list" aria-label="Available devices">{BODY_DEVICES.map(device => {
        const paired = pairedDevices.has(device.id);
        const pairing = pairingDevice === device.id;
        return <li key={device.id} className="body-device" data-paired={paired || undefined}>
          <div className="body-device-text"><p className="body-device-name">{device.name}{paired ? <span className="body-device-badge">Paired</span> : null}</p><p className="body-device-meta">{device.worn} · {device.measures}</p><p className="body-device-parts">Body parts: {device.parts.join(', ')}</p></div>
          {paired ? <button type="button" className="btn-secondary" aria-label={`Disconnect ${device.name}`} onClick={() => onUnpairDevice?.(device.id)}>Disconnect</button>
            : <button type="button" className="btn-secondary" aria-label={`Pair ${device.name}`} disabled={pairing || Boolean(pairingDevice)} onClick={() => onPairDevice?.(device.id)}>{pairing ? 'Pairing…' : 'Pair'}</button>}
        </li>;
      })}</ul> : null}
    </div>
    <footer className="body-viewer-footer"><p>Turn to the back for the Back marker. Green dots have a paired device; red dots do not. Colors show connection, not health status. Illustrative anatomy, not a scan of you.</p><p>Anatomy: BodyParts3D © DBCLS; adapted by <a href="https://github.com/MervinR07/open-anatomy-3d" target="_blank" rel="noreferrer">open-anatomy-3d</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Display colors adjusted. <a href={`${import.meta.env.BASE_URL}models/human/ATTRIBUTION.md`} target="_blank" rel="noreferrer">Full credits</a></p></footer>
  </section>;
}
