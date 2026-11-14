import type { LifeStage } from "../types/horizon";

/**
 * An astronaut's own profile. The same field lists drive the sign-up form, the edit form and the
 * Profile page, so each stage shows exactly the details it asks for.
 */
export type FieldKind = "text" | "number" | "date" | "select";
export interface ProfileField { key: string; label: string; kind: FieldKind; placeholder?: string; unit?: string; options?: string[]; required?: boolean }
export interface ProfileGroup { id: "personal" | "journey" | "careTeam"; title: string; fields: ProfileField[] }

export interface AstronautProfile {
  stage: LifeStage;
  fullName: string;
  callSign: string;
  agency: string;
  personal: Record<string, string>;
  journey: Record<string, string>;
  careTeam: Record<string, string>;
}

export const STAGE_CHOICES: Array<{ stage: LifeStage; title: string; body: string }> = [
  { stage: "future", title: "Future traveler", body: "Candidate or trainee preparing for a first flight." },
  { stage: "active", title: "Active astronaut", body: "Currently assigned to, or flying, a mission." },
  { stage: "retired", title: "Retired astronaut", body: "Has flown and now lives life after flight." },
];

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

const PERSONAL: ProfileField[] = [
  { key: "age", label: "Age", kind: "number", unit: "years", placeholder: "34" },
  { key: "height", label: "Height", kind: "number", unit: "cm", placeholder: "175" },
  { key: "weight", label: "Weight", kind: "number", unit: "kg", placeholder: "70" },
  { key: "bloodType", label: "Blood type", kind: "select", options: BLOOD_TYPES },
  { key: "languages", label: "Languages", kind: "text", placeholder: "English, Russian" },
  { key: "background", label: "Background", kind: "text", placeholder: "Aerospace engineer, pilot…" },
  { key: "homeBase", label: "Home base", kind: "text", placeholder: "City, country" },
];

const JOURNEY: Record<LifeStage, { title: string; fields: ProfileField[] }> = {
  future: { title: "Training", fields: [
    { key: "candidateClass", label: "Candidate class", kind: "text", placeholder: "2025" },
    { key: "trainingPhase", label: "Training phase", kind: "text", placeholder: "Basic training · module 4 of 6" },
    { key: "currentFocus", label: "Current focus", kind: "text", placeholder: "Station systems" },
    { key: "targetAssignment", label: "Target assignment", kind: "text", placeholder: "Expedition 15 (planned 2028)" },
    { key: "trainingHours", label: "Training hours logged", kind: "number", unit: "h", placeholder: "600" },
    { key: "nextMilestone", label: "Next milestone", kind: "text", placeholder: "Spacewalk training" },
  ] },
  active: { title: "Current mission", fields: [
    { key: "mission", label: "Mission", kind: "text", placeholder: "Expedition 12" },
    { key: "role", label: "Role", kind: "text", placeholder: "Flight engineer" },
    { key: "launchDate", label: "Launch date", kind: "date" },
    { key: "plannedReturn", label: "Planned return", kind: "date" },
    { key: "exercisePlan", label: "Exercise plan", kind: "text", placeholder: "2.5 h daily" },
  ] },
  retired: { title: "Career in space", fields: [
    { key: "missionsFlown", label: "Missions flown", kind: "number", placeholder: "3" },
    { key: "timeInSpace", label: "Total time in space", kind: "number", unit: "days", placeholder: "412" },
    { key: "spacewalks", label: "Spacewalks", kind: "text", placeholder: "5 · 31 h 10 min" },
    { key: "lastLanding", label: "Last landing", kind: "date" },
    { key: "currentRole", label: "Current role", kind: "text", placeholder: "Mentor, outreach…" },
  ] },
};

