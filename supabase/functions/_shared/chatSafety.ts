import { getEmergencySupport } from "./emergencySupport.ts";
export { EMERGENCY_GUIDANCE, GLUCOSE_GUIDANCE, GLUCOSE_GUIDANCE_URL } from "./emergencySupport.ts";

export function chatSafetyReply(message: string): string | undefined {
  return getEmergencySupport(message)?.content;
}

/** Conservative extra boundary; not a guarantee of clinical safety. */
export function isAllowedChatOutput(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0 && text.length <= 6_000
    && !/diagnos(?:e|is)|you have|medical clearance|guarantee|prescription|(?:start|stop|change|increase|decrease|take|administer|inject).{0,40}(?:medication|medicine|dose)|insulin|glucagon|\binject\w*\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units)\b|(?:you are|you're|it is|it's) safe|no need.{0,25}(?:medic|doctor|help)/i.test(text);
}
