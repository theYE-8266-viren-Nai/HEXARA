import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, AlertTriangle, Pencil, Apple, ArrowRight, ArrowUpRight, Bluetooth, Bone, CircleHelp, Compass, Droplets, FileText, Heart, HeartPulse, MessageCircleHeart, Minus, Moon, Orbit, Radio, Rocket, ShieldCheck, Sparkles, Watch, WifiOff } from "lucide-react";
import { MetricMetadata } from "./MetricTile";
import { formatValue } from "../lib/formatMetric";
import { ActiveGuidanceView } from "./ActiveGuidanceView";

const HumanBodyViewer = lazy(() => import('./HumanBodyViewer'));
import { StatusChip } from "./StatusChip";
import { TrendChart } from "./TrendChart";
import type { DashboardSource } from "../lib/backendDashboardRepository";
import type { SolarEventResult } from "../lib/nasaDonki";
import { usePersistedState } from "../lib/usePersistedState";
import type { Alert, DataQualityState, LifeStage, MetricCardData, SimulationScenario, TravelerProfile } from "../types/horizon";
import { Brand, type ViewName } from "./AppShell";
import type { PreparationRepository } from "../lib/preparationRepository";
import { useDevice } from "../lib/deviceContext";
import { WellbeingCheckIn } from "./WellbeingCheckIn";
import { WearableConnect } from "./WearableConnect";
import { BODY_DEVICES, bodyDevicesForStage, metricFromPairedDevice } from "../domain/bodyDevices";
import { astronautRecord, initials } from "../data/astronautProfiles";
import { displayValue, initialsOf, profileGroups, validateProfile, type AstronautProfile } from "../domain/astronautAccount";
import type { Account } from "../lib/accountRepository";
import { ProfileFields } from "./AccountViews";
import { CONNECT_PHASES } from "../domain/deviceSimulator";
import { deviceTiming } from "../lib/useDeviceStream";
import { formatMetricValue } from "../lib/formatMetricValue";
import { LandingScene } from "./LandingScene";
import { SpaceLoader } from "./SpaceLoader";
import type { VisualCheck, VisualCheckType } from "../domain/visualCheck";
import type { MovementBodyRegionId } from "../domain/movementBody";
import type { MonthlyHistorySummary } from "../domain/monthlyHistory";

const panelClass = "tech-card p-5 sm:p-6";

export function StageSelectionView({ loading, warning, onSelect, onOpenGroundDemo }: { loading?: boolean; warning?: string; onSelect?: (stage: LifeStage) => void; onOpenGroundDemo?: () => void }) {
  const options = [
    { stage: "future" as const, title: "Astronaut in Training", Icon: Rocket },
    { stage: "active" as const, title: "Active astronaut", Icon: Orbit },
    { stage: "retired" as const, title: "Former astronaut", Icon: Compass },
  ];
  return <main className="onboarding landing-space">
    <LandingScene />
    <div className="onboarding-container landing-content">
      <header className="onboarding-topbar landing-topbar"><Brand /><p className="landing-eyebrow"><span className="landing-live-dot" /> Health companion for astronauts</p></header>
      <div className="landing-hero">
        <section className="landing-copy" aria-labelledby="journey-title">
          <h1 id="journey-title" className="landing-title landing-rise">Far from Earth.<br /><span>Close to your health.</span></h1>
          <p className="landing-intro landing-rise">OrbitWell tracks your vital signs against your own baseline and tells you what changed.</p>
          <h2 id="stage-options-title" className="landing-stage-title landing-rise">Choose your mission stage</h2>
          {loading ? <div className="tech-card journey-loading"><SpaceLoader message="Preparing your private workspace…" /></div> : <div className="landing-stages landing-rise" aria-labelledby="stage-options-title">{options.map(({ stage, title, Icon }) => <button key={stage} type="button" aria-label={title} onClick={() => onSelect?.(stage)} className={`landing-stage journey-${stage}`}><span className="landing-stage-icon"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span><span className="landing-stage-text"><span className="landing-stage-name">{title}</span></span><ArrowRight className="landing-stage-arrow" size={18} aria-hidden="true" /></button>)}{onOpenGroundDemo ? <button type="button" className="landing-stage landing-stage-ground" onClick={onOpenGroundDemo}><span className="landing-stage-icon"><HeartPulse size={20} strokeWidth={1.6} aria-hidden="true" /></span><span className="landing-stage-text"><span className="landing-stage-name">Ground health team</span></span><ArrowRight className="landing-stage-arrow" size={18} aria-hidden="true" /></button> : null}</div>}
        </section>
      </div>
    </div>
  </main>;
}

