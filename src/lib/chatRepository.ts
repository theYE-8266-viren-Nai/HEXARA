import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { offlineChatReply, type ChatContextSummary, type ChatConversation, type ChatMessage, type ChatSendResult } from "../domain/chat";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";
import { getEmergencySupport } from "../../supabase/functions/_shared/emergencySupport";

type Row = Record<string, unknown>;
const mapMessage = (row: Row): ChatMessage => ({ id: String(row.id), role: row.role as ChatMessage["role"], content: String(row.content), createdAt: String(row.created_at), status: (row.status as ChatMessage["status"]) ?? "complete" });
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
      const result = await client.from("chat_messages").select("id,role,content,created_at,status").eq("conversation_id", conversationId).eq("user_id", userId).order("created_at", { ascending: true }).limit(60);
      return { data: (result.data ?? []).map(mapMessage).map((message) => message.role === "assistant" && !isAllowedChatOutput(message.content)
        ? { ...message, content: "Older reply hidden. Ask again for a short answer.\nFor medical concerns, contact your crew medic.", source: "built-in" as const }
        : message), warning: result.error?.message };
    },
    async sendMessage(conversationId: string, stage: LifeStage, message: string, includeContext: boolean, context?: ChatContextSummary): Promise<ChatSendResult> {
      const builtIn = (content: string): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in" });
      const safety = getEmergencySupport(message);
      if (safety) return { data: { ...builtIn(safety.content), supportTopic: safety.topic, details: safety.details, resources: safety.resources }, warning: "Built-in guidance. Not sent or saved remotely." };
      if (!client || !userId) return { data: builtIn(offlineChatReply(stage, message)), warning: unavailable };
      const requestId = crypto.randomUUID();
      const result = await client.functions.invoke("chat-assistant", { body: { conversationId, stage, message, includeContext, context: includeContext ? context : undefined, requestId } });
      if (result.error || !result.data?.message) return { error: result.data?.error ?? result.error?.message ?? "Chat could not be saved." };
      if (!isAllowedChatOutput(result.data.message.content)) return { data: builtIn(offlineChatReply(stage, message)), warning: "AI reply could not be shown. Built-in guidance instead." };
      return { data: { ...mapMessage(result.data.message), source: "cloud" } };
    },
  };
}
