import { useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { Activity, AlertTriangle, Apple, ArrowRight, ArrowUpRight, BedDouble, Bluetooth, Bone, CalendarDays, Check, CircleHelp, Compass, Droplets, Eye, FileText, Heart, HeartPulse, LockKeyhole, MessageCircleHeart, Moon, Orbit, Radio, Rocket, RotateCcw, ShieldCheck, Sparkles, Timer, Watch, WifiOff } from "lucide-react";
import { MetricTile } from "./MetricTile";
import { StatusChip } from "./StatusChip";
import { TrendChart } from "./TrendChart";
import type { DashboardSource } from "../lib/backendDashboardRepository";
import type { SolarEventResult } from "../lib/nasaDonki";
import { usePersistedState } from "../lib/usePersistedState";
import type { Alert, DataQualityState, LifeStage, MetricCardData, SimulationScenario, TravelerProfile } from "../types/horizon";
import { Brand, SafetyDisclaimer, type ViewName } from "./AppShell";
import type { PreparationRepository } from "../lib/preparationRepository";
import { useDevice } from "../lib/deviceContext";
import { ImportDataPanel } from "./ImportDataPanel";
import { AssumedDevicesPanel } from "./AssumedDevicesPanel";
import { BaselineSummaryPanel } from "./BaselineSummaryPanel";
import { VoiceCheckIn } from "./VoiceCheckIn";
import { WebhookCard } from "./WebhookCard";
import { CONNECT_PHASES } from "../domain/deviceSimulator";
import { deviceTiming } from "../lib/useDeviceStream";
import { ThemeToggle } from "./ThemeToggle";

type CheckIn = {
  mood: string;
  stress: string;
  sleepQuality: string;
  note: string;
  energy: string;
  purpose: string;
  socialConnection: string;
  transitionTags: string[];
};
type Privacy = { mood: boolean; notes: boolean; trends: boolean };
const panelClass = "tech-card p-5 sm:p-6";

export function StageSelectionView({ loading, warning, onSelect }: { loading?: boolean; warning?: string; onSelect?: (stage: LifeStage) => void }) {
  const options = [
    { stage: "future" as const, title: "Future traveler", label: "BEFORE THE MISSION", body: "Build your baseline. Find your rhythm. Prepare for what’s ahead.", Icon: Rocket },
    { stage: "active" as const, title: "Active astronaut", label: "DURING THE MISSION", body: "Your signals, wellbeing, and next steps. One clear view.", Icon: Orbit },
    { stage: "retired" as const, title: "Retired astronaut", label: "BEYOND THE MISSION", body: "See the bigger picture. Reflect, recover, and reconnect.", Icon: Compass },
  ];
  return <main className="star-field onboarding">
    <div className="onboarding-container">
      <header className="onboarding-topbar"><Brand /><span className="onboarding-topline">A human perspective on space health</span><div className="onboarding-actions"><span className="research-badge"><span /> Research demo</span><ThemeToggle /></div></header>
      <div className="onboarding-grid">
        <section className="journey-selection" aria-labelledby="journey-title">
          <p className="eyebrow"><span className="small-rule" /> YOUR SPACE. YOUR PACE.</p>
          <h1 id="journey-title">A universe to explore.<br /><span>A moment for you.</span></h1>
          <p className="journey-intro">A little clarity, wherever your journey takes you. Explore your health and wellbeing, one small step at a time.</p>
          <div className="journey-section-label"><h2>Choose your mission stage</h2><span>01 — 03</span></div>
          {loading ? <div className="tech-card journey-loading" role="status" aria-live="polite"><span className="loading-dot" />Preparing your private workspace…</div> : <div className="journey-options">{options.map(({ stage, title, label, body, Icon }) => <button key={stage} type="button" aria-label={title} onClick={() => onSelect?.(stage)} className={`journey-card journey-${stage}`}><span className="journey-icon"><Icon size={22} strokeWidth={1.4} aria-hidden="true" /></span><span className="journey-card-content"><span className="journey-kicker">{label}</span><h3>{title}</h3><span className="journey-description">{body}</span></span><span className="journey-arrow"><ArrowUpRight size={19} aria-hidden="true" /></span></button>)}</div>}
          <p className="journey-footnote"><ShieldCheck size={14} aria-hidden="true" /> Explore freely. Change your stage at any time.</p>
          {warning ? <details className="cloud-note"><summary>Exploring in demo mode · cloud save unavailable</summary><p>{warning} Your stage choice applies to this visit. Cloud preferences can be restored when the connection is available.</p></details> : null}
        </section>
        <figure className="orbital-visual">
          <img className="orbital-photo" src="/images/nasa-spacewalk.jpg" alt="NASA astronaut Bruce McCandless floating above the blue curve of Earth" fetchPriority="high" />
          <div className="orbital-shade" />
          <div className="orbital-topline"><span><span className="status-dot" /> THE HUMAN SIDE OF EXPLORATION</span><Orbit size={21} strokeWidth={1} aria-hidden="true" /></div>
          <div className="orbit-path orbit-path-one" aria-hidden="true" /><div className="orbit-path orbit-path-two" aria-hidden="true" />
          <span className="orbital-marker" aria-hidden="true"><span /> A LITTLE PERSPECTIVE</span>
          <div className="orbital-caption"><p>Far from ordinary.<br /><span>Closer to yourself.</span></p><div className="visual-health-card"><span className="health-card-icon"><Activity size={21} aria-hidden="true" /></span><div><span>HUMAN, FIRST.</span><p>Small signals. Meaningful context.</p></div><svg viewBox="0 0 82 28" fill="none" aria-hidden="true"><path d="M1 17h17l5-7 6 15L38 2l8 22 5-9 5 2h25" stroke="currentColor" strokeWidth="1.5" /></svg></div></div>
          <figcaption>STS-41B · Earth orbit <a href="https://www.nasa.gov/image-article/astronaut-bruce-mccandless-performs-the-first-untethered-spacewalk/" target="_blank" rel="noreferrer">Photography: NASA <ArrowUpRight size={11} aria-hidden="true" /></a></figcaption>
        </figure>
      </div>
      <footer className="onboarding-footer"><p>Built around the person inside the spacesuit.</p><div><span><Activity size={14} />Personal patterns</span><span><Heart size={14} />Everyday wellbeing</span><span><ShieldCheck size={14} />Clear next steps</span></div></footer>
    </div>
    <SafetyDisclaimer landing />
  </main>;
}

export function HomeView({ profile, stage, scenario, metrics, alert, dataQuality, loading, source, warning, solarEvents, onViewChange }: { profile: TravelerProfile; stage: LifeStage; scenario: SimulationScenario; metrics: MetricCardData[]; alert: Alert | null; dataQuality: DataQualityState; loading: boolean; source?: DashboardSource; warning?: string; solarEvents?: SolarEventResult | null; onViewChange: (view: ViewName) => void }) {
  const ingest = useDevice()?.ingest ?? null;
  const unreliable = ingest?.quality === "poor";
  const dataUnavailable = dataQuality === "disconnected" || dataQuality === "offline" || unreliable;
  const stale = dataQuality === "stale";
  if (unreliable) alert = null; // poor-quality data never produces an alert
  const status = dataUnavailable ? "unavailable" : stale ? "watch" : alert?.severity ?? "normal";
  const statusReason = unreliable ? "Not enough reliable data to assess. Check that the wearable is worn snugly and try again." : dataUnavailable ? "The simulated sensor has stopped sending readings. Reconnect the source to continue monitoring." : stale ? "The latest simulated update is older than expected. Review these readings with caution before acting on a pattern." : alert?.reason ?? "Your latest simulated signals are close to your personal pattern.";
  const action = dataUnavailable ? "Reconnect simulated data" : stale ? "Review data-quality controls" : alert?.nextAction ?? "Keep monitoring and complete the optional wellbeing check-in if something feels different.";
  const stageContent = stage === "future" ? { eyebrow: "Baseline-building workspace", title: "Build your starting pattern", description: "Practise simple check-ins and learn what to expect before a first mission." } : stage === "retired" ? { eyebrow: "Long-term follow-up workspace", title: "Keep the long view", description: "Review long-term signals and wellbeing context after flying." } : { eyebrow: "Active monitoring workspace", title: "How are you doing today?", description: "Use the simulated signals as context for your next small action." };

  return <div className="space-y-7">
    <header className="dashboard-hero">
      <div className="dashboard-hero-copy"><p className="eyebrow">{stageContent.eyebrow}</p><h1>{stageContent.title}</h1><p>{profile.name} · {stageLabel(stage)} · {missionLabel(profile, stage)}</p><span className="hero-description">{stageContent.description}</span><span className="scenario-pill"><Radio size={13} aria-hidden="true" />{scenarioLabel(scenario)}<span>SIMULATED</span></span><DeviceBadge /></div>
      <div className="dashboard-hero-visual" aria-hidden="true"><img src="/images/nasa-spacewalk.jpg" alt="" /><div className="dashboard-orbit" /><span>KEEP A LITTLE PERSPECTIVE.</span></div>
    </header>
    <DataSourceStatus source={source} warning={warning} />
    {loading ? <LoadingPanel /> : <DeviceIdleGate stage={stage}><>
    <DataTrustStrip onImport={() => onViewChange("profile")} />
    <section data-tone={dataUnavailable ? "unavailable" : stale || alert ? "watch" : "normal"} className={`${panelClass} status-panel ${dataUnavailable ? "border-slate-500/70" : stale || alert ? "border-amber-300/40" : "border-emerald-300/30"}`} aria-labelledby="status-title"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium text-slate-400">Today’s status</p><div className="mt-3 flex flex-wrap items-center gap-3"><StatusChip severity={status} /><h2 id="status-title" className="text-xl font-semibold text-white">{unreliable ? "Not enough reliable data" : dataUnavailable ? "Waiting for a data source" : stale ? "The data needs a review" : alert ? "A pattern is worth reviewing" : "Your signals look usual"}</h2></div><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{statusReason}</p></div><div className="rounded-2xl bg-slate-950/50 px-4 py-3 text-sm text-slate-400">Last update<br /><span className="font-semibold text-slate-200">{stale ? "Earlier today · simulated" : "Just now · simulated"}</span></div></div><div className="mt-6 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center"><span className="sr-only">Suggested next step</span><button type="button" onClick={() => onViewChange(dataUnavailable || stale ? "profile" : "wellbeing")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"><span className="sr-only">{action}</span><span aria-hidden="true">{dataUnavailable ? "Reconnect data" : stale ? "Review data quality" : alert ? "Take the optional wellbeing check-in" : "Check in with yourself"}</span><ArrowRight size={16} /></button><button type="button" onClick={() => onViewChange("trends")} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">Review trends</button></div></section>
    {stage === "retired" ? <RetiredWearableSignals metrics={metrics} dataUnavailable={dataUnavailable} onViewTrends={() => onViewChange("trends")} /> : <section className="signals-section" aria-labelledby="signals-title"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="eyebrow">PERSONAL SIGNALS</p><h2 id="signals-title" className="text-xl font-semibold text-white">Your health, at a glance</h2></div><button type="button" onClick={() => onViewChange("trends")} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">See all trends</button></div><div className="metric-grid">{metrics.slice(0, 6).map((metric) => <MetricTile key={metric.metric} metric={metric} />)}</div></section>}
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className={panelClass} aria-labelledby="action-title"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles size={20} /></span><div><p className="text-sm text-slate-400">One small action</p><h2 id="action-title" className="text-xl font-semibold text-white">{dataUnavailable ? "Check the simulated source" : "Give your recovery a quick check"}</h2></div></div><p className="mt-4 leading-7 text-slate-300">{dataUnavailable ? "This demo scenario is showing a disconnected source so you can see how missing data is handled." : "A short check-in adds context to the signals. Skipping it does not count as feeling well."}</p><button type="button" onClick={() => onViewChange(dataUnavailable ? "profile" : "wellbeing")} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">{dataUnavailable ? "Open simulation controls" : "Open wellbeing check-in"}<ArrowRight size={16} /></button></section><section className={panelClass} aria-labelledby="timeline-title"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Follow-up</p><h2 id="timeline-title" className="text-xl font-semibold text-white">Recent activity</h2></div><Check size={20} className="text-emerald-200" /></div><ol className="mt-5 space-y-4 border-l border-slate-700 pl-4 text-sm"><li><p className="font-semibold text-slate-200">Simulation started</p><p className="mt-1 text-slate-400">{scenarioLabel(scenario)} pattern selected</p></li><li><p className="font-semibold text-slate-200">Personal baseline loaded</p><p className="mt-1 text-slate-400">30-day rolling comparison</p></li></ol></section></div>
    {stage !== "retired" ? <RadiationPanel metric={metrics.find((metric) => metric.metric === "radiation_dose")} solarEvents={solarEvents} /> : null}
    </></DeviceIdleGate>}
  </div>;
}

function RetiredWearableSignals({ metrics, dataUnavailable, onViewTrends }: { metrics: MetricCardData[]; dataUnavailable: boolean; onViewTrends: () => void }) {
  const metric = (name: MetricCardData["metric"]) => metrics.find((item) => item.metric === name);
  const restingHeartRate = metric("resting_hr");
  const hrv = metric("hrv");
  const spo2 = metric("spo2");
  const sleep = metric("sleep_hours");
  const sleepTotalMinutes = sleep ? Math.round(sleep.value * 60) : 0;
  const sleepHours = Math.floor(sleepTotalMinutes / 60);
  const sleepMinutes = sleepTotalMinutes % 60;
  const unavailable = "Unavailable";
  const cards = [
    { label: "Sleep duration", value: dataUnavailable || !sleep ? unavailable : `${sleepHours} h ${sleepMinutes} min`, source: "Synthetic Apple Health · 6 nights", Icon: Moon },
    { label: "Mobility", value: dataUnavailable ? unavailable : "Stable", source: "Walking steadiness · Updated today", Icon: Activity },
    { label: "Estimated stress level", value: dataUnavailable ? unavailable : "Moderate", source: "HRV and resting heart rate · Wellness only", Icon: HeartPulse },
    { label: "Exercise minutes", value: dataUnavailable ? unavailable : "28 min", source: "Synthetic Apple Health · Today", Icon: Timer },
  ];
  const measurements = [
    { label: "Resting heart rate", value: dataUnavailable || !restingHeartRate ? unavailable : `${Math.round(restingHeartRate.value)} bpm`, Icon: Heart },
    { label: "HRV", value: dataUnavailable || !hrv ? unavailable : `${Math.round(hrv.value)} ms`, Icon: Activity },
    { label: "SpO₂", value: dataUnavailable || !spo2 ? unavailable : `${Math.round(spo2.value)}%`, Icon: Droplets },
  ];

  return <section className="signals-section retired-wearable-signals" aria-labelledby="retired-signals-title">
    <div className="mb-3 flex items-end justify-between gap-3"><div><p className="eyebrow">SIMULATED APPLE HEALTH</p><h2 id="retired-signals-title" className="text-xl font-semibold text-white">Wearable activity, at a glance</h2></div><button type="button" onClick={onViewTrends} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">See all trends</button></div>
    <div className="retired-wearable-grid">{cards.map(({ label, value, source, Icon }) => <article key={label} className="tech-card retired-wearable-card"><div><span className="retired-wearable-icon"><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span><p>{label}</p></div><strong>{value}</strong><span>{source}</span></article>)}</div>
    <div className="tech-card connected-measurements"><div className="connected-measurements-title"><Activity size={20} aria-hidden="true" /><div><h3>Connected measurements</h3><p>Synthetic Apple Health · Wellness context only</p></div></div>{measurements.map(({ label, value, Icon }) => <div key={label} className="connected-measurement"><Icon size={18} strokeWidth={1.6} aria-hidden="true" /><span><small>{label}</small><strong>{value}</strong></span></div>)}</div>
  </section>;
}

function RadiationPanel({ metric, solarEvents }: { metric?: MetricCardData; solarEvents?: SolarEventResult | null }) {
  if (!metric) return null;
  const level = metric.value > metric.baseline * 2 ? "High" : metric.value > metric.baseline * 1.25 ? "Caution" : "Safe";
  const tone = level === "High" ? "text-rose-200 border-rose-300/30" : level === "Caution" ? "text-amber-200 border-amber-300/30" : "text-emerald-200 border-emerald-300/30";
  return <section className={`${panelClass} ${tone}`} aria-labelledby="radiation-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-400">Radiation context</p><h2 id="radiation-title" className="mt-1 text-xl font-semibold text-white">{level}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Today’s synthetic dose is {metric.value} {metric.unit}; the illustrative personal baseline is {metric.baseline} {metric.unit}. This is context only, not a safety clearance.</p></div><span className="rounded-full border border-current px-3 py-1 text-sm font-semibold">{level}</span></div><p className="mt-4 text-xs text-slate-400">{solarEvents?.source === "nasa" ? `NASA DONKI events loaded: ${solarEvents.events.length}.` : solarEvents?.warning ?? "Loading optional NASA solar-event context…"}</p></section>;
}

const retiredActivityTrends = [
  {
    metric: "mobility",
    label: "Mobility",
    unit: "%",
    value: 92,
    baseline: 90,
    trend: "up" as const,
    plainLanguage: "Walking steadiness is slightly above your recent pattern.",
    points: [88, 89, 90, 91, 90, 92, 92].map((value, index) => ({ day: `Day ${index + 1}`, value, baseline: 90, alert: false })),
  },
  {
    metric: "exercise_minutes",
    label: "Exercise minutes",
    unit: "min",
    value: 28,
    baseline: 25,
    trend: "up" as const,
    plainLanguage: "Today’s movement is a little above your recent daily pattern.",
    points: [18, 22, 24, 30, 20, 26, 28].map((value, index) => ({ day: `Day ${index + 1}`, value, baseline: 25, alert: false })),
  },
];

export function TrendsView({ stage = "active", metrics, alert, dataQuality, loading, source, warning }: { stage?: LifeStage; metrics: MetricCardData[]; alert: Alert | null; dataQuality: DataQualityState; loading: boolean; source?: DashboardSource; warning?: string }) {
  const dataUnavailable = dataQuality === "disconnected" || dataQuality === "offline";
  const stale = dataQuality === "stale";
  const [alertOpen, setAlertOpen] = useState(false);
  const retired = stage === "retired";
  const visibleMetrics = retired
    ? [...metrics.filter((metric) => metric.metric !== "radiation_dose" && metric.metric !== "core_temperature"), ...retiredActivityTrends]
    : metrics;
  return <div className="space-y-7"><header><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Trends</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{retired ? "Your wearable trends over time" : "Your signals over time"}</h1><p className="mt-2 max-w-2xl leading-7 text-slate-400">Each dotted line represents an illustrative 30-day personal baseline. Alerts are marked so you can review what changed and why.</p><div className="mt-3"><DeviceBadge /></div></header>{loading ? null : <DataTrustStrip />}{loading ? <LoadingPanel /> : dataUnavailable ? <DataNotice title="Trends are unavailable" body="The simulated source is disconnected. Reconnect it from Profile to resume the trend view." /> : <DeviceIdleGate stage={stage}><>{alert ? <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4" aria-labelledby="trend-alert-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Alert marker</p><h2 id="trend-alert-title" className="mt-1 text-lg font-semibold text-white">A signal needs review</h2></div><button type="button" aria-expanded={alertOpen} aria-controls="trend-alert-reason" onClick={() => setAlertOpen((open) => !open)} className="rounded-xl border border-amber-200/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/10">{alertOpen ? "Hide reason" : "Show alert reason"}</button></div>{alertOpen ? <p id="trend-alert-reason" className="mt-4 max-w-3xl text-sm leading-6 text-amber-50">{alert.reason}</p> : null}</section> : null}<div className={`rounded-2xl border px-4 py-3 text-sm ${stale ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-cyan-300/20 bg-cyan-300/5 text-slate-300"}`} role="status">{stale ? "These readings are stale. The charts remain visible for context, but the latest update is older than expected." : "Dotted lines show each metric’s illustrative personal baseline."}</div><div className="grid gap-5 xl:grid-cols-2">{visibleMetrics.map((metric) => <article key={metric.metric} className={panelClass}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold text-white">{metric.label}</h2><p className="mt-1 text-sm text-slate-400">{metric.plainLanguage}</p></div><p className="text-2xl font-semibold text-white">{metric.value}<span className="ml-1 text-sm font-medium text-slate-400">{metric.unit}</span></p></div><div className="mt-4"><TrendChart metric={metric} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Dotted line: usual baseline ({metric.baseline} {metric.unit})</span>{metric.points.some((point) => point.alert) ? <span className="inline-flex items-center gap-1 text-amber-200"><AlertTriangle size={14} /> Review marker</span> : <span>Within usual range</span>}</div></article>)}</div></></DeviceIdleGate>}</div>;
}

export function WellbeingView({ stage, checkIn, onCheckInChange, privacy, onPrivacyChange }: { stage: LifeStage; checkIn: CheckIn; onCheckInChange: Dispatch<SetStateAction<CheckIn>>; privacy: Privacy; onPrivacyChange: Dispatch<SetStateAction<Privacy>> }) {
  const [saved, setSaved] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const update = (field: keyof CheckIn, value: string) => { setSaved(false); onCheckInChange((current) => ({ ...current, [field]: value })); };
  const transitionTags = checkIn.transitionTags ?? [];
  const toggleTransition = (tag: string) => {
    setSaved(false);
    onCheckInChange((current) => ({
      ...current,
      transitionTags: transitionTags.includes(tag) ? transitionTags.filter((item) => item !== tag) : [...transitionTags, tag],
    }));
  };
  const retired = stage === "retired";
  return <div className="space-y-7">
    <header>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Wellbeing{retired ? " · Retired astronaut" : ""}</p>
      <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{retired ? "A private moment to check in" : "A 30-second check-in"}</h1>
      <p className="mt-2 max-w-2xl leading-7 text-slate-400">{retired ? "Notice how life after flying feels today. Skip anything you do not want to answer." : "Add context about how you feel. Skipping this check-in does not count as reporting no concerns."}</p>
    </header>
    {/* Optional voice check-in: fills this form for review; nothing is saved until Save is pressed. */}
    <VoiceCheckIn fields={retired ? undefined : ["mood", "stress", "sleepQuality"]} onApply={(values, note) => { setSaved(false); onCheckInChange((current) => ({ ...current, ...values, ...(note ? { note } : {}) })); }} onUrgent={() => setSupportOpen(true)} />
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <form className={`${panelClass} space-y-5`} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
        {retired ? <div className="flex items-start gap-3"><Heart size={18} className="mt-1 shrink-0 text-cyan-200" /><div><h2 className="font-semibold text-white">How are you feeling today?</h2><p className="mt-1 text-sm leading-6 text-slate-400">Use the sliders to describe how things feel right now.</p></div></div> : null}
        <WellbeingSlider label="Mood" hint="1 = low, 5 = good" value={checkIn.mood} labels={["Very low", "Low", "Okay", "Good", "Very good"]} onChange={(value) => update("mood", value)} />
        <WellbeingSlider label="Stress" hint="1 = low, 5 = high" value={checkIn.stress} labels={["Very low", "Low", "Moderate", "High", "Very high"]} onChange={(value) => update("stress", value)} />
        <WellbeingSlider label="Sleep quality" hint="1 = poor, 5 = restful" value={checkIn.sleepQuality} labels={["Very poor", "Poor", "Mixed", "Good", "Restful"]} onChange={(value) => update("sleepQuality", value)} />
        {retired ? <>
          <WellbeingSlider label="Energy" hint="1 = drained, 5 = energized" value={checkIn.energy ?? "3"} labels={["Drained", "Low", "Enough", "Energized", "Very energized"]} onChange={(value) => update("energy", value)} />
          <div className="border-t border-slate-800 pt-5">
            <div className="flex items-start gap-3"><Compass size={18} className="mt-1 shrink-0 text-cyan-200" /><div><h2 className="font-semibold text-white">Life after flying</h2><p className="mt-1 text-sm leading-6 text-slate-400">Optional context can make your personal patterns easier to understand.</p></div></div>
            <div className="mt-5 space-y-5">
              <WellbeingRatingSelect label="Sense of purpose" hint="Choose what fits best" value={checkIn.purpose ?? "3"} labels={["Disconnected", "Uncertain", "Finding direction", "Purposeful", "Very purposeful"]} onChange={(value) => update("purpose", value)} />
              <WellbeingRatingSelect label="Social connection" hint="Choose what fits best" value={checkIn.socialConnection ?? "3"} labels={["Isolated", "Distant", "Some contact", "Connected", "Very connected"]} onChange={(value) => update("socialConnection", value)} />
            </div>
            <fieldset className="mt-5"><legend className="text-sm font-semibold text-slate-200">What is shaping today?</legend><div className="mt-3 flex flex-wrap gap-2">{["Sleep routine", "Family adjustment", "Returning to work", "Missing mission life", "Finding new purpose"].map((tag) => <button key={tag} type="button" aria-pressed={transitionTags.includes(tag)} onClick={() => toggleTransition(tag)} className={`rounded-full border px-3 py-2 text-sm ${transitionTags.includes(tag) ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>{tag}</button>)}</div></fieldset>
          </div>
        </> : null}
        <FieldLabel label={retired ? "Private reflection (optional)" : "Note (optional)"}><textarea value={checkIn.note} onChange={(event) => update("note", event.target.value)} className="field min-h-28 resize-y" placeholder={retired ? "What felt meaningful, difficult, or different today?" : "Anything you want to remember?"} aria-label={retired ? "Private reflection" : "Optional note"} /></FieldLabel>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Save check-in locally</button>{saved ? <span className="inline-flex items-center gap-2 text-sm text-emerald-200"><Check size={16} /> Saved on this device</span> : null}</div>
      </form>
      <aside className={`${panelClass} space-y-5`} aria-labelledby="support-title">
        <div className="flex items-start gap-3"><MessageCircleHeart className="mt-1 text-cyan-200" /><div><h2 id="support-title" className="text-lg font-semibold text-white">Talk to a person</h2><p className="mt-2 text-sm leading-6 text-slate-400">Choose the kind of support that feels right for you.</p></div></div>
        <button type="button" aria-expanded={supportOpen} aria-controls="support-options" onClick={() => setSupportOpen((open) => !open)} className="w-full rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">{supportOpen ? "Hide support options" : "Open support options"}</button>
        {supportOpen ? <div id="support-options" className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4" role="region" aria-label="Support options"><p className="text-sm leading-6 text-slate-300">This demo helps you review your choices but does not contact anyone.</p><ul className="mt-3 space-y-2 text-sm font-semibold text-cyan-100"><li>Former astronaut peer</li><li>Behavioral-health professional</li><li>Family or trusted person</li><li>Urgent support</li></ul></div> : null}
        <div className="border-t border-slate-800 pt-5"><div className="flex items-center gap-2"><LockKeyhole size={16} className="text-slate-300" /><h2 className="font-semibold text-white">Privacy choices</h2></div><div className="mt-4 space-y-3"><PrivacyToggle label="Mood and stress" checked={privacy.mood} onChange={() => onPrivacyChange((current) => ({ ...current, mood: !current.mood }))} /><PrivacyToggle label="Free-text notes" checked={privacy.notes} onChange={() => onPrivacyChange((current) => ({ ...current, notes: !current.notes }))} /><PrivacyToggle label="Trend summaries" checked={privacy.trends} onChange={() => onPrivacyChange((current) => ({ ...current, trends: !current.trends }))} /></div></div>
      </aside>
    </div>
  </div>;
}

export function ProfileView({ profile, profiles, stage, scenario, seed, replayCount, loading, onProfileChange, onScenarioChange, onSeedChange, onReplay, onStageChange }: { profile: TravelerProfile; profiles: TravelerProfile[]; stage: LifeStage; scenario: SimulationScenario; seed: number; replayCount: number; loading: boolean; onProfileChange: (id: string) => void; onScenarioChange: (scenario: SimulationScenario) => void; onSeedChange: (seed: number) => void; onReplay: () => void; onStageChange: (stage: LifeStage) => void }) {
  return <div className="space-y-7"><header><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Profile and simulation</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Shape the demo context</h1><p className="mt-2 max-w-2xl leading-7 text-slate-400">All records here are synthetic. Change the scenario to demonstrate normal, review, and data-quality states.</p></header>{loading ? <LoadingPanel /> : null}<div className="grid gap-5 lg:grid-cols-2"><section className={`${panelClass} space-y-5`} aria-labelledby="profile-settings"><h2 id="profile-settings" className="text-xl font-semibold text-white">Traveler settings</h2><FieldLabel label="Sample traveler"><select value={profile.id} onChange={(event) => onProfileChange(event.target.value)} className="field" aria-label="Sample traveler">{profiles.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.role}</option>)}</select></FieldLabel><FieldLabel label="Mission stage"><select value={stage} onChange={(event) => onStageChange(event.target.value as LifeStage)} className="field" aria-label="Mission stage"><option value="future">Future / Trainee</option><option value="active">Active astronaut</option><option value="retired">Retired / Post-mission</option></select></FieldLabel><div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4"><p className="text-sm text-slate-400">Selected profile</p><p className="mt-1 text-lg font-semibold text-white">{profile.name}</p><p className="mt-1 text-sm text-slate-400">{profile.role} · {missionLabel(profile, stage)}</p></div><DeviceCard onResetScenario={() => onScenarioChange("usual")} /><BluetoothCard /><WebhookCard /></section><section className={`${panelClass} space-y-5`} aria-labelledby="simulation-settings"><div className="flex items-center justify-between gap-3"><h2 id="simulation-settings" className="text-xl font-semibold text-white">Simulation controls</h2><button type="button" onClick={() => onScenarioChange("usual")} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"><RotateCcw size={15} /> Reset</button></div><FieldLabel label="Demo scenario"><select value={scenario} onChange={(event) => onScenarioChange(event.target.value as SimulationScenario)} className="field" aria-label="Demo scenario"><option value="usual">Usual day</option><option value="recovery_concern">Recovery concern</option><option value="sensor_disconnected">Sensor disconnected</option><option value="stale">Stale data</option><option value="offline">Offline mode</option></select></FieldLabel><FieldLabel label="Simulation seed" hint="Saved on this device"><input type="number" min="0" value={seed} onChange={(event) => onSeedChange(Number(event.target.value))} className="field" aria-label="Simulation seed" /></FieldLabel><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={onReplay} className="rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10"><RotateCcw size={15} className="mr-2 inline" /> Replay events</button><span className="text-xs text-slate-500">Replay {replayCount} · mock run</span></div><div className="space-y-3"><ScenarioRow icon={<ShieldCheck size={18} />} title="Usual day" body="Readings stay close to the illustrative personal pattern." /><ScenarioRow icon={<AlertTriangle size={18} />} title="Recovery concern" body="Sleep falls while resting heart rate rises and HRV falls." /><ScenarioRow icon={<WifiOff size={18} />} title="Sensor disconnected" body="Shows what happens when new readings stop arriving." /></div></section></div><AssumedDevicesPanel /><ImportDataPanel personKey={`${stage}:${profile.id}`} /><section className={`${panelClass} flex items-start gap-3`}><CircleHelp className="mt-1 shrink-0 text-cyan-200" /><p className="text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">Limits:</span> This demo uses synthetic records and illustrative baselines. It does not diagnose, clear, or treat a health condition.</p></section></div>;
}

function FuturePreparationView({ preparationRepository }: { preparationRepository?: PreparationRepository }) {
  const [day, setDay] = useState(1);
  const [saved, setSaved] = useState(false);
  const [baselineSaves, setBaselineSaves] = useState(0);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineMessage, setBaselineMessage] = useState("");
  const [timelineMessage, setTimelineMessage] = useState("");
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [baseline, setBaseline] = useState({ restingHeartRate: "", sleepHours: "", mood: "", stress: "", note: "" });
  const device = useDevice();
  const wearable = device?.status.phase === "streaming" ? device.metrics : null;
  const fillFromWearable = () => {
    const hr = wearable?.find((metric) => metric.metric === "resting_hr")?.value;
    const sleep = wearable?.find((metric) => metric.metric === "sleep_hours")?.value;
    setBaseline((current) => ({ ...current, restingHeartRate: hr !== undefined ? String(Math.round(hr)) : current.restingHeartRate, sleepHours: sleep !== undefined ? String(sleep) : current.sleepHours }));
  };
  const [practice, setPractice] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void preparationRepository?.getAdaptationProgress().then((result) => {
      if (!cancelled && !result.warning) setCompletedDays(result.data.filter((item) => item.completed).map((item) => item.day));
    });
    return () => { cancelled = true; };
  }, [preparationRepository]);
  const topics = ["Arrival and orientation", "Motion sensitivity", "Fluid shifts and facial puffiness", "Sleep timing changes", "Movement confidence", "Exercise adaptation", "Recovery rhythm", "Family and mission contact", "Sleep routine", "Stress reset", "Steady movement", "Personal pattern review", "Ask-for-support practice", "Your first-days recap"];
  const togglePractice = (id: string) => {
    const next = practice.includes(id) ? practice.filter((item) => item !== id) : [...practice, id];
    setPractice(next);
    void preparationRepository?.savePreparationSession({ sessionId: id, type: id.includes("breath") ? "breathing" : id.includes("ground") ? "grounding" : "fitness", status: next.includes(id) ? "completed" : "saved" });
  };
  const saveBaseline = async (event: FormEvent) => {
    event.preventDefault();
    setSavingBaseline(true);
    setSaved(false);
    setBaselineMessage("");
    const result = await preparationRepository?.saveBaselineCheckin({ checkInDate: new Date().toISOString().slice(0, 10), restingHeartRate: Number(baseline.restingHeartRate) || undefined, sleepHours: Number(baseline.sleepHours) || undefined, mood: Number(baseline.mood) || undefined, stress: Number(baseline.stress) || undefined, exerciseCompleted: false, note: baseline.note });
    setSavingBaseline(false);
    setSaved(Boolean(result && !result.warning));
    if (result && !result.warning) setBaselineSaves((count) => count + 1);
    setBaselineMessage(result?.warning ?? (result ? "Saved to your Supabase workspace." : "Cloud save is unavailable for this session."));
  };
  return <div className="space-y-7"><header className="horizon-hero preparation-hero p-6 sm:p-8"><p className="editorial-label hero-script">Future traveler / preparation workspace</p><h1 className="hero-wordmark mt-5">Build your starting pattern</h1><p className="mt-5 max-w-3xl text-sm leading-7 text-[#999]">Prepare for a first journey through small check-ins, practical exercises, and a day-by-day guide to common early adaptations.</p><p className="mt-4 font-mono text-xs text-[#55e0f4]">Preparation education only · never flight clearance or certification</p></header>
    <section className="grid gap-5 xl:grid-cols-2"><form className={`${panelClass} space-y-4`} onSubmit={saveBaseline} aria-labelledby="baseline-title"><div><p className="text-sm text-slate-400">01 / Personal baseline</p><h2 id="baseline-title" className="text-xl font-semibold text-white">A short baseline check-in</h2><p className="mt-2 text-sm leading-6 text-slate-400">Build context for your usual pattern. These values are saved to your private Supabase session.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Resting heart rate"><input className="field" type="number" value={baseline.restingHeartRate} onChange={(e) => setBaseline({ ...baseline, restingHeartRate: e.target.value })} /></FieldLabel><FieldLabel label="Sleep hours"><input className="field" type="number" step="0.1" value={baseline.sleepHours} onChange={(e) => setBaseline({ ...baseline, sleepHours: e.target.value })} /></FieldLabel><FieldLabel label="Mood (1–5)"><input className="field" type="number" min="1" max="5" value={baseline.mood} onChange={(e) => setBaseline({ ...baseline, mood: e.target.value })} /></FieldLabel><FieldLabel label="Stress (1–5)"><input className="field" type="number" min="1" max="5" value={baseline.stress} onChange={(e) => setBaseline({ ...baseline, stress: e.target.value })} /></FieldLabel></div><FieldLabel label="Context note"><textarea className="field min-h-20" value={baseline.note} onChange={(e) => setBaseline({ ...baseline, note: e.target.value })} /></FieldLabel>{wearable ? <button type="button" onClick={fillFromWearable} className="rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">Fill from my wearable</button> : null}<button className="btn-square bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={savingBaseline}>{savingBaseline ? "Saving…" : "Save baseline check-in"}</button>{baselineMessage ? <p className={`text-sm ${saved ? "text-emerald-200" : "text-amber-200"}`} role="status">{baselineMessage}</p> : null}</form><section className={`${panelClass} space-y-4`} aria-labelledby="practice-title"><p className="text-sm text-slate-400">02 / Fitness and resilience</p><h2 id="practice-title" className="text-xl font-semibold text-white">Small practices for the week</h2>{[{ id: "mobility", title: "Equipment-free mobility", body: "Five minutes of gentle movement to practise control and comfort." }, { id: "strength", title: "Bodyweight strength", body: "A short equipment-free routine for preparation, not performance scoring." }, { id: "breath", title: "Extended-exhale breathing", body: "Slow the pace of your breathing and notice what changes." }, { id: "ground", title: "Five-senses grounding", body: "Name what you can see, hear, feel, smell, and taste." }].map((item) => <button key={item.id} type="button" onClick={() => togglePractice(item.id)} aria-pressed={practice.includes(item.id)} className={`w-full rounded-xl border p-4 text-left ${practice.includes(item.id) ? "border-emerald-300/50 bg-emerald-300/10" : "border-slate-700 bg-slate-950/30"}`}><p className="font-semibold text-white">{practice.includes(item.id) ? "✓ " : ""}{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-400">{item.body}</p></button>)}</section>
    </section><BaselineSummaryPanel repository={preparationRepository} refreshKey={baselineSaves} /><section className={`${panelClass} overflow-hidden`} aria-labelledby="timeline-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-400">03 / First 14 days</p><h2 id="timeline-title" className="text-xl font-semibold text-white">Adaptation timeline</h2><p className="mt-2 text-sm text-slate-400">Every level includes a reason. Common does not mean every situation is harmless.</p></div><span className="rounded-full border border-cyan-300/40 px-3 py-1 font-mono text-xs text-cyan-200">Day {day} / 14</span></div><div className="mt-5 flex gap-2 overflow-x-auto pb-2">{topics.map((topic, index) => <button key={topic} type="button" onClick={() => setDay(index + 1)} aria-pressed={day === index + 1} className={`min-w-24 rounded-xl border px-3 py-3 text-left text-xs ${day === index + 1 ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-400"}`}><span className="font-mono">D{index + 1}</span><span className="mt-2 block">{topic}</span></button>)}</div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]"><div><h3 className="text-lg font-semibold text-white">{topics[day - 1]}</h3><p className="mt-2 leading-7 text-slate-300">Your body and routine may be adjusting to a new movement environment. Notice the pattern, use a gentle routine, and write down what you experience.</p><p className="mt-3 text-sm text-slate-400"><span className="font-semibold text-emerald-200">Self-care:</span> Try the breathing or grounding practice and note whether it helps. <span className="font-semibold text-amber-200">Tell a crew medic:</span> Tell someone if it is persistent, worsening, or making daily tasks difficult. <span className="font-semibold text-rose-200">Urgent:</span> Seek immediate mission support for severe or rapidly worsening symptoms.</p></div><button type="button" onClick={async () => { const result = await preparationRepository?.saveAdaptationProgress({ day, completed: true, experienceNote: "Completed educational timeline day." }); setTimelineMessage(result?.warning ?? `Day ${day} marked complete.`); }} className="btn-square self-start bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">Mark day complete</button>{timelineMessage ? <p className="text-sm text-emerald-200" role="status">{timelineMessage}</p> : null}</div></section>
    <section className={`${panelClass} flex items-start gap-3`}><CircleHelp className="mt-1 shrink-0 text-cyan-200" /><p className="text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">Limits:</span> Horizon provides readiness education only. Completion does not mean you are ready to fly, medically cleared, certified, or approved for travel. Real decisions belong to qualified mission and medical teams.</p></section>
  </div>;
}

export function GuidanceView({ stage, preparationRepository, onViewChange }: { stage: LifeStage; preparationRepository?: PreparationRepository; onViewChange: (view: ViewName) => void }) {
  const [lessonComplete, setLessonComplete] = usePersistedState("horizon:trainee-lesson-complete", false);
  const [summaryFields, setSummaryFields] = usePersistedState("horizon:retired-summary-fields", { trends: true, wellbeing: false });
  if (stage === "future") return <FuturePreparationView preparationRepository={preparationRepository} />;
  if (stage === "retired") return <RetiredGuidanceView summaryFields={summaryFields} setSummaryFields={setSummaryFields} onViewChange={onViewChange} />;
  return <div className="space-y-7"><header><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Guidance · Active astronaut</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Make the next step clear</h1><p className="mt-2 max-w-2xl leading-7 text-slate-400">When a pattern changes, start with data quality, review the reason, and choose the smallest useful action.</p></header><section className={`${panelClass} max-w-3xl`}><div className="flex items-start gap-3"><Sparkles className="mt-1 text-cyan-200" /><div><h2 className="text-xl font-semibold text-white">A short, practical guide</h2><ul className="mt-5 space-y-4">{["Check the reading and sensor fit", "Review the personal baseline", "Talk to a crew medic when needed"].map((item) => <li key={item} className="flex items-start gap-3 text-slate-300"><Check className="mt-0.5 shrink-0 text-emerald-200" size={18} />{item}</li>)}</ul></div></div></section><section className={`${panelClass} max-w-3xl`} aria-labelledby="about-limits-title"><h2 id="about-limits-title" className="text-xl font-semibold text-white">About and limits</h2><p className="mt-2 text-sm leading-6 text-slate-400">Horizon is a research demo using synthetic data only. It is not a medical device and never diagnoses. Real baselines should be cited from NASA research sources.</p><div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold"><a className="text-cyan-200 underline" href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">NASA NTRS</a><a className="text-cyan-200 underline" href="https://osdr.nasa.gov/" target="_blank" rel="noreferrer">NASA OSDR</a></div></section></div>;
}

type RetiredSummaryFields = { trends: boolean; wellbeing: boolean };
type SyntheticDxaRecord = { id: string; reportDate: string; facility: string; lumbarSpineTScore: number; totalHipTScore: number; femoralNeckTScore: number; clinicianInterpretation: string; followUpDue: string };
type SyntheticVisionRecord = { id: string; examDate: string; facility: string; visualAcuity: string; clinicianNote: string; followUpDue: string };
type SyntheticAppointment = { date: string; reminder: boolean };

const sampleDxaRecord: SyntheticDxaRecord = {
  id: "sample-dxa-2026-05",
  reportDate: "2026-05-12",
  facility: "Horizon Sample Medical Center",
  lumbarSpineTScore: -1.4,
  totalHipTScore: -1.1,
  femoralNeckTScore: -1.3,
  clinicianInterpretation: "Bone density is below the young-adult reference range. Review this result with prior studies, history, and a qualified clinician.",
  followUpDue: "2027-05-12",
};

const sampleVisionRecord: SyntheticVisionRecord = {
  id: "sample-vision-2026-08",
  examDate: "2026-08-20",
  facility: "Horizon Sample Eye Clinic",
  visualAcuity: "20/20 corrected · both eyes",
  clinicianNote: "No urgent concern documented in this synthetic exam. Continue the follow-up plan and report new or worsening vision changes to a qualified eye-care professional.",
  followUpDue: "2026-12-15",
};

const retiredEducationCards = [
  { group: "physical", title: "Movement & strength", subtitle: "Aerobic activity, strength, mobility, and gradual progression", Icon: Activity, points: ["Use a gradual, individualized plan that matches current ability and health history.", "Include a mix of aerobic, strength, mobility, and balance work rather than relying on one activity.", "Review pain, dizziness, unusual breathlessness, or a major change in capacity with a qualified professional."], resources: [{ label: "NASA strength, conditioning and rehabilitation", href: "https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/" }] },
  { group: "physical", title: "Bone & balance", subtitle: "Bone strength, stability, coordination, and fall prevention", Icon: Bone, points: ["Weight-bearing and resistance activities can support bone and muscle health when they are appropriate for you.", "Balance and coordination practice can support confidence and safer daily movement.", "Use clinical results and professional advice to decide what intensity and progression are appropriate."], resources: [{ label: "NASA bone-loss technical brief", href: "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf" }] },
  { group: "physical", title: "Heart & circulation", subtitle: "Cardiovascular activity, recovery, and long-term patterns", Icon: HeartPulse, points: ["Regular activity can support cardiovascular health, sleep, balance, and independent living.", "Look at heart-rate and recovery patterns over time rather than treating one wearable value as a diagnosis.", "Discuss persistent changes or new symptoms with a qualified clinician."], resources: [{ label: "CDC physical-activity benefits", href: "https://www.cdc.gov/physical-activity-basics/health-benefits/older-adults.html" }] },
  { group: "physical", title: "Sleep & recovery", subtitle: "Routine, rest, fatigue, and restorative sleep", Icon: Moon, points: ["Keep a regular sleep and wake schedule and build a consistent wind-down routine.", "Notice how exercise timing, screens, caffeine, alcohol, meals, and the sleep environment affect rest.", "Talk with a clinician when sleep problems persist or interfere with daytime life."], resources: [{ label: "NIH healthy sleep habits", href: "https://www.nia.nih.gov/health/sleep/6-healthy-sleep-habits-older-adults" }] },
  { group: "physical", title: "Nutrition & preventive care", subtitle: "Balanced eating, hydration, checkups, and sustainable habits", Icon: Apple, points: ["Use regular meals, hydration, and balanced food choices to support activity and recovery.", "Build habits that are sustainable and compatible with personal health needs and medications.", "Keep routine health checks, screenings, and vaccinations up to date with your care team."], resources: [{ label: "CDC healthy aging", href: "https://www.cdc.gov/healthy-aging/about/" }] },
  { group: "mental", title: "Emotional wellbeing", subtitle: "Stress, adjustment, changing roles, and early support", Icon: MessageCircleHeart, points: ["Notice persistent changes in mood, stress, sleep, concentration, or daily functioning.", "Make room for recovery, recreation, and adjustment to changes in identity or routine.", "Ask for support early when changes persist, worsen, or make daily life harder."], resources: [{ label: "NASA behavioral health", href: "https://www.nasa.gov/reference/jsc-behavioral-health/" }] },
  { group: "mental", title: "Social connection", subtitle: "Family, peers, friends, belonging, and community", Icon: Heart, points: ["Protect supportive relationships with family, peers, friends, and community.", "Choose regular, meaningful ways to stay connected rather than waiting until support is urgently needed.", "Talk with someone you trust when isolation or loneliness begins affecting daily life."], resources: [{ label: "CDC social connection", href: "https://www.cdc.gov/social-connectedness/about/index.html" }] },
  { group: "mental", title: "Purpose & daily routine", subtitle: "Meaningful activity, structure, learning, and rest", Icon: Compass, points: ["Build a routine that balances meaningful activity, movement, relationships, learning, and rest.", "Expect purpose and identity to change over time rather than requiring one immediate answer.", "Use the wellbeing check-in to notice which activities and connections are helping."], resources: [{ label: "CDC healthy aging", href: "https://www.cdc.gov/healthy-aging/about/" }] },
];

function RetiredEducationCard({ card }: { card: (typeof retiredEducationCards)[number] }) {
  const { title, subtitle, Icon, points, resources } = card;
  return <details className="group/topic rounded-xl border border-slate-800 bg-slate-950/30 p-4"><summary className="flex cursor-pointer list-none items-start justify-between gap-3"><span className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Icon size={18} /></span><span><span className="block font-semibold text-white">{title}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{subtitle}</span></span></span><span className="shrink-0 text-sm font-semibold text-cyan-200 group-open/topic:hidden">Learn</span><span className="hidden shrink-0 text-sm font-semibold text-cyan-200 group-open/topic:inline">Close</span></summary><div className="mt-4 border-t border-slate-800 pt-4"><ul className="space-y-3 text-sm leading-6 text-slate-300">{points.map((point) => <li key={point} className="flex items-start gap-2"><Check size={15} className="mt-1 shrink-0 text-emerald-200" />{point}</li>)}</ul><div className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting resources</p><div className="mt-3 flex flex-col items-start gap-2">{resources.map((resource) => <a key={resource.href} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 underline" href={resource.href} target="_blank" rel="noreferrer">{resource.label} <ArrowUpRight size={14} /></a>)}</div></div></div></details>;
}

function formatSampleDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function RetiredGuidanceView({ summaryFields, setSummaryFields, onViewChange }: {
  summaryFields: RetiredSummaryFields;
  setSummaryFields: Dispatch<SetStateAction<RetiredSummaryFields>>;
  onViewChange: (view: ViewName) => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dxaRecord, setDxaRecord] = usePersistedState<SyntheticDxaRecord | null>("horizon:retired-sample-dxa", null);
  const [visionRecord, setVisionRecord] = usePersistedState<SyntheticVisionRecord | null>("horizon:retired-sample-vision", null);
  const [appointment, setAppointment] = usePersistedState<SyntheticAppointment | null>("horizon:retired-sample-appointment", null);
  const selectedCount = Object.values(summaryFields).filter(Boolean).length;
  const nextFollowUpOptions = [
    visionRecord ? { label: "Vision follow-up", date: visionRecord.followUpDue } : null,
    appointment ? { label: "Bone health appointment", date: appointment.date } : dxaRecord ? { label: "Bone health follow-up due", date: dxaRecord.followUpDue } : null,
  ].filter((item): item is { label: string; date: string } => Boolean(item)).sort((a, b) => a.date.localeCompare(b.date));
  const nextFollowUp = nextFollowUpOptions[0] ? `${nextFollowUpOptions[0].label} · ${formatSampleDate(nextFollowUpOptions[0].date)}` : "No sample follow-up scheduled";

  return <div className="space-y-7">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">Guidance · Retired astronaut</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Your long-term follow-up</h1><p className="mt-2 max-w-2xl leading-7 text-slate-400">Review important health areas and prepare useful context for your next appointment.</p></div>
      <a href="#retired-follow-ups" className="btn-square inline-flex items-center justify-center gap-2 bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">View follow-ups <ArrowRight size={16} /></a>
    </header>

    <section className={`${panelClass} border-cyan-300/30`} aria-labelledby="next-follow-up-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><CalendarDays size={22} /></span><div><p className="text-sm font-semibold text-cyan-200">Next follow-up</p><h2 id="next-follow-up-title" className="mt-1 text-xl font-semibold text-white">{nextFollowUp}</h2><p className="mt-2 text-sm text-slate-400">Dates update from the imported sample report and locally created sample appointment. Nothing is booked or sent.</p></div></div>
        <a href="#appointment-summary" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">Prepare now <ArrowRight size={16} /></a>
      </div>
    </section>

    <section aria-labelledby="retired-education-title">
      <div><p className="text-sm text-slate-400">Education for long-term health</p><h2 id="retired-education-title" className="mt-1 text-2xl font-semibold text-white">Maintain physical and mental wellbeing</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Use these topics as conversation starters and general education. Personal exercise, nutrition, sleep, and mental-health plans should be agreed with qualified professionals who know your history.</p></div>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <details className="tech-card group p-6 sm:p-7">
          <summary className="min-h-20 cursor-pointer list-none"><span className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Activity size={23} /></span><span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-white">Physical health</span><span className="mt-2 block text-sm leading-6 text-slate-400">Movement, bone, heart, sleep, nutrition, and preventive care</span><span className="mt-4 inline-flex min-w-24 items-center justify-center rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-bold text-cyan-100 group-open:hidden">Learn</span><span className="mt-4 hidden min-w-24 items-center justify-center rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-bold text-cyan-100 group-open:inline-flex">Close</span></span></span></summary>
          <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5">{retiredEducationCards.filter((card) => card.group === "physical").map((card) => <RetiredEducationCard key={card.title} card={card} />)}</div>
        </details>
        <details className="tech-card group p-6 sm:p-7">
          <summary className="min-h-20 cursor-pointer list-none"><span className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><MessageCircleHeart size={23} /></span><span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-white">Mental health</span><span className="mt-2 block text-sm leading-6 text-slate-400">Emotional wellbeing, social connection, purpose, and routine</span><span className="mt-4 inline-flex min-w-24 items-center justify-center rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-bold text-cyan-100 group-open:hidden">Learn</span><span className="mt-4 hidden min-w-24 items-center justify-center rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-bold text-cyan-100 group-open:inline-flex">Close</span></span></span></summary>
          <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5">{retiredEducationCards.filter((card) => card.group === "mental").map((card) => <RetiredEducationCard key={card.title} card={card} />)}</div>
        </details>
      </div>
    </section>

    <section id="retired-follow-ups" className={panelClass} aria-labelledby="health-areas-title">
      <h2 id="health-areas-title" className="text-xl font-semibold text-white">Long-term follow-up preview</h2>
      <div className="health-areas-grid mt-5 grid items-start gap-3">
        <details className="group rounded-xl border border-slate-800 bg-slate-950/20 p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4"><span><span className="block font-semibold text-white">Bone-density trend over years</span><span className="mt-1 block text-sm text-slate-400">{dxaRecord ? "Sample DXA report imported" : "Historical records are not connected."}</span></span><span className="text-sm font-semibold text-cyan-200 group-open:hidden">Details</span><span className="hidden text-sm font-semibold text-cyan-200 group-open:inline">Close</span></summary>
          {dxaRecord ? <div className="mt-5 border-t border-slate-800 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Synthetic sample · not a real medical record</p><button type="button" onClick={() => { setDxaRecord(null); setAppointment(null); }} className="text-xs font-semibold text-slate-400 underline hover:text-slate-200">Remove sample</button></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Report date</dt><dd className="mt-1 font-semibold text-slate-200">{formatSampleDate(dxaRecord.reportDate)}</dd></div><div><dt className="text-slate-500">Recommended follow-up</dt><dd className="mt-1 font-semibold text-slate-200">{formatSampleDate(dxaRecord.followUpDue)}</dd></div><div><dt className="text-slate-500">Lumbar spine T-score</dt><dd className="mt-1 font-mono font-semibold text-slate-200">{dxaRecord.lumbarSpineTScore}</dd></div><div><dt className="text-slate-500">Total hip T-score</dt><dd className="mt-1 font-mono font-semibold text-slate-200">{dxaRecord.totalHipTScore}</dd></div><div><dt className="text-slate-500">Femoral neck T-score</dt><dd className="mt-1 font-mono font-semibold text-slate-200">{dxaRecord.femoralNeckTScore}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 font-semibold text-slate-200">{dxaRecord.facility}</dd></div></dl><div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-sm font-semibold text-amber-100">Clinician interpretation from sample report</p><p className="mt-2 text-sm leading-6 text-slate-300">{dxaRecord.clinicianInterpretation}</p><p className="mt-2 text-xs text-slate-500">Horizon displays the supplied note; it does not calculate a diagnosis.</p></div><div className="mt-4 flex flex-wrap items-center gap-3">{appointment ? <><span className="text-sm font-semibold text-emerald-200">Sample appointment: {formatSampleDate(appointment.date)}</span><label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={appointment.reminder} onChange={(event) => setAppointment({ ...appointment, reminder: event.target.checked })} className="size-4 accent-cyan-300" /> Create local reminder</label></> : <button type="button" onClick={() => setAppointment({ date: "2027-05-18", reminder: false })} className="rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">Create sample appointment</button>}</div>{appointment?.reminder ? <p className="mt-3 text-xs text-emerald-200" role="status">Local sample reminder created for {formatSampleDate(appointment.date)}. No external calendar or clinic was contacted.</p> : null}</div> : <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-sm leading-6 text-slate-400">Import a built-in synthetic report to preview DXA results, a clinician-supplied interpretation, follow-up dates, and reminders.</p><button type="button" onClick={() => setDxaRecord(sampleDxaRecord)} className="btn-square mt-4 bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">Import sample DXA report</button></div>}
        </details>
        <details className="group rounded-xl border border-slate-800 bg-slate-950/20 p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4"><span><span className="block font-semibold text-white">Vision and cardiovascular trend</span><span className="mt-1 block text-sm text-slate-400">{visionRecord ? "Sample eye-exam record imported; wearable trends available." : "Historical records are not connected."}</span></span><span className="text-sm font-semibold text-cyan-200 group-open:hidden">Details</span><span className="hidden text-sm font-semibold text-cyan-200 group-open:inline">Close</span></summary>
          {visionRecord ? <div className="mt-5 border-t border-slate-800 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Synthetic sample · not a real eye exam</p><button type="button" onClick={() => setVisionRecord(null)} className="text-xs font-semibold text-slate-400 underline hover:text-slate-200">Remove sample</button></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Exam date</dt><dd className="mt-1 font-semibold text-slate-200">{formatSampleDate(visionRecord.examDate)}</dd></div><div><dt className="text-slate-500">Recommended follow-up</dt><dd className="mt-1 font-semibold text-slate-200">{formatSampleDate(visionRecord.followUpDue)}</dd></div><div><dt className="text-slate-500">Recorded acuity</dt><dd className="mt-1 font-semibold text-slate-200">{visionRecord.visualAcuity}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 font-semibold text-slate-200">{visionRecord.facility}</dd></div></dl><div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-sm font-semibold text-amber-100">Guidance supplied with the sample exam</p><p className="mt-2 text-sm leading-6 text-slate-300">{visionRecord.clinicianNote}</p><p className="mt-2 text-xs text-slate-500">Horizon displays the supplied note; it does not assess or diagnose vision.</p></div></div> : <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">Source:</span> No eye-exam source is connected. Import a built-in synthetic record to see its exam date, clinician-supplied guidance, and follow-up date.</p><button type="button" onClick={() => setVisionRecord(sampleVisionRecord)} className="btn-square mt-4 bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">Import sample eye-exam record</button></div>}
          <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-sm leading-6 text-slate-300">Review resting heart rate and HRV as patterns over time rather than treating one wearable value as a diagnosis.</p><button type="button" onClick={() => onViewChange("trends")} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">Review wearable trends <ArrowRight size={16} /></button></div>
        </details>
        <details className="group rounded-xl border border-slate-800 bg-slate-950/20 p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4"><span><span className="block font-semibold text-white">Sleep and mood context</span><span className="mt-1 block text-sm text-slate-400">Local check-ins can add sleep and mood context.</span></span><span className="text-sm font-semibold text-cyan-200 group-open:hidden">Details</span><span className="hidden text-sm font-semibold text-cyan-200 group-open:inline">Close</span></summary><div className="mt-5 border-t border-slate-800 pt-4"><p className="text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">Source:</span> Sleep, mood, stress, and check-ins that you choose to save locally.</p><p className="mt-3 text-sm leading-6 text-slate-300"><span className="font-semibold text-slate-200">Guidance:</span> Use a short check-in to add personal context. Skipping a check-in never means that no concern exists.</p><button type="button" onClick={() => onViewChange("wellbeing")} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">Complete wellbeing check-in <ArrowRight size={16} /></button></div></details>
      </div>
    </section>

    <section id="appointment-summary" className={panelClass} aria-labelledby="summary-title">
      <div className="flex items-start gap-3"><FileText className="mt-1 shrink-0 text-cyan-200" /><div><h2 id="summary-title" className="text-xl font-semibold text-white">Prepare for your next appointment</h2><p className="mt-2 text-sm leading-6 text-slate-400">Choose the context you want to bring. Nothing is sent automatically.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><PrivacyToggle label="Wearable trend summary" checked={summaryFields.trends} onChange={() => setSummaryFields((current) => ({ ...current, trends: !current.trends }))} /><PrivacyToggle label="Wellbeing check-ins" checked={summaryFields.wellbeing} onChange={() => setSummaryFields((current) => ({ ...current, wellbeing: !current.wellbeing }))} /></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" aria-expanded={summaryOpen} aria-controls="retired-summary-preview" onClick={() => setSummaryOpen((open) => !open)} className="btn-square bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">{summaryOpen ? "Hide summary" : "Preview summary"}</button><span className="text-xs text-slate-500">{selectedCount} of 2 sections selected · saved locally</span></div>
      {summaryOpen ? <div id="retired-summary-preview" className="mt-5 rounded-xl border border-slate-800 bg-slate-950/30 p-4" role="region" aria-label="Appointment summary preview"><p className="font-semibold text-white">Appointment conversation summary</p>{selectedCount ? <ul className="mt-3 space-y-2 text-sm text-slate-300">{summaryFields.trends ? <li>• Wearable trends and long-term context</li> : null}{summaryFields.wellbeing ? <li>• Locally saved wellbeing check-ins</li> : null}</ul> : <p className="mt-3 text-sm text-slate-400">Choose at least one section to include.</p>}<p className="mt-4 text-xs text-slate-500">Research demo. Not for diagnosis or emergency monitoring.</p></div> : null}
    </section>
  </div>;
}

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="block"><span className="flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-200"><span>{label}</span>{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}</span><span className="mt-2 block">{children}</span></label>; }
function WellbeingSlider({ label, hint, value, labels, onChange }: { label: string; hint: string; value: string; labels: [string, string, string, string, string]; onChange: (value: string) => void }) {
  const legacyIndex = labels.findIndex((item) => item.toLowerCase() === value.toLowerCase());
  const parsed = Number(value);
  const sliderValue = Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : legacyIndex >= 0 ? legacyIndex + 1 : 3;
  const id = `wellbeing-${label.toLowerCase().replaceAll(" ", "-")}`;
  const progress = (sliderValue - 1) * 25;
  return <div className="wellbeing-slider"><div className="wellbeing-slider-heading"><label htmlFor={id}>{label}</label><span>{hint}</span></div><output htmlFor={id}>{sliderValue} · {labels[sliderValue - 1]}</output><input id={id} type="range" min="1" max="5" step="1" value={sliderValue} onChange={(event) => onChange(event.target.value)} aria-label={label} aria-valuetext={`${sliderValue} out of 5, ${labels[sliderValue - 1]}`} style={{ background: `linear-gradient(to right, var(--accent) 0% ${progress}%, var(--surface-inset) ${progress}% 100%)` }} /><div className="wellbeing-slider-scale" aria-hidden="true"><span>{labels[0]}</span><span>{labels[4]}</span></div></div>;
}
function WellbeingRatingSelect({ label, hint, value, labels, onChange }: { label: string; hint: string; value: string; labels: [string, string, string, string, string]; onChange: (value: string) => void }) {
  const parsed = Number(value);
  const selected = Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? String(parsed) : "3";
  return <FieldLabel label={label} hint={hint}><select value={selected} onChange={(event) => onChange(event.target.value)} className="field" aria-label={label}>{labels.map((option, index) => <option key={option} value={index + 1}>{option}</option>)}</select></FieldLabel>;
}
function PrivacyToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-3 text-sm text-slate-300"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-cyan-300" /></label>; }
function ScenarioRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) { return <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3"><span className="text-cyan-200">{icon}</span><div><p className="text-sm font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div></div>; }
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
      <span className={`device-connect-icon ${connecting ? "is-active" : ""}`} aria-hidden="true"><Watch size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-white">{connecting ? device!.label : "Loading simulated signals…"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{connecting ? device!.detail : "Preparing the selected scenario and personal comparison."}</p>
        {connecting ? <>
          <div className="device-progress" role="progressbar" aria-label="Wearable connection progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(device!.progress * 100)}><span style={{ width: `${Math.round(device!.progress * 100)}%` }} /></div>
          <ol className="device-steps" aria-label="Connection steps">{CONNECT_PHASES.map((step) => <li key={step.phase} data-state={step.phase === device!.phase ? "current" : CONNECT_PHASES.findIndex((item) => item.phase === device!.phase) > CONNECT_PHASES.findIndex((item) => item.phase === step.phase) ? "done" : "todo"}>{step.phase === "searching" ? "Find device" : step.phase === "pairing" ? "Pair" : "Sync data"}</li>)}</ol>
        </> : null}
      </div>
    </div>
  </section>;
}

/** Shows the pair/reconnect prompt instead of readings when no device is connected. */
function DeviceIdleGate({ stage, children }: { stage: LifeStage; children: ReactNode }) {
  const device = useDevice()?.status;
  if (device && device.phase === "idle") {
    const first = stage === "future";
    return <section className={`${panelClass} flex max-w-2xl items-start gap-3`} aria-labelledby="no-device-title"><Watch className="mt-1 shrink-0 text-slate-300" aria-hidden="true" /><div><h2 id="no-device-title" className="font-semibold text-white">{first ? "No device paired" : "Device disconnected"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{first ? "Pair the simulated wearable to see live heart rate, HRV, SpO₂, temperature and radiation context. You can also build a baseline by hand in Guidance." : "Live readings have stopped. Reconnect the simulated wearable to continue."}</p><button type="button" onClick={device.pair} className="btn-square mt-4 inline-flex items-center gap-2 bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950"><Watch size={16} aria-hidden="true" />{first ? "Pair simulated wearable" : "Reconnect wearable"}</button></div></section>;
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
    <span className="basis-full text-xs text-slate-500">Signals assume a crew wearable and a personal dosimeter. Nothing here is measured by Horizon. See Profile for details.</span>
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
  return <span className="device-badge" data-state={state} role="status"><span className="device-dot" aria-hidden="true" />{text}</span>;
}

function missionLabel(profile: TravelerProfile, stage: LifeStage) { return stage === "future" ? "Pre-mission" : stage === "retired" ? "Post-mission" : `Mission day ${profile.missionDay}`; }
function stageLabel(stage: LifeStage) { return stage === "future" ? "Future traveler" : stage === "retired" ? "Retired astronaut" : "Active astronaut"; }
function scenarioLabel(scenario: SimulationScenario) { return scenario === "usual" ? "Usual day" : scenario === "recovery_concern" ? "Recovery concern" : scenario === "sensor_disconnected" ? "Sensor disconnected" : scenario === "stale" ? "Stale data" : "Offline mode"; }

function BluetoothCard() {
  const bt = useDevice()?.bluetooth;
  if (!bt) return null;
  const busy = bt.phase === "requesting";
  const title = bt.phase === "streaming" ? (bt.ready ? `Live · ${bt.deviceName}` : `Connected · ${bt.deviceName}`) : bt.phase === "signal_lost" ? "Signal lost" : bt.phase === "unsupported" ? "Not supported in this browser" : "Not connected";
  return <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4" aria-labelledby="bluetooth-card-title">
    <div className="flex items-center gap-2"><Bluetooth size={16} className="text-cyan-200" aria-hidden="true" /><p id="bluetooth-card-title" className="text-sm text-slate-400">Bluetooth heart-rate device</p></div>
    <p className="mt-1 text-lg font-semibold text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-400">{bt.phase === "streaming" && bt.ready ? "Receiving clean readings. Heart rate (and HRV, if the device sends beat-to-beat data) come from this device; other signals stay simulated." : bt.phase === "unsupported" ? (bt.message ?? "Web Bluetooth works in Chrome and Edge on desktop and Android. Horizon keeps using the simulated wearable.") : bt.message ?? "Connect a chest strap or watch that broadcasts heart rate. Horizon cleans its readings like any other source. Heart rate and HRV come from the device; other signals stay simulated. Nothing is saved or uploaded."}</p>
    {bt.phase === "streaming" && !bt.ready ? <p className="mt-2 text-sm text-slate-400" role="status">Collecting readings… a few seconds of clean data are needed before they appear on Home.</p> : null}
    <div className="mt-3 flex flex-wrap gap-3">
      {bt.phase === "streaming" ? <button type="button" onClick={bt.disconnect} className="rounded-xl border border-slate-500/50 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Disconnect device</button>
        : bt.phase === "unsupported" ? null
        : <button type="button" disabled={busy} onClick={() => void bt.connect()} className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-60">{busy ? "Waiting for device…" : bt.phase === "signal_lost" || bt.phase === "error" ? "Try again" : "Connect Bluetooth heart-rate device"}</button>}
    </div>
  </div>;
}

function DeviceCard({ onResetScenario }: { onResetScenario: () => void }) {
  const device = useDevice()?.status;
  if (!device) return null;
  const summary = device.phase === "streaming" ? "Connected · streaming simulated readings" : device.connecting ? "Connecting…" : device.phase === "signal_lost" ? "Signal lost" : device.phase === "offline" ? "Offline" : "Not connected";
  return <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4" aria-labelledby="device-card-title"><div className="flex items-center gap-2"><Watch size={16} className="text-cyan-200" aria-hidden="true" /><p id="device-card-title" className="text-sm text-slate-400">Simulated wearable</p></div><p className="mt-1 text-lg font-semibold text-white">{summary}</p><div className="mt-3 flex flex-wrap gap-3">{device.phase === "streaming" ? <button type="button" onClick={device.disconnect} className="rounded-xl border border-slate-500/50 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Disconnect wearable</button> : device.connecting ? null : <button type="button" onClick={() => { onResetScenario(); device.reconnect(); }} className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">{device.paired ? "Reconnect wearable" : "Pair simulated wearable"}</button>}</div></div>;
}