export function HomeView({ profile, stage, scenario, metrics, alert, dataQuality, loading, source, warning, solarEvents, movementChecks = [], movementWarning, bodyFocus, onBodyFocusHandled, onStartMovement, onViewChange, onOpenChat }: { profile: TravelerProfile; stage: LifeStage; scenario: SimulationScenario; metrics: MetricCardData[]; alert: Alert | null; dataQuality: DataQualityState; loading: boolean; source?: DashboardSource; warning?: string; solarEvents?: SolarEventResult | null; movementChecks?: VisualCheck[]; movementWarning?: string; bodyFocus?: { regions: MovementBodyRegionId[]; nonce: number } | null; onBodyFocusHandled?: () => void; onStartMovement?: (task: VisualCheckType) => void; onViewChange: (view: ViewName) => void; onOpenChat?: () => void }) {
  const device = useDevice();
  const ingest = device?.ingest ?? null;
  const unreliable = ingest?.quality === "poor";
  const dataUnavailable = dataQuality === "disconnected" || dataQuality === "offline" || unreliable;
  const stale = dataQuality === "stale";
  if (unreliable) alert = null; // poor-quality data never produces an alert
  const status = dataUnavailable ? "unavailable" : stale ? "watch" : alert?.severity ?? "normal";
  const tone = dataUnavailable ? "unavailable" : stale || alert ? "watch" : "normal";
  const statusTitle = unreliable ? "Not enough reliable data" : dataUnavailable ? "Waiting for a data source" : stale ? "The data needs a review" : alert ? "A pattern is worth reviewing" : "Your signals look usual";
  const statusReason = unreliable ? "Not enough reliable data to assess. Check that the wearable is worn snugly and try again." : dataUnavailable ? "The simulated sensor has stopped sending readings. Reconnect the source to continue monitoring." : stale ? "The latest simulated update is older than expected. Review these readings with caution before acting on a pattern." : alert?.reason ?? "Your latest simulated signals are close to your personal pattern.";
  const action = dataUnavailable ? "Reconnect simulated data" : stale ? "Review data-quality controls" : alert?.nextAction ?? "Keep monitoring and complete the optional wellbeing check-in if something feels different.";
  const actionLabel = dataUnavailable ? "Reconnect data" : stale ? "Review data quality" : alert ? "Take the optional wellbeing check-in" : "Check in with yourself";
  const actionNote = dataUnavailable ? "This demo scenario shows how missing data is handled. Nothing is inferred while the source is offline." : "A short check-in adds context to the signals. Skipping it does not count as feeling well.";
  const stageContent = stage === "future" ? { title: "Train with your wearable", description: "Use your wearable during physical training to build a personal baseline before your first mission." } : stage === "retired" ? { title: "Keep the long view", description: "Review long-term signals and wellbeing context after flying." } : { title: "Explore your signals", description: "Hover or focus a green dot to see the body part. Select it to open signals; select again to close. Drag to turn the figure." };
  const radiation = stage === "future" ? metrics.find((metric) => metric.metric === "radiation_dose") : undefined;

  return <div className={`page${stage === "retired" ? " retired-page" : ""}`}>
    <header className="page-header">
      <div>
        <p className="page-kicker">{profile.name} · {stageLabel(stage)}{stage === "retired" ? "" : ` · ${missionLabel(profile, stage)}`}</p>
        <h1>{stageContent.title}</h1>
        <p className="page-lede" id="body-viewer-instructions">{stageContent.description}</p>
      </div>
      <div className="page-meta home-device-meta">
        {(stage === "active" || stage === "retired") && device?.bodyDevices?.paired.size === 0 ? <DeviceIdleGate stage={stage}>{null}</DeviceIdleGate> : null}
        {device?.bodyDevices && (stage === "future" || device.bodyDevices.paired.size > 0) ? <WearableConnect stage={stage} on={device.bodyDevices.bluetoothOn} open={device.bodyDevices.listOpen} paired={device.bodyDevices.paired} pairing={device.bodyDevices.pairing} onToggle={device.bodyDevices.setBluetooth} onOpenChange={device.bodyDevices.setListOpen} onPair={device.bodyDevices.pair} onUnpair={device.bodyDevices.unpair} /> : null}
        <span className="scenario-pill"><Radio size={13} aria-hidden="true" />{scenarioLabel(scenario)}<span>Simulated</span></span>
        {stage === "retired" ? null : <DeviceBadge />}
      </div>
    </header>
    <Suspense fallback={<section className="body-viewer-loading" aria-label="Body overview">Loading body overview…</section>}><HumanBodyViewer key={`${stage}:${profile.id}`} stage={stage} metrics={metrics} alert={alert} onViewChange={onViewChange} {...(device?.bodyDevices ? { pairedDevices: device.bodyDevices.paired, pairingDevice: device.bodyDevices.pairing, onPairDevice: device.bodyDevices.pair, motion: device.bodyDevices.motion } : {})} movementChecks={movementChecks} movementWarning={movementWarning} initialLayer={bodyFocus ? "movement" : "signals"} initialRegions={bodyFocus?.regions} initialFocusKey={bodyFocus?.nonce} onInitialFocusHandled={onBodyFocusHandled} onStartMovement={onStartMovement}
      signalState={loading ? 'loading' : device?.status.phase === 'idle' ? 'unpaired' : dataUnavailable ? 'unavailable' : stale ? 'stale' : dataQuality === 'insufficient_baseline' ? 'insufficient_baseline' : 'ready'} /></Suspense>
    {stage === "retired" ? <section className="retired-advisor tech-card" aria-labelledby="retired-advisor-title">
      <span className="retired-advisor-icon" aria-hidden="true"><MessageCircleHeart size={25} /></span>
      <div className="retired-advisor-copy"><h2 id="retired-advisor-title">Mental friend</h2><p>Talk with ORBIT about life after flight, the view of Earth, or anything on your mind.</p></div>
      <button type="button" className="btn-primary" onClick={onOpenChat}>Chat with ORBIT <ArrowRight size={17} aria-hidden="true" /></button>
    </section> : null}
    {stage === "retired" ? null : loading ? <LoadingPanel /> : <DeviceIdleGate stage={stage} hidePrompt={Boolean(device?.bodyDevices)}><>
      <section data-tone={tone} className="tech-card status-card" aria-labelledby="status-title">
        <div className="status-card-main">
          <StatusChip severity={status} />
          <h2 id="status-title">{statusTitle}</h2>
          <p>{statusReason}</p>
        </div>
        <div className="status-card-action">
          <button type="button" onClick={() => onViewChange(dataUnavailable || stale ? "profile" : "wellbeing")} className="btn-primary"><span className="sr-only">{action}</span><span aria-hidden="true">{actionLabel}</span><ArrowRight size={16} aria-hidden="true" /></button>
          <p>{actionNote}</p>
        </div>
      </section>

      {radiation ? <RadiationPanel metric={radiation} solarEvents={solarEvents} /> : null}
    </></DeviceIdleGate>}

    <footer className="home-footer">
      {loading ? null : <DataTrustStrip />}
      <DataSourceStatus source={source} warning={warning} />
    </footer>
  </div>;
}

function RadiationPanel({ metric, solarEvents }: { metric?: MetricCardData; solarEvents?: SolarEventResult | null }) {
  if (!metric) return null;
  const level = metric.value > metric.baseline * 2 ? { label: "Well above usual", tone: "high" } : metric.value > metric.baseline * 1.25 ? { label: "Above usual", tone: "watch" } : { label: "Within usual range", tone: "normal" };
  return <section className="tech-card panel radiation-panel" data-tone={level.tone} aria-labelledby="radiation-title">
    <div className="panel-head"><h2 id="radiation-title">Radiation context</h2><span className="tone-pill">{level.label}</span></div>
    <p className="radiation-figure"><strong>{formatValue(metric.metric, metric.value)}</strong> {metric.unit}<span>usual {formatValue(metric.metric, metric.baseline)} {metric.unit}</span></p>
    <p className="panel-note">Synthetic dose shown as context only. It is not a safety clearance.</p>
    <p className="panel-footnote">{solarEvents?.source === "nasa" ? `NASA DONKI solar events loaded: ${solarEvents.events.length}.` : solarEvents?.warning ?? "Loading optional NASA solar-event context…"}</p>
  </section>;
}

const retiredTrendDays = ["06-23", "06-24", "06-25", "06-26", "06-27", "06-28", "06-29"];
type RetiredActivityTrend = Omit<MetricCardData, "metric"> & { metric: "mobility" | "exercise_minutes" };
const retiredActivityTrends = [
  {
    metric: "mobility",
    label: "Mobility",
    unit: "%",
    value: 92,
    baseline: 90,
    trend: "up" as const,
    plainLanguage: "Walking steadiness is slightly above your recent pattern.",
    source: "Synthetic Apple Health",
    quality: "Simulated",
    aggregationPeriod: "Daily walking summary",
    points: [88, 89, 90, 91, 90, 92, 92].map((value, index) => ({ day: retiredTrendDays[index], value, baseline: 90, alert: false })),
  },
  {
    metric: "exercise_minutes",
    label: "Exercise minutes",
    unit: "min",
    value: 28,
    baseline: 25,
    trend: "up" as const,
    plainLanguage: "Today’s movement is a little above your recent daily pattern.",
    source: "Synthetic Apple Health",
    quality: "Simulated",
    aggregationPeriod: "Total today",
    points: [18, 22, 24, 30, 20, 26, 28].map((value, index) => ({ day: retiredTrendDays[index], value, baseline: 25, alert: false })),
  },
] satisfies RetiredActivityTrend[];

function formatTrendValue(metric: MetricCardData | RetiredActivityTrend, value: number): string {
  if (metric.metric === "mobility" || metric.metric === "exercise_minutes") return `${value} ${metric.unit}`;
  return formatMetricValue(metric.metric, value, metric.unit);
}

