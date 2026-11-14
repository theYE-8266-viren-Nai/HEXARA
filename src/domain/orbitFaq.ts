import type { LifeStage } from "../types/horizon";

export type OrbitFaqCategory =
  | "health_human_spaceflight"
  | "future_preparation"
  | "active_mission_support"
  | "retired_follow_up"
  | "missions_engineering"
  | "astronomy"
  | "planetary_science"
  | "earth_science"
  | "aeronautics"
  | "standards_osdr"
  | "unclassified";

export type OrbitFaq = { category: OrbitFaqCategory; title: string; description: string; question: string; stages: LifeStage[]; destination?: string };
export type OrbitResource = { id: string; title: string; description: string; collection: string; url: string; categories: OrbitFaqCategory[] };

export const ORBIT_FAQS: OrbitFaq[] = [
  { category: "health_human_spaceflight", title: "Everyday health", description: "General health information on sleep, exercise, stress and more.", question: "How can I improve my sleep quality?", stages: ["future", "active", "retired"] },
  { category: "health_human_spaceflight", title: "Health in space", description: "Learn how NASA studies the body during spaceflight.", question: "How does microgravity affect the vestibular system?", stages: ["future", "active", "retired"] },
  { category: "future_preparation", title: "Prepare for a first flight", description: "Understand adaptation, sleep, exercise, and personal baselines.", question: "What should a first-time traveler expect during the first two weeks?", stages: ["future"], destination: "guidance" },
  { category: "active_mission_support", title: "Mission support", description: "Explore routines, spacecraft systems, and long-duration missions.", question: "Why does the ISS use control moment gyroscopes?", stages: ["active"], destination: "trends" },
  { category: "retired_follow_up", title: "Life after flight", description: "Learn about long-term astronaut research and follow-up.", question: "What has NASA studied about health after long-duration spaceflight?", stages: ["retired"], destination: "guidance" },
  { category: "missions_engineering", title: "Missions and engineering", description: "Understand spacecraft, docking, life support, and operations.", question: "How does spacecraft docking work?", stages: ["future", "active", "retired"] },
  { category: "astronomy", title: "Astronomy", description: "Ask about NASA observations of stars, galaxies, and the universe.", question: "How does NASA study distant galaxies?", stages: ["future", "active", "retired"] },
  { category: "planetary_science", title: "Planetary science", description: "Explore NASA missions to planets, moons, and small bodies.", question: "How does NASA search for evidence of water on Mars?", stages: ["future", "active", "retired"] },
  { category: "earth_science", title: "Earth science", description: "Learn how NASA observes our changing planet.", question: "How do NASA satellites monitor Earth’s climate?", stages: ["future", "active", "retired"] },
  { category: "aeronautics", title: "Aeronautics", description: "Explore NASA research into flight and aviation.", question: "How does NASA test quieter aircraft designs?", stages: ["future", "active", "retired"] },
  { category: "standards_osdr", title: "Standards and research data", description: "Find NASA technical standards and open space-biology research.", question: "What is NASA OSDR used for?", stages: ["future", "active", "retired"] },
];

/** Navigation-only links. Factual answers still require indexed NASA citations. */
export const ORBIT_RESOURCES: OrbitResource[] = [
  { id: "nasa-human-body", title: "The Human Body in Space", description: "NASA's overview of how spaceflight affects human systems.", collection: "NASA Human Research", url: "https://www.nasa.gov/humans-in-space/the-human-body-in-space/", categories: ["health_human_spaceflight", "future_preparation", "active_mission_support", "retired_follow_up"] },
  { id: "nasa-space-station", title: "International Space Station", description: "Mission, research, and technology context from NASA.", collection: "NASA Missions", url: "https://www.nasa.gov/international-space-station/", categories: ["active_mission_support", "missions_engineering"] },
  { id: "nasa-osdr", title: "NASA Open Science Data Repository", description: "Public space-biology datasets and research metadata.", collection: "NASA OSDR", url: "https://osdr.nasa.gov/", categories: ["health_human_spaceflight", "retired_follow_up", "standards_osdr"] },
  { id: "nasa-ntrs", title: "NASA Technical Reports Server", description: "NASA technical reports and research publications.", collection: "NASA NTRS", url: "https://sti.nasa.gov/", categories: ["missions_engineering", "standards_osdr", "aeronautics", "health_human_spaceflight"] },
  { id: "nasa-science", title: "NASA Science", description: "NASA's public science topics and mission discoveries.", collection: "NASA Science", url: "https://science.nasa.gov/", categories: ["astronomy", "planetary_science", "earth_science"] },
];

const rules: Array<[OrbitFaqCategory, RegExp]> = [
  ["future_preparation", /first.?time|prepare|preparation|baseline|adaptation|first two weeks|before launch|training/i],
  ["active_mission_support", /crew|mission day|mission control|in orbit|daily exercise|long.?duration|space station routine/i],
  ["retired_follow_up", /after landing|retir|long.?term|post.?flight|life after|follow.?up/i],
  ["health_human_spaceflight", /bone|muscle|sleep|radiation|vestibular|motion sickness|cardiovascular|vision|fluid shift|microgravity.*body|health|respiratory|breathing|exercis|workout|diet|nutrition|hydrat|vitamin|stress|anxi|mood|heart|blood pressure|headache|fatigue|tired|weight/i],
  ["missions_engineering", /iss|spacecraft|docking|spacesuit|life support|gyroscope|communication delay|engineering/i],
  ["astronomy", /galaxy|galaxies|star|black hole|cosmos|telescope|astrophysics|universe/i],
  ["planetary_science", /mars|moon|lunar|planet|asteroid|comet|jupiter|saturn|planetary/i],
  ["earth_science", /earth observation|climate|weather|ocean|ice sheet|earth science|satellite.*earth/i],
  ["aeronautics", /aircraft|aviation|aeronautics|flight test|sonic boom|air traffic/i],
  ["standards_osdr", /osdr|open data|technical standard|standards|dataset|research data/i],
];

export function classifyOrbitQuestion(question: string): OrbitFaqCategory {
  for (const [category, pattern] of rules) if (pattern.test(question)) return category;
  return "unclassified";
}

export function faqsForStage(stage: LifeStage): OrbitFaq[] { return ORBIT_FAQS.filter((faq) => faq.stages.includes(stage)); }
export function resourcesForCategory(category?: OrbitFaqCategory): OrbitResource[] { return category ? ORBIT_RESOURCES.filter((resource) => resource.categories.includes(category)) : []; }
