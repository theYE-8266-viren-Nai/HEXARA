import { useEffect, useMemo, useState } from "react";
import { AppShell, viewAvailable, type ViewName } from "./components/AppShell";
import { GuidanceView, HomeView, ProfileView, StageSelectionView, TrendsView, WellbeingView } from "./components/WorkspaceViews";
import { createHorizonRepository } from "./data/repository";
import { createBackendDashboardRepository, type DashboardSource } from "./lib/backendDashboardRepository";
import { mockDashboardRepository } from "./lib/mockDashboardRepository";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { usePersistedState } from "./lib/usePersistedState";
import type { DashboardSnapshot } from "./lib/dashboardRepository";
import { fetchRecentSolarEvents, type SolarEventResult } from "./lib/nasaDonki";
import type { DataQualityState, LifeStage, SimulationScenario } from "./types/horizon";
import { ensureAnonymousSession } from "./lib/anonymousAuth";
import { createAccountRepository, type Account } from "./lib/accountRepository";
import { AccountScreen } from "./components/AccountViews";
import { missionDayFrom, type AstronautProfile } from "./domain/astronautAccount";
import { createPreparationRepository } from "./lib/preparationRepository";
import { VisualCheckView } from "./components/VisualCheckView";
import { createVisualCheckRepository } from "./lib/visualCheckRepository";
import { ownerKeyFor, type VisualCheck, type VisualCheckType } from "./domain/visualCheck";
import { primaryMovementRegion, type MovementBodyRegionId } from "./domain/movementBody";
import { ThemeProvider } from "./lib/theme";
import { DeviceContext } from "./lib/deviceContext";
import { useDeviceStream } from "./lib/useDeviceStream";
import { useBluetoothHeartRate } from "./lib/useBluetoothHeartRate";
import { useWebhookSource } from "./lib/useWebhookSource";
import { useAssessment } from "./lib/useAssessment";
import { analyzeLiveReadings } from "./lib/liveAnalysis";
import { hasCompletedDay } from "./lib/dayCoverage";
import { PatternCard } from "./components/PatternCard";
import { createExplainRepository } from "./lib/explainRepository";
import { buildExplainRequest } from "./domain/explainTypes";


export default function App() {
  return <ThemeProvider><HorizonApp /></ThemeProvider>;
}