export function TrendsView({ stage = "active", metrics, alert, dataQuality, loading, source, warning, monthlyHistory = [], monthlyHistoryNote }: { stage?: LifeStage; metrics: MetricCardData[]; alert: Alert | null; dataQuality: DataQualityState; loading: boolean; source?: DashboardSource; warning?: string; monthlyHistory?: MonthlyHistorySummary[]; monthlyHistoryNote?: string }) {
  const dataUnavailable = dataQuality === "disconnected" || dataQuality === "offline";
  const stale = dataQuality === "stale";
  const [alertOpen, setAlertOpen] = useState(false);
  const retired = stage === "retired";
  // Active and Future pair wearables with "Connect wearables": show only the charts their paired devices measure.
  const wearables = useDevice()?.bodyDevices;
  const pairedDevices = wearables?.paired;
  const paired = retired ? undefined : pairedDevices;
  const visibleMetrics = retired
    ? [...metrics.filter((metric) => metric.metric !== "radiation_dose" && metric.metric !== "core_temperature"), ...retiredActivityTrends]
    : paired ? metrics.filter((metric) => metricFromPairedDevice(metric.metric, paired)) : metrics;
  const pairedNames = paired ? BODY_DEVICES.filter((item) => paired.has(item.id)).map((item) => item.name) : [];
  const deviceNote = paired && pairedNames.length ? <><p className="trend-device-note" role="note">Showing charts from: {pairedNames.join(", ")}.{pairedNames.length < BODY_DEVICES.length ? " Connect more wearables to see other signals." : ""}</p>{!visibleMetrics.length ? <p className="trend-device-note" role="note">Motion sensor readings appear on the Legs and Back of the body in Home; they have no trend chart.</p> : null}</> : null;
  return <div className="space-y-7"><header className="trends-header"><div><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Trends</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{retired ? "Your wearable trends over time" : "Your signals over time"}</h1>{retired ? null : <><p className="mt-2 max-w-2xl leading-7 text-slate-400">Each dotted line represents an illustrative 30-day personal baseline. Alerts are marked so you can review what changed and why.</p></>}</div><div className="trends-header-meta">{wearables ? <WearableConnect stage={stage} on={wearables.bluetoothOn} open={wearables.listOpen} paired={wearables.paired} pairing={wearables.pairing} onToggle={wearables.setBluetooth} onOpenChange={wearables.setListOpen} onPair={wearables.pair} onUnpair={wearables.unpair} /> : null}{retired ? null : <DeviceBadge />}</div></header>{loading ? <LoadingPanel /> : dataUnavailable ? <DataNotice title="Trends are unavailable" body="The simulated source is disconnected. Reconnect it from Profile to resume the trend view." /> : <DeviceIdleGate stage={stage} connectAbove={Boolean(wearables)}><>{alert ? <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4" aria-labelledby="trend-alert-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Alert marker</p><h2 id="trend-alert-title" className="mt-1 text-lg font-semibold text-white">A signal needs review</h2></div><button type="button" aria-expanded={alertOpen} aria-controls="trend-alert-reason" onClick={() => setAlertOpen((open) => !open)} className="rounded-xl border border-amber-200/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/10">{alertOpen ? "Hide reason" : "Show alert reason"}</button></div>{alertOpen ? <p id="trend-alert-reason" className="mt-4 max-w-3xl text-sm leading-6 text-amber-50">{alert.reason}</p> : null}</section> : null}{stale ? <div className="rounded-2xl border px-4 py-3 text-sm border-amber-300/30 bg-amber-300/10 text-amber-100" role="status">{"These readings are stale. The charts remain visible for context, but the latest update is older than expected."}</div> : null}{deviceNote}<div className="trend-grid">{visibleMetrics.map((metric) => <article key={metric.metric} className="tech-card trend-card"><div className="trend-card-head"><h2>{metric.label}</h2><p className="trend-value">{formatTrendValue(metric, metric.value)}</p></div><p className="trend-card-note">{metric.plainLanguage}</p><MetricMetadata metric={metric} /><div className="mt-3"><TrendChart metric={metric} compact /></div><div className="trend-card-foot"><span>Usual {formatTrendValue(metric, metric.baseline)}</span>{metric.points.some((point) => point.alert) ? <span className="inline-flex items-center gap-1 text-amber-200"><AlertTriangle size={14} /> Review marker</span> : <span>Within usual range</span>}</div></article>)}</div><MonthlyHistorySection summaries={monthlyHistory} note={monthlyHistoryNote} /></></DeviceIdleGate>}{loading ? null : <DataTrustStrip />}</div>;
}

const MONTHLY_LABELS: Record<string, string> = { heart_rate: "Resting heart rate", hrv: "HRV", spo2: "SpO₂", sleep_hours: "Sleep", skin_temperature: "Skin temperature", radiation_dose: "Radiation dose" };
const MONTHLY_UNITS: Record<string, string> = { heart_rate: "bpm", hrv: "ms", spo2: "%", sleep_hours: "h", skin_temperature: "°C", radiation_dose: "mSv" };
const MONTHLY_DIRECTION: Record<string, string> = { usual: "close to earlier pattern", higher: "higher than earlier pattern", lower: "lower than earlier pattern", insufficient: "not enough data to compare" };

export function MonthlyHistorySection({ summaries, note }: { summaries: MonthlyHistorySummary[]; note?: string }) {
  if (!summaries.length) return null;
  return <section className="monthly-history tech-card" aria-labelledby="monthly-history-title"><div className="panel-head"><div><p className="eyebrow">LONGER VIEW</p><h2 id="monthly-history-title">Monthly personal history</h2></div><span className="monthly-history-count">{summaries.length} months</span></div><p className="panel-note">Personal history from simulated readings. This is context, not a diagnosis.</p>{note ? <p className="monthly-history-window-note" role="note">{note}</p> : null}<div className="monthly-history-list">{summaries.slice().reverse().map((summary, index) => <details key={summary.month} open={index === 0} className="monthly-history-month"><summary><span>{summary.label}</span><span className={`monthly-quality monthly-quality-${summary.quality}`}>{summary.quality === "good" ? "Good context" : summary.quality === "limited" ? "Limited context" : "Insufficient context"}</span></summary><div className="monthly-history-content"><p className="monthly-personal-summary">{summary.personalSummary}</p><div className="monthly-metric-grid">{summary.metrics.map((metric) => <div key={metric.metric} className="monthly-metric"><span>{MONTHLY_LABELS[metric.metric]}</span><strong>{metric.average} {MONTHLY_UNITS[metric.metric]}</strong><small>{metric.minimum}–{metric.maximum} · {MONTHLY_DIRECTION[metric.direction]}</small></div>)}</div><p className="monthly-history-foot">{summary.notableDays ? `${summary.notableDays} notable day${summary.notableDays === 1 ? "" : "s"} under the existing review rules.` : "No notable days under the existing review rules."}</p></div></details>)}</div></section>;
}

export function WellbeingView({ stage, client }: { stage: LifeStage; client: import("@supabase/supabase-js").SupabaseClient | null }) {
  return <WellbeingCheckIn key={stage} stage={stage} client={client} />;
}