const CARE_TEAM: Record<LifeStage, ProfileField[]> = {
  future: [
    { key: "leadInstructor", label: "Lead instructor", kind: "text" },
    { key: "trainingPhysician", label: "Training physician", kind: "text" },
    { key: "mentor", label: "Mentor", kind: "text" },
    { key: "emergencyContact", label: "Emergency contact", kind: "text", placeholder: "Name · relationship" },
  ],
  active: [
    { key: "crewMedic", label: "Crew medic", kind: "text" },
    { key: "flightSurgeon", label: "Flight surgeon", kind: "text" },
    { key: "psychSupport", label: "Psychological support", kind: "text" },
    { key: "familyContact", label: "Family contact", kind: "text", placeholder: "Name · relationship" },
  ],
  retired: [
    { key: "primaryDoctor", label: "Primary doctor", kind: "text" },
    { key: "followUp", label: "Long-term follow-up", kind: "text", placeholder: "Annual post-flight review" },
    { key: "nextReview", label: "Next review", kind: "date" },
    { key: "peerSupport", label: "Peer support", kind: "text" },
  ],
};

export function profileGroups(stage: LifeStage): ProfileGroup[] {
  return [
    { id: "personal", title: "Personal details", fields: PERSONAL },
    { id: "journey", title: JOURNEY[stage].title, fields: JOURNEY[stage].fields },
    { id: "careTeam", title: "Care team and contacts", fields: CARE_TEAM[stage] },
  ];
}

export function emptyProfile(stage: LifeStage): AstronautProfile {
  return { stage, fullName: "", callSign: "", agency: "", personal: {}, journey: {}, careTeam: {} };
}

const LIMITS: Partial<Record<string, [number, number]>> = { age: [16, 110], height: [120, 230], weight: [30, 250], trainingHours: [0, 100000], missionsFlown: [0, 50], timeInSpace: [0, 5000] };

/** Returns field errors keyed by field key ("fullName", "personal.age", …). Empty object means valid. */
export function validateProfile(profile: AstronautProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!profile.fullName.trim()) errors.fullName = "Enter your full name.";
  else if (profile.fullName.trim().length > 120) errors.fullName = "Use 120 characters or fewer.";
  if (profile.callSign.length > 40) errors.callSign = "Use 40 characters or fewer.";
  for (const group of profileGroups(profile.stage)) {
    for (const field of group.fields) {
      const value = (profile[group.id][field.key] ?? "").trim();
      if (!value) continue;
      if (value.length > 200) errors[`${group.id}.${field.key}`] = "Use 200 characters or fewer.";
      if (field.kind === "number") {
        const number = Number(value);
        const range = LIMITS[field.key];
        if (!Number.isFinite(number)) errors[`${group.id}.${field.key}`] = "Enter a number.";
        else if (range && (number < range[0] || number > range[1])) errors[`${group.id}.${field.key}`] = `Enter a value between ${range[0]} and ${range[1]}.`;
      }
    }
  }
  return errors;
}

/** Keeps only the fields that belong to the profile's stage, trimmed, so switching stage never leaves stray data. */
export function cleanProfile(profile: AstronautProfile): AstronautProfile {
  const groups = profileGroups(profile.stage);
  const pick = (id: ProfileGroup["id"]) => Object.fromEntries(groups.find((group) => group.id === id)!.fields
    .map((field) => [field.key, (profile[id][field.key] ?? "").trim()] as const)
    .filter(([, value]) => value));
  return { stage: profile.stage, fullName: profile.fullName.trim(), callSign: profile.callSign.trim(), agency: profile.agency.trim(), personal: pick("personal"), journey: pick("journey"), careTeam: pick("careTeam") };
}

/** Display value for a field, with its unit and dates written out. */
export function displayValue(field: ProfileField, value: string | undefined): string {
  if (!value) return "Not provided";
  if (field.kind === "date") {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  return field.unit && field.unit !== "years" ? `${value} ${field.unit}` : value;
}

/** Day of the mission (launch day = day 1) for an active astronaut, or null when no launch date is set. */
export function missionDayFrom(launchDate: string | undefined, today = new Date()): number | null {
  if (!launchDate) return null;
  const launch = new Date(`${launchDate}T00:00:00`);
  if (Number.isNaN(launch.getTime())) return null;
  const days = Math.floor((today.getTime() - launch.getTime()) / 86_400_000) + 1;
  return days >= 1 ? days : null;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}
