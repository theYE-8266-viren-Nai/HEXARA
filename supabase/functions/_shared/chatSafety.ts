/** Shared browser/Edge Function support messages, not clinical triage or an exhaustive symptom detector. */
export const GLUCOSE_GUIDANCE_URL = "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia";
export const EMERGENCY_GUIDANCE = "Contact your crew medic and mission control now using your mission emergency channel. On Earth, contact local emergency services. Do not wait for this chat. Follow your mission-approved emergency procedures and the medical team's instructions. Horizon cannot diagnose or provide emergency care. No one has been contacted by this app.";
export const GLUCOSE_GUIDANCE = "If blood sugar may be low, contact your crew medic now and follow your clinician-provided low-blood-sugar plan. Insulin lowers blood sugar; do not use it to treat suspected low blood sugar. If someone is unconscious, having a seizure, or unable to swallow safely, get emergency medical help immediately and do not give food or drink by mouth. Horizon does not measure blood glucose or determine whether it is high or low, and cannot advise medication doses. No one has been contacted by this app.";
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[-_]/g, " ");

export function chatSafetyReply(message: string): string | undefined {
  const text = normalize(message);
  // Broad matching is intentional, even for hypothetical glucose/medication questions.
  if (/\b(insulin|glucose|hypoglyc\w*|blood\s*sugar)\b/.test(text)) return GLUCOSE_GUIDANCE;
  if (/\b(emergency|urgent|severe|pain|faint\w*|unconscious|unresponsive|seizure\w*|bleed\w*|chok\w*|overdose|collapsed?|dizz\w*|confus\w*|breath\w*)\b|pass(?:ed|ing)? out|can'?t (?:breathe|wake)|cannot (?:breathe|wake)|not breathing|hurt myself|kill myself/.test(text)) return EMERGENCY_GUIDANCE;
  if (/\b(inject\w*|dos(?:e|es|ing)|medicat\w*|prescri\w*|\d+\s*(?:mg|mcg|ml|units))\b/.test(text)) return "Horizon cannot prescribe, recommend injections, or choose medication doses. Ask your crew medic or prescribing clinician and follow their existing care plan. If this is urgent, contact mission medical support now; on Earth, contact local emergency services. Do not wait for chat. No one has been contacted by this app.";
  return undefined;
}

/** Conservative extra boundary; not a guarantee of clinical safety. */
export function isAllowedChatOutput(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0 && text.length <= 6_000
    && !/diagnos(?:e|is)|you have|medical clearance|guarantee|prescription|(?:start|stop|change|increase|decrease|take|administer|inject).{0,40}(?:medication|medicine|dose)|insulin|glucagon|\binject\w*\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units)\b|(?:you are|you're|it is|it's) safe|no need.{0,25}(?:medic|doctor|help)/i.test(text);
}