export function ProfileView({ profile, profiles, stage, scenario, seed, replayCount, loading, onProfileChange, onScenarioChange, onSeedChange, onReplay, onStageChange, account, onSaveProfile }: { profile: TravelerProfile; profiles: TravelerProfile[]; stage: LifeStage; scenario: SimulationScenario; seed: number; replayCount: number; loading: boolean; onProfileChange: (id: string) => void; onScenarioChange: (scenario: SimulationScenario) => void; onSeedChange: (seed: number) => void; onReplay: () => void; onStageChange: (stage: LifeStage) => void; account?: Account | null; onSaveProfile?: (profile: AstronautProfile) => Promise<string | undefined> }) {
  const [editing, setEditing] = useState(false);
  const own = account?.profile ?? null;
  const record = astronautRecord(stage);
  const metrics = useDevice()?.metrics ?? [];
  const baselines = metrics.filter((metric) => ["resting_hr", "hrv", "sleep_hours", "spo2"].includes(metric.metric));
  if (own && editing && onSaveProfile) return <ProfileEditor initial={own} onCancel={() => setEditing(false)} onSave={async (next) => { const error = await onSaveProfile(next); if (!error) setEditing(false); return error; }} />;
  const name = own ? own.fullName : profile.name;
  const tags = own ? [["Call sign", own.callSign], ["Agency", own.agency]].filter(([, value]) => value) : [["Call sign", record.callsign], ["Agency", record.agency]];
  const summary = own ? [own.journey.role ?? own.journey.currentRole ?? own.journey.trainingPhase, own.personal.background].filter(Boolean).join(" · ") || `Signed in as ${account!.email}` : record.summary;
  return <div className="page">
    <header className="tech-card profile-hero">
      <span className="profile-avatar" aria-hidden="true">{own ? initialsOf(own.fullName) : initials(profile)}</span>
      <div className="profile-hero-text">
        <p className="page-kicker">{stage === "retired" ? "Former astronaut" : `${stageLabel(stage)} · ${missionLabel(profile, stage)}`}</p>
        <h1>{name}</h1>
        {stage === "retired" ? null : <p className="page-lede">{summary}</p>}
      </div>
      {tags.length ? <dl className="profile-tags">{tags.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
      {own ? <button type="button" className="btn-secondary profile-edit" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true" /> Edit profile</button> : null}
    </header>
    <div className="profile-grid">
      {own ? <>
        {profileGroups(own.stage).slice(0, 2).map((group) => <ProfileFacts key={group.id} title={group.title} facts={group.fields.map((field) => ({ label: field.label, value: displayValue(field, own[group.id][field.key]) }))} />)}
      </> : <>
        <ProfileFacts title="Personal details" facts={record.personal} />
        <ProfileFacts title={record.journey.title} facts={record.journey.facts} />
      </>}
      <section className="tech-card panel" aria-labelledby="baselines-title">
        <div className="panel-head"><h2 id="baselines-title">Personal baselines</h2></div>
        <p className="panel-note">Your usual values over the last 30 days. Alerts compare you only with these.</p>
        {baselines.length ? <dl className="fact-list">{baselines.map((metric) => <div key={metric.metric}><dt>{metric.label}</dt><dd>{Number(metric.baseline).toFixed(metric.metric === "sleep_hours" || metric.metric === "spo2" ? 1 : 0)} {metric.unit}</dd></div>)}</dl> : <p className="panel-note">Baselines appear once a wearable has synced.</p>}
      </section>
      {own ? (() => { const group = profileGroups(own.stage)[2]; return <ProfileFacts title={group.title} facts={group.fields.map((field) => ({ label: field.label, value: displayValue(field, own.careTeam[field.key]) }))} />; })() : <ProfileFacts title="Care team and contacts" facts={record.careTeam} />}
    </div>
    <section className="tech-card panel" aria-labelledby="wearable-title">
      <div className="panel-head"><h2 id="wearable-title">Wearable</h2></div>
      <div className="mt-3"><DeviceCard stage={stage} onResetScenario={() => onScenarioChange("usual")} /></div>
    </section>
  </div>;
}

function ProfileEditor({ initial, onSave, onCancel }: { initial: AstronautProfile; onSave: (profile: AstronautProfile) => Promise<string | undefined>; onCancel: () => void }) {
  const [draft, setDraft] = useState<AstronautProfile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateProfile(draft);
    setErrors(found);
    if (Object.keys(found).length) { setError("Check the highlighted fields."); return; }
    setBusy(true); setError(undefined);
    const failure = await onSave(draft);
    setBusy(false);
    if (failure) setError(failure);
  };
  return <div className="page">
    <header className="page-header"><div><p className="page-kicker">Profile</p><h1>Edit your profile</h1><p className="page-lede">Changing your stage switches your workspace, check-in questions and profile sections.</p></div></header>
    <form className="tech-card account-card account-card-wide account-form" onSubmit={submit} noValidate>
      <ProfileFields profile={draft} onChange={setDraft} errors={errors} showStage />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="account-nav"><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
    </form>
  </div>;
}

function ProfileFacts({ title, facts }: { title: string; facts: Array<{ label: string; value: string }> }) {
  return <section className="tech-card panel"><div className="panel-head"><h2>{title}</h2></div><dl className="fact-list">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></section>;
}

const futureWorkflow: { title: string; body: string; view?: ViewName; anchor?: string; action: string }[] = [
  { title: "Confirm your future workspace", body: "In Profile, check the selected traveler, Future stage, and practice data source. Demo scenarios change simulated data only; they do not change a real device or mission record.", view: "profile", action: "Check Profile" },
  { title: "Learn Home before launch", body: "Practice checking the source, last sync, and quality before reading any card. Learn which signals are simulated and how missing or stale data should be treated.", view: "home", action: "Open Home" },
  { title: "Review your personal pattern", body: "Use Trends to compare available readings with your own earlier pattern. A personal pattern is context, not a medical target or flight clearance.", view: "trends", action: "Review Trends" },
  { title: "Practice a wellbeing check-in", body: "Answer questions about sleep, energy, comfort, mood, and expected workload. Add useful context and learn what should be shared with your future mission team.", view: "wellbeing", action: "Open Wellbeing" },
  { title: "Explore Movement safely", body: "Review camera consent and limits before a guided practice. The movement summary is approximate and cannot diagnose injury, assess bone density, or approve a task.", view: "movement", action: "Explore Movement" },
  { title: "Prepare your data connection", body: "Learn how to check device fit and connection, and how to resolve missing or poor-quality data. Practice resolving gaps before relying on a trend.", view: "profile", action: "Review connections" },
];

const futureLearningGroups = [
  {
    title: "Training progress & reflection",
    description: "Understand your preparation record, use personal context carefully, and turn each session into a useful next step.",
    Icon: FileText,
    cards: [
      { title: "How qualification progress works", Icon: ShieldCheck, summary: "Use completed modules and assessed skills to understand where you are in the training programme.", points: ["A module counts as complete only when the training programme records its required work and assessment.", "Review the skills currently being practised and the evidence still needed for the next milestone.", "OrbitWell shows training progress only; it does not provide medical clearance, flight certification, or mission approval."], resources: [{ label: "NASA astronaut candidate training", href: "https://www.nasa.gov/centers-and-facilities/johnson/summer-training-catching-up-with-nasas-astronaut-candidates/" }] },
      { title: "How baseline days are counted", Icon: Watch, summary: "Build a useful personal reference from consistent, good-quality wearable days rather than every calendar day.", points: ["A useful day needs enough wearable coverage and reliable readings to support a personal comparison.", "Missing, disconnected, stale, or poor-quality readings should be shown as gaps rather than treated as normal values.", "Compare patterns across relevant contexts such as strength work, pool training, simulator sessions, and recovery days."], resources: [{ label: "NASA Human Research Program", href: "https://www.nasa.gov/hrp/" }] },
      { title: "How to interpret training load", Icon: Activity, summary: "Read training load as programme context, not as a target to maximize or a measure of flight readiness.", points: ["Review the planned mix of physical work, simulations, study, and recovery across the week.", "Look for changes from your own recent pattern and consider session type, duration, intensity, and how you feel.", "Follow the load and limits set by qualified trainers; do not add work simply to improve an app value."], resources: [{ label: "NASA strength and conditioning", href: "https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/" }] },
      { title: "How to use recovery information", Icon: Moon, summary: "Use sleep, wellbeing, and recent workload as context for the next demanding session.", points: ["Review sleep, fatigue, comfort, mood, and recent workload before training.", "Treat a change from your personal pattern as a prompt to check in, not as a diagnosis or automatic stop decision.", "Raise unusual, persistent, worsening, or activity-limiting concerns with the appropriate training or medical professional."], resources: [{ label: "NASA behavioral health and performance brief", href: "https://www.nasa.gov/wp-content/uploads/2023/03/behavioral-health-technical-brief-ochmo.pdf" }] },
      { title: "How to conduct a useful debrief", Icon: MessageCircleHeart, summary: "Capture what happened, what you learned, and what should change before the next attempt.", points: ["Record the session goal, what actually happened, and any important difference from the plan.", "Note one effective action, one difficulty, and relevant trainer feedback without turning the debrief into a score chase.", "Finish with one specific skill to revisit and the agreed next step, owner, or follow-up."], resources: [{ label: "NASA training requirements", href: "https://www.nasa.gov/reference/5-0-training/" }] },
    ],
  },
  {
    title: "Physical & medical readiness",
    description: "Build the fitness, recovery habits, and health awareness needed for demanding training.",
    Icon: Activity,
    cards: [
      { title: "Strength & endurance", Icon: HeartPulse, summary: "Prepare for sustained workloads, equipment handling, and physically demanding operations.", points: ["Combine aerobic conditioning with progressive full-body strength work.", "Build gradually and prioritize consistent technique over performance scores.", "Treat pain, faintness, chest discomfort, or unusual breathlessness as reasons to stop and seek qualified guidance."], resources: [{ label: "NASA astronaut strength and conditioning", href: "https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/" }] },
      { title: "Mobility & water confidence", Icon: Droplets, summary: "Develop controlled movement, swimming ability, and confidence in unfamiliar environments.", points: ["Practice mobility, coordination, balance, and safe movement under load.", "Swimming and water-survival skills support later training in suits and recovery scenarios.", "Use trained supervision for water, altitude, or other specialist exercises."], resources: [{ label: "NASA astronaut candidate water-survival training", href: "https://www.nasa.gov/centers-and-facilities/johnson/summer-training-catching-up-with-nasas-astronaut-candidates/" }] },
      { title: "Sleep, nutrition & recovery", Icon: Moon, summary: "Support learning and physical adaptation with repeatable recovery habits.", points: ["Keep a regular sleep routine and notice early signs of accumulating fatigue.", "Use balanced meals and hydration to support training rather than relying on restrictive routines.", "Plan recovery as part of the programme, especially after demanding sessions."], resources: [{ label: "NASA behavioral health and performance brief", href: "https://www.nasa.gov/wp-content/uploads/2023/03/behavioral-health-technical-brief-ochmo.pdf" }] },
      { title: "Medical readiness", Icon: ShieldCheck, summary: "Understand screening, monitoring, and when a change should be professionally reviewed.", points: ["Keep medical, dental, vision, and preventive-care records current.", "Learn your personal baseline without treating wearable readings as medical clearance.", "Report persistent or worsening symptoms early instead of training through them."], resources: [{ label: "NASA aerospace medical certification standard", href: "https://www.nasa.gov/organizations/ochmo/aerospace-medical-certification-standard/" }] },
    ],
  },
  {
    title: "Mission systems & safety",
    description: "Learn how spacecraft, suits, science equipment, and emergency procedures work together.",
    Icon: Rocket,
    cards: [
      { title: "Spacecraft systems & robotics", Icon: Orbit, summary: "Understand the systems that keep a spacecraft operating and how crews control them.", points: ["Study power, life support, communications, navigation, and vehicle control.", "Build robotics and troubleshooting skills through repeated simulation.", "Understand system interactions so one failure is not considered in isolation."], resources: [{ label: "NASA Orion crew systems", href: "https://www.nasa.gov/reference/crew-systems/" }] },
      { title: "Spacesuits & surface operations", Icon: Compass, summary: "Prepare for working safely in a suit and moving through constrained environments.", points: ["Learn suit components, communication checks, air supply, cooling, and contamination controls.", "Practice task planning when movement, visibility, dexterity, and time are limited.", "Use checklists and teammate verification for safety-critical steps."], resources: [{ label: "NASA: What is a spacesuit?", href: "https://www.nasa.gov/humans-in-space/what-is-a-spacesuit/" }] },
      { title: "Science, maintenance & procedures", Icon: FileText, summary: "Carry out experiments and repairs accurately while protecting crew time and evidence quality.", points: ["Practice reading procedures, documenting results, and preserving samples correctly.", "Learn routine inspection, tool control, and preventive maintenance.", "Pause and clarify when actual conditions do not match the procedure."], resources: [{ label: "NASA astronaut candidate training", href: "https://www.nasa.gov/centers-and-facilities/johnson/summer-training-catching-up-with-nasas-astronaut-candidates/" }] },
      { title: "Emergency & survival training", Icon: AlertTriangle, summary: "Respond calmly to equipment failures, fire, pressure loss, injury, and off-nominal landings.", points: ["Rehearse emergency roles until communication and first actions are reliable under pressure.", "Train for fire response, depressurization, first aid, evacuation, and survival after landing.", "Debrief simulations to improve judgment rather than hiding mistakes."], resources: [{ label: "NASA medical and crewmember training requirements", href: "https://www.nasa.gov/reference/5-0-training/" }] },
    ],
  },
  {
    title: "Teamwork & resilience",
    description: "Strengthen communication, judgment, and wellbeing in a small multicultural crew.",
    Icon: MessageCircleHeart,
    cards: [
      { title: "Crew communication", Icon: Radio, summary: "Share information clearly and build a common understanding during routine and critical work.", points: ["Use concise messages, closed-loop confirmation, and respectful questions.", "State uncertainty and emerging concerns before they become larger problems.", "Adapt communication across languages, disciplines, and cultural expectations."], resources: [{ label: "NASA risk of inadequate teamwork", href: "https://www.nasa.gov/reference/risk-of-inadequate-teamwork/" }] },
      { title: "Leadership & decision-making", Icon: Compass, summary: "Know when to lead, when to support, and how to make sound decisions with incomplete information.", points: ["Practice rotating leadership and following based on expertise and mission needs.", "Separate urgent facts from assumptions before choosing a response.", "Invite challenge and alternative views when time and safety allow."], resources: [{ label: "NASA teamwork and mission performance", href: "https://www.nasa.gov/reference/risk-of-inadequate-teamwork/" }] },
      { title: "Stress, isolation & resilience", Icon: Sparkles, summary: "Recognize strain early and use practical strategies to remain effective over time.", points: ["Build routines for sleep, exercise, recreation, privacy, and connection.", "Use grounding, breathing, and workload-management tools before stress becomes overwhelming.", "Ask for behavioral-health or peer support early; help-seeking is a crew-safety skill."], resources: [{ label: "NASA behavioral health in isolation", href: "https://www.nasa.gov/reference/risk-of-behavioral-changes-and-psychiatric-disorders/" }] },
      { title: "Conflict, feedback & recovery", Icon: Heart, summary: "Repair working relationships and turn errors into safer future performance.", points: ["Address behavior and mission impact without attacking the person.", "Use structured debriefs to discuss what happened, why, and what should change.", "Make space for recovery after high-stress events before returning to full workload."], resources: [{ label: "NASA expeditionary mindset and connection", href: "https://www.nasa.gov/humans-in-space/isolation-what-can-we-learn-from-the-experiences-of-nasa-astronauts/" }] },
    ],
  },
];

function FutureLearningCard({ card }: { card: (typeof futureLearningGroups)[number]["cards"][number] }) {
  const { title, Icon, summary, points, resources } = card;
  return <details className="tech-card group p-5 sm:p-6"><summary className="flex cursor-pointer list-none items-center gap-3 text-base font-semibold text-white"><span className="text-cyan-200 transition-transform group-open:rotate-90" aria-hidden="true">▸</span><Icon className="shrink-0 text-cyan-200" size={20} aria-hidden="true" /><span>{title}</span><span className="ml-auto text-xs font-semibold text-cyan-200 underline decoration-cyan-300/60 underline-offset-4"><span className="group-open:hidden">Learn</span><span className="hidden group-open:inline">Close</span></span></summary><div className="mt-4 border-t border-slate-800 pt-4"><p className="text-sm leading-6 text-slate-300">{summary}</p><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-400">{points.map((point) => <li key={point}>{point}</li>)}</ul><div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting resources</p><div className="mt-3 flex flex-col items-start gap-2">{resources.map((resource) => <a key={resource.href} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 underline" href={resource.href} target="_blank" rel="noreferrer">{resource.label}<ArrowUpRight size={14} aria-hidden="true" /></a>)}</div></div></div></details>;
}

