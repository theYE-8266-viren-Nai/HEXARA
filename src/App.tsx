import { useEffect, useMemo, useState } from "react";
import { AppShell, type ViewName } from "./components/AppShell";
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
import { createPreparationRepository } from "./lib/preparationRepository";
import { VisualCheckView } from "./components/VisualCheckView";
import { createVisualCheckRepository } from "./lib/visualCheckRepository";
import { ThemeProvider } from "./lib/theme";
import { DeviceContext } from "./lib/deviceContext";
import { useDeviceStream } from "./lib/useDeviceStream";
import { useBluetoothHeartRate } from "./lib/useBluetoothHeartRate";
import { useWebhookSource } from "./lib/useWebhookSource";
import { useAssessment } from "./lib/useAssessment";
import { PatternCard } from "./components/PatternCard";

export default function App() {
  return <ThemeProvider><HorizonApp /></ThemeProvider>;
}

function HorizonApp() {
  const mockProfiles = mockDashboardRepository.getProfiles();
  const [profiles, setProfiles] = useState(mockProfiles);
  const [activeView, setActiveView] = useState<ViewName>("home");
  const [stage, setStage] = useState<LifeStage | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState<string | undefined>();
  const [scenario, setScenario] = usePersistedState<SimulationScenario>("horizon:scenario", "usual");
  const [seed, setSeed] = usePersistedState<number>("horizon:seed", 42);
  const [replayCount, setReplayCount] = usePersistedState<number>("horizon:replay-count", 0);
  const [profileId, setProfileId] = usePersistedState("horizon:profile", profiles[0].id);
  const [checkIn, setCheckIn] = usePersistedState("horizon:wellbeing", { mood: "", stress: "", sleepQuality: "", note: "" });
  const [privacy, setPrivacy] = usePersistedState("horizon:privacy", { mood: true, notes: false, trends: true });
  const [futureDevicePaired, setFutureDevicePaired] = usePersistedState<boolean>("horizon:device-paired", false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendSnapshot, setBackendSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dataSource, setDataSource] = useState<DashboardSource>("local");
  const [dataWarning, setDataWarning] = useState<string | undefined>();
  const [backendQuality, setBackendQuality] = useState<DataQualityState>("current");
  const [solarEvents, setSolarEvents] = useState<SolarEventResult | null>(null);

  const profile = profiles.find((candidate) => candidate.id === profileId) ?? profiles[0];
  const preparationRepository = useMemo(() => createPreparationRepository(supabase, userId), [userId]);
  const visualCheckRepository = useMemo(() => createVisualCheckRepository(supabase, userId), [userId]);
  const mockDashboard = useMemo(() => mockDashboardRepository.getSnapshot(scenario, { seed, replayCount }), [scenario, seed, replayCount]);
  const dashboard = scenario === "usual" && backendSnapshot ? backendSnapshot : mockDashboard;
  const dataQuality = scenario === "usual" ? backendQuality : scenario === "sensor_disconnected" ? "disconnected" : scenario === "offline" ? "offline" : scenario === "stale" ? "stale" : "current";
  const futurePaired = futureDevicePaired;
  const device = useDeviceStream({ enabled: stage !== null && (stage !== "future" || futurePaired), personKey: `${stage ?? "none"}:${profile.id}`, scenario, seed, baseMetrics: dashboard.metrics, history: scenario === "usual" ? backendSnapshot?.history : undefined });
  // An optional Bluetooth heart-rate device replaces only the heart-rate and HRV cards; everything else stays simulated.
  const bluetooth = useBluetoothHeartRate(dashboard.metrics);
  const webhook = useWebhookSource(dashboard.metrics); // priority for the cards below: Bluetooth, then webhook, then the simulated wearable
  const liveMetrics = useMemo(() => device.metrics.map((metric) => (metric.metric === "resting_hr" || metric.metric === "hrv" ? bluetooth.cards[metric.metric] : undefined) ?? webhook.cards[metric.metric] ?? metric), [device.metrics, bluetooth.cards, webhook.cards]);
  const liveIngest = bluetooth.ready && bluetooth.ingest ? bluetooth.ingest : webhook.ready && webhook.ingest ? webhook.ingest : device.ingest;
  // The wearable's own cleaned readings decide the alert when history allows it; poor-quality data never alerts.
  // Demo scenarios have no stored history, so the scenario still supplies their alert.
  const liveAlert = liveIngest?.quality === "poor" ? null : device.alert !== undefined ? device.alert : dashboard.alert;
  const alertBasis = device.alert !== undefined ? "device" as const : "scenario" as const;
  // Pattern context (adds to alerts, never changes them): completed days only, from the source in use.
  const pattern = useAssessment({ history: scenario === "usual" ? backendSnapshot?.history : undefined, scenario, seed, personId: profile.id, dataQuality, ingestQuality: liveIngest?.quality, webhook: webhook.completed, webhookActive: webhook.ready && !bluetooth.ready });
  const deviceStatus = useMemo(() => ({
    ...device.status,
    pair: () => { if (stage === "future") setFutureDevicePaired(true); device.status.pair(); },
    disconnect: () => { if (stage === "future") setFutureDevicePaired(false); device.status.disconnect(); },
  }), [device.status, stage, setFutureDevicePaired]);
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
      setCloudWarning(auth.warning);
      if (auth.userId) {
        const preference = await createPreparationRepository(supabase, auth.userId).getTravelerPreferences();
        if (!cancelled && preference.data) {
          setStage(preference.data.stage);
          setProfileId(preference.data.profileId);
        }
        if (!cancelled) setCloudWarning(auth.warning ?? preference.warning);
      }
      setAuthLoading(false);
    })();
    return () => { cancelled = true; };
  }, [setProfileId]);

  const setStageAndProfile = (nextStage: LifeStage) => {
    const matchingProfile = profiles.find((candidate) => candidate.stage === nextStage) ?? profiles[0];
    void preparationRepository.saveTravelerPreferences(nextStage, matchingProfile.id).then((result) => {
      if (result.warning) setCloudWarning(result.warning); else setCloudWarning(undefined);
      setStage(nextStage);
      setProfileId(matchingProfile.id);
    });
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

  if (authLoading) return <StageSelectionView loading />;
  if (!stage) return <StageSelectionView warning={cloudWarning} onSelect={setStageAndProfile} />;

  const content = (() => {
    switch (activeView) {
      case "trends":
        return <><PatternCard view={pattern} /><TrendsView stage={stage} metrics={liveMetrics} alert={liveAlert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} /></>;
      case "movement":
        return <VisualCheckView key={`${stage}:${profile.id}`} stage={stage} profileId={profile.id} repository={visualCheckRepository} seed={seed} onRequestCrewMedic={() => setActiveView("wellbeing")} />;
      case "wellbeing":
        return <WellbeingView checkIn={checkIn} onCheckInChange={setCheckIn} privacy={privacy} onPrivacyChange={setPrivacy} />;
      case "guidance":
        return <GuidanceView stage={stage} preparationRepository={preparationRepository} />;
      case "profile":
        return <ProfileView profile={profile} profiles={profiles} stage={stage} scenario={scenario} seed={seed} replayCount={replayCount} loading={viewLoading} onProfileChange={setProfileId} onScenarioChange={setScenario} onSeedChange={setSeed} onReplay={replayEvents} onStageChange={setStageAndProfile} />;
      case "home":
      default:
        return <><HomeView profile={profile} stage={stage} scenario={scenario} metrics={liveMetrics} alert={liveAlert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} solarEvents={solarEvents} onViewChange={setActiveView} /><PatternCard view={pattern} /></>;
    }
  })();

  return <DeviceContext.Provider value={{ status: deviceStatus, metrics: liveMetrics, ingest: liveIngest, alertBasis, bluetooth: bluetoothControls, webhook }}><AppShell activeView={activeView} onViewChange={setActiveView} stage={stage} onStageChange={setStageAndProfile}>{content}</AppShell></DeviceContext.Provider>;
}
