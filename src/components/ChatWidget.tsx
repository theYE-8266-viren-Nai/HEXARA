import { AlertTriangle, ArrowUpRight, BookOpen, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { createChatRepository } from "../lib/chatRepository";
import { offlineChatReply, type ChatMessage } from "../domain/chat";
import { getUrgentSupport, type EmergencySupport, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";
import { sanitizedNasaQuery } from "../../supabase/functions/_shared/nasaGrounding";
import { RobotAvatar } from "./RobotAvatar";

const SUGGESTIONS = [
  "How does microgravity affect the vestibular system?",
  "Why does the ISS use control moment gyroscopes?",
  "What has NASA learned about radiation beyond low Earth orbit?",
];
const localMessage = (content: string, support?: EmergencySupport): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in", answerKind: support ? "urgent_warning" : "unavailable", supportTopic: support?.topic, resources: support?.resources });

export function ChatWidget({ stage, client, userId, avatarSrc }: { stage: LifeStage | null; client: SupabaseClient | null; userId: string | null; avatarSrc?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [supportTopic, setSupportTopic] = useState<EmergencyTopic>();
  const [pendingResearch, setPendingResearch] = useState<{ topic: EmergencyTopic; query: string }>();
  const supportRef = useRef<EmergencyTopic | undefined>(undefined);
  const requestSequence = useRef(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const epoch = useRef(0);
  const sending = useRef(false);
  const hydrated = useRef(false);
  const repository = useMemo(() => createChatRepository(client, userId), [client, userId]);

  useEffect(() => {
    epoch.current += 1; requestSequence.current += 1; supportRef.current = undefined;
    sending.current = false; hydrated.current = false;
    setConversationId(undefined); setMessages([]); setWarning(undefined); setPendingResearch(undefined);
    setInput(""); setBusy(false); setLoading(false); setSupportTopic(undefined);
  }, [stage, repository]);

  useEffect(() => {
    if (!open || !stage || hydrated.current) return;
    hydrated.current = true; const version = epoch.current; setLoading(true);
    void (async () => {
      try {
        const list = await repository.listConversations(stage);
        if (version !== epoch.current) return;
        setWarning(list.warning); const conversation = list.data[0];
        if (conversation) {
          const loaded = await repository.listMessages(conversation.id);
          if (version !== epoch.current) return;
          setConversationId(conversation.id); setMessages((current) => [...loaded.data, ...current]); setWarning(loaded.warning ?? list.warning);
        }
      } catch { if (version === epoch.current) setWarning("Saved NASA research history is unavailable."); }
      finally { if (version === epoch.current) setLoading(false); }
    })();
  }, [open, stage, repository]);

  useEffect(() => { if (open) question.current?.focus(); }, [open]);
  useEffect(() => { const list = messageList.current; if (list) list.scrollTop = list.scrollHeight; }, [messages, busy, open, pendingResearch]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const leaveUrgentMode = () => { supportRef.current = undefined; setSupportTopic(undefined); setPendingResearch(undefined); setInput(""); question.current?.focus(); };

  const sendCloud = async (trimmed: string, options: { sanitizedFromTopic?: EmergencyTopic } = {}) => {
    if (!trimmed || trimmed.length > 2_000 || sending.current || loading) return;
    const version = epoch.current; const request = ++requestSequence.current; const isCurrent = () => version === epoch.current && request === requestSequence.current;
    sending.current = true; setBusy(true); setWarning(undefined);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete", sanitizedQuery: options.sanitizedFromTopic ? trimmed : undefined };
    setMessages((current) => [...current, userMessage]);
    try {
      let id = conversationId;
      if (!id && stage) {
        const created = await repository.createConversation(stage);
        if (!isCurrent()) return;
        id = created.data?.id; setWarning(created.warning); setConversationId(id);
      }
      if (!stage || !id) { setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]); return; }
      const result = await repository.sendMessage(id, stage, trimmed, options);
      if (!isCurrent()) return;
      setWarning(result.warning ?? result.error);
      setMessages((current) => [...current, result.data ?? localMessage(offlineChatReply(stage, trimmed))]);
    } catch {
      if (isCurrent()) { setWarning("NASA research chat is unavailable; no unsourced answer was generated."); setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]); }
    } finally { if (isCurrent()) { sending.current = false; setBusy(false); } }
  };

  const send = async (text = input) => {
    const trimmed = text.trim(); if (!trimmed || trimmed.length > 2_000) return;
    const safety = getUrgentSupport(trimmed, supportRef.current);
    if (!safety) { setInput(""); await sendCloud(trimmed); return; }
    requestSequence.current += 1; sending.current = false; setBusy(false); setInput("");
    supportRef.current = safety.topic; setSupportTopic(safety.topic); setPendingResearch(undefined);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete" };
    setMessages((current) => [...current, userMessage, localMessage(safety.content, safety)]);
  };

  const confirmResearch = async () => {
    if (!pendingResearch) return;
    const request = pendingResearch; setPendingResearch(undefined); supportRef.current = undefined; setSupportTopic(undefined);
    await sendCloud(request.query, { sanitizedFromTopic: request.topic });
  };

  const petState = supportTopic ? "support" : busy ? "thinking" : open ? "listening" : "idle";
  return <>
    <button ref={launcher} type="button" className={`chat-launcher${open ? " is-open" : ""}`} data-pet-state={petState} aria-label={open ? "Close ORBIT assistant" : "Open ORBIT assistant"} aria-expanded={open} aria-controls="orbit-chat" onClick={() => open ? close() : setOpen(true)}>
      <span className="chat-launcher-label"><strong>Ask NASA</strong><span>Research with ORBIT</span></span>
      <span className="chat-robot"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-robot-badge">{open ? <X size={13} /> : <Sparkles size={13} />}</span></span>
    </button>
    {open ? <section id="orbit-chat" className="chat-panel" data-pet-state={petState} role="dialog" aria-modal="false" aria-labelledby="orbit-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header><RobotAvatar imageSrc={avatarSrc} /><div className="chat-heading"><p className="eyebrow">NASA RESEARCH ASSISTANT</p><h2 id="orbit-title">ORBIT <span>AI</span></h2><p className="chat-pet-status" role="status"><span aria-hidden="true" />{supportTopic ? "Showing urgent guidance" : busy ? "Searching NASA sources…" : "Ready for a NASA question"}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close chat"><X size={18} /></button></header>
      <div className="chat-safety-note"><ShieldCheck size={14} aria-hidden="true" /><p>Answers use indexed public NASA documents. Not medical or operational authority.</p></div>
      <div className="chat-messages" ref={messageList}>
        {loading ? <p className="chat-meta" role="status">Loading saved NASA research…</p> : null}
        {messages.length === 0 ? <div className="chat-empty"><div className="chat-pet-intro"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-pet-greeting">Ask the NASA archive.</span></div><h3>What do you want to explore?</h3><p>ORBIT searches indexed NASA documents, then uses AI to explain only what those sources support.</p>{SUGGESTIONS.map((suggestion) => <button disabled={busy || loading} key={suggestion} type="button" onClick={() => void send(suggestion)}>{suggestion}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div> : null}
        <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><small>{message.role === "user" ? (message.sanitizedQuery ? "Sanitized NASA research question" : "You") : message.answerKind === "nasa_grounded" ? "ORBIT · NASA-grounded AI response" : message.answerKind === "no_evidence" ? "ORBIT · No verified NASA source" : "ORBIT · Urgent guidance"}</small><p>{message.content}</p>{message.citations?.length ? <div className="chat-source-cards" aria-label="NASA sources">{message.citations.map((source, index) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>[{index + 1}] {source.collection}</span><strong>{source.title}</strong>{source.publishedAt ? <small>{source.publishedAt}</small> : null}<p>{source.excerpt}</p><ArrowUpRight size={12} aria-hidden="true" /></a>)}</div> : null}{message.resources?.length ? <details className="chat-references"><summary>Urgent-help references</summary><span>Earth guidance; onboard procedures take precedence.</span>{message.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ArrowUpRight size={11} aria-hidden="true" /></a>)}</details> : null}</div>)}
          {busy ? <p className="chat-meta" role="status">ORBIT is searching and checking NASA sources…</p> : null}
        </div>
        {supportTopic ? <div className="chat-followups" aria-label="Urgent guidance options"><button type="button" onClick={() => setPendingResearch({ topic: supportTopic, query: sanitizedNasaQuery(supportTopic) })}><BookOpen size={13} aria-hidden="true" />Ask NASA about this topic</button><button type="button" onClick={leaveUrgentMode}>Return to NASA research</button></div> : null}
        {pendingResearch ? <div className="chat-research-confirm" role="group" aria-label="Confirm sanitized NASA research question"><p>Your personal message stays in this browser session. Send this neutral research question instead?</p><blockquote>{pendingResearch.query}</blockquote><div><button type="button" className="btn-primary" onClick={() => void confirmResearch()}>Send sanitized question</button><button type="button" className="btn-secondary" onClick={() => setPendingResearch(undefined)}>Cancel</button></div></div> : null}
      </div>
      <div className="chat-controls"><div className="chat-composer-topline"><button className="chat-urgent-shortcut" type="button" onClick={() => void send("I need help now")}><AlertTriangle size={13} aria-hidden="true" />I need urgent help</button><details className="chat-options"><summary>Research privacy</summary><p className="chat-privacy">NASA questions and grounded answers may be saved to your account. Urgent personal messages stay in this browser session and are never sent unless you confirm the neutral research rewrite.</p></details></div>{warning ? <p className="chat-warning" role="status">{warning}</p> : null}<form onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={question} value={input} maxLength={2_000} onChange={(event) => setInput(event.target.value)} placeholder="Ask a NASA or space question…" aria-label="NASA research question" /><button type="submit" aria-label="Send question" disabled={!input.trim() || busy || loading}><Send size={17} /></button></form></div>
    </section> : null}
  </>;
}
