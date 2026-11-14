import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { BodyScene } from '../lib/bodyScene';
import { bodyRegions, enabledRegions, type BodyHotspot, type BodyRegionId } from '../domain/bodyRegions';
import { BODY_DEVICES, type BodyDeviceId } from '../domain/bodyDevices';
import type { MotionReadings } from '../domain/motionSensor';
import {
  MOVEMENT_TASK_REGIONS, isMovementRegion, latestMovementForRegion, movementTaskForRegion,
  movementRegionsForStage, type BodyLayer, type MovementBodyRegionId,
} from '../domain/movementBody';
import { taskFor, type VisualCheck, type VisualCheckType } from '../domain/visualCheck';
import type { Alert, LifeStage, MetricCardData } from '../types/horizon';
import type { ViewName } from './AppShell';
import { MetricTile } from './MetricTile';
import { formatDisplayValue } from '../lib/formatMetric';

export const clampBodyRotation = (degrees: number) => Math.round(Math.max(-180, Math.min(180, degrees)));

export type BodySignalState = 'ready' | 'loading' | 'unpaired' | 'unavailable' | 'stale' | 'insufficient_baseline';
interface BodyViewerProps {
  stage?: LifeStage;
  metrics?: MetricCardData[];
  alert?: Alert | null;
  signalState?: BodySignalState;
  movementChecks?: VisualCheck[];
  movementWarning?: string;
  initialLayer?: BodyLayer;
  initialRegion?: MovementBodyRegionId;
  initialRegions?: MovementBodyRegionId[];
  initialFocusKey?: number;
  onInitialFocusHandled?: () => void;
  onStartMovement?: (task: VisualCheckType) => void;
  onViewChange?: (view: ViewName) => void;
  /** Active Home only: wearables paired with "Connect wearables". When set, Signals dots are red until their device is paired. */
  pairedDevices?: ReadonlySet<BodyDeviceId>;
  pairingDevice?: BodyDeviceId | null;
  onPairDevice?: (id: BodyDeviceId) => void;
  motion?: MotionReadings;
}

