import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { offlineChatReply, type ChatConversation, type ChatMessage, type ChatSendResult } from "../domain/chat";
import { isAllowedChatOutput } from "../../supabase/functions/_shared/chatSafety";
import { getUrgentSupport, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";
import type { ChatAnswerKind, NasaCitation } from "../../supabase/functions/_shared/nasaGrounding";
import type { OrbitFaqCategory } from "../domain/orbitFaq";

type Row = Record<string, unknown>;
const mapCitations = (value: unknown): NasaCitation[] => Array.isArray(value) ? value.filter((item): item is NasaCitation => Boolean(item && typeof item === "object" && typeof (item as NasaCitation).id === "string" && typeof (item as NasaCitation).url === "string")) : [];
const mapList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const mapMessage = (row: Row): ChatMessage => ({ id: String(row.id), role: row.role as ChatMessage["role"], content: String(row.content), createdAt: String(row.created_at), status: (row.status as ChatMessage["status"]) ?? "complete", answerKind: row.answer_kind as ChatAnswerKind | undefined, citations: mapCitations(row.citations), keyPoints: mapList(row.key_points), nextSteps: mapList(row.next_steps), warnings: mapList(row.warnings), questionsToExplore: mapList(row.questions_to_explore), confidence: row.confidence === "high" || row.confidence === "low" || row.confidence === "medium" ? row.confidence : undefined, sanitizedQuery: typeof row.sanitized_query === "string" ? row.sanitized_query : undefined, category: row.category as OrbitFaqCategory | undefined, inputMode: row.input_mode as "text" | "voice" | undefined });
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
      const result = await client.from("chat_messages").select("id,role,content,created_at,status,answer_kind,citations,key_points,next_steps,warnings,questions_to_explore,confidence,sanitized_query,category,input_mode").eq("conversation_id", conversationId).eq("user_id", userId).order("created_at", { ascending: true }).limit(60);
      return { data: (result.data ?? []).map(mapMessage).map((message) => message.role === "assistant" && !isAllowedChatOutput(message.content)
        ? { ...message, content: "Older reply hidden. Ask again for a short answer.\nFor medical concerns, contact your crew medic.", source: "built-in" as const }
        : message), warning: result.error?.message };
    },
    async sendMessage(conversationId: string, stage: LifeStage, message: string, options: { sanitizedFromTopic?: EmergencyTopic; category?: OrbitFaqCategory; inputMode?: "text" | "voice" } = {}): Promise<ChatSendResult> {
      const builtIn = (content: string): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in", answerKind: "unavailable" });
      const safety = getUrgentSupport(message);
      if (safety && !options.sanitizedFromTopic) return { data: { ...builtIn(safety.content), answerKind: "urgent_warning", supportTopic: safety.topic, details: safety.details, resources: safety.resources }, warning: "Urgent guidance. This exchange was not sent to cloud AI or saved remotely." };
      if (!client || !userId) return { data: builtIn(offlineChatReply(null, message)), warning: unavailable };
      const requestId = crypto.randomUUID();
      const result = await client.functions.invoke("chat-assistant", { body: { conversationId, stage, message, sanitizedFromTopic: options.sanitizedFromTopic, category: options.category, inputMode: options.inputMode ?? "text", requestId } });
      if (result.error || !result.data?.message) {
        // A non-2xx reply leaves result.data empty; the function's error code is in the response body.
        let code: unknown = result.data?.error ?? result.data?.detail;
        const context = (result.error as { context?: Response } | null)?.context;
        if (!code && context && typeof context.json === "function") { try { const body = await context.clone().json(); code = body?.error ?? body?.detail; } catch { /* body was not JSON */ } }
        return { error: friendlyChatError(code ?? result.error?.message) };
      }
      if (!isAllowedChatOutput(result.data.message.content)) return { data: builtIn(offlineChatReply(null, message)), warning: "The AI response could not be shown. Built-in guidance is shown instead." };
      const upstream: string[] = Array.isArray(result.data.upstream) ? result.data.upstream : [];
      const warning = result.data.fallback ? fallbackWarning(upstream) : undefined;
      return { data: { ...mapMessage(result.data.message), source: "cloud" }, warning };
    },
  };
}

function fallbackWarning(upstream: string[]): string {
  if (upstream.some((item) => /:(402|429)$/.test(item))) return "The free AI quota is used up, so ORBIT is showing the NASA source instead of a written answer. Try again later.";
  if (upstream.some((item) => /:(401|403)$/.test(item))) return "The AI key was rejected, so ORBIT is showing the NASA source instead of a written answer.";
  return "The AI answer could not be checked against the sources, so ORBIT is showing the NASA source instead.";
}

function friendlyChatError(code: unknown): string {
  const value = String(code ?? "");
  if (value === "not_configured" || value === "model_missing") return "ORBIT's AI service is not configured yet. No AI answer was generated.";
  if (value === "conversation_not_found") return "This chat could not be found. Close ORBIT and open it again to start a new chat.";
  if (value.includes("free-models-per-day") || value === "upstream_credit" || value === "paid_model_blocked") return "OpenRouter's free daily limit has been reached. No AI answer was generated; please try again after the quota resets.";
  if (value === "rate_limited") return "ORBIT is receiving many questions right now. Please wait a minute and try again.";
  if (value === "nasa_index_unavailable" || value === "embedding_unavailable") return "NASA research sources are temporarily unavailable. Please try again shortly.";
  if (value === "urgent_confirmation_required") return "Please use the urgent guidance first and confirm the neutral NASA research question before sending it.";
  return "NASA research chat could not be completed. No unsourced answer was generated.";
}
