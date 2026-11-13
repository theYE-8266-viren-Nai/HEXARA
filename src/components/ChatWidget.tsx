import { AlertTriangle, ArrowUpRight, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { createChatRepository } from "../lib/chatRepository";
import { offlineChatReply, stageName, type ChatContextSummary, type ChatMessage } from "../domain/chat";
import { chatSafetyReply, EMERGENCY_GUIDANCE, GLUCOSE_GUIDANCE_URL } from "../../supabase/functions/_shared/chatSafety";
import { RobotAvatar } from "./RobotAvatar";

const suggestions = (stage: LifeStage | null) => stage === "future"
  ? ["How do I build a personal baseline?", "What should I expect in the first 14 days?"]
  : stage === "retired" ? ["How can I prepare for long-term follow-up?", "How can I support my wellbeing today?"]
  : ["What should I do if a trend changes?", "How can I support my wellbeing today?"];
const localMessage = (content: string): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in" });

export function ChatWidget({ stage, client, userId, context, avatarSrc }: { stage: LifeStage | null; client: SupabaseClient | null; userId: string | null; context?: ChatContextSummary; avatarSrc?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [includeContext, setIncludeContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const epoch = useRef(0);
  const sending = useRef(false);
  const hydrated = useRef(false);
  const repository = useMemo(() => createChatRepository(client, userId), [client, userId]);

  useEffect(() => {
    epoch.current += 1;
    sending.current = false; hydrated.current = false;
    setConversationId(undefined); setMessages([]); setWarning(undefined);
    setInput(""); setIncludeContext(false); setBusy(false); setLoading(false); setEmergencyOpen(false);
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
  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);
  useEffect(() => {
    if (emergencyOpen && messageList.current) messageList.current.scrollTop = 0;
  }, [emergencyOpen]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const send = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2_000) return;
    const safety = chatSafetyReply(trimmed);
    if (!safety && (sending.current || loading)) return;
    setInput("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete" };
    if (safety) {
      setEmergencyOpen(true);
      setMessages((current) => [...current, userMessage, localMessage(safety)]);
      return;
    }
    const version = epoch.current;
    sending.current = true; setBusy(true);
    setMessages((current) => [...current, userMessage]);
    try {
      let id = conversationId;
      if (!id && stage) {
        const created = await repository.createConversation(stage);
        if (version !== epoch.current) return;
        id = created.data?.id;
        setWarning(created.warning); setConversationId(id);
      }
      if (!stage || !id) {
        setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]);
        return;
      }
      const result = await repository.sendMessage(id, stage, trimmed, includeContext, context);
      if (version !== epoch.current) return;
      setWarning(result.warning ?? result.error);
      setMessages((current) => [...current, result.data ?? localMessage(offlineChatReply(stage, trimmed))]);
    } catch {
      if (version === epoch.current) {
        setWarning("Cloud chat is unavailable. This reply is built in and has not been saved remotely.");
        setMessages((current) => [...current, localMessage(offlineChatReply(stage, trimmed))]);
      }
    } finally { if (version === epoch.current) { sending.current = false; setBusy(false); } }
  };

  return <>
    <button ref={launcher} type="button" className={`chat-launcher${open ? " is-open" : ""}`} aria-label={open ? "Close ORBIT companion" : "Open ORBIT companion"} aria-expanded={open} aria-controls="orbit-chat" onClick={() => open ? close() : setOpen(true)}>
      <span className="chat-launcher-label"><strong>Ask ORBIT</strong><span>Your AI companion</span></span>
      <span className="chat-robot"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-robot-badge">{open ? <X size={13} /> : <Sparkles size={13} />}</span></span>
    </button>
    {open ? <section id="orbit-chat" className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="orbit-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header>
        <RobotAvatar imageSrc={avatarSrc} />
        <div className="chat-heading"><p className="eyebrow">HORIZON COMPANION</p><h2 id="orbit-title">ORBIT <span>AI</span></h2><p>A little support, wherever you are.</p></div>
        <button type="button" className="icon-button" onClick={close} aria-label="Close chat"><X size={18} /></button>
      </header>
      <div className="chat-safety-note"><ShieldCheck size={14} aria-hidden="true" /><p>AI companion, not a doctor. No diagnosis, medication doses, or emergency monitoring.</p></div>
      <button className="chat-urgent-toggle" type="button" aria-expanded={emergencyOpen} aria-controls="orbit-emergency" onClick={() => setEmergencyOpen((value) => !value)}><AlertTriangle size={15} aria-hidden="true" /><span>Need urgent help?</span><span>{emergencyOpen ? "Hide steps" : "View steps"} <ArrowUpRight size={13} /></span></button>
      <div className="chat-messages" ref={messageList}>
        {emergencyOpen ? <aside id="orbit-emergency" className="chat-emergency" aria-label="Emergency support steps"><h3>Reach a person now</h3><p>{EMERGENCY_GUIDANCE}</p><button type="button" onClick={() => void send("My blood sugar may be low")}>Blood sugar concern</button><a href={GLUCOSE_GUIDANCE_URL} target="_blank" rel="noreferrer">NIH: low blood sugar guidance <ArrowUpRight size={12} /></a></aside> : null}
        {loading ? <p className="chat-meta" role="status">Loading saved conversation…</p> : null}
        {messages.length === 0 ? <div className="chat-empty"><span className="chat-welcome-icon"><Sparkles size={19} /></span><h3>Hello, I’m ORBIT.</h3><p>I can explain Horizon’s simulated signals, help with routines, or help you prepare questions for your crew medic.</p><p className="chat-stage-label">{stage ? stageName(stage) : "Space traveler"} support</p>{suggestions(stage).map((suggestion) => <button disabled={busy || loading} key={suggestion} type="button" onClick={() => void send(suggestion)}>{suggestion}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div> : null}
        <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><small>{message.role === "user" ? "You" : message.source === "built-in" ? "ORBIT · Built-in guidance" : "ORBIT · AI response"}</small><p>{message.content}</p></div>)}
          {busy ? <p className="chat-meta" role="status">ORBIT is thinking…</p> : null}
        </div>
      </div>
      <div className="chat-controls">
        {context ? <label><input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} /> Share a short dashboard summary with cloud AI</label> : null}
        <p className="chat-privacy">Regular chat uses cloud AI and may be saved to your account. Urgent prompts matched by built-in guidance stay in this session.</p>
        {warning ? <p className="chat-warning" role="status">{warning}</p> : null}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={question} value={input} maxLength={2_000} onChange={(event) => setInput(event.target.value)} placeholder="Ask ORBIT a question…" aria-label="Chat question" /><button type="submit" aria-label="Send question" disabled={!input.trim() || ((busy || loading) && !chatSafetyReply(input))}><Send size={17} /></button></form>
      </div>
    </section> : null}
  </>;
}
