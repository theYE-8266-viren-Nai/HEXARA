import type { LifeStage, MetricCardData, MetricName } from "../types/horizon";

export type CrewSituation = "urgent" | "review" | "usual" | "data_gap";
export type AssignmentState = "onboard" | "assigned" | "returned";

export interface GroundCrewMember {
  id: string;
  name: string;
  callSign: string;
  role: string;
  stage: LifeStage;
  assignment: AssignmentState;
  situation: CrewSituation;
  summary: string;
  reportedConcern?: string;
  heartRate?: number;
  oxygen?: number;
  sleepHours?: number;
  dataQuality: "sample" | "missing";
}

export interface GroundMission {
  id: string;
  name: string;
  destination: string;
  state: "ongoing" | "planned" | "completed";
  startsOn: string;
  endsOn: string;
  crew: GroundCrewMember[];
}

const dayFrom = (today: Date, offset: number) => {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
  return date.toISOString().slice(0, 10);
};

/** Fixed, invented people and situations. Dates stay relative to the demo day so the training view remains usable. */
export function syntheticGroundMissions(today = new Date()): GroundMission[] {
  return [
    {
      id: "aurora", name: "Aurora Station Rotation", destination: "Orbital station", state: "ongoing",
      startsOn: dayFrom(today, -64), endsOn: dayFrom(today, 110),
      crew: [
        { id: "nia", name: "Nia Brooks", callSign: "NOVA", role: "Flight engineer", stage: "active", assignment: "onboard", situation: "urgent", summary: "Crew-reported concern needs immediate human review.", reportedConcern: "Crew member reports severe breathing difficulty in this synthetic scenario.", heartRate: 108, oxygen: 93, sleepHours: 5.1, dataQuality: "sample" },
        { id: "aiden", name: "Aiden Sato", callSign: "VEGA", role: "Commander", stage: "active", assignment: "onboard", situation: "usual", summary: "Sample readings are close to the earlier pattern.", heartRate: 64, oxygen: 98, sleepHours: 7.2, dataQuality: "sample" },
        { id: "trainee", name: "Future crew member", callSign: "TRAINEE", role: "Mission candidate", stage: "future", assignment: "assigned", situation: "usual", summary: "Not flying.", dataQuality: "missing" },
      ],
    },
    {
      id: "kepler", name: "Kepler Research Flight", destination: "Orbital laboratory", state: "ongoing",
      startsOn: dayFrom(today, -37), endsOn: dayFrom(today, 72),
      crew: [
        { id: "maya", name: "Maya Ortiz", callSign: "ASTER", role: "Mission specialist", stage: "active", assignment: "onboard", situation: "review", summary: "Recovery pattern differs from the earlier synthetic baseline.", heartRate: 79, oxygen: 97, sleepHours: 5.7, dataQuality: "sample" },
        { id: "leo", name: "Leo Chen", callSign: "ORION", role: "Crew medical officer", stage: "active", assignment: "onboard", situation: "data_gap", summary: "Recent wearable readings are unavailable; wellbeing cannot be inferred.", dataQuality: "missing" },
        { id: "returned", name: "Returned crew member", callSign: "RETURNED", role: "Mission specialist", stage: "active", assignment: "returned", situation: "usual", summary: "No longer on board.", dataQuality: "sample" },
      ],
    },
    {
      id: "next", name: "Next Rotation", destination: "Orbital station", state: "planned",
      startsOn: dayFrom(today, 30), endsOn: dayFrom(today, 200),
      crew: [{ id: "assigned", name: "Assigned astronaut", callSign: "NEXT", role: "Flight engineer", stage: "active", assignment: "assigned", situation: "usual", summary: "Not yet on board.", dataQuality: "missing" }],
    },
  ];
}

