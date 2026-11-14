import type { LifeStage } from "../types/horizon";
import { chatSafetyReply } from "../../supabase/functions/_shared/chatSafety";
import type { EmergencyTopic, SupportResource } from "../../supabase/functions/_shared/emergencySupport";
import type { ChatAnswerKind, NasaCitation } from "../../supabase/functions/_shared/nasaGrounding";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string; createdAt: string; status: "complete" | "failed"; source?: "built-in" | "cloud"; supportTopic?: EmergencyTopic; resources?: SupportResource[]; answerKind?: ChatAnswerKind; citations?: NasaCitation[]; sanitizedQuery?: string };
export type ChatConversation = { id: string; stage: LifeStage; title: string; updatedAt: string };
export type ChatSendResult = { data?: ChatMessage; warning?: string; error?: string };

export const stageName = (stage: LifeStage) => stage === "future" ? "Future traveler" : stage === "retired" ? "Retired astronaut" : "Active astronaut";

export function offlineChatReply(stage: LifeStage | null, message: string): string {
  const safetyReply = chatSafetyReply(message);
  if (safetyReply) return safetyReply;
  return "NASA-grounded answers are unavailable right now. ORBIT will not answer from model memory; try again when the cloud connection is restored.";
}
