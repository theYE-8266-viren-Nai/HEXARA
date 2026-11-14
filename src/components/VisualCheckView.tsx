import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Camera, CameraOff, Check, ClipboardList, Copy, Info, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import {
  VISUAL_CHECK_DISCLAIMER, buildVisualCheck, combinedContextNote, composeCrewSummary, extractMovementFeatures, generateSyntheticFeatures, movementStatusFor, ownerKeyFor, taskFor, taskInstructions, tasksForStage,
  type CameraQuality, type CrewSummaryFields, type ObservedFeatures, type UserReportedContext, type VisualCheck, type VisualCheckTask, type VisualCheckType,
} from "../domain/visualCheck";
import { cameraSupported, useCameraMotion } from "../lib/useCameraMotion";
import { loadPoseDetector, type PoseDetector } from "../lib/poseLandmarker";
import { extractPoseFeatures } from "../domain/poseFeatures";
import { drawSkeleton } from "./drawSkeleton";
import type { VisualCheckRepository } from "../lib/visualCheckRepository";
import type { LifeStage } from "../types/horizon";

type Step = "intro" | "quality" | "countdown" | "capture" | "context" | "result";
type Mode = "camera" | "synthetic";
const panelClass = "tech-card p-5 sm:p-6";

/** Movement checks are offered before, during, and after flight with stage-appropriate tasks. */
const stageCopy: Record<LifeStage, { eyebrow: string; title: string; note?: string }> = {
  future: { eyebrow: "Movement check · Future traveler", title: "Build your movement practice" },
  active: { eyebrow: "Movement check · Active astronaut", title: "Keep your practice consistent" },
  retired: { eyebrow: "Movement check · Post-mission", title: "Track your reconditioning practice", note: "Practice tracking, not a rehab programme: follow the plan from your own rehab or medical team." },
};

