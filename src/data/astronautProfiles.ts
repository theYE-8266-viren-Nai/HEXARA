import type { LifeStage, TravelerProfile } from "../types/horizon";

/**
 * Synthetic personal records for the demo astronauts. Every value is invented for the
 * research demo; none describes a real person.
 */
export interface ProfileFact { label: string; value: string }
export interface ProfileSection { title: string; facts: ProfileFact[] }
export interface AstronautRecord {
  callsign: string;
  agency: string;
  summary: string;
  personal: ProfileFact[];
  journey: ProfileSection;
  careTeam: ProfileFact[];
}

const RECORDS: Record<LifeStage, AstronautRecord> = {
  active: {
    callsign: "ASTER",
    agency: "Synthetic Space Agency",
    summary: "Flight engineer on a six-month station expedition.",
    personal: [
      { label: "Age", value: "41" },
      { label: "Height", value: "172 cm" },
      { label: "Weight before launch", value: "68 kg" },
      { label: "Blood type", value: "A+" },
      { label: "Languages", value: "English, Russian" },
      { label: "Home base", value: "Houston, Texas" },
    ],
    journey: { title: "Current mission", facts: [
      { label: "Mission", value: "Expedition 12" },
      { label: "Role", value: "Flight engineer" },
      { label: "Launch date", value: "1 January 2026" },
      { label: "Planned return", value: "30 June 2026" },
      { label: "Exercise plan", value: "2.5 h daily (treadmill, resistance, cycle)" },
    ] },
    careTeam: [
      { label: "Crew medic", value: "Cmdr. J. Okafor (on board)" },
      { label: "Flight surgeon", value: "Dr. S. Lindqvist (ground)" },
      { label: "Psychological support", value: "Behavioural health team, weekly private call" },
      { label: "Family contact", value: "Partner · private family conference on Sundays" },
    ],
  },
  future: {
    callsign: "LEON",
    agency: "Synthetic Space Agency",
    summary: "Astronaut candidate in basic training, preparing for a first flight.",
    personal: [
      { label: "Age", value: "34" },
      { label: "Height", value: "181 cm" },
      { label: "Weight", value: "77 kg" },
      { label: "Blood type", value: "O+" },
      { label: "Background", value: "Aerospace engineer and private pilot" },
      { label: "Home base", value: "Cologne, Germany" },
    ],
    journey: { title: "Training", facts: [
      { label: "Candidate class", value: "2025" },
      { label: "Training phase", value: "Basic training · module 4 of 6" },
      { label: "Current focus", value: "Station systems and Russian language" },
      { label: "Target assignment", value: "Expedition 15 (planned 2028)" },
      { label: "Training hours logged", value: "612 h" },
      { label: "Next milestone", value: "Neutral buoyancy spacewalk training" },
    ] },
    careTeam: [
      { label: "Lead instructor", value: "M. Duarte" },
      { label: "Training physician", value: "Dr. A. Brenner" },
      { label: "Mentor", value: "Flown astronaut, monthly check-in" },
      { label: "Emergency contact", value: "Sibling" },
    ],
  },
  retired: {
    callsign: "ELENA",
    agency: "Synthetic Space Agency (retired)",
    summary: "Veteran of three missions, now mentoring the next generation.",
    personal: [
      { label: "Age", value: "63" },
      { label: "Height", value: "165 cm" },
      { label: "Weight", value: "61 kg" },
      { label: "Blood type", value: "B+" },
      { label: "Current role", value: "STEM outreach and candidate mentoring" },
      { label: "Home", value: "Albuquerque, New Mexico" },
    ],
    journey: { title: "Career in space", facts: [
      { label: "Missions flown", value: "3" },
      { label: "Total time in space", value: "412 days" },
      { label: "Spacewalks", value: "5 · 31 h 10 min" },
      { label: "Last landing", value: "March 2019" },
      { label: "Years since last flight", value: "7" },
    ] },
    careTeam: [
      { label: "Primary doctor", value: "Dr. R. Castillo" },
      { label: "Long-term follow-up", value: "Annual post-flight health review" },
      { label: "Next review", value: "September 2026" },
      { label: "Peer support", value: "Astronaut alumni network" },
    ],
  },
};

export function astronautRecord(stage: LifeStage): AstronautRecord {
  return RECORDS[stage];
}

export function initials(profile: TravelerProfile): string {
  return profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
