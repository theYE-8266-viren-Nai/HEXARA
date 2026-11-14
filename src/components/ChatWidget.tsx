import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, CircleAlert, CircleHelp, Mic, Phone, Send, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeStage } from "../types/horizon";
import { createChatRepository } from "../lib/chatRepository";
import { offlineChatReply, type ChatMessage } from "../domain/chat";
import { forEarth, getUrgentSupport, type EmergencySupport, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";
import { sanitizedNasaQuery } from "../../supabase/functions/_shared/nasaGrounding";
import { classifyOrbitQuestion, faqsForStage, resourcesForCategory } from "../domain/orbitFaq";
import { RobotAvatar } from "./RobotAvatar";
import { useVapiOrbit } from "../lib/useVapiOrbit";

const RETIRED_SUGGESTIONS = ["I miss the view of Earth", "Life after the mission feels different", "I want to reconnect with people"];
const localMessage = (content: string, support?: EmergencySupport): ChatMessage => ({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString(), status: "complete", source: "built-in", answerKind: support ? "urgent_warning" : "unavailable", supportTopic: support?.topic, details: support?.details, resources: support?.resources });

function StructuredAnswer({ message, onFeedback }: { message: ChatMessage; onFeedback: (value: "yes" | "not_yet") => void }) {
  if (message.role !== "assistant" || (message.answerKind !== "nasa_grounded" && message.answerKind !== "general_health")) return null;
  const general = message.answerKind === "general_health";
  const resources = general ? [] : resourcesForCategory(message.category);
  return <div className="orbit-answer-card">
    {general ? <p className="orbit-general-note"><CircleAlert size={13} aria-hidden="true" />General health information, not from NASA sources and not personal medical advice. Talk to a doctor about your own health.</p> : null}
    {message.confidence ? <span className={`orbit-confidence confidence-${message.confidence}`}>{message.confidence} confidence</span> : null}
    {message.keyPoints?.length ? <section><h4>Key points</h4><ul>{message.keyPoints.map((point) => <li key={point}><CheckCircle2 size={13} aria-hidden="true" />{point}</li>)}</ul></section> : null}
    {message.nextSteps?.length ? <section><h4>Useful next steps</h4><ul>{message.nextSteps.map((step) => <li key={step}><ArrowUpRight size={13} aria-hidden="true" />{step}</li>)}</ul></section> : null}
    {message.warnings?.length ? <section className="orbit-answer-warnings"><h4><CircleAlert size={13} aria-hidden="true" /> Keep in mind</h4><ul>{message.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
    {message.questionsToExplore?.length ? <section><h4><CircleHelp size={13} aria-hidden="true" /> Explore next</h4><ul>{message.questionsToExplore.map((question) => <li key={question}>{question}</li>)}</ul></section> : null}
    {general ? <section className="orbit-related-resources"><h4>Trusted health information</h4><a href="https://medlineplus.gov/healthtopics.html" target="_blank" rel="noreferrer"><span>U.S. National Library of Medicine</span><strong>MedlinePlus health topics</strong><small>Plain-language information on symptoms, conditions and wellness.</small><ArrowUpRight size={12} aria-hidden="true" /></a></section> : null}
    {resources.length ? <section className="orbit-related-resources"><h4>Related NASA resources</h4>{resources.slice(0, 3).map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><span>{resource.collection}</span><strong>{resource.title}</strong><small>{resource.description}</small><ArrowUpRight size={12} aria-hidden="true" /></a>)}</section> : null}
    <div className="orbit-feedback" aria-label="Answer feedback"><span>Was this useful?</span><button type="button" onClick={() => onFeedback("yes")}>Yes</button><button type="button" onClick={() => onFeedback("not_yet")}>Not yet</button></div>
  </div>;
}

// One-tap next steps for urgent guidance. OrbitWell never contacts anyone itself.
function UrgentActions({ onEarth, topic }: { onEarth: boolean; topic?: EmergencyTopic }) {
  const groundComms = import.meta.env.VITE_GROUND_COMMS_URL as string | undefined;
  return <div className="chat-urgent-actions" role="group" aria-label="Get help now">
    {onEarth ? <>
      <a className="chat-urgent-call" href="tel:112"><Phone size={15} aria-hidden="true" />Call emergency services (112)</a>
      <small>112 works from most mobile phones. In the US or Canada dial 911; otherwise use your local emergency number.</small>
      {topic === "distress" ? <a className="chat-urgent-link" href="https://findahelpline.com/" target="_blank" rel="noreferrer">Find a free crisis line near you<ArrowUpRight size={12} aria-hidden="true" /></a> : null}
    </> : <>
      <p className="chat-urgent-step"><Phone size={15} aria-hidden="true" />Alert a crewmate and use your mission's emergency channel now.</p>
      {groundComms ? <a className="chat-urgent-link" href={groundComms} target="_blank" rel="noreferrer">Open ground support channel<ArrowUpRight size={12} aria-hidden="true" /></a> : null}
    </>}
    <small>OrbitWell has not contacted anyone.</small>
  </div>;
}

export function ChatWidget({ stage, client, userId, avatarSrc, openRequest }: { stage: LifeStage | null; client: SupabaseClient | null; userId: string | null; avatarSrc?: string; openRequest?: number }) {
  const [open, setOpen] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [supportTopic, setSupportTopic] = useState<EmergencyTopic>();
  const [pendingResearch, setPendingResearch] = useState<{ topic: EmergencyTopic; query: string }>();
  const [feedback, setFeedback] = useState<Record<string, "yes" | "not_yet">>({});
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
  const privateMode = stage === "retired" && !researchMode;
  const visibleMessages = privateMode ? privateMessages : messages;
  const faqs = faqsForStage(stage ?? "future");
  const onEarth = stage !== "active";
  const voice = useVapiOrbit((transcript) => { void send(transcript, "voice"); });

  useEffect(() => {
    epoch.current += 1; requestSequence.current += 1; supportRef.current = undefined;
    sending.current = false; hydrated.current = false;
    setConversationId(undefined); setMessages([]); setPrivateMessages([]); setResearchMode(false); setWarning(undefined); setPendingResearch(undefined);
    setInput(""); setBusy(false); setLoading(false); setSupportTopic(undefined); setFeedback({});
  }, [stage, repository]);

  useEffect(() => {
    if (!open || !stage || privateMode || hydrated.current) return;
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
  }, [open, stage, privateMode, repository]);

  useEffect(() => { if (open) question.current?.focus(); }, [open]);
  useEffect(() => { if ((openRequest ?? 0) > lastOpenRequest.current) setOpen(true); lastOpenRequest.current = openRequest ?? 0; }, [openRequest]);
  useEffect(() => { const list = messageList.current; if (list) list.scrollTop = list.scrollHeight; }, [visibleMessages, busy, open, pendingResearch]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const leaveUrgentMode = () => { supportRef.current = undefined; setSupportTopic(undefined); setPendingResearch(undefined); setInput(""); question.current?.focus(); };

  const sendCloud = async (trimmed: string, options: { sanitizedFromTopic?: EmergencyTopic; inputMode?: "text" | "voice" } = {}) => {
    if (!trimmed || trimmed.length > 2_000 || sending.current || loading) return;
    const version = epoch.current; const request = ++requestSequence.current; const isCurrent = () => version === epoch.current && request === requestSequence.current;
    sending.current = true; setBusy(true); setWarning(undefined);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete", sanitizedQuery: options.sanitizedFromTopic ? trimmed : undefined, inputMode: options.inputMode ?? "text" };
    setMessages((current) => [...current, userMessage]);
    try {
      let id = conversationId;
      if (!id && stage) {
        const created = await repository.createConversation(stage);
        if (!isCurrent()) return;
        id = created.data?.id; setWarning(created.warning); setConversationId(id);
      }
      if (!stage || !id) { setMessages((current) => [...current, localMessage(offlineChatReply(null, trimmed))]); return; }
      const result = await repository.sendMessage(id, stage, trimmed, { ...options, category: classifyOrbitQuestion(trimmed) });
      if (!isCurrent()) return;
      setWarning(result.warning ?? result.error);
      const reply = result.data ?? localMessage(offlineChatReply(null, trimmed));
      setMessages((current) => [...current, reply]);
      if (options.inputMode === "voice" && (voice.state === "listening" || voice.state === "thinking" || voice.state === "speaking")) voice.speak(result.data ? reply.content : result.error ?? reply.content);
    } catch {
      if (isCurrent()) { setWarning("NASA research chat is unavailable; no unsourced answer was generated."); setMessages((current) => [...current, localMessage(offlineChatReply(null, trimmed))]); }
    } finally { if (isCurrent()) { sending.current = false; setBusy(false); } }
  };

  const send = async (text = input, inputMode: "text" | "voice" = "text") => {
    const trimmed = text.trim(); if (!trimmed || trimmed.length > 2_000) return;
    const detected = getUrgentSupport(trimmed, supportRef.current);
    // Future trainees and Retired astronauts are on Earth: emergency services come first, not a crew medic.
    const safety = detected && onEarth ? forEarth(detected) : detected;
    if (!safety) {
      setInput("");
      if (privateMode) {
        setWarning(undefined);
        setPrivateMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete" }, localMessage(offlineChatReply("retired", trimmed))]);
        return;
      }
      await sendCloud(trimmed, { inputMode }); return;
    }
    requestSequence.current += 1; sending.current = false; setBusy(false); setInput("");
    supportRef.current = safety.topic; setSupportTopic(safety.topic); setPendingResearch(undefined);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: new Date().toISOString(), status: "complete", inputMode };
    const append = privateMode ? setPrivateMessages : setMessages;
    append((current) => [...current, userMessage, localMessage(safety.content, safety)]);
  };

  const confirmResearch = async () => {
    if (!pendingResearch) return;
    const request = pendingResearch; setPendingResearch(undefined); supportRef.current = undefined; setSupportTopic(undefined);
    setResearchMode(true);
    await sendCloud(request.query, { sanitizedFromTopic: request.topic });
  };

  const latestUrgentId = [...visibleMessages].reverse().find((message) => message.answerKind === "urgent_warning")?.id;
  const petState = supportTopic ? "support" : busy ? "thinking" : open ? "listening" : "idle";
  return <>
    <button ref={launcher} type="button" className={`chat-launcher${open ? " is-open" : ""}`} data-pet-state={petState} aria-label={open ? "Close ORBIT assistant" : "Open ORBIT assistant"} aria-expanded={open} aria-controls="orbit-chat" onClick={() => open ? close() : setOpen(true)}>
      <span className="chat-launcher-label"><strong>{stage === "retired" ? "Talk with ORBIT" : "Ask NASA"}</strong><span>{stage === "retired" ? "A space to talk" : "Research with ORBIT"}</span></span>
      <span className="chat-robot"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-robot-badge">{open ? <X size={13} /> : <Sparkles size={13} />}</span></span>
    </button>
    {open ? <section id="orbit-chat" className="chat-panel" data-pet-state={petState} role="dialog" aria-modal="false" aria-labelledby="orbit-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header><RobotAvatar imageSrc={avatarSrc} /><div className="chat-heading"><p className="eyebrow">{privateMode ? "PRIVATE CONVERSATION" : "NASA RESEARCH ASSISTANT"}</p><h2 id="orbit-title">ORBIT <span>AI</span></h2><p className="chat-pet-status" role="status"><span aria-hidden="true" />{supportTopic ? "Showing urgent guidance" : busy ? "Searching NASA sources…" : privateMode ? "I'm listening" : "Ready for a NASA question"}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close chat"><X size={18} /></button></header>
      <div className="chat-safety-note"><ShieldCheck size={14} aria-hidden="true" /><p>{privateMode ? "Private replies stay in this browser session. No one is contacted." : "NASA answers cite indexed NASA documents. Health answers are general information. Not medical or operational authority."}</p></div>
      {stage === "retired" ? <div className="chat-mode-switch"><button type="button" className="btn-link" onClick={() => { leaveUrgentMode(); setWarning(undefined); setResearchMode((current) => !current); }}>{privateMode ? "Explore NASA research" : "Return to private chat"}</button></div> : null}
      <div className="chat-messages" ref={messageList}>
        {loading ? <p className="chat-meta" role="status">Loading saved NASA research…</p> : null}
        {visibleMessages.length === 0 ? <div className="chat-empty"><div className="chat-pet-intro"><RobotAvatar imageSrc={avatarSrc} /><span className="chat-pet-greeting">{privateMode ? "Hey, I'm ORBIT." : "Ask about space or health."}</span></div><h3>{privateMode ? "There's room for your story here." : "What do you want to explore?"}</h3><p>{privateMode ? "Share a memory, a change in perspective, or how today feels. Start anywhere." : "ORBIT searches indexed NASA documents and explains what they support. For everyday health questions it can also give general, non-diagnostic information."}</p>{privateMode ? RETIRED_SUGGESTIONS.map((suggestion) => <button disabled={busy || loading} key={suggestion} type="button" onClick={() => void send(suggestion)}>{suggestion}<ArrowUpRight size={14} aria-hidden="true" /></button>) : faqs.slice(0, 5).map((faq) => <button disabled={busy || loading} key={faq.question} type="button" onClick={() => void send(faq.question)}><span><strong>{faq.title}</strong><small>{faq.description}</small></span><ArrowUpRight size={14} aria-hidden="true" /></button>)}</div> : null}
        <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          {visibleMessages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><small>{message.role === "user" ? (message.sanitizedQuery ? "Sanitized NASA research question" : "You") : message.answerKind === "nasa_grounded" ? "ORBIT · NASA-grounded AI response" : message.answerKind === "general_health" ? "ORBIT · General health information" : message.answerKind === "no_evidence" ? "ORBIT · No verified NASA source" : message.answerKind === "urgent_warning" ? "ORBIT · Urgent guidance" : privateMode ? "ORBIT · Private reply" : "ORBIT · Research unavailable"}</small><p>{message.content}</p>{message.answerKind === "urgent_warning" && message.id === latestUrgentId ? <UrgentActions onEarth={onEarth} topic={message.supportTopic} /> : null}<StructuredAnswer message={message} onFeedback={(value) => setFeedback((current) => ({ ...current, [message.id]: value }))} />{feedback[message.id] ? <p className="orbit-feedback-thanks" role="status">Thanks — your feedback stays in this browser session.</p> : null}{message.citations?.length ? <div className="chat-source-cards" aria-label="NASA sources">{message.citations.map((source, index) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>[{index + 1}] {source.collection}</span><strong>{source.title}</strong>{source.publishedAt ? <small>{source.publishedAt}</small> : null}<p>{source.excerpt}</p><ArrowUpRight size={12} aria-hidden="true" /></a>)}</div> : null}{message.details || message.resources?.length ? <details className="chat-references"><summary>More guidance</summary>{message.details ? <p>{message.details}</p> : null}<span>{onEarth ? "General first-aid guidance; follow the emergency operator's instructions." : "Earth guidance; onboard procedures take precedence."}</span>{message.resources?.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ArrowUpRight size={11} aria-hidden="true" /></a>)}</details> : null}</div>)}
          {busy ? <p className="chat-meta" role="status">ORBIT is searching and checking NASA sources…</p> : null}
        </div>
        {visibleMessages.length > 0 && !busy && !loading && !supportTopic && !pendingResearch ? (() => {
          // Keep suggestions available after the first question, skipping ones already asked.
          const asked = new Set(visibleMessages.filter((message) => message.role === "user").map((message) => message.content.trim()));
          const remaining = privateMode ? RETIRED_SUGGESTIONS.filter((suggestion) => !asked.has(suggestion)).map((suggestion) => ({ key: suggestion, label: suggestion, question: suggestion })) : faqs.filter((faq) => !asked.has(faq.question)).map((faq) => ({ key: faq.question, label: faq.title, question: faq.question }));
          return remaining.length ? <div className="chat-suggestions" role="group" aria-label="Suggested questions"><span>Try another question</span><div>{remaining.slice(0, 4).map((item) => <button key={item.key} type="button" title={item.question} onClick={() => void send(item.question)}>{item.label}<ArrowUpRight size={12} aria-hidden="true" /></button>)}</div></div> : null;
        })() : null}
        {supportTopic ? <div className="chat-followups" aria-label="Urgent guidance options"><button type="button" onClick={leaveUrgentMode}>Return to {privateMode ? "private chat" : "NASA research"}</button><button type="button" className="chat-followup-secondary" onClick={() => setPendingResearch({ topic: supportTopic, query: sanitizedNasaQuery(supportTopic) })}><BookOpen size={13} aria-hidden="true" />Ask NASA about this topic</button></div> : null}
        {pendingResearch ? <div className="chat-research-confirm" role="group" aria-label="Confirm sanitized NASA research question"><p>Your personal message stays in this browser session. Send this neutral research question instead?</p><blockquote>{pendingResearch.query}</blockquote><div><button type="button" className="btn-primary" onClick={() => void confirmResearch()}>Send sanitized question</button><button type="button" className="btn-secondary" onClick={() => setPendingResearch(undefined)}>Cancel</button></div></div> : null}
      </div>
      <div className="chat-controls"><div className="chat-composer-topline"><button className="chat-urgent-shortcut" type="button" onClick={() => void send("I need help now")}><AlertTriangle size={13} aria-hidden="true" />I need urgent help</button>{!privateMode ? <button type="button" className="chat-voice-button" disabled={!voice.available || busy} onClick={() => voice.state === "listening" ? voice.stop() : void voice.start()}>{voice.state === "listening" ? <Square size={13} /> : <Mic size={13} />} {voice.state === "unavailable" ? "Voice unavailable" : voice.state === "listening" ? "Stop listening" : "Ask by voice"}</button> : null}<details className="chat-options"><summary>Chat privacy</summary><p className="chat-privacy">{stage === "retired" ? "Private conversation stays in this browser session. If you switch to NASA research, those questions and answers may be saved to your account. Urgent personal messages are never sent automatically." : "NASA questions and grounded answers may be saved to your account. Urgent personal messages stay in this browser session and are never sent unless you confirm the neutral research rewrite."}</p></details></div>{voice.error ? <p className="chat-warning" role="status">{voice.error}</p> : null}{warning ? <p className="chat-warning" role="status">{warning}</p> : null}<form onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={question} value={input} maxLength={2_000} onChange={(event) => setInput(event.target.value)} placeholder={privateMode ? "Share what's on your mind…" : "Ask a NASA, space or health question…"} aria-label={privateMode ? "Private message" : "NASA research question"} /><button type="submit" aria-label="Send question" disabled={!input.trim() || busy || loading}><Send size={17} /></button></form></div>
    </section> : null}
  </>;
}
