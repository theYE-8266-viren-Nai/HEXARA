export type LifeStage = 'future' | 'active' | 'retired';
export const metricUnits = {
  heart_rate: 'bpm', hrv: 'ms', sleep_hours: 'h',
  skin_temperature: 'degC', spo2: '%', radiation_dose: 'mSv',
} as const;
export type MetricName = keyof typeof metricUnits;
export interface Traveler {
  id: string; name: string; life_stage: LifeStage; mission_day: number; is_synthetic: true;
}
export type Observation = {
  [M in MetricName]: {
    id: string; person_id: string; observed_on: string; metric: M; value: number;
    unit: typeof metricUnits[M]; context: 'rest' | 'exercise'; seed: number; is_synthetic: true;
  }
}[MetricName];
export interface DemoEvent {
  id: string; person_id: string; kind: 'radiation_spike' | 'illness_like' | 'sleep_disruption';
  starts_on: string; ends_on: string; description: string; seed: number; is_synthetic: true;
}
export type SimulationScenario = 'usual' | 'recovery-concern' | 'sensor-disconnected' | 'stale' | 'offline';
export type DataQualityState = 'ready' | 'insufficient-baseline' | 'stale-data' | 'missing-data' | 'offline';
export interface SimulationControls { seed: number; replayCount: number; scenario?: SimulationScenario }
export interface Alert {
  id: string; person_id: string; metric: MetricName; observed_on: string;
  rule: 'single-reading' | 'sustained-shift'; severity: 'caution'; explanation: string;
}
export interface DemoDataset { people: Traveler[]; observations: Observation[]; events: DemoEvent[] }
export interface RepositoryResult<T> {
  data: T; source: 'supabase' | 'local'; warning?: string;
  quality?: DataQualityState;
}
export interface ObservationQueryOptions { from?: string; to?: string; controls?: SimulationControls }
export interface HorizonRepository {
  listPeople(): Promise<RepositoryResult<Traveler[]>>;
  listObservations(personId: string, options?: ObservationQueryOptions): Promise<RepositoryResult<Observation[]>>;
  listEvents(personId: string, options?: { controls?: SimulationControls }): Promise<RepositoryResult<DemoEvent[]>>;
}