const jointLabel = (name: string) => name.replace('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const completionLabel: Record<Exclude<VisualCheck['completionStatus'], 'not_assessable'>, string> = { completed: 'Completed', partial: 'Partial capture' };

export default function HumanBodyViewer({ stage = 'active', metrics = [], alert = null, signalState = 'ready', movementChecks = [], movementWarning, initialLayer = 'signals', initialRegion, initialRegions, initialFocusKey, onInitialFocusHandled, onStartMovement, onViewChange, pairedDevices, pairingDevice = null, onPairDevice, motion }: BodyViewerProps) {
  // With paired devices supplied (Active Home), a Signals part works only once its wearable is paired.
  const gated = pairedDevices !== undefined;
  const connectedIds = useMemo(() => new Set<string>(gated ? enabledRegions(pairedDevices!).map(item => item.id) : bodyRegions.filter(item => item.layer === 'signals').map(item => item.id)), [gated, pairedDevices]);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BodyScene | null>(null);
  const angleRef = useRef(0);
  const drag = useRef<{ x: number; angle: number; id: number } | null>(null);
  const handledFocus = useRef<number | undefined>(undefined);
  const [angle, setAngle] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hotspots, setHotspots] = useState<BodyHotspot[]>([]);
  const [layer, setLayer] = useState<BodyLayer>(initialLayer);
  const [selected, setSelected] = useState<BodyRegionId | null>(initialRegion ?? null);
  const [focusedRegions, setFocusedRegions] = useState<MovementBodyRegionId[]>(initialRegions ?? (initialRegion ? [initialRegion] : []));
  const [menuOpen, setMenuOpen] = useState(false);
  const dotButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const movementRegionIds = useMemo(() => movementRegionsForStage(stage), [stage]);
  const availableRegions = useMemo(() => bodyRegions.filter((region) => layer === 'signals'
    ? region.layer === 'signals'
    : region.layer === 'movement' && movementRegionIds.includes(region.id as MovementBodyRegionId)), [layer, movementRegionIds]);

  useEffect(() => {
    const nextRegions = initialRegions?.length ? initialRegions : initialRegion ? [initialRegion] : [];
    if (!nextRegions.length || initialFocusKey === undefined || handledFocus.current === initialFocusKey) return;
    handledFocus.current = initialFocusKey;
    setLayer('movement');
    setFocusedRegions(nextRegions);
    setSelected(nextRegions[0]);
    onInitialFocusHandled?.();
  }, [initialFocusKey, initialRegion, initialRegions, onInitialFocusHandled]);

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
  const chooseLayer = (next: BodyLayer) => { setLayer(next); setSelected(null); setFocusedRegions([]); setMenuOpen(false); };
  const toggle = (id: BodyRegionId) => setSelected(previous => {
    const next = previous === id ? null : id;
    setFocusedRegions(next && layer === 'movement' && isMovementRegion(next) ? [next] : []);
    return next;
  });
  const closePanel = () => { const id = selected; setSelected(null); setFocusedRegions([]); if (id) dotButtons.current[id]?.focus({ preventScroll: true }); };
  const region = bodyRegions.find(item => item.id === selected);
  const movementRegion = region && isMovementRegion(region.id) ? region.id : null;
  const related = region ? metrics.filter(metric => region.metrics.some(name => name === metric.metric)) : [];
  const canShowReadings = ['ready', 'stale', 'insufficient_baseline'].includes(signalState);
  const selectedTask = movementRegion ? movementTaskForRegion(movementRegion, stage) : undefined;
  const selectedMovement = movementRegion && selectedTask ? latestMovementForRegion(movementChecks, movementRegion, selectedTask) : undefined;

  return <section className="body-viewer" aria-label="Body signals" onKeyDown={event => { if (event.key === 'Escape' && selected) { event.stopPropagation(); closePanel(); } }}>
    <header className="body-viewer-header body-viewer-header-compact">
      <div className="body-layer-switch" role="group" aria-label="Body information layer"><button type="button" aria-pressed={layer === 'signals'} onClick={() => chooseLayer('signals')}>Signals</button><button type="button" aria-pressed={layer === 'movement'} onClick={() => chooseLayer('movement')}>Movement</button></div>
    </header>
    {!gated || layer === 'movement' ? <p className="body-viewer-description" id={gated ? 'body-viewer-layer-help' : 'body-viewer-instructions'}>{layer === 'signals' ? 'Hover or focus a green dot to see the body part. Select it to open signals; select again to close.' : 'Cyan dots connect your saved movement practice to related body regions. They do not show health status.'} Drag to turn the figure.</p> : null}
    <div className="body-viewer-layout">
    <div className="body-viewer-stage" role="group" aria-label="Rotatable 3D human figure" aria-describedby={gated && layer === 'movement' ? 'body-viewer-instructions body-viewer-layer-help' : 'body-viewer-instructions'} tabIndex={state === 'ready' ? 0 : -1}
      onKeyDown={onKeyDown} onPointerDown={onPointerDown}
      onPointerMove={event => { if (drag.current && event.pointerId === drag.current.id) turn(drag.current.angle + (event.clientX - drag.current.x) * 0.6); }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
      <div className="body-viewer-halo" aria-hidden="true" />
      <div ref={host} className="body-viewer-canvas" />
      {state === 'ready' ? hotspots.filter(point => availableRegions.some(regionItem => regionItem.id === point.id)).map(point => {
        const item = bodyRegions.find(candidate => candidate.id === point.id)!;
        const check = isMovementRegion(item.id) ? latestMovementForRegion(movementChecks, item.id, movementTaskForRegion(item.id, stage)) : undefined;
        const movementState = !check ? 'none' : check.completionStatus !== 'completed' || check.observedFeatures.cameraQuality !== 'good' ? 'limited' : 'available';
        const connected = item.layer !== 'signals' || connectedIds.has(item.id);
        return <button key={point.id} type="button" ref={node => { dotButtons.current[point.id] = node; }}
          className="body-hotspot" data-connected={connected ? "true" : "false"} data-layer={item.layer} data-movement-state={movementState} data-movement-focused={isMovementRegion(item.id) && focusedRegions.includes(item.id) ? 'true' : 'false'} data-label-side={point.x > 60 ? 'left' : 'right'} style={{ left: `${point.x}%`, top: `${point.y}%`, display: point.visible ? undefined : 'none' }}
          aria-label={connected ? item.label : `${item.label}, not connected`} aria-pressed={selected === item.id} aria-controls={region ? 'body-region-signals' : undefined}
          onPointerDown={event => event.stopPropagation()} onClick={() => toggle(item.id)}>
          <span className="body-hotspot-light" aria-hidden="true" /><span className="body-hotspot-label" aria-hidden="true">{item.label}{connected ? null : " · not connected"}</span>
        </button>;
      }) : null}
      {state !== 'ready' ? <div className="body-viewer-notice" role="status">{state === 'loading' ? <><span className="loading-dot" />Loading 3D body…</> : <><strong>3D view unavailable</strong><span>Enable WebGL or choose a body region below to review its available information.</span><button type="button" className="body-control" onClick={() => setAttempt(a => a + 1)}>Try again</button></>}</div> : null}
      {state === 'ready' ? <span className="body-viewer-orientation">{Math.abs(angle) < 15 ? 'Front view' : Math.abs(angle) > 165 ? 'Back view' : 'Side view'} · {Math.abs(angle)}°{angle < 0 ? ' left' : angle > 0 ? ' right' : ''}</span> : null}
    </div>
    <div className="body-region-menu"><button className="btn-primary" type="button" aria-expanded={menuOpen} aria-controls="body-region-options" onClick={() => setMenuOpen(open => !open)}>Choose a body region</button>{menuOpen ? <div id="body-region-options">{availableRegions.map(item => { const connected = item.layer !== 'signals' || connectedIds.has(item.id); return <button type="button" className="body-control body-region-option" data-connected={connected ? 'true' : 'false'} key={item.id} aria-pressed={selected === item.id} onClick={() => toggle(item.id)}>{layer === 'signals' ? <span className="body-region-dot" aria-hidden="true" /> : null}{item.label}<span className="sr-only">{connected ? '' : ', not connected'}</span></button>; })}</div> : null}</div>
    {region ? <aside id="body-region-signals" className="body-region-panel tech-card" data-side="right" aria-labelledby="body-region-title">
      {(() => {
        const selectedTask = movementRegion ? movementTaskForRegion(movementRegion, stage) : undefined;
        const combined = layer === 'movement' && focusedRegions.length > 1 && selectedTask ? taskFor(selectedTask).label : `${region.label} movement`;
        const note = combined === 'Sit-to-stand' || combined === 'Anchored lower-body flexion' ? 'Linked movement context for your spine, hips, knees, and legs. These derived numbers help you notice your own practice; they do not measure spinal health, strength, or injury.' : region.note;
        const panelTitle = layer === 'movement'
          ? focusedRegions.length > 1 && selectedTask
            ? `${taskFor(selectedTask).label} movement`
            : `${region.label} movement`
          : `${region.label} signals`;
        return <><div className="body-region-heading"><div><p className="eyebrow">Selected region</p><h3 id="body-region-title" aria-live="polite">{panelTitle}</h3></div><button type="button" className="body-panel-close" onClick={closePanel} aria-label={`Close ${region.label} ${layer === 'movement' ? 'movement' : 'signals'}`}>×</button></div>
      <p className="body-region-note">{note}</p>
      {layer === 'signals' && !connectedIds.has(region.id) && 'device' in region ? (() => {
        const needed = BODY_DEVICES.find(item => item.id === region.device)!;
        return <div className="body-unpaired"><p className="body-signal-notice" role="status">Not connected. Pair the {needed.name} to see {region.label.toLowerCase()} signals.</p>
          <button type="button" className="btn-primary" disabled={Boolean(pairingDevice)} onClick={() => onPairDevice?.(needed.id)}>{pairingDevice === needed.id ? 'Pairing…' : `Pair ${needed.name}`}</button></div>;
      })() : layer === 'signals' && 'motion' in region && motion ? <div className="body-region-readings">{motion[region.motion].map(reading => <div className="body-reading" key={reading.label}><h4>{reading.label}</h4><p>{reading.value}</p><small>{reading.usual} · {reading.note}</small></div>)}</div> : layer === 'movement' && movementRegion && selectedTask ? <MovementRegionPanel region={movementRegion} taskType={selectedTask} check={selectedMovement} warning={movementWarning} onStart={() => onStartMovement ? onStartMovement(selectedTask) : onViewChange?.('movement')} /> : region.metrics.length ? <>
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
      </>;
      })()}
    </aside> : null}
    </div>
    <div className="body-viewer-controls">
      <label className="body-viewer-range"><span>Left 180°</span><span className="sr-only">Body rotation</span><input type="range" min="-180" max="180" step="1" value={angle} disabled={state !== 'ready'} onChange={event => turn(Number(event.target.value))} aria-label="Body rotation" aria-valuetext={`${Math.abs(angle)} degrees ${angle < 0 ? 'left' : angle > 0 ? 'right' : 'front'}`} /><span>180° Right</span></label>
    </div>

    <footer className="body-viewer-footer"><p>{layer === 'signals' ? (gated ? 'Turn to the back for the Back marker. Green dots have a paired device; red dots do not. Colors show connection, not health status.' : 'Turn to the back for the Back marker. Green dots identify selectable regions, not health status.') : 'Cyan means saved movement context is available. Amber means the capture was partial or tracking quality was limited—not that something is wrong.'} Illustrative anatomy, not a scan of you.</p></footer>
  </section>;
}

function MovementRegionPanel({ region, taskType, check, warning, onStart }: { region: MovementBodyRegionId; taskType: keyof typeof MOVEMENT_TASK_REGIONS; check?: VisualCheck; warning?: string; onStart: () => void }) {
  const task = taskFor(taskType);
  const affected = MOVEMENT_TASK_REGIONS[taskType].map((id) => bodyRegions.find((item) => item.id === id)?.label).filter(Boolean).join(', ');
  const ranges = check?.observedFeatures.jointAngleRanges ? Object.entries(check.observedFeatures.jointAngleRanges) : [];
  const sideDifference = check ? Math.round(Math.abs(check.observedFeatures.leftRightBalance - 0.5) * 200) : 0;
  if (!check) return <>
    {warning ? <p className="body-signal-notice" role="status">Cloud history unavailable: {warning}</p> : <p className="body-signal-notice">No saved {task.label.toLowerCase()} result yet.</p>}
    <p className="movement-related-regions">Related regions: {affected}.</p>
    <p className="movement-awareness-note">Notice control, evenness, and pauses during your own practice. This cannot predict injury or assess spine, bone, muscle, or joint health.</p>
    <button type="button" className="body-control" onClick={onStart}>Open {task.label}</button>
  </>;
  return <div className="movement-result">
    <div className="movement-result-head"><div><strong>{task.label}</strong><span>{dateLabel(check.startedAt)}</span></div>{check.completionStatus !== 'not_assessable' ? <span data-quality={check.completionStatus === 'completed' && check.observedFeatures.cameraQuality === 'good' ? 'good' : 'limited'}>{completionLabel[check.completionStatus]}</span> : null}</div>
    <dl>
      {check.observedFeatures.repetitionCount !== undefined ? <><dt>Repetitions</dt><dd>{check.observedFeatures.repetitionCount}</dd></> : null}
      {ranges.length ? <><dt>Joint ranges</dt><dd>{ranges.slice(0, 4).map(([name, range]) => `${jointLabel(name)} ${Math.round(range.max - range.min)}°`).join(' · ')}</dd></> : null}
      <dt>Left/right difference</dt><dd>{sideDifference}%</dd>
      {check.observedFeatures.balanceDeviation !== undefined ? <><dt>Balance movement</dt><dd>{check.observedFeatures.balanceDeviation.toFixed(2)} relative units</dd></> : null}
      <dt>Pauses</dt><dd>{check.observedFeatures.pauseCount}</dd>
      <dt>Tracking quality</dt><dd>{check.observedFeatures.cameraQuality}</dd>
      <dt>Source</dt><dd>{check.isSynthetic ? 'Synthetic demo' : 'Camera observation'}</dd>
    </dl>
    <div className="movement-comparison"><strong>Compared with your own practice</strong>{check.comparisonSummary.statements.map((statement) => <p key={statement}>{statement}</p>)}</div>
    <p className="movement-related-regions">Related regions: {affected}.</p>
    <p className="movement-awareness-note">Notice control, evenness, and pauses during your own practice. This cannot predict injury or assess spine, bone, muscle, or joint health.</p>
    <button type="button" className="body-control" onClick={onStart}>Practise {task.label.toLowerCase()} again</button>
  </div>;
}