const emptyContext: UserReportedContext = { discomfort: "none", steadiness: "steady", dizziness: "none", symptoms: "" };

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function VisualCheckView({ stage, profileId, repository, seed, initialTask, onSavedToBody, onRequestCrewMedic }: { stage: LifeStage; profileId: string; repository: VisualCheckRepository; seed: number; initialTask?: VisualCheckType; onSavedToBody?: (check: VisualCheck) => void; onRequestCrewMedic?: () => void }) {
  const ownerKey = ownerKeyFor(stage, profileId);
  const camera = useCameraMotion();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>(cameraSupported() ? "camera" : "synthetic");
  const [consent, setConsent] = useState(false);
  const tasks = tasksForStage(stage);
  const [taskType, setTaskType] = useState<VisualCheckType>(() => initialTask && tasks.some((task) => task.type === initialTask) ? initialTask : tasks[0]?.type ?? "shoulder_mobility");
  const [quality, setQuality] = useState<{ quality: CameraQuality; notes: string[] } | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState(0);
  const [features, setFeatures] = useState<ObservedFeatures | null>(null);
  const [context, setContext] = useState<UserReportedContext>(emptyContext);
  const [history, setHistory] = useState<VisualCheck[]>(() => repository.listLocal());
  const [result, setResult] = useState<VisualCheck | null>(null);
  const [startedAt, setStartedAt] = useState("");
  const cancelled = useRef(false);
  const detectorRef = useRef<PoseDetector | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [pose, setPose] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [skeleton, setSkeleton] = useState(false);
  // StrictMode (the dev server) mounts, unmounts and mounts again, so the flag must be reset on every mount, not only set on unmount.
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);

  const task = taskFor(taskType);
  const instructions = taskInstructions(task, stage);
  const ownHistory = useMemo(() => history.filter((check) => check.ownerKey === ownerKey), [history, ownerKey]);

  const reset = () => { camera.stop(); setPose("idle"); setStep("intro"); setQuality(null); setFeatures(null); setResult(null); setContext(emptyContext); };

  const begin = async () => {
    if (mode === "synthetic") { setStep("countdown"); return; }
    const ok = await camera.start();
    if (ok) {
      setStep("quality");
      setPose("loading");
      void loadPoseDetector().then((loaded) => { if (cancelled.current) return; detectorRef.current = loaded.ok ? loaded.detector : null; setPose(loaded.ok ? "ready" : "unavailable"); });
      window.setTimeout(() => { if (!cancelled.current) setQuality(camera.checkQuality()); }, 600);
    }
  };

  // Countdown, then capture.
  useEffect(() => {
    if (step !== "countdown") return;
    setCountdown(3);
    let value = 3;
    const timer = window.setInterval(() => {
      value -= 1; setCountdown(value);
      if (value <= 0) { window.clearInterval(timer); setStep("capture"); }
    }, mode === "synthetic" ? 250 : 1000);
    return () => window.clearInterval(timer);
  }, [step, mode]);

  useEffect(() => {
    if (step !== "capture") return;
    setStartedAt(new Date().toISOString());
    if (mode === "synthetic") { setFeatures(generateSyntheticFeatures(task, seed + ownHistory.length)); setStep("context"); return; }
    setRemaining(task.durationSeconds);
    const detector = pose === "ready" ? detectorRef.current : null;
    if (detector) {
      void camera.capturePose(detector, task.durationSeconds, setRemaining, skeleton ? (landmarks) => drawSkeleton(overlayRef.current, landmarks) : undefined).then((frames) => {
        if (cancelled.current) return;
        camera.stop();
        setFeatures(extractPoseFeatures(frames, task, quality ?? { quality: "limited", notes: [] }));
        setStep("context");
      });
      return;
    }
    void camera.captureMotion(task.durationSeconds, setRemaining).then((samples) => {
      if (cancelled.current) return;
      camera.stop();
      setFeatures(extractMovementFeatures(samples, task, quality ?? { quality: "limited", notes: [] }));
      setStep("context");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const finish = () => {
    if (!features) return;
    const check = buildVisualCheck({ checkId: crypto.randomUUID(), ownerKey, stage, task, startedAt: startedAt || new Date().toISOString(), cameraConsent: mode === "camera" && consent, features, context, history, isSynthetic: mode === "synthetic" });
    repository.saveLocal(check);
    setHistory(repository.listLocal());
    setResult(check);
    setStep("result");
  };

  // Movement is not offered to Future travelers. The view is never routed to them, but fail safe if it is ever rendered.
  if (!tasks.length) return <section className={panelClass} role="status"><h1 className="text-xl font-semibold text-white">No movement checks are available</h1></section>;
  const copy = stageCopy[stage];
  return <div className="space-y-7">
    <header><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{copy.title}</h1></header>
    <div className="max-w-2xl space-y-1 text-xs leading-5">
      <p role="note" className="flex items-start gap-2 text-amber-100"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{VISUAL_CHECK_DISCLAIMER}</p>
      {copy.note ? <p className="pl-6 text-slate-400">{copy.note}</p> : null}
      <p className="pl-6 text-slate-300">This practice helps you notice how evenly and comfortably you move. Use it to build movement awareness and follow your approved conditioning plan; it cannot assess spine, bone, muscle, or joint health.</p>
    </div>

    {step === "intro" ? <IntroStep mode={mode} onModeChange={setMode} consent={consent} onConsentChange={setConsent} taskType={taskType} onTaskChange={setTaskType} tasks={tasks} stage={stage} onBegin={() => void begin()} camera={camera} /> : null}

    {/* The preview element must exist while the camera runs; it is hidden outside camera steps. */}
    <div className={mode === "camera" && (step === "quality" || step === "countdown" || step === "capture") ? "max-w-3xl" : "hidden"}>
      <div className="relative overflow-hidden rounded-2xl border border-[#293d59] bg-black">
        <video ref={camera.videoRef} muted playsInline aria-label="Live camera preview (not recorded)" className="aspect-video w-full -scale-x-100 object-cover" />
        <canvas ref={overlayRef} width={640} height={480} aria-hidden="true" className={`pointer-events-none absolute inset-0 size-full -scale-x-100 ${skeleton && step === "capture" ? "" : "hidden"}`} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[8%] rounded-xl border-2 border-dashed border-cyan-200/60" />
        <p className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1 font-mono text-xs text-slate-200">Processed on this device · not recorded</p>
      </div>
    </div>

    {step === "quality" ? <section className={`${panelClass} max-w-3xl`} aria-labelledby="quality-title">
      <h2 id="quality-title" className="text-xl font-semibold text-white">Lighting and framing check</h2>
      <p className="mt-2 text-sm text-slate-400">{stage === "active" ? "Anchor yourself so your arms and upper body fit inside the dashed frame, about two metres from the camera." : "Stand so your whole body fits inside the dashed frame, about two metres from the camera."}</p>
      {quality ? <div className="mt-4 space-y-3" role="status">
        <p className="font-semibold text-white">Camera quality: <span className={quality.quality === "good" ? "text-emerald-200" : quality.quality === "limited" ? "text-amber-100" : "text-rose-100"}>{quality.quality}</span></p>
        {quality.notes.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{quality.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="text-sm text-slate-300">Lighting and contrast look usable.</p>}
        {quality.quality === "poor" ? <p className="text-sm text-slate-400">Results under these conditions would not be assessable. Adjust lighting or position and check again.</p> : null}
      </div> : <p className="mt-4 text-sm text-slate-400" role="status">Checking the camera image…</p>}
      <p className="mt-4 text-sm text-slate-300" role="status">{pose === "loading" ? "Body tracking is loading…" : pose === "ready" ? "Body tracking is ready. Joint angles will be measured on your device." : pose === "unavailable" ? "Body tracking is not available here, so the motion-based check will be used. Results stay on your device." : ""}</p>
      {pose === "ready" ? <label className="mt-2 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="size-4" checked={skeleton} onChange={(event) => setSkeleton(event.target.checked)} />Show body points on the preview</label> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <PrimaryButton disabled={!quality || quality.quality === "poor" || pose === "loading"} onClick={() => setStep("countdown")}><Play size={16} aria-hidden="true" />Start {task.label.toLowerCase()}</PrimaryButton>
        <SecondaryButton onClick={() => setQuality(camera.checkQuality())}><RotateCcw size={16} aria-hidden="true" />Check again</SecondaryButton>
        <SecondaryButton onClick={reset}>Cancel</SecondaryButton>
      </div>
    </section> : null}

    {step === "countdown" ? <section className={`${panelClass} max-w-3xl text-center`} aria-live="assertive">
      <p className="text-sm text-slate-400">{instructions}</p>
      <p className={`mono-data mt-4 text-7xl font-semibold text-cyan-200 ${reducedMotion ? "" : "animate-pulse"}`} aria-label={`Starting in ${countdown}`}>{Math.max(countdown, 1)}</p>
    </section> : null}

    {step === "capture" ? <section className={`${panelClass} max-w-3xl`} aria-live="polite">
      <h2 className="text-xl font-semibold text-white">{task.label}</h2>
      <p className="mt-2 text-slate-300">{instructions}</p>
      <p className="mono-data mt-4 text-4xl text-cyan-200">{remaining}s remaining</p>
      <p className="mt-2 text-sm text-slate-400">Move slowly and comfortably. Stop if you feel pain, dizziness, or unsteadiness, and contact your approved support person when needed.</p>
      <SecondaryButton className="mt-4" onClick={reset}>Stop</SecondaryButton>
    </section> : null}

    {step === "context" && features ? <ContextStep context={context} onChange={setContext} onSubmit={finish} synthetic={mode === "synthetic"} /> : null}

    {step === "result" && result ? <ResultStep check={result} onRepeat={reset} repository={repository} onSavedToBody={onSavedToBody} onRequestCrewMedic={onRequestCrewMedic} /> : null}

    <HistoryPanel history={ownHistory} />
  </div>;
}

function IntroStep({ mode, onModeChange, consent, onConsentChange, taskType, onTaskChange, tasks, stage, onBegin, camera }: { tasks: VisualCheckTask[]; stage: LifeStage; mode: Mode; onModeChange: (mode: Mode) => void; consent: boolean; onConsentChange: (value: boolean) => void; taskType: VisualCheckType; onTaskChange: (type: VisualCheckType) => void; onBegin: () => void; camera: ReturnType<typeof useCameraMotion> }) {
  const supported = cameraSupported();
  const blocked = camera.status === "denied" || camera.status === "unavailable" || camera.status === "error";
  return <section className={`${panelClass} max-w-2xl space-y-6`} aria-label="Start a movement check">
    <fieldset>
      <legend className="text-sm font-semibold text-slate-200">Practice task</legend>
      <div className="mt-3 space-y-2">{tasks.map((task) => {
        const selected = taskType === task.type;
        return <label key={task.type} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${selected ? "border-cyan-400/70 bg-cyan-400/15" : "border-[#293d59] hover:border-cyan-200/40"}`}>
          <input type="radio" name="visual-task" className="mt-1" checked={selected} onChange={() => onTaskChange(task.type)} />
          <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-3"><span className="font-semibold text-white">{task.label}</span><span className="shrink-0 font-mono text-xs text-slate-400">{task.durationSeconds} s</span></span>
            {selected ? <span className="mt-1 block text-slate-400">{taskInstructions(task, stage)}</span> : null}</span>
        </label>;
      })}</div>
    </fieldset>

    <p className="text-sm text-slate-400">Move slowly and comfortably. Stop if you feel pain, dizziness, or unsteadiness, and contact your approved support person when needed.</p>

    <fieldset>
      <legend className="sr-only">Mode</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <ModeOption checked={mode === "camera"} disabled={!supported} onChange={() => onModeChange("camera")} icon={<Camera size={16} aria-hidden="true" />} label="Use my camera" hint={supported ? undefined : "Not available in this browser"} />
        <ModeOption checked={mode === "synthetic"} onChange={() => onModeChange("synthetic")} icon={<Sparkles size={16} aria-hidden="true" />} label="Synthetic demo" hint="No camera needed" />
      </div>
    </fieldset>

    {mode === "camera" ? <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1 size-4" checked={consent} onChange={(event) => onConsentChange(event.target.checked)} />Allow my camera for this practice. Video stays on this device.</label> : null}
    {blocked ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-slate-500/40 bg-slate-800/40 p-4 text-sm text-slate-200"><CameraOff className="shrink-0" size={18} aria-hidden="true" /><div><p className="font-semibold">{camera.error}</p><p className="mt-1 text-slate-400">Allow the camera in your browser settings and try again, or use the synthetic demo.</p><SecondaryButton className="mt-3" onClick={() => onModeChange("synthetic")}>Use synthetic demo</SecondaryButton></div></div> : null}

    <PrimaryButton disabled={mode === "camera" && (!consent || camera.status === "requesting")} onClick={onBegin}>{mode === "camera" ? <Camera size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{mode === "camera" ? (camera.status === "requesting" ? "Waiting for camera permission…" : "Allow camera and continue") : "Run synthetic demo"}</PrimaryButton>

    <details className="group border-t border-slate-700/50 pt-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-300 hover:text-white"><LockKeyhole size={15} className="text-cyan-200" aria-hidden="true" />Privacy and limits</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-6 text-slate-400">
        <li>Video is processed on this device and never recorded or uploaded.</li>
        <li>Only derived numbers are kept: repetitions, timing, left/right balance, joint-angle ranges, pauses and camera quality.</li>
        <li>Results are compared only with your own earlier practice. There is no “normal astronaut” score.</li>
        <li>The camera cannot assess bone, vision, blood flow, radiation effects or any medical condition.</li>
        <li>With pain or severe or worsening symptoms, contact the crew medic instead of using this check.</li>
      </ul>
    </details>
  </section>;
}

function ContextStep({ context, onChange, onSubmit, synthetic }: { context: UserReportedContext; onChange: (context: UserReportedContext) => void; onSubmit: () => void; synthetic: boolean }) {
  const scale = (key: "exertion", label: string, hint: string) => <label className="block text-sm font-semibold text-slate-200">{label}<span className="ml-2 text-xs font-normal text-slate-500">{hint}</span>
    <select className="field mt-2" value={context[key] ?? ""} onChange={(event) => onChange({ ...context, [key]: event.target.value ? Number(event.target.value) : undefined })}><option value="">Prefer not to say</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>;
  return <form className={`${panelClass} max-w-3xl`} aria-labelledby="context-title" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <h2 id="context-title" className="text-xl font-semibold text-white">How did that feel?</h2>
    <p className="mt-2 text-sm text-slate-400">{synthetic ? "Synthetic movement result generated. " : "Movement capture finished and the camera is off. "}Use these optional answers to describe how the movement felt; they do not create a health score.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-slate-200">Discomfort
        <select className="field mt-2" value={context.discomfort} onChange={(event) => onChange({ ...context, discomfort: event.target.value as UserReportedContext["discomfort"] })}><option value="none">None</option><option value="mild">Mild</option><option value="pain">Pain</option><option value="severe_or_worsening">Severe or worsening</option></select></label>
      {scale("exertion", "Effort", "1 easy · 5 very hard")}
      <label className="block text-sm font-semibold text-slate-200">Steadiness
        <select className="field mt-2" value={context.steadiness ?? "steady"} onChange={(event) => onChange({ ...context, steadiness: event.target.value as UserReportedContext["steadiness"] })}><option value="steady">Steady</option><option value="slightly_unsteady">A little unsteady</option><option value="very_unsteady">Very unsteady</option></select></label>
      <label className="block text-sm font-semibold text-slate-200">Dizziness
        <select className="field mt-2" value={context.dizziness ?? "none"} onChange={(event) => onChange({ ...context, dizziness: event.target.value as UserReportedContext["dizziness"] })}><option value="none">None</option><option value="dizzy">Dizzy or light-headed</option></select></label>
      <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">What did you notice?<textarea className="field mt-2 min-h-20" value={context.symptoms} onChange={(event) => onChange({ ...context, symptoms: event.target.value })} placeholder="Optional note in your own words" /></label>
    </div>
    <PrimaryButton className="mt-5" type="submit"><Check size={16} aria-hidden="true" />See observation summary</PrimaryButton>
  </form>;
}

function ResultStep({ check, onRepeat, repository, onSavedToBody, onRequestCrewMedic }: { check: VisualCheck; onRepeat: () => void; repository: VisualCheckRepository; onSavedToBody?: (check: VisualCheck) => void; onRequestCrewMedic?: () => void }) {
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; reason?: string }>({ state: "idle" });
  const note = combinedContextNote(check.userReportedSymptoms, check.comparisonSummary);
  const movementStatus = movementStatusFor(check.observedFeatures, check.userReportedSymptoms);
  const saveCloud = async () => {
    setSave({ state: "saving" });
    const outcome = await repository.saveCloud(check);
    if (outcome.ok) {
      setSave({ state: "saved" });
      onSavedToBody?.(check);
    } else setSave({ state: "failed", reason: outcome.reason });
  };
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className={panelClass} aria-labelledby="result-title">
      <div className="flex flex-wrap items-center gap-2"><h2 id="result-title" className="text-xl font-semibold text-white">Observation summary</h2>{check.isSynthetic ? <span className="rounded-full border border-purple-300/40 bg-purple-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-100">Synthetic demo result</span> : null}</div>
      <div className="movement-status-box" data-status={movementStatus.status} role={movementStatus.status === "stop_and_check_in" ? "alert" : "status"} aria-live="polite">
        <div>
          <span className="movement-status-label">Movement status</span>
          <h3>{movementStatus.title}</h3>
          <p>{movementStatus.reason}</p>
        </div>
        {movementStatus.status === "complete" ? <PrimaryButton disabled={save.state === "saving" || save.state === "saved"} onClick={() => void saveCloud()}>{save.state === "saving" ? "Saving…" : save.state === "saved" ? "Saved to cloud" : onSavedToBody ? "Save and show on body" : "Save summary to cloud"}</PrimaryButton> : null}
        {movementStatus.status === "limited_capture" ? <SecondaryButton onClick={onRepeat}><RotateCcw size={16} aria-hidden="true" />{movementStatus.actionLabel}</SecondaryButton> : null}
        {movementStatus.status === "stop_and_check_in" && onRequestCrewMedic ? <SecondaryButton onClick={onRequestCrewMedic}>{movementStatus.actionLabel}</SecondaryButton> : null}
      </div>
      <ul className="mt-4 space-y-2 text-slate-200">{check.observationSummary.map((line) => <li key={line} className="flex gap-2"><Check className="mt-1 shrink-0 text-cyan-200" size={16} aria-hidden="true" />{line}</li>)}</ul>
      <h3 className="mt-6 font-semibold text-white">Compared with your own practice</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-300">{check.comparisonSummary.statements.map((line) => <li key={line}>{line}</li>)}</ul>
      {check.comparisonSummary.priorSessionsUsed ? <p className="mt-2 text-xs text-slate-500">Based on your last {check.comparisonSummary.priorSessionsUsed} session{check.comparisonSummary.priorSessionsUsed === 1 ? "" : "s"} of this task.</p> : null}
      {note ? <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{note}</p> : null}
      {movementStatus.status !== "stop_and_check_in" ? <p className="mt-4 text-sm text-slate-300">{check.supportRecommendation}</p> : null}
      <p className="mt-4 text-xs text-slate-500">{check.disclaimer}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <SecondaryButton onClick={onRepeat}><RotateCcw size={16} aria-hidden="true" />Practise again</SecondaryButton>
      </div>
      <p className="mt-3 text-xs" role="status">{save.state === "saved" ? <span className="text-emerald-200">Saved. Only the derived summary was stored — no video or images.</span> : save.state === "failed" ? <span className="text-rose-100">Not saved to cloud: {save.reason} The result remains on this device.</span> : <span className="text-slate-500">Saved on this device. Cloud save stores the derived summary only.</span>}</p>
    </section>
    <CrewSummaryComposer check={check} />
  </div>;
}

function CrewSummaryComposer({ check }: { check: VisualCheck }) {
  const [fields, setFields] = useState<CrewSummaryFields>({ task: true, symptoms: true, comparison: true, cameraLimits: true, context: false });
  const [copied, setCopied] = useState(false);
  const text = composeCrewSummary(check, fields);
  const toggle = (key: keyof CrewSummaryFields) => { setFields((current) => ({ ...current, [key]: !current[key] })); setCopied(false); };
  const labels: Record<keyof CrewSummaryFields, string> = { task: "Task performed", symptoms: "Comfort and note", comparison: "Change from my baseline", cameraLimits: "Camera limitations", context: "Movement context" };
  return <section className={panelClass} aria-labelledby="crew-summary-title">
    <div className="flex items-start gap-3"><ClipboardList className="mt-1 shrink-0 text-cyan-200" aria-hidden="true" /><div>
      <h2 id="crew-summary-title" className="text-xl font-semibold text-white">Crew medic summary</h2>
      <p className="mt-2 text-sm text-slate-400">Choose what to include. Nothing is sent automatically — you decide whether to share it.</p>
    </div></div>
    <fieldset className="mt-4 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Summary fields</legend>{(Object.keys(labels) as Array<keyof CrewSummaryFields>).map((key) => <label key={key} className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="size-4" checked={fields[key]} onChange={() => toggle(key)} />{labels[key]}</label>)}</fieldset>
    <pre aria-label="Crew medic summary preview" className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-[#293d59] bg-[#080d21] p-4 font-mono text-xs leading-5 text-slate-200">{text}</pre>
    <SecondaryButton className="mt-4" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false)); }}><Copy size={16} aria-hidden="true" />{copied ? "Copied" : "Copy summary"}</SecondaryButton>
  </section>;
}

function HistoryPanel({ history }: { history: VisualCheck[] }) {
  if (!history.length) return null;
  return <section className={`${panelClass} max-w-3xl`} aria-labelledby="history-title">
    <div className="flex items-center gap-2"><ShieldCheck className="text-cyan-200" size={18} aria-hidden="true" /><h2 id="history-title" className="text-lg font-semibold text-white">Your practice history</h2></div>
    <p className="mt-1 text-xs text-slate-500">Only your own sessions in this stage and profile. Stored on this device.</p>
    <ul className="mt-3">{history.slice(-6).reverse().map((check) => <li key={check.checkId} className="stream-row flex flex-wrap justify-between gap-2"><span>{new Date(check.startedAt).toLocaleString()} · {taskFor(check.checkType).label}{check.isSynthetic ? " · synthetic" : ""}</span><span>{check.observedFeatures.repetitionCount !== undefined ? `${check.observedFeatures.repetitionCount} reps · ` : ""}{Math.round(check.duration)} s · {check.comparisonSummary.trend.replace("_", " ")}</span></li>)}</ul>
  </section>;
}

function ModeOption({ checked, disabled, onChange, icon, label, hint }: { checked: boolean; disabled?: boolean; onChange: () => void; icon: ReactNode; label: string; hint?: string }) {
  return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-cyan-400/70 bg-cyan-400/15" : "border-[#293d59]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}><input type="radio" name="visual-mode" checked={checked} disabled={disabled} onChange={onChange} /><span className="min-w-0"><span className="flex items-center gap-2 font-semibold text-white">{icon}{label}</span>{hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}</span></label>;
}

function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`btn-square inline-flex items-center gap-2 bg-[#55e0f4] px-4 py-2.5 text-sm font-semibold text-[#080d21] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}</button>;
}
function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`btn-square inline-flex items-center gap-2 border border-[#526783] px-4 py-2.5 text-sm font-semibold text-[#f4f7ff] ${className}`}>{children}</button>;
}
