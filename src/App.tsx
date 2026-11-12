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
  const device = useDeviceStream({ enabled: stage !== null && (stage !== "future" || futurePaired), personKey: `${stage ?? "none"}:${profile.id}`, scenario, seed, baseMetrics: dashboard.metrics });
  const deviceStatus = useMemo(() => ({
    ...device.status,
    pair: () => { if (stage === "future") setFutureDevicePaired(true); device.status.pair(); },
    disconnect: () => { if (stage === "future") setFutureDevicePaired(false); device.status.disconnect(); },
  }), [device.status, stage, setFutureDevicePaired]);
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
        return <TrendsView stage={stage} metrics={device.metrics} alert={dashboard.alert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} />;
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
        return <HomeView profile={profile} stage={stage} scenario={scenario} metrics={device.metrics} alert={dashboard.alert} dataQuality={dataQuality} loading={viewLoading} source={viewSource} warning={viewWarning} solarEvents={solarEvents} onViewChange={setActiveView} />;
    }
  })();

  return <DeviceContext.Provider value={{ status: deviceStatus, metrics: device.metrics }}><AppShell activeView={activeView} onViewChange={setActiveView} stage={stage} onStageChange={setStageAndProfile}>{content}</AppShell></DeviceContext.Provider>;
}
