export type LifeStage = "future" | "active" | "retired";
export type MetricName = "resting_hr" | "hrv" | "spo2" | "sleep_hours" | "core_temperature" | "radiation_dose";
export type SimulationScenario = "usual" | "recovery_concern" | "sensor_disconnected" | "stale" | "offline";
export type DataQualityState = "current" | "stale" | "disconnected" | "offline" | "insufficient_baseline";
export type AlertSeverity = "normal" | "watch" | "talk_to_crew_medic";
export interface SimulationControls { seed: number; replayCount: number; }

export interface MetricPoint { day: string; value: number; baseline: number; alert?: boolean; }
export interface MetricCardData { metric: MetricName; label: string; unit: string; value: number; baseline: number; trend: "up" | "down" | "steady"; plainLanguage: string; source: string; quality: string; aggregationPeriod: string; points: MetricPoint[]; }
export interface Alert { id: string; severity: AlertSeverity; metric: MetricName; reason: string; nextAction: string; }
export interface TravelerProfile { id: string; name: string; role: string; missionDay: number; stage: LifeStage; }

export interface TravelerPreferences { userId: string; stage: LifeStage; profileId: string; }
export interface BaselineCheckIn { id?: string; checkInDate: string; restingHeartRate?: number; sleepHours?: number; sleepQuality?: string; mood?: number; stress?: number; exerciseCompleted: boolean; note: string; }
export type PreparationSessionType = "fitness" | "breathing" | "grounding" | "reflection";
export type PreparationSessionStatus = "completed" | "skipped" | "saved";
export interface PreparationSession { id?: string; sessionId: string; type: PreparationSessionType; status: PreparationSessionStatus; completedAt?: string; }
export interface AdaptationDayProgress { day: number; completed: boolean; experienceNote: string; }
export interface PrivacyPreferences { mood: boolean; notes: boolean; trends: boolean; }
export type StageSelectionState = "loading" | "needs-selection" | "ready" | "unavailable";
export type CloudPersistenceState = "loading" | "saved" | "saving" | "unavailable" | "error";
