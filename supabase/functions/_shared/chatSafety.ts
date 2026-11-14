import { getEmergencySupport } from "./emergencySupport.ts";
export { EMERGENCY_GUIDANCE, GLUCOSE_GUIDANCE, GLUCOSE_GUIDANCE_URL } from "./emergencySupport.ts";
export const CHAT_REPLY_WORD_LIMIT = 30;

export function chatSafetyReply(message: string): string | undefined {
  return getEmergencySupport(message)?.content;
}

/** Conservative extra boundary; not a guarantee of clinical safety. */
export function isAllowedChatOutput(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0 && text.length <= 250
    && text.trim().split(/\s+/).length <= CHAT_REPLY_WORD_LIMIT
    && text.split(/\r?\n/).filter((line) => line.trim()).length <= 3
    && !/diagnos(?:e|is)|you have|medical clearance|guarantee|prescription|(?:start|stop|change|increase|decrease|take|administer|inject).{0,40}(?:medication|medicine|dose)|insulin|glucagon|\binject\w*\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units)\b|(?:you are|you're|it is|it's) safe|no need.{0,25}(?:medic|doctor|help)/i.test(text);
}
