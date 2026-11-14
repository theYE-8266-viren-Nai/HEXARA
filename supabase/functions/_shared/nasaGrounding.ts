import type { EmergencyTopic } from "./emergencySupport.ts";

export type NasaCitation = {
  id: string;
  title: string;
  url: string;
  collection: string;
  publishedAt?: string;
  excerpt: string;
};

export type ChatAnswerKind = "nasa_grounded" | "no_evidence" | "urgent_warning" | "unavailable";
export const NO_EVIDENCE_TEXT = "I couldn’t verify that from the indexed NASA documents. Try a narrower question.";

const TOPIC_QUERIES: Record<EmergencyTopic, string> = {
  breathing: "What does NASA documentation report about respiratory concerns during human spaceflight?",
  chest: "What does NASA documentation report about cardiovascular health during human spaceflight?",
  stroke: "What does NASA documentation report about neurological and vision changes during human spaceflight?",
  bleeding: "What does NASA documentation report about injury care constraints during human spaceflight?",
  allergy: "What does NASA documentation report about immune and allergy changes during human spaceflight?",
  seizure: "What does NASA documentation report about neurological health during human spaceflight?",
  unresponsive: "What does NASA documentation report about medical emergency support during human spaceflight?",
  poisoning: "What does NASA documentation report about cabin contaminants and toxic exposure during human spaceflight?",
  burn: "What does NASA documentation report about fire and burn hazards in crewed spacecraft?",
  injury: "What does NASA documentation report about injury risks and care during human spaceflight?",
  temperature: "What does NASA documentation report about thermal stress during human spaceflight?",
  glucose: "What does NASA documentation report about metabolism and glucose regulation during human spaceflight?",
  mission: "What does NASA documentation report about spacecraft environmental hazards and crew response?",
  distress: "What does NASA documentation report about behavioral health support during human spaceflight?",
  illness: "What does NASA documentation report about illness monitoring during human spaceflight?",
  general: "What does NASA documentation report about medical support during crewed spaceflight?",
  check_in: "What does NASA documentation report about common health changes during human spaceflight?",
  medication: "What does NASA documentation report about medication use and pharmacology during human spaceflight?",
};

export const sanitizedNasaQuery = (topic: EmergencyTopic) => TOPIC_QUERIES[topic];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function parseGroundedAnswer(raw: string | undefined, allowedSourceIds: string[]) {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try { value = JSON.parse(cleaned); } catch { return undefined; }
  if (!isRecord(value) || typeof value.answer !== "string" || !Array.isArray(value.citationIds)) return undefined;
  const citationIds = value.citationIds.filter((id): id is string => typeof id === "string");
  if (value.answer.trim() === NO_EVIDENCE_TEXT && citationIds.length === 0) return { answer: NO_EVIDENCE_TEXT, citationIds: [] };
  if (!citationIds.length || citationIds.length > 8 || new Set(citationIds).size !== citationIds.length) return undefined;
  if (citationIds.some((id) => !allowedSourceIds.includes(id))) return undefined;
  const answer = value.answer.trim();
  if (!answer || /https?:\/\//i.test(answer)) return undefined;
  const markers = [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
  if (!markers.length || markers.some((marker) => marker < 1 || marker > citationIds.length)) return undefined;
  return { answer, citationIds };
}
