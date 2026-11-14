import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { offlineChatReply, type ChatConversation, type ChatMessage, type ChatSendResult } from "../domain/chat";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";
import { getUrgentSupport, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";
import type { ChatAnswerKind, NasaCitation } from "../../supabase/functions/_shared/nasaGrounding";

type Row = Record<string, unknown>;
const mapCitations = (value: unknown): NasaCitation[] => Array.isArray(value) ? value.filter((item): item is NasaCitation => Boolean(item && typeof item === "object" && typeof (item as NasaCitation).id === "string" && typeof (item as NasaCitation).url === "string")) : [];
const mapMessage = (row: Row): ChatMessage => ({ id: String(row.id), role: row.role as ChatMessage["role"], content: String(row.content), createdAt: String(row.created_at), status: (row.status as ChatMessage["status"]) ?? "complete", answerKind: row.answer_kind as ChatAnswerKind | undefined, citations: mapCitations(row.citations), sanitizedQuery: typeof row.sanitized_query === "string" ? row.sanitized_query : undefined });
const mapConversation = (row: Row): ChatConversation => ({ id: String(row.id), stage: row.stage as LifeStage, title: String(row.title ?? "OrbitWell chat"), updatedAt: String(row.updated_at) });

export function createChatRepository(client: SupabaseClient | null, userId: string | null) {
  const unavailable = "Cloud unavailable. Not saved remotely.";
  return {
    async listConversations(stage: LifeStage) {
      if (!client || !userId) return { data: [] as ChatConversation[], warning: unavailable };
      const result = await client.from("chat_conversations").select("id,stage,title,updated_at").eq("user_id", userId).eq("stage", stage).order("updated_at", { ascending: false });
      return { data: (result.data ?? []).map(mapConversation), warning: result.error?.message };
    },
    async createConversation(stage: LifeStage) {
      if (!client || !userId) return { data: undefined, warning: unavailable };
      const result = await client.from("chat_conversations").insert({ user_id: userId, stage }).select("id,stage,title,updated_at").single();
      return { data: result.data ? mapConversation(result.data) : undefined, warning: result.error?.message };
    },
    async listMessages(conversationId: string) {
      if (!client || !userId) return { data: [] as ChatMessage[], warning: unavailable };
      const result = await client.from("chat_messages").select("id,role,content,created_at,status,answer_kind,citations,sanitized_query").eq("conversation_id", conversationId).eq("user_id", userId).order("created_at", { ascending: true }).limit(60);
      return { data: (result.data ?? []).map(mapMessage).map((message) => message.role === "assistant" && !isAllowedChatOutput(message.content)
        ? { ...message, content: "Older reply hidden. Ask again for a short answer.\nFor medical concerns, contact your crew medic.", source: "built-in" as const }
        : message), warning: result.error?.message };
    },
    async sendMessage(conversationId: string, stage: LifeStage, message: string, options: { sanitizedFromTopic?: EmergencyTopic } = {}): Promise<ChatSendResult> {
      const builtIn = (content: string): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in", answerKind: "unavailable" });
      const safety = getUrgentSupport(message);
      if (safety && !options.sanitizedFromTopic) return { data: { ...builtIn(safety.content), answerKind: "urgent_warning", supportTopic: safety.topic, details: safety.details, resources: safety.resources }, warning: "Urgent guidance. This exchange was not sent to cloud AI or saved remotely." };
      if (!client || !userId) return { data: builtIn(offlineChatReply(null, message)), warning: unavailable };
      const requestId = crypto.randomUUID();
      const result = await client.functions.invoke("chat-assistant", { body: { conversationId, stage, message, sanitizedFromTopic: options.sanitizedFromTopic, requestId } });
      if (result.error || !result.data?.message) return { error: result.data?.detail ?? result.data?.error ?? result.error?.message ?? "NASA research chat could not be completed." };
      if (!isAllowedChatOutput(result.data.message.content)) return { data: builtIn(offlineChatReply(null, message)), warning: "The AI response could not be shown. Built-in guidance is shown instead." };
      return { data: { ...mapMessage(result.data.message), source: "cloud" } };
    },
  };
}
