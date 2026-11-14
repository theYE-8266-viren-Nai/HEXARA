import { AlertTriangle, ArrowUpRight, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { createChatRepository } from "../lib/chatRepository";
import { offlineChatReply, stageName, type ChatContextSummary, type ChatMessage } from "../domain/chat";
import { getEmergencySupport, type EmergencySupport, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";
import { RobotAvatar } from "./RobotAvatar";

const suggestions = (stage: LifeStage | null) => stage === "retired" ? ["I miss the view of Earth", "Life after the mission feels different", "I want to reconnect with people", "I need help now"] : ["I'm not feeling well", "I need help now", stage === "future" ? "How do I build a personal baseline?" : "How can I support my wellbeing today?"];
const localMessage = (content: string, support?: EmergencySupport): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in", supportTopic: support?.topic, details: support?.details, resources: support?.resources });

export function ChatWidget({ stage, client, userId, context, avatarSrc, openRequest }: { stage: LifeStage | null; client: SupabaseClient | null; userId: string | null; context?: ChatContextSummary; avatarSrc?: string; openRequest?: number }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [includeContext, setIncludeContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [supportTopic, setSupportTopic] = useState<EmergencyTopic>();
  const supportRef = useRef<EmergencyTopic | undefined>(undefined);
  const requestSequence = useRef(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const epoch = useRef(0);
  const sending = useRef(false);
  const lastOpenRequest = useRef(openRequest ?? 0);
  const hydrated = useRef(false);
  const repository = useMemo(() => createChatRepository(client, userId), [client, userId]);

  useEffect(() => {
    epoch.current += 1;
    requestSequence.current += 1;
    supportRef.current = undefined;
    sending.current = false; hydrated.current = false;
    setConversationId(undefined); setMessages([]); setWarning(undefined);
    setInput(""); setIncludeContext(false); setBusy(false); setLoading(false); setSupportTopic(undefined);
  }, [stage, repository]);

  useEffect(() => {
    if (!open || !stage || hydrated.current) return;
    hydrated.current = true;
    const version = epoch.current;
    setLoading(true);
    void (async () => {
      try {
        const list = await repository.listConversations(stage);
        if (version !== epoch.current) return;
        setWarning(list.warning);
        const conversation = list.data[0];
        if (conversation) {
          const loaded = await repository.listMessages(conversation.id);
          if (version !== epoch.current) return;
          setConversationId(conversation.id);
          // Preserve immediate local safety replies sent while history was loading.
          setMessages((current) => [...loaded.data, ...current]);
          setWarning(loaded.warning ?? list.warning);
        }
      } catch { if (version === epoch.current) setWarning("Cloud history is unavailable. Built-in guidance still works."); }
      finally { if (version === epoch.current) setLoading(false); }
    })();
  }, [open, stage, repository]);

  useEffect(() => { if (open) question.current?.focus(); }, [open]);
  useEffect(() => { if ((openRequest ?? 0) > lastOpenRequest.current) setOpen(true); lastOpenRequest.current = openRequest ?? 0; }, [openRequest]);
  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const everydayChat = () => {
    supportRef.current = undefined; setSupportTopic(undefined);
    setInput(""); question.current?.focus();
  };
  const send = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2_000) return;
    const safety = getEmergencySupport(trimmed, supportRef.current);
    if (!safety && (sending.current || loading)) return;
    setInput("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete" };
    if (safety) {
      // Urgent conversation takes precedence over any older pending cloud response.
      requestSequence.current += 1; sending.current = false; setBusy(false);
      supportRef.current = safety.topic; setSupportTopic(safety.topic);
      setMessages((current) => [...current, userMessage, localMessage(safety.content, safety)]);
      return;
    }
    const version = epoch.current;
    const request = ++requestSequence.current;
    const isCurrent = () => version === epoch.current && request === requestSequence.current;
    sending.current = true; setBusy(true);
    setMessages((current) => [...current, userMessage]);
    try {
      let id = conversationId;
      if (!id && stage) {
        const created = await repository.createConversation(stage);
        if (!isCurrent()) return;
        id = created.data?.id;
        setWarning(created.warning); setConversationId(id);
      }
      if (!stage || !id) {
        setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]);
        return;
      }
      const result = await repository.sendMessage(id, stage, trimmed, includeContext, context);
      if (!isCurrent()) return;
      setWarning(result.warning ?? result.error);
      setMessages((current) => [...current, result.data ?? localMessage(offlineChatReply(stage, trimmed))]);
    } catch {
      if (isCurrent()) {
        setWarning("AI unavailable. Built-in reply; not saved remotely.");
        setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]);
      }
    } finally { if (isCurrent()) { sending.current = false; setBusy(false); } }
  };

  const petState = supportTopic ? "support" : busy ? "thinking" : open ? "listening" : "idle";
  const followUps = supportTopic === "check_in" ? ["I feel dizzy", "I'm having trouble breathing", "I need help now"] : ["A medic is with me", "I'm alone", "What should I tell the medic?"];

  return <>
    <button ref={launcher} type="button" className={`chat-launcher${open ? " is-open" : ""}`} data-pet-state={petState} aria-label={open ? "Close ORBIT companion" : "Open ORBIT companion"} aria-expanded={open} aria-controls="orbit-chat" onClick={() => open ? close() : setOpen(true)}>
      <span className="chat-launcher-label"><strong>How are you feeling?</strong><span>Tap to chat with ORBIT</span></span>
      <span className="chat-robot"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-robot-badge">{open ? <X size={13} /> : <Sparkles size={13} />}</span></span>
    </button>
    {open ? <section id="orbit-chat" className="chat-panel" data-pet-state={petState} role="dialog" aria-modal="false" aria-labelledby="orbit-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header>
        <RobotAvatar imageSrc={avatarSrc} />
        <div className="chat-heading"><h2 id="orbit-title">ORBIT <span>AI</span></h2><p className="chat-pet-status" role="status"><span aria-hidden="true" />{petState === "support" ? "Here to help" : busy ? "Thinking…" : "I'm listening"}</p></div>
        <button type="button" className="icon-button" onClick={close} aria-label="Close chat"><X size={18} /></button>
      </header>
      <div className="chat-safety-note"><ShieldCheck size={14} aria-hidden="true" /><p>AI only. No diagnosis/doses. No one contacted.</p></div>
      <div className="chat-messages" ref={messageList}>
        {loading ? <p className="chat-meta" role="status">Loading saved conversation…</p> : null}
        {messages.length === 0 ? <div className="chat-empty"><div className="chat-pet-intro"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-pet-greeting">Hey, I'm ORBIT.</span></div><h3>{stage === "retired" ? "There's room for your story here." : "How are you feeling?"}</h3><p>{stage === "retired" ? "Share a memory, a change in perspective, or just how today feels. Start anywhere." : "Tell me what's happening."}</p><p className="chat-stage-label">{stage ? stageName(stage) : "Space traveler"} support</p>{suggestions(stage).map((suggestion) => <button disabled={(busy || loading) && !getEmergencySupport(suggestion)} key={suggestion} type="button" onClick={() => void send(suggestion)}>{suggestion}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div> : null}
        <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><small>{message.role === "user" ? "You" : message.source === "built-in" ? "Built-in" : "AI"}</small><p>{message.content}</p>{message.details || message.resources?.length ? <details className="chat-references"><summary>More guidance</summary>{message.details ? <p>{message.details}</p> : null}<span>Onboard procedures take precedence.</span>{message.resources?.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ArrowUpRight size={11} aria-hidden="true" /></a>)}</details> : null}</div>)}
          {busy ? <p className="chat-meta" role="status">ORBIT is thinking…</p> : null}
        </div>
        {supportTopic ? <div className="chat-followups" aria-label="Continue the conversation">{followUps.map((text) => <button key={text} type="button" onClick={() => void send(text)}>{text}</button>)}<button type="button" onClick={everydayChat}>Return to everyday chat</button></div> : null}
      </div>
      <div className="chat-controls">
        <div className="chat-composer-topline"><button className="chat-urgent-shortcut" type="button" onClick={() => void send("I need help now")}><AlertTriangle size={13} aria-hidden="true" />I need urgent help</button><details className="chat-options"><summary>Chat privacy</summary>{context ? <label><input type="checkbox" checked={includeContext} disabled={Boolean(supportTopic)} onChange={(event) => setIncludeContext(event.target.checked)} /> Share a short dashboard summary with cloud AI</label> : null}<p className="chat-privacy">Regular chat uses cloud AI and may be saved to your account. Matched symptom conversations and their follow-ups stay in this session. No emergency service is contacted.</p></details></div>
        {warning ? <p className="chat-warning" role="status">{warning}</p> : null}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={question} value={input} maxLength={2_000} onChange={(event) => setInput(event.target.value)} placeholder="Tell ORBIT what's happening…" aria-label="Chat question" /><button type="submit" aria-label="Send question" disabled={!input.trim() || ((busy || loading) && !getEmergencySupport(input, supportTopic))}><Send size={17} /></button></form>
      </div>
    </section> : null}
  </>;
}