function FuturePreparationView({ onViewChange }: { onViewChange: (view: ViewName) => void }) {
  return <div className="space-y-7"><p className="editorial-label hero-script">Astronaut in Training / preparation workspace</p><section className="space-y-7"><section id="future-using-orbitwell" className="scroll-mt-6" aria-labelledby="future-tools-title">
    <h1 id="future-tools-title" className="mt-2 text-2xl font-semibold text-white">Prepare with OrbitWell before your mission</h1>
    <nav aria-label="Future guidance sections" className="mt-5 flex flex-wrap gap-3 text-sm">
      <a href="#future-using-orbitwell" className="mission-guide-button">Using OrbitWell</a>
      <a href="#future-training-guidance" className="mission-guide-button">Training guidance</a>
      <a href="#future-changed-readings" className="mission-guide-button">When readings change</a>
    </nav>
    <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {futureWorkflow.map((step, i) => <article key={step.title} className="tech-card flex h-full flex-col p-5 sm:p-7">
        <span className="font-mono text-xs text-cyan-200">0{i + 1}</span>
        <h2 className="mt-3 text-lg font-semibold text-white">{step.title}</h2>
        <p className="mt-2 grow text-sm leading-6 text-slate-400">{step.body}</p>
        <button type="button" onClick={() => step.view ? onViewChange(step.view) : document.getElementById(step.anchor ?? "")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 flex items-center gap-2 self-start text-sm font-semibold text-cyan-200 hover:underline">{step.action}<ArrowUpRight size={15} aria-hidden="true" /></button>
      </article>)}
    </div>
  </section></section>
    <section id="future-training-guidance" aria-label="Astronaut trainee learning" className="scroll-mt-6 space-y-8">
      {futureLearningGroups.map(({ title, description, Icon, cards }) => { const sectionId = `learning-${title.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`; const showTrainingRhythm = title === "Training progress & reflection"; return <section key={title} id={sectionId} aria-labelledby={`${sectionId}-title`} className="scroll-mt-6 space-y-4"><div className="flex items-start gap-3"><Icon className="mt-1 shrink-0 text-cyan-200" size={22} aria-hidden="true" /><div><h3 id={`${sectionId}-title`} className="text-xl font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div></div><div className={showTrainingRhythm ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}><div className="space-y-3">{cards.map((card) => <FutureLearningCard key={card.title} card={card} />)}</div>{showTrainingRhythm ? <aside className={panelClass} aria-labelledby="training-rhythm-title"><Heart className="text-cyan-200" size={22} aria-hidden="true" /><h4 id="training-rhythm-title" className="mt-3 text-lg font-semibold text-white">A simple training rhythm</h4><ol className="mt-4 space-y-5 text-sm leading-6 text-slate-400"><li><strong className="block text-slate-200">Before training</strong>Review today’s session, check wearable fit, and complete the pre-session checklist.</li><li><strong className="block text-slate-200">During training</strong>Follow the assigned plan, record useful wearable data, and stop if your qualified training team instructs you to stop.</li><li><strong className="block text-slate-200">After training</strong>Complete a short reflection, note difficulties, and review trainer feedback.</li></ol></aside> : null}</div></section>; })}
    </section>
    <section id="future-changed-readings" className={`${panelClass} scroll-mt-6`} aria-labelledby="future-changed-readings-title">
      <h2 id="future-changed-readings-title" className="text-2xl font-semibold text-white">When a reading looks different</h2>
      <ol className="mt-5 grid gap-5 md:grid-cols-2">
        {[
          ["Check the data first", "Look at the source, timestamp, fit, and quality. Check the device according to its instructions. A gap, rejected reading, or poor signal cannot establish that you are well."],
          ["Read the reason, not just the status", "Open Trends and the alert explanation. Look for repeated changes and context such as recent exercise, training workload, or disturbed sleep. A change from your baseline is a prompt to review, not a diagnosis."],
          ["Tell the appropriate person", "Contact your approved training or medical support person about new, persistent, worsening, or activity-limiting concerns. Seek support based on how you feel, not only on whether OrbitWell shows an alert. ORBIT cannot contact them for you."],
          ["Record the agreed follow-up", "Bring the dates, affected signals, quality limitations, and your own observations to the check-in. Follow professional advice and record the next review in the system your programme uses; OrbitWell does not schedule or send it."],
        ].map(([title, body], i) => <li key={title} className="flex items-start gap-3"><span className="mt-0.5 font-mono text-sm text-cyan-200">0{i + 1}</span><div><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div></li>)}
      </ol>
    </section>
    <section className={`${panelClass} flex items-start gap-3`}><CircleHelp className="mt-1 shrink-0 text-cyan-200" /><p className="text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">Limits:</span> OrbitWell provides readiness education only. Completion does not mean you are ready to fly, medically cleared, certified, or approved for travel. Real decisions belong to qualified mission and medical teams.</p></section>
  </div>;
}

export function GuidanceView({ stage, preparationRepository, onViewChange, onOpenChat }: { stage: LifeStage; preparationRepository?: PreparationRepository; onViewChange: (view: ViewName) => void; onOpenChat?: () => void }) {
  if (stage === "future") return <FuturePreparationView onViewChange={onViewChange} />;
  if (stage === "retired") return <RetiredGuidanceView onViewChange={onViewChange} onOpenChat={onOpenChat} />;
  return <ActiveGuidanceView onViewChange={onViewChange} />;
}

const retiredEducationCards = [
  { group: "physical", title: "Movement & strength", subtitle: "Aerobic activity, strength, mobility, and gradual progression", Icon: Activity, points: ["Use a gradual, individualized plan that matches current ability and health history.", "Include a mix of aerobic, strength, mobility, and balance work rather than relying on one activity.", "Review pain, dizziness, unusual breathlessness, or a major change in capacity with a qualified professional."], resources: [{ label: "NASA strength, conditioning and rehabilitation", href: "https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/" }] },
  { group: "physical", title: "Bone & balance", subtitle: "Bone strength, stability, coordination, and fall prevention", Icon: Bone, points: ["Weight-bearing and resistance activities can support bone and muscle health when they are appropriate for you.", "Balance and coordination practice can support confidence and safer daily movement.", "Use clinical results and professional advice to decide what intensity and progression are appropriate."], resources: [{ label: "NASA bone-loss technical brief", href: "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf" }] },
  { group: "physical", title: "Heart & circulation", subtitle: "Cardiovascular activity, recovery, and long-term patterns", Icon: HeartPulse, points: ["Regular activity can support cardiovascular health, sleep, balance, and independent living.", "Look at heart-rate and recovery patterns over time rather than treating one wearable value as a diagnosis.", "Discuss persistent changes or new symptoms with a qualified clinician."], resources: [{ label: "CDC physical-activity benefits", href: "https://www.cdc.gov/physical-activity-basics/health-benefits/older-adults.html" }] },
  { group: "physical", title: "Sleep & recovery", subtitle: "Routine, rest, fatigue, and restorative sleep", Icon: Moon, points: ["Keep a regular sleep and wake schedule and build a consistent wind-down routine.", "Notice how exercise timing, screens, caffeine, alcohol, meals, and the sleep environment affect rest.", "Talk with a clinician when sleep problems persist or interfere with daytime life."], resources: [{ label: "NIH healthy sleep habits", href: "https://www.nia.nih.gov/health/sleep/6-healthy-sleep-habits-older-adults" }] },
  { group: "physical", title: "Nutrition & preventive care", subtitle: "Balanced eating, hydration, checkups, and sustainable habits", Icon: Apple, points: ["Use regular meals, hydration, and balanced food choices to support activity and recovery.", "Build habits that are sustainable and compatible with personal health needs and medications.", "Keep routine health checks, screenings, and vaccinations up to date with your care team."], resources: [{ label: "CDC healthy aging", href: "https://www.cdc.gov/healthy-aging/about/" }] },
  { group: "mental", title: "Emotional wellbeing", subtitle: "Stress, adjustment, changing roles, and early support", Icon: MessageCircleHeart, points: ["Notice persistent changes in mood, stress, sleep, concentration, or daily functioning.", "Make room for recovery, recreation, and adjustment to changes in identity or routine.", "Ask for support early when changes persist, worsen, or make daily life harder."], resources: [{ label: "NASA behavioral health", href: "https://www.nasa.gov/reference/jsc-behavioral-health/" }] },
  { group: "mental", title: "The overview effect", subtitle: "Awe, perspective, and telling your own story", Icon: Orbit, points: ["Some astronauts describe awe and a changed sense of connection after seeing Earth; there is no single required reaction.", "People may need time and conversation to make sense of an experience that is hard to put into words.", "The overview effect is an experience, not a diagnosis. You can explore what it meant to you without being pushed toward a particular story."], resources: [{ label: "Overview effect research", href: "https://doi.org/10.1037/cns0000086" }, { label: "Astronaut interview analysis", href: "https://doi.org/10.1177/00218863221136289" }] },
  { group: "mental", title: "Social connection", subtitle: "Family, peers, friends, belonging, and community", Icon: Heart, points: ["Protect supportive relationships with family, peers, friends, and community.", "Choose regular, meaningful ways to stay connected rather than waiting until support is urgently needed.", "Talk with someone you trust when isolation or loneliness begins affecting daily life."], resources: [{ label: "CDC social connection", href: "https://www.cdc.gov/social-connectedness/about/index.html" }] },
  { group: "mental", title: "Purpose & daily routine", subtitle: "Meaningful activity, structure, learning, and rest", Icon: Compass, points: ["Build a routine that balances meaningful activity, movement, relationships, learning, and rest.", "Expect purpose and identity to change over time rather than requiring one immediate answer.", "Use the wellbeing check-in to notice which activities and connections are helping."], resources: [{ label: "CDC healthy aging", href: "https://www.cdc.gov/healthy-aging/about/" }] },
];

function RetiredEducationCard({ card }: { card: (typeof retiredEducationCards)[number] }) {
  const { title, subtitle, Icon, points, resources } = card;
  return <details className="tech-card p-5 sm:p-7" open={title === "Emotional wellbeing"}><summary className="cursor-pointer text-base font-semibold text-white"><Icon className="mr-2 inline text-cyan-200" size={18} aria-hidden="true" />{title}</summary><p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p><div className="mt-4 border-t border-slate-800 pt-4"><div className="space-y-3 text-sm leading-6 text-slate-300">{points.map((point) => <p key={point}>{point}</p>)}</div><div className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting resources</p><div className="mt-3 flex flex-col items-start gap-2">{resources.map((resource) => <a key={resource.href} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 underline" href={resource.href} target="_blank" rel="noreferrer">{resource.label} <ArrowUpRight size={14} aria-hidden="true" /></a>)}</div></div></div></details>;
}

function RetiredGuidanceView({ onViewChange, onOpenChat }: { onViewChange: (view: ViewName) => void; onOpenChat?: () => void }) {
  const workflow: Array<{ title: string; body: string; action: string; view?: ViewName; opensChat?: boolean }> = [
    { title: "Confirm your sources", body: "Check your profile and device connection. This workspace combines simulated wearable readings with your own check-ins.", action: "Check Profile", view: "profile" },
    { title: "Start with Home", body: "Explore your body overview and notice when a reading is unavailable or out of date. A device reading cannot tell you how you feel.", action: "Open Home", view: "home" },
    { title: "Look at longer patterns", body: "Use Trends to compare readings over time. Treat changes as context for a conversation, not a diagnosis or target.", action: "Review Trends", view: "trends" },
    { title: "Talk about life after flight", body: "Open ORBIT to reflect on the view of Earth, relationships, purpose, or anything else on your mind. Your experience does not need to fit one story.", action: "Talk with ORBIT", opensChat: true },
    { title: "Add your own perspective", body: "Use Wellbeing for a private check-in about mood, sleep, and daily life. Skipping a question never means you are feeling well.", action: "Open Wellbeing", view: "wellbeing" },
  ];

  return <div className="space-y-7">
    <header>
      <p className="eyebrow">Guidance · Former astronaut</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Finding your rhythm after flight</h1>
      <nav aria-label="Retirement guide sections" className="mt-5 flex flex-wrap gap-3 text-sm">
        <a href="#retired-workflow" className="mission-guide-button">Using OrbitWell<ArrowRight size={16} aria-hidden="true" /></a>
        <a href="#retired-routine" className="mission-guide-button">Everyday wellbeing<ArrowRight size={16} aria-hidden="true" /></a>
        <a href="#retired-follow-ups" className="mission-guide-button">Follow-ups<ArrowRight size={16} aria-hidden="true" /></a>
      </nav>
    </header>

    <section id="retired-workflow" className="scroll-mt-6" aria-labelledby="retired-workflow-title">
      <p className="eyebrow">01 / Know your tools</p>
      <h2 id="retired-workflow-title" className="mt-2 text-2xl font-semibold text-white">Use OrbitWell from reflection to follow-up</h2>
      <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflow.map((step, index) => <article key={step.title} className="tech-card flex h-full flex-col p-5 sm:p-7">
          <span className="font-mono text-xs text-cyan-200">0{index + 1}</span>
          <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
          <p className="mt-2 grow text-sm leading-6 text-slate-400">{step.body}</p>
          <button type="button" onClick={() => step.opensChat ? onOpenChat?.() : step.view && onViewChange(step.view)} className="mt-5 flex items-center gap-2 self-start text-sm font-semibold text-cyan-200 hover:underline">{step.action}<ArrowUpRight size={15} aria-hidden="true" /></button>
        </article>)}
      </div>
    </section>

    <section id="retired-routine" className="scroll-mt-6" aria-labelledby="retired-education-title">
      <p className="eyebrow">02 / Support your routine</p>
      <h2 id="retired-education-title" className="mt-2 text-2xl font-semibold text-white">Maintain physical and mental wellbeing</h2>
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Mental health after spaceflight</h3>
          {retiredEducationCards.filter((card) => card.group === "mental").map((card) => <RetiredEducationCard key={card.title} card={card} />)}
          <h3 className="pt-3 text-sm font-semibold text-slate-200">Physical health after spaceflight</h3>
          {retiredEducationCards.filter((card) => card.group === "physical").map((card) => <RetiredEducationCard key={card.title} card={card} />)}
        </div>
        <aside className="tech-card p-5 sm:p-7" aria-labelledby="retired-rhythm-title">
          <Heart className="text-cyan-200" size={22} aria-hidden="true" />
          <h3 id="retired-rhythm-title" className="mt-3 text-lg font-semibold text-white">A simple daily rhythm</h3>
          <ol className="mt-4 space-y-5 text-sm leading-6 text-slate-400">
            <li><strong className="block text-slate-200">Start of your day</strong>Notice how you feel and check the wearable source and sync status before interpreting its numbers.</li>
            <li><strong className="block text-slate-200">Make room for connection</strong>Choose a manageable activity, reach out to someone, or talk with ORBIT if you want space to reflect.</li>
            <li><strong className="block text-slate-200">Before rest</strong>Use a private check-in if it helps you remember what affected your mood, sleep, or energy.</li>
          </ol>
          <p className="mt-5 border-t border-slate-700 pt-4 text-xs leading-6 text-slate-400">A suggested way to use this demo, not a prescribed routine or a measure of wellbeing.</p>
        </aside>
      </div>
    </section>

    <section id="retired-follow-ups" className="scroll-mt-6 space-y-5" aria-labelledby="retired-follow-ups-title">
      <div><p className="eyebrow">03 / Check, prepare, follow up</p><h2 id="retired-follow-ups-title" className="mt-2 text-2xl font-semibold text-white">When something needs follow-up</h2></div>
      <div className="tech-card p-5 sm:p-7">
        <ol className="grid gap-5 md:grid-cols-2">
          {[
            ["Check the source", "Look at when a wearable reading was captured and whether the data is complete. A missing reading is not a reassuring result."],
            ["Add your own context", "Notice symptoms, sleep, mood, activity, and what has changed in daily life. You can seek support even when a chart looks usual."],
            ["Talk with the right person", "Bring new, persistent, or worsening concerns to a qualified professional. ORBIT can help you reflect but cannot contact anyone for you."],
            ["Record the next step", "Use the dates and notes from your own records and care team to keep track of the agreed plan."],
          ].map(([title, body], index) => <li key={title} className="flex items-start gap-3"><span className="mt-0.5 font-mono text-sm text-cyan-200">0{index + 1}</span><div><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div></li>)}
        </ol>
      </div>
    </section>
  </div>;
}

function DataNotice({ title, body }: { title: string; body: string }) { return <section className={`${panelClass} flex max-w-2xl items-start gap-3`} role="status"><WifiOff className="mt-1 shrink-0 text-slate-300" /><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div></section>; }
function DataSourceStatus({ source, warning }: { source?: DashboardSource; warning?: string }) {
  if (!source) return null;
  return <div className="data-source-note" role="status"><p><Radio size={12} aria-hidden="true" /><span>Source: {source === "supabase" ? "Supabase synthetic data" : "Local synthetic fallback"}</span></p>{warning ? <details><summary>Connection details</summary><p>{warning}</p></details> : null}</div>;
}
function LoadingPanel() {
  const device = useDevice()?.status;
  const connecting = Boolean(device?.connecting);
  return <section className={`${panelClass} device-connect`} role="status" aria-live="polite" aria-busy="true">
    <div className="flex items-start gap-3">
      <SpaceLoader message={connecting ? device!.label : "Loading simulated signals…"} detail={connecting ? device!.detail : "Preparing the selected scenario and personal comparison."} />
      <div className="min-w-0 flex-1">
        {connecting ? <>
          <div className="device-progress" role="progressbar" aria-label="Wearable connection progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(device!.progress * 100)}><span style={{ width: `${Math.round(device!.progress * 100)}%` }} /></div>
          <ol className="device-steps" aria-label="Connection steps">{CONNECT_PHASES.map((step) => <li key={step.phase} data-state={step.phase === device!.phase ? "current" : CONNECT_PHASES.findIndex((item) => item.phase === device!.phase) > CONNECT_PHASES.findIndex((item) => item.phase === step.phase) ? "done" : "todo"}>{step.phase === "searching" ? "Find device" : step.phase === "pairing" ? "Pair" : "Sync data"}</li>)}</ol>
        </> : null}
      </div>
    </div>
  </section>;
}

/** Shows the pair/reconnect prompt instead of readings when no device is connected. */
function DeviceIdleGate({ children, hidePrompt = false, stage = "active", connectAbove = false }: { children: ReactNode; hidePrompt?: boolean; stage?: LifeStage; connectAbove?: boolean }) {
  const context = useDevice();
  const device = context?.status;
  const wearables = context?.bodyDevices;
  const connected = wearables ? wearables.paired.size > 0 : context?.bluetooth?.phase === "streaming";
  if (device && device.phase === "idle" && !connected) {
    if (hidePrompt) return null;
    return <section className={`${panelClass} device-connect-card`} aria-labelledby="no-device-title">
      <Watch size={26} aria-hidden="true" /><div><h2 id="no-device-title">No device paired</h2>
      {wearables && connectAbove ? <p className="device-connect-hint">Use Connect wearables above to pair a device.</p> : wearables ? <WearableConnect stage={stage} on={wearables.bluetoothOn} open={wearables.listOpen} paired={wearables.paired} pairing={wearables.pairing} onToggle={wearables.setBluetooth} onOpenChange={wearables.setListOpen} onPair={wearables.pair} onUnpair={wearables.unpair} />
        : <button type="button" onClick={device.pair} className="btn-primary"><Bluetooth size={18} aria-hidden="true" />{device.hasPaired ? "Reconnect wearable" : "Connect wearables"}</button>}
      </div>
    </section>;
  }
  return <>{children}</>;
}

/** Connection / freshness badge. Wording never implies a medical reading. */
function DataTrustStrip({ onImport }: { onImport?: () => void }) {
  const ctx = useDevice();
  const ingest = ctx?.ingest;
  if (!ingest) return null;
  const sync = ctx.status.lastSyncAt ? new Date(ctx.status.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-600/40 px-4 py-3 text-sm text-slate-300" aria-label="Data source and quality">
    <span>Source: <span className="font-semibold text-white">{ingest.sourceLabel}</span></span>
    {sync ? <span>Last sync: <span className="font-semibold text-white">{sync}</span></span> : null}
    <span data-quality={ingest.quality}>Data quality: <span className="font-semibold text-white">{ingest.quality}</span></span>
    <span className="text-slate-400">{ingest.accepted} readings checked{ingest.rejected ? ` · ${ingest.rejected} set aside` : ""}{ingest.flagged ? ` · ${ingest.flagged} flagged` : ""}</span>
    {ingest.quality === "poor" ? <span className="font-semibold text-amber-100">Not enough reliable data to assess</span> : null}
    <span className="text-slate-400">Alerts from: {ctx.bluetooth?.ready ? "completed days only. Bluetooth readings are display-only until a full day is collected." : ctx.webhook?.ready ? (ctx.alertBasis === "webhook" ? "completed days of webhook readings, plus the simulated wearable for other signals" : "completed days only. Webhook readings are display-only until a full day is collected.") : ctx.alertBasis === "device" ? "completed days of device readings" : "demo scenario"}</span>
    <span className="basis-full text-xs text-slate-500">Signals assume a crew wearable and a personal dosimeter. Nothing here is measured by OrbitWell.</span>
    {onImport ? <button type="button" onClick={onImport} className="ml-auto text-sm font-semibold text-cyan-200 hover:text-cyan-100">Import a file instead</button> : null}
  </section>;
}

function DeviceBadge() {
  const device = useDevice()?.status;
  if (!device || device.phase === "idle" || device.connecting) return null;
  const age = device.lastSyncAt ? Math.max(0, deviceTiming.now() - device.lastSyncAt) : 0;
  const hours = Math.round(age / 3_600_000);
  const state = device.phase === "streaming" ? (age > 30 * 60_000 ? "stale" : "live") : device.phase === "signal_lost" ? "lost" : "offline";
  const text = state === "live" ? "Live · synced just now" : state === "stale" ? `Last sync ${hours} h ago` : state === "lost" ? "Signal lost · wearable not responding" : "Offline · no connection";
  return <span className="device-badge" data-state={state} role="status">{state === "live" ? <span className="device-dot" role="img" aria-label="Live" /> : <span className="device-dot" aria-hidden="true" />}{text}</span>;
}

function missionLabel(profile: TravelerProfile, stage: LifeStage) { return stage === "future" ? "Pre-mission" : stage === "retired" ? "Post-mission" : `Mission day ${profile.missionDay}`; }
function stageLabel(stage: LifeStage) { return stage === "future" ? "Astronaut in Training" : stage === "retired" ? "Former astronaut" : "Active astronaut"; }
function scenarioLabel(scenario: SimulationScenario) { return scenario === "usual" ? "Usual day" : scenario === "recovery_concern" ? "Recovery concern" : scenario === "sensor_disconnected" ? "Sensor disconnected" : scenario === "stale" ? "Stale data" : "Offline mode"; }

function DeviceCard({ onResetScenario, stage }: { onResetScenario: () => void; stage?: LifeStage }) {
  const context = useDevice();
  const device = context?.status;
  if (!device) return null;
  const wearables = stage ? context?.bodyDevices : undefined;
  if (wearables) {
    const devices = bodyDevicesForStage(stage ?? "active");
    const connected = devices.filter((item) => wearables.paired.has(item.id));
    return <div className="profile-wearables" aria-labelledby="device-card-title">
      <div className="profile-wearables-head">
        <div><p id="device-card-title" className="profile-wearables-title">{connected.length ? `${connected.length} of ${devices.length} wearables connected` : "No wearables connected"}</p>
          <p className="profile-wearables-note">{connected.length ? "Simulated readings from these devices appear on the body in Home." : "Pair your devices with Connect wearables on Home or Trends."}</p></div>
      </div>
      {connected.length ? <ul className="profile-wearable-list" aria-label="Connected wearables">{connected.map((item) => <li key={item.id} className="profile-wearable">
        <span className="wearable-dot" aria-hidden="true" />
        <div className="profile-wearable-text"><p className="profile-wearable-name">{item.name}<span className="body-device-badge">Connected</span></p><p className="profile-wearable-meta">{item.worn} · {item.measures}</p><p className="profile-wearable-meta">Body parts: {item.parts.join(", ")}</p></div>
      </li>)}</ul> : null}
    </div>;
  }
  const summary = device.phase === "streaming" ? "Connected · streaming simulated readings" : device.connecting ? "Connecting…" : device.phase === "signal_lost" ? "Signal lost" : device.phase === "offline" ? "Offline" : "Not connected";
  return <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4" aria-labelledby="device-card-title"><div className="flex items-center gap-2"><Watch size={16} className="text-cyan-200" aria-hidden="true" /><p id="device-card-title" className="text-sm text-slate-400">Simulated wearable</p></div><p className="mt-1 text-lg font-semibold text-white">{summary}</p><div className="mt-3 flex flex-wrap gap-3">{device.phase === "streaming" ? <button type="button" onClick={device.disconnect} className="rounded-xl border border-slate-500/50 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Disconnect wearable</button> : device.connecting ? null : <button type="button" onClick={() => { onResetScenario(); device.reconnect(); }} className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">{device.paired ? "Reconnect wearable" : "Pair simulated wearable"}</button>}</div></div>;
}
