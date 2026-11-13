/**
 * Voice check-in logic (pure code, no network, no audio).
 *
 * A spoken conversation is turned into the SAME values as the on-screen wellbeing check-in
 * (mood, stress, sleep quality, energy on a 1 to 5 scale). Horizon controls the question order and
 * understands the answers itself: a voice service only carries the speech. Nothing is saved here;
 * the user reviews the result and applies it to the form, then saves it as usual.
 *
 * Safety: pain or severe-symptom words always stop the check-in and point to the crew medic. That
 * decision is made by this fixed word list, never by an AI model. Nothing here diagnoses.
 */

export type CheckInField = "mood" | "stress" | "sleepQuality" | "energy";

export interface VoiceQuestion { field: CheckInField; label: string; ask: string; }

/** Every question Horizon can ask, in this order. A stage asks only the ones its form shows. */
export const VOICE_QUESTIONS: VoiceQuestion[] = [
  { field: "mood", label: "Mood", ask: "How is your mood today, from 1 for low to 5 for high?" },
  { field: "stress", label: "Stress", ask: "How stressed do you feel, from 1 for calm to 5 for very stressed?" },
  { field: "sleepQuality", label: "Sleep quality", ask: "How well did you sleep, from 1 for poorly to 5 for very well?" },
  { field: "energy", label: "Energy", ask: "How is your energy, from 1 for low to 5 for high?" },
];

export const NOTE_PROMPT = "Is there anything else you would like to add? You can say no.";
const COUNT_WORDS = ["zero", "one", "two", "three", "four"];
export const firstMessage = (count: number) => `Hi, this is your Horizon check-in. I will ask ${COUNT_WORDS[count] ?? count} short question${count === 1 ? "" : "s"}. You can answer with a number from 1 to 5.`;

/** The questions for the fields a stage's form actually shows, always in the standard order. */
export const questionsFor = (fields: CheckInField[]): VoiceQuestion[] => VOICE_QUESTIONS.filter((q) => fields.includes(q.field));
export const ALL_FIELDS: CheckInField[] = VOICE_QUESTIONS.map((q) => q.field);
export const URGENT_MESSAGE = "You mentioned pain or a severe symptom. Please contact the crew medic or mission support now. Horizon is a research demo and cannot assess symptoms.";
export const MAX_NOTE_CHARS = 280;
export const MAX_CALL_SECONDS = 180;

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9/' -]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Understands a spoken 1 to 5 rating. Returns null when the answer is missing, out of range, or
 * ambiguous (for example "between 3 and 4"), so the question is asked again instead of guessing.
 */
export function parseSpokenRating(text: string): number | null {
  let t = normalize(text);
  if (!t) return null;
  // "3 out of 5", "three out of five", "4/5": the number before the scale counts.
  t = t.replace(/\b([1-5]|one|two|three|four|five)\s*(?:\/|out of)\s*(?:5|five)\b/g, (_, n: string) => ` ${n} `);
  const found = new Set<number>();
  for (const match of t.matchAll(/\b(\d+)\b/g)) { const n = Number(match[1]); if (n >= 1 && n <= 5 && match[1].length === 1) found.add(n); else return null; }
  for (const word of t.split(" ")) if (word in NUMBER_WORDS) found.add(NUMBER_WORDS[word]);
  if (found.size === 1) return [...found][0];
  if (found.size > 1) return null;
  // Level words, only when unambiguous and not negated.
  if (/\b(not|isn't|isnt|never|don't|dont)\b/.test(t)) return null;
  const veryLow = /\b(very|extremely|really) low\b/.test(t);
  const veryHigh = /\b(very|extremely|really) high\b/.test(t);
  const low = /\blow\b/.test(t);
  const high = /\bhigh\b/.test(t);
  const middle = /\b(medium|moderate|middling|average|okay|ok|so so|so-so)\b/.test(t);
  const hits = [veryLow, veryHigh, low && !veryLow, high && !veryHigh, middle].filter(Boolean).length;
  if (hits !== 1) return null;
  return veryLow ? 1 : low ? 2 : middle ? 3 : high && !veryHigh ? 4 : 5;
}

/** Words that always end the check-in and send the person to the crew medic. Deliberately conservative: a mention counts, even if negated. */
const URGENT_PATTERNS: RegExp[] = [
  /\bpain\b/, /\bchest (pressure|tight)/, /\bshort(ness)? of breath\b/, /\b(can't|cannot|unable to|trouble|hard to|difficulty) breath/,
  /\b(faint|fainted|fainting|pass(ed|ing)? out|unconscious|collaps)/, /\b(severe|worsening|getting worse)\b/, /\bbleed(ing)?\b/,
  /\bemergency\b/, /\bheart attack\b/, /\bstroke\b/, /\bseizure\b/, /\b(suicid|kill myself|hurt myself|self[- ]harm|end my life)/,
];
export function detectUrgent(text: string): boolean {
  const t = normalize(text);
  return URGENT_PATTERNS.some((pattern) => pattern.test(t));
}

export interface VoiceFlowState {
  /** The fields being asked about, in order. */
  fields: CheckInField[];
  /** 0 up to the last rating question, then the optional note, then finished. */
  step: number;
  answers: Partial<Record<CheckInField, number>>;
  note: string;
  done: boolean;
  urgent: boolean;
}

export const startFlow = (fields: CheckInField[] = ALL_FIELDS): VoiceFlowState => ({ fields: questionsFor(fields).map((q) => q.field), step: 0, answers: {}, note: "", done: false, urgent: false });

/** The next thing the assistant should ask, or null when finished. */
export function currentPrompt(state: VoiceFlowState): string | null {
  if (state.done) return null;
  return state.step < state.fields.length ? questionsFor(state.fields)[state.step].ask : NOTE_PROMPT;
}

const DECLINES = /^(no|nope|nothing|none|no thanks|no thank you|that's all|thats all|skip|pass|nothing else|i'm good|im good)\b/;

/** Applies one final thing the user said. Returns the same state when nothing usable was heard. */
export function applyUserUtterance(state: VoiceFlowState, text: string): VoiceFlowState {
  if (state.done) return state;
  if (detectUrgent(text)) return { ...state, urgent: true, done: true };
  if (state.step < state.fields.length) {
    const rating = parseSpokenRating(text);
    if (rating === null) return state;
    return { ...state, answers: { ...state.answers, [state.fields[state.step]]: rating }, step: state.step + 1 };
  }
  const spoken = text.trim();
  const declined = DECLINES.test(normalize(spoken));
  return { ...state, note: declined ? "" : spoken.slice(0, MAX_NOTE_CHARS), step: state.step + 1, done: true };
}

/** Values for the existing form, which stores ratings as the strings "1" to "5". */
export function toFormValues(answers: VoiceFlowState["answers"]): Partial<Record<CheckInField, string>> {
  const out: Partial<Record<CheckInField, string>> = {};
  for (const question of VOICE_QUESTIONS) { const value = answers[question.field]; if (value !== undefined) out[question.field] = String(value); }
  return out;
}
