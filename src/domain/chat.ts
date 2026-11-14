import type { LifeStage } from "../types/horizon";
import { chatSafetyReply } from "../../supabase/functions/_shared/chatSafety";
import type { EmergencyTopic, SupportResource } from "../../supabase/functions/_shared/emergencySupport";
import type { ChatAnswerKind, NasaCitation, OrbitAnswerConfidence } from "../../supabase/functions/_shared/nasaGrounding";
import type { OrbitFaqCategory } from "./orbitFaq";

export type ChatRole = "user" | "assistant";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status: "complete" | "failed";
  source?: "built-in" | "cloud";
  supportTopic?: EmergencyTopic;
  details?: string;
  resources?: SupportResource[];
  answerKind?: ChatAnswerKind;
  citations?: NasaCitation[];
  keyPoints?: string[];
  nextSteps?: string[];
  warnings?: string[];
  questionsToExplore?: string[];
  confidence?: OrbitAnswerConfidence;
  sanitizedQuery?: string;
  category?: OrbitFaqCategory;
  inputMode?: "text" | "voice";
};
export type ChatConversation = { id: string; stage: LifeStage; title: string; updatedAt: string };
export type ChatSendResult = { data?: ChatMessage; warning?: string; error?: string };

export const stageName = (stage: LifeStage) => stage === "future" ? "Future traveler" : stage === "retired" ? "Retired astronaut" : "Active astronaut";

export function offlineChatReply(stage: LifeStage | null, message: string): string {
  const safetyReply = chatSafetyReply(message);
  if (safetyReply) return safetyReply;
  if (stage === "retired") {
    if (/\b(earth|overview effect|orbit|planet|the view)\b/i.test(message)) return "That view can stay with you in many ways. What part of seeing Earth feels most present today?";
    if (/\b(mission|spaceflight|retir\w*|different|purpose|identity)\b/i.test(message)) return "A mission can remain part of your story as daily life changes. What feels different for you lately?";
    if (/\b(reconnect|lonel\w*|isolat\w*|miss (?:my )?(?:crew|friends|family)|people)\b/i.test(message)) return "Missing connection can feel heavy. Is there a person you would like to reach out to today?";
    return "I'm here to listen. You can tell me about a memory, a change, or how today feels. What would you like to share?";
  }
  return "NASA-grounded answers are unavailable right now. ORBIT will not answer from model memory; try again when the cloud connection is restored.";
}
