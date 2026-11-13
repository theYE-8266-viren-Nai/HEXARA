import type { LifeStage } from "../types/horizon";
import { chatSafetyReply } from "../../supabase/functions/_shared/chatSafety";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string; createdAt: string; status: "complete" | "failed"; source?: "built-in" | "cloud" };
export type ChatConversation = { id: string; stage: LifeStage; title: string; updatedAt: string };
export type ChatContextSummary = { stage: LifeStage; dataQuality?: string; source?: string; signals: Array<{ label: string; trend: string }> };
export type ChatSendResult = { data?: ChatMessage; warning?: string; error?: string };

export const stageName = (stage: LifeStage) => stage === "future" ? "Future traveler" : stage === "retired" ? "Retired astronaut" : "Active astronaut";

export function offlineChatReply(stage: LifeStage | null, message: string): string {
  const label = stage ? stageName(stage) : "space traveler";
  const safetyReply = chatSafetyReply(message);
  if (safetyReply) return safetyReply;
  return `${label} guidance is available for preparation, daily routines, space adaptation, and wellbeing. Cloud chat is unavailable right now, so this is a demo response. Please use qualified mission and medical teams for personal decisions.`;
}