function HorizonApp() {
  const mockProfiles = mockDashboardRepository.getProfiles();
  const [profiles, setProfiles] = useState(mockProfiles);
  const [activeView, setActiveView] = useState<ViewName>("home");
  const [stage, setStage] = useState<LifeStage | null>(null);
  const accounts = useMemo(() => createAccountRepository(supabase), []);
  const [account, setAccount] = useState<Account | null>(null);
  // The stage card the person clicked; its log in / create account screen shows until they are in.
  const [accountStage, setAccountStage] = useState<LifeStage | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState<string | undefined>();
  const [scenario, setScenario] = usePersistedState<SimulationScenario>("horizon:scenario", "usual");
  const [seed, setSeed] = usePersistedState<number>("horizon:seed", 42);
  const [replayCount, setReplayCount] = usePersistedState<number>("horizon:replay-count", 0);
  const [profileId, setProfileId] = usePersistedState("horizon:profile", profiles[0].id);
  // Pairing lasts for this visit only: the wearable never connects until the person presses "Pair".
  const [devicePaired, setDevicePaired] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendSnapshot, setBackendSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dataSource, setDataSource] = useState<DashboardSource>("local");
  const [dataWarning, setDataWarning] = useState<string | undefined>();
  const [backendQuality, setBackendQuality] = useState<DataQualityState>("current");
  const [solarEvents, setSolarEvents] = useState<SolarEventResult | null>(null);

  const profile = profiles.find((candidate) => candidate.id === profileId) ?? profiles[0];
  const preparationRepository = useMemo(() => createPreparationRepository(supabase, userId), [userId]);
  const visualCheckRepository = useMemo(() => createVisualCheckRepository(supabase, userId), [userId]);
  const [movementChecks, setMovementChecks] = useState<VisualCheck[]>([]);
  const [movementHistoryWarning, setMovementHistoryWarning] = useState<string | undefined>();
  const [movementLaunch, setMovementLaunch] = useState<{ task: VisualCheckType; nonce: number } | null>(null);
  const [bodyFocus, setBodyFocus] = useState<{ region: MovementBodyRegionId; nonce: number } | null>(null);
  const mockDashboard = useMemo(() => mockDashboardRepository.getSnapshot(scenario, { seed, replayCount }), [scenario, seed, replayCount]);
  const dashboard = scenario === "usual" && backendSnapshot ? backendSnapshot : mockDashboard;
  const dataQuality = scenario === "usual" ? backendQuality : scenario === "sensor_disconnected" ? "disconnected" : scenario === "offline" ? "offline" : scenario === "stale" ? "stale" : "current";
  const device = useDeviceStream({ enabled: stage !== null && devicePaired, personKey: `${stage ?? "none"}:${profile.id}`, scenario, seed, baseMetrics: dashboard.metrics, history: scenario === "usual" ? backendSnapshot?.history : undefined });
  // An optional Bluetooth heart-rate device replaces only the heart-rate and HRV cards; everything else stays simulated.
  const bluetooth = useBluetoothHeartRate(dashboard.metrics);
  const webhook = useWebhookSource(dashboard.metrics); // priority for the cards below: Bluetooth, then webhook, then the simulated wearable
  const liveMetrics = useMemo(() => device.metrics.map((metric) => (metric.metric === "resting_hr" || metric.metric === "hrv" ? bluetooth.cards[metric.metric] : undefined) ?? webhook.cards[metric.metric] ?? metric), [device.metrics, bluetooth.cards, webhook.cards]);
  const liveIngest = bluetooth.ready && bluetooth.ingest ? bluetooth.ingest : webhook.ready && webhook.ingest ? webhook.ingest : device.ingest;
  // The wearable's own cleaned readings decide the alert when history allows it; poor-quality data never alerts.
  // Demo scenarios have no stored history, so the scenario still supplies their alert.
  // A webhook that has delivered a well-covered completed day is analyzed itself, with the same 30-day baseline and rules.
  // Only completed days count and poor-quality data never alerts; the open day is display-only.
  const webhookActive = webhook.ready && !bluetooth.ready;
  const webhookHistory = scenario === "usual" ? backendSnapshot?.history : undefined;
  const webhookScored = webhookActive && Boolean(webhook.completed) && Boolean(webhookHistory?.length) && hasCompletedDay(webhook.completed!.readings);
  const webhookAlert = useMemo(() => (webhookScored && webhookHistory ? analyzeLiveReadings(webhookHistory, webhook.completed!.readings) : null), [webhookScored, webhookHistory, webhook.completed]);
  const liveAlert = liveIngest?.quality === "poor" ? null : webhookAlert ?? (device.alert !== undefined ? device.alert : dashboard.alert);
  const alertBasis = webhookScored ? "webhook" as const : device.alert !== undefined ? "device" as const : "scenario" as const;
  // Pattern context (adds to alerts, never changes them): completed days only, from the source in use.
  const pattern = useAssessment({ history: scenario === "usual" ? backendSnapshot?.history : undefined, scenario, seed, personId: profile.id, dataQuality, ingestQuality: liveIngest?.quality, webhook: webhook.completed, webhookActive });
  const explainRepository = useMemo(() => createExplainRepository(supabase), []);
  const explain = useMemo(() => ({ request: buildExplainRequest(pattern, { stage: stage ?? "active", ingestQuality: liveIngest?.quality, source: bluetooth.ready ? "bluetooth" as const : webhook.ready ? "api" as const : "simulated" as const }), run: explainRepository.explain }), [pattern, stage, liveIngest?.quality, bluetooth.ready, webhook.ready, explainRepository]);
  const deviceStatus = useMemo(() => ({
    ...device.status,
    hasPaired: devicePaired,
    pair: () => { setDevicePaired(true); device.status.pair(); },
    reconnect: () => { setDevicePaired(true); device.status.reconnect(); },
  }), [device.status, devicePaired]);
  const bluetoothControls = useMemo(() => ({
    phase: bluetooth.phase, message: bluetooth.message, deviceName: bluetooth.deviceName, ready: bluetooth.ready,
    // Connecting a heart-rate device also pairs the simulated wearable that supplies the other signals.
    connect: async () => { const ok = await bluetooth.connect(); if (ok && deviceStatus.phase === "idle") deviceStatus.pair(); return ok; },
    disconnect: bluetooth.disconnect,
  }), [bluetooth.phase, bluetooth.message, bluetooth.deviceName, bluetooth.ready, bluetooth.connect, bluetooth.disconnect, deviceStatus]);
  const viewSource = scenario === "usual" ? dataSource : "local";
  const viewWarning = scenario === "usual" ? dataWarning : undefined;
  const viewLoading = device.status.connecting || (scenario === "usual" && backendLoading);
  const backendRepository = useMemo(() => createBackendDashboardRepository(
    createHorizonRepository(supabaseConfigured && seed === 42 ? supabase : null, seed),
  ), [seed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const auth = await ensureAnonymousSession(supabase);
      if (cancelled) return;
      setUserId(auth.userId);
      // A signed-in astronaut is remembered, but the start page still shows first (with "Continue").
      const existing = await accounts.current();
      if (cancelled) return;
      setAccount(existing);
      setCloudWarning(auth.warning);
      if (auth.userId) {
        // The saved stage is kept in the cloud, but every visit starts on the stage picker.
        const preference = await createPreparationRepository(supabase, auth.userId).getTravelerPreferences();
        if (!cancelled && preference.data) setProfileId(preference.data.profileId);
        if (!cancelled) setCloudWarning(auth.warning ?? preference.warning);
      }
      setAuthLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accounts, setProfileId]);

  useEffect(() => {
    let cancelled = false;
    if (!stage || stage === "future") {
      setMovementChecks([]);
      setMovementHistoryWarning(undefined);
      return;
    }
    void visualCheckRepository.listCloud(ownerKeyFor(stage, profile.id)).then((result) => {
      if (cancelled) return;
      setMovementChecks(result.data);
      setMovementHistoryWarning(result.warning);
    });
    return () => { cancelled = true; };
  }, [profile.id, stage, visualCheckRepository]);

  const setStageAndProfile = (nextStage: LifeStage) => {
    const matchingProfile = profiles.find((candidate) => candidate.stage === nextStage) ?? profiles[0];
    void preparationRepository.saveTravelerPreferences(nextStage, matchingProfile.id).then((result) => {
      if (result.warning) setCloudWarning(result.warning); else setCloudWarning(undefined);
      setStage(nextStage);
      setProfileId(matchingProfile.id);
    });
  };

  const enterAccount = (next: Account) => {
    setAccount(next);
    setUserId(next.userId);
    if (!next.profile) return; // the account screen asks for the profile details first
    const matchingProfile = profiles.find((candidate) => candidate.stage === next.profile!.stage) ?? profiles[0];
    setProfileId(matchingProfile.id);
    void preparationRepository.saveTravelerPreferences(next.profile.stage, matchingProfile.id);
    setAccountStage(null);
    setStage(next.profile.stage);
    setActiveView("home");
  };
  const logOut = async () => {
    await accounts.signOut();
    setAccount(null);
    setStage(null);
    setAccountStage(null);
    setDevicePaired(false);
    setActiveView("home");
    const auth = await ensureAnonymousSession(supabase);
    setUserId(auth.userId);
  };
  const saveOwnProfile = async (next: AstronautProfile) => {
    if (!account) return "You are not logged in.";
    const result = await accounts.saveProfile(account, next);
    if (!result.account) return result.error ?? "Not saved.";
    setAccount(result.account);
    if (result.account.profile && result.account.profile.stage !== stage) {
      const matchingProfile = profiles.find((candidate) => candidate.stage === result.account!.profile!.stage) ?? profiles[0];
      setProfileId(matchingProfile.id);
      setStage(result.account.profile.stage);
    }
    return undefined;
  };

  useEffect(() => {
    let cancelled = false;
    void fetchRecentSolarEvents().then((result) => { if (!cancelled) setSolarEvents(result); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scenario !== "usual") {
      setBackendLoading(false);
      return;
    }
    let cancelled = false;
    setBackendLoading(true);
    void (async () => {
      try {
        const profileResult = await backendRepository.loadProfiles();
        if (cancelled) return;
        const backendProfiles = profileResult.data;
        // Backend travelers are all "active"; keep demo profiles so Future and Retired have their own person.
        const nextProfiles = backendProfiles.length ? [...backendProfiles, ...mockProfiles.filter((demo) => !backendProfiles.some((person) => person.stage === demo.stage))] : mockProfiles;
        const nextProfileId = nextProfiles.some((candidate) => candidate.id === profileId) ? profileId : nextProfiles[0].id;
        setProfiles(nextProfiles);
        if (nextProfileId !== profileId) setProfileId(nextProfileId);
        if (!backendProfiles.some((person) => person.id === nextProfileId)) {
          // Demo-only profile (e.g. Future): use the deterministic local snapshot, not an empty backend lookup.
          setBackendSnapshot(null);
          setDataSource("local");
          setDataWarning(undefined);
          setBackendQuality("current");
          return;
        }
        const snapshotResult = await backendRepository.loadSnapshot(nextProfileId, { seed, replayCount });
        if (cancelled) return;
        setBackendSnapshot(snapshotResult.data);
        setDataSource(snapshotResult.source);
        setDataWarning([profileResult.warning, snapshotResult.warning].filter(Boolean).join(" ") || undefined);
        setBackendQuality(snapshotResult.quality ?? "current");
      } catch {
        if (!cancelled) {
          setDataSource("local");
          setDataWarning("Backend data could not be loaded; using deterministic synthetic fallback.");
          setBackendQuality("current");
        }
      } finally {
        if (!cancelled) setBackendLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [backendRepository, mockProfiles, profileId, replayCount, scenario, seed, setProfileId]);

  const replayEvents = () => setReplayCount((count) => count + 1);
  const openMovementFromBody = (task: VisualCheckType) => {
    setMovementLaunch({ task, nonce: Date.now() });
    setActiveView("movement");
  };
  const showSavedMovementOnBody = (check: VisualCheck) => {
    setMovementChecks((current) => [check, ...current.filter((item) => item.checkId !== check.checkId)]);
    setMovementHistoryWarning(undefined);
    setMovementLaunch(null);
    setBodyFocus({ region: primaryMovementRegion(check.checkType), nonce: Date.now() });
    setActiveView("home");
  };
  const changeView = (next: ViewName) => {
    if (next !== "movement") setMovementLaunch(null);
    setActiveView(next);
  };

  if (authLoading) return <StageSelectionView loading />;
  if (accountStage) return <AccountScreen stage={accountStage} repository={accounts} account={account} onDone={enterAccount} onBack={() => setAccountStage(null)} onLogOut={() => { void accounts.signOut().then(() => setAccount(null)); }} />;
  if (!stage || !account?.profile) return <StageSelectionView warning={cloudWarning} onSelect={setAccountStage} />;
  // The astronaut's own name and mission day replace the sample traveler's on every page.
  const ownProfile = account?.profile && account.profile.stage === stage ? account.profile : null;
  const shownProfile = ownProfile ? { ...profile, name: ownProfile.fullName, missionDay: missionDayFrom(ownProfile.journey.launchDate) ?? profile.missionDay } : profile;

  // A view that is not offered to this stage (Movement for Future travelers) falls back to Home.
  const view: ViewName = viewAvailable(activeView, stage) ? activeView : "home";
  const content = (() => {
    switch (view) {
      case "trends":
        return <TrendsView stage={stage} metrics={liveMetrics} alert={liveAlert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} pattern={<PatternCard view={pattern} explain={explain} />} />;
      case "movement":
        return <VisualCheckView key={`${stage}:${profile.id}:${movementLaunch?.nonce ?? "nav"}`} stage={stage} profileId={profile.id} repository={visualCheckRepository} seed={seed} initialTask={movementLaunch?.task} onSavedToBody={showSavedMovementOnBody} onRequestCrewMedic={() => setActiveView("wellbeing")} />;
      case "wellbeing":
        return <WellbeingView stage={stage} client={supabase} />;
      case "guidance":
        return <GuidanceView stage={stage} preparationRepository={preparationRepository} onViewChange={changeView} />;
      case "profile":
        return <ProfileView profile={shownProfile} profiles={profiles} stage={stage} scenario={scenario} seed={seed} replayCount={replayCount} loading={viewLoading} onProfileChange={setProfileId} onScenarioChange={setScenario} onSeedChange={setSeed} onReplay={replayEvents} onStageChange={setStageAndProfile} account={ownProfile ? account : null} onSaveProfile={saveOwnProfile} />;
      case "home":
      default:
        return <><HomeView profile={shownProfile} stage={stage} scenario={scenario} metrics={liveMetrics} alert={liveAlert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} solarEvents={solarEvents} movementChecks={movementChecks} movementWarning={movementHistoryWarning} bodyFocus={bodyFocus} onBodyFocusHandled={() => setBodyFocus(null)} onStartMovement={openMovementFromBody} onViewChange={changeView} pattern={<PatternCard view={pattern} explain={explain} />} /></>;
    }
  })();

  return <DeviceContext.Provider value={{ status: deviceStatus, metrics: liveMetrics, ingest: liveIngest, alertBasis, bluetooth: bluetoothControls, webhook }}><AppShell activeView={view} onViewChange={changeView} stage={stage} onStageChange={setStageAndProfile} account={account} onLogOut={() => void logOut()} chat={{ client: supabase, userId }}>{content}</AppShell></DeviceContext.Provider>;
}