/** Only active astronauts physically assigned to a mission that is in progress appear in the console. */
export function ongoingMissionCrew(missions: GroundMission[], today = new Date()): GroundMission[] {
  const date = dayFrom(today, 0);
  return missions
    .filter((mission) => mission.state === "ongoing" && mission.startsOn <= date && mission.endsOn >= date)
    .map((mission) => ({ ...mission, crew: mission.crew.filter((person) => person.stage === "active" && person.assignment === "onboard") }))
    .filter((mission) => mission.crew.length > 0);
}

export function missionCounts(missions: GroundMission[]) {
  const crew = missions.flatMap((mission) => mission.crew);
  return { missions: missions.length, onboard: crew.length, needsReview: crew.filter((person) => person.situation === "urgent" || person.situation === "review").length, dataGaps: crew.filter((person) => person.situation === "data_gap").length };
}

const trendSpecs: Array<{ metric: MetricName; label: string; unit: string; baseline: number; spread: number; precision: number }> = [
  { metric: "resting_hr", label: "Resting heart rate", unit: "bpm", baseline: 64, spread: 2, precision: 0 },
  { metric: "hrv", label: "HRV", unit: "ms", baseline: 48, spread: 3, precision: 0 },
  { metric: "spo2", label: "SpO₂", unit: "%", baseline: 97.5, spread: 0.2, precision: 1 },
  { metric: "sleep_hours", label: "Sleep", unit: "h", baseline: 7.2, spread: 0.25, precision: 1 },
  { metric: "core_temperature", label: "Skin temperature", unit: "°C", baseline: 33.2, spread: 0.1, precision: 1 },
  { metric: "radiation_dose", label: "Radiation dose", unit: "mSv", baseline: 0.5, spread: 0.02, precision: 2 },
];

/** Seven invented daily values for each onboard astronaut; a data gap ends the history yesterday. */
export function syntheticCrewTrends(person: GroundCrewMember, today = new Date()): MetricCardData[] {
  const lastIndex = person.dataQuality === "missing" ? 5 : 6;
  const identity = [...person.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return trendSpecs.map((spec, metricIndex) => {
    const target = person.dataQuality === "missing" ? spec.baseline : spec.metric === "resting_hr" ? person.heartRate ?? spec.baseline : spec.metric === "spo2" ? person.oxygen ?? spec.baseline : spec.metric === "sleep_hours" ? person.sleepHours ?? spec.baseline : spec.metric === "hrv" && person.situation === "urgent" ? 34 : spec.metric === "hrv" && person.situation === "review" ? 39 : spec.baseline;
    const points = Array.from({ length: lastIndex + 1 }, (_, index) => {
      const progress = index / 6;
      const drift = (target - spec.baseline) * progress * progress;
      const wave = Math.sin(identity + metricIndex * 3 + index * 2) * spec.spread * (1 - progress);
      const value = Number((index === 6 ? target : spec.baseline + drift + wave).toFixed(spec.precision));
      return { day: dayFrom(today, index - 6).slice(5), value, baseline: spec.baseline, alert: false };
    });
    const value = points[points.length - 1].value;
    return {
      metric: spec.metric, label: spec.label, unit: spec.unit, value, baseline: spec.baseline,
      trend: value > spec.baseline ? "up" as const : value < spec.baseline ? "down" as const : "steady" as const,
      plainLanguage: "Illustrative daily history only; no medical assessment.",
      source: spec.metric === "radiation_dose" ? "Synthetic personal dosimeter" : "Synthetic crew wearable",
      quality: "Simulated", aggregationPeriod: person.dataQuality === "missing" ? "History through yesterday; latest missing" : "Seven-day synthetic history",
      points,
    };
  });
}

export function crewMessageDraft(person: GroundCrewMember, mission: GroundMission): string {
  return `To ${person.callSign} on ${mission.name}: Ground health team requests a private check-in through the approved medical communications channel. Please confirm receipt and connect with the crew medical officer and flight surgeon using mission procedures. This is a synthetic training draft; no message has been sent.`;
}
