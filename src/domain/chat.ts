import type { LifeStage } from "../types/horizon";
import { chatSafetyReply } from "../../supabase/functions/_shared/chatSafety";
import type { EmergencyTopic, SupportResource } from "../../supabase/functions/_shared/emergencySupport";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string; createdAt: string; status: "complete" | "failed"; source?: "built-in" | "cloud"; supportTopic?: EmergencyTopic; resources?: SupportResource[] };
export type ChatConversation = { id: string; stage: LifeStage; title: string; updatedAt: string };
export type ChatContextSummary = { stage: LifeStage; dataQuality?: string; source?: string; signals: Array<{ label: string; trend: string }> };
export type ChatSendResult = { data?: ChatMessage; warning?: string; error?: string };

export const stageName = (stage: LifeStage) => stage === "future" ? "Future traveler" : stage === "retired" ? "Retired astronaut" : "Active astronaut";

export function offlineChatReply(stage: LifeStage | null, message: string): string {
  const label = stage ? stageName(stage) : "space traveler";
  const safetyReply = chatSafetyReply(message);
  if (safetyReply) return safetyReply;
  if (/^(hi|hey|hello|good morning|good evening)[!. ]*$/i.test(message.trim())) return "Hi, I'm ORBIT, your little Horizon companion. How are you feeling today? I can listen, explain the demo, or help you prepare a question for your crew medic. This is a built-in reply; cloud AI is unavailable right now.";
  if (/\b(stress\w*|anxious|worried|lonely|overwhelmed)\b/i.test(message)) return "That sounds like a lot to carry. I'm here to listen. Would you like to tell me what's been difficult, or open your optional Wellbeing check-in? You can also reach out to a trusted crewmate or mission support. This is a built-in reply; cloud AI is unavailable right now.";
  return `${label} guidance is available for preparation, daily routines, space adaptation, and wellbeing. Cloud chat is unavailable right now, so this is a demo response. Please use qualified mission and medical teams for personal decisions.`;
}
