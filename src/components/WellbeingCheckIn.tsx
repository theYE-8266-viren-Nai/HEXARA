import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, RotateCcw, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { summarizeCheckIn, visibleQuestions, type CheckInAnswers } from "../domain/wellbeingCheckIn";
import { usePersistedState } from "../lib/usePersistedState";
import type { LifeStage } from "../types/horizon";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSampleHistory } from "../domain/wellbeingHistory";

type CompletedCheckIn = { answers: CheckInAnswers; note: string; completedAt: string; sample?: boolean };
type SavedCheckIn = CompletedCheckIn | null;
type JournalEntry = { id: string; createdAt: string; text: string };
const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sundayOf = (date: Date) => { const result = new Date(date); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - result.getDay()); return result; };
function sampleCheckIn(stage: LifeStage, date: Date): CompletedCheckIn {
  const answers: CheckInAnswers = {};
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const question = visibleQuestions(stage, answers).find((item) => answers[item.id] === undefined);
    if (!question) break;
    const seed = date.getDate() + question.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const option = question.options[seed % question.options.length];
    answers[question.id] = question.multi ? [option.id] : option.id;
  }
  if (stage === "future") answers.overallMood = String((date.getDate() % 5) + 1);
  const completedAt = new Date(date); completedAt.setHours(17, 30, 0, 0);
  return { answers, note: "", completedAt: completedAt.toISOString(), sample: true };
}

const COPY: Record<LifeStage, { kicker: string; title: string; lede: string }> = {
  active: { kicker: "Wellbeing · In flight", title: "A moment for yourself", lede: "Start with your feelings and connections. The questions are optional, one at a time, and your answers stay on this device." },
  future: { kicker: "Wellbeing · Before flight", title: "A moment for yourself", lede: "Start with your feelings and connections. The questions are optional, one at a time, and your answers stay on this device." },
  retired: { kicker: "Wellbeing · After flight", title: "A moment for yourself", lede: "Start with your feelings and connections. The questions are optional, one at a time, and your answers stay on this device." },
};

export function WellbeingCheckIn({ stage }: { stage: LifeStage; client: SupabaseClient | null }) {
  const [saved, setSaved] = usePersistedState<SavedCheckIn>(`horizon:checkin:${stage}`, null);
  const [checkInHistory, setCheckInHistory] = usePersistedState<CompletedCheckIn[]>(`horizon:checkin-history:${stage}`, []);
  const [journalEntries, setJournalEntries] = usePersistedState<JournalEntry[]>(`horizon:journal:${stage}`, []);
  const [answers, setAnswers] = useState<CheckInAnswers>({});
  const [note, setNote] = useState("");
  const [step, setStep] = useState(0);
  const [showMoodIntro, setShowMoodIntro] = useState(stage === "future");
  const [moodRating, setMoodRating] = useState(3);
  const [journalOpen, setJournalOpen] = useState(true);
  const [journalCheckInActive, setJournalCheckInActive] = useState(false);
  const [selectedJournalDate, setSelectedJournalDate] = useState(() => toDateKey(new Date()));
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));
  const questions = visibleQuestions(stage, answers);
  const onNoteStep = step >= questions.length;
  const copy = COPY[stage];
  const journalWeek = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; });
  const allCheckIns: CompletedCheckIn[] = [...checkInHistory, ...(saved && !checkInHistory.some((item) => item.completedAt === saved.completedAt) ? [saved] : [])];
  const todayKey = toDateKey(new Date());
  const displayedSamples = journalWeek.filter((date) => hasSampleHistory(date) && !allCheckIns.some((item) => toDateKey(new Date(item.completedAt)) === toDateKey(date))).map((date) => sampleCheckIn(stage, date));
  const visibleCheckIns = [...allCheckIns, ...displayedSamples];
  const selectedDateCheckIns = visibleCheckIns.filter((item) => toDateKey(new Date(item.completedAt)) === selectedJournalDate).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const selectedDateHasHistory = selectedDateCheckIns.length > 0 || journalEntries.some((entry) => toDateKey(new Date(entry.createdAt)) === selectedJournalDate);
  const historyDateCheckIns = visibleCheckIns.filter((item) => toDateKey(new Date(item.completedAt)) === historyDate).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const historyDateEntries = journalEntries.filter((entry) => toDateKey(new Date(entry.createdAt)) === historyDate);
  const weekMonthLabel = journalWeek[0].getMonth() === journalWeek[6].getMonth() ? journalWeek[6].toLocaleDateString(undefined, { month: "long", year: "numeric" }) : `${journalWeek[0].toLocaleDateString(undefined, { month: "long" })} – ${journalWeek[6].toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
  const moveWeek = (offset: number) => { const next = new Date(weekStart); next.setDate(next.getDate() + offset * 7); setWeekStart(next); setSelectedJournalDate(toDateKey(next)); };
  const deleteCheckIn = (completedAt: string) => {
    setCheckInHistory((current) => current.filter((item) => item.completedAt !== completedAt));
    if (saved?.completedAt === completedAt) setSaved(null);
  };
  const startJournalCheckIn = () => { setWeekStart(sundayOf(new Date())); setSelectedJournalDate(todayKey); setJournalOpen(false); setJournalCheckInActive(true); setAnswers({}); setNote(""); setStep(0); setMoodRating(3); setShowMoodIntro(true); };
  const restart = () => { if (saved) setCheckInHistory((current) => current.some((item) => item.completedAt === saved.completedAt) ? current : [...current, saved]); setSaved(null); setAnswers({}); setNote(""); setStep(0); setMoodRating(3); setShowMoodIntro(stage === "future"); };
  const beginQuestions = (includeMood: boolean) => {
    if (includeMood) setAnswers((current) => ({ ...current, overallMood: String(moodRating) }));
    else setAnswers((current) => { const { overallMood: _overallMood, ...rest } = current; return rest; });
    setShowMoodIntro(false);
    setStep(0);
  };
  const choose = (questionId: string, optionId: string) => {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    setStep((current) => current + 1);
  };
  const toggle = (questionId: string, optionId: string) => setAnswers((current) => {
    const list = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
    return { ...current, [questionId]: list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId] };
  });
  const finish = () => { const completed = { answers, note: note.trim(), completedAt: new Date().toISOString() }; setSaved(completed); setCheckInHistory((current) => [...current, ...(saved && !current.some((item) => item.completedAt === saved.completedAt) ? [saved] : []), completed]); setJournalCheckInActive(false); setJournalOpen(false); };

  return <div className="page">
    <header className="page-header">
      <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1>{copy.lede ? <p className="page-lede">{copy.lede}</p> : null}</div>
      {!journalOpen ? <button type="button" className="btn-secondary" onClick={() => setJournalOpen(true)}><BookOpen size={16} aria-hidden="true" />Back to history</button> : null}
    </header>
    {journalOpen ? <section className="journal-calendar" aria-labelledby="journal-title">
      {historyDate ? <div className="journal-history-page">
        <div className="journal-history-page-head"><button type="button" className="btn-secondary" onClick={() => setHistoryDate(null)}><ArrowLeft size={15} aria-hidden="true" /> Back to days</button><p className="checkin-count">WELLBEING HISTORY</p><h2>{new Date(`${historyDate}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</h2></div>
        {historyDateCheckIns.map((assessment) => { const summary = summarizeCheckIn(stage, assessment.answers); const questionsForAssessment = visibleQuestions(stage, assessment.answers); return <article className="journal-history-card" key={assessment.completedAt}><div><p className="checkin-count">{assessment.sample ? "Sample history · simulated demo data" : `Completed ${new Date(assessment.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</p><h4>{summary.headline}</h4></div>{assessment.answers.overallMood ? <p><strong>Overall mood:</strong> {["", "Very unpleasant", "Unpleasant", "Neutral", "Pleasant", "Very pleasant"][Number(assessment.answers.overallMood)]}</p> : null}<dl>{questionsForAssessment.map((question) => { const answer = assessment.answers[question.id]; const selectedOptions = question.options.filter((option) => Array.isArray(answer) ? answer.includes(option.id) : answer === option.id).map((option) => option.label); return selectedOptions.length ? <div key={question.id}><dt>{question.prompt}</dt><dd>{selectedOptions.join(", ")}</dd></div> : null; })}</dl>{assessment.note ? <div className="journal-history-note"><strong>Your private note</strong><p>{assessment.note}</p></div> : null}{!assessment.sample ? <button type="button" className="btn-link" aria-label="Delete check-in" onClick={() => deleteCheckIn(assessment.completedAt)}><Trash2 size={15} aria-hidden="true" /> Delete check-in</button> : null}</article>; })}
        {historyDateEntries.map((entry) => <article className="checkin-note" key={entry.id}><p>{entry.text}</p><button type="button" className="btn-link" aria-label="Delete journal entry" onClick={() => setJournalEntries((current) => current.filter((item) => item.id !== entry.id))}><Trash2 size={15} aria-hidden="true" /> Delete</button></article>)}
        {!historyDateCheckIns.length && !historyDateEntries.length ? <p className="panel-note">No history is available for this date.</p> : null}
      </div> : <>
      <div className="journal-week-heading"><button type="button" className="btn-secondary" aria-label="Previous week" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button><h2>{weekMonthLabel}</h2><button type="button" className="btn-secondary" aria-label="Next week" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button></div>
      <div className="journal-week-strip" aria-label="Recent days">{journalWeek.map((date) => { const key = toDateKey(date); const hasEntry = journalEntries.some((entry) => toDateKey(new Date(entry.createdAt)) === key) || visibleCheckIns.some((item) => toDateKey(new Date(item.completedAt)) === key); return <button type="button" key={key} className="journal-week-day" data-today={key === todayKey || undefined} data-selected={key === selectedJournalDate || undefined} data-has-history={hasEntry || undefined} aria-pressed={key === selectedJournalDate} aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "full" })}${hasEntry ? ", history available" : ", no saved history"}`} onClick={() => { setSelectedJournalDate(key); setHistoryDate(null); }}><span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).slice(0, 1)}</span><strong>{date.getDate()}</strong><i aria-hidden="true">{hasEntry ? "✓" : ""}</i></button>; })}</div>
      <h2 id="journal-title" className="journal-prompt">How have you been feeling?</h2>
      <div className="journal-checkin-ring">
        <span className="journal-orbit-track" aria-hidden="true"><span className="journal-orbit-satellite" /></span>
        <button type="button" onClick={selectedDateHasHistory ? () => setHistoryDate(selectedJournalDate) : selectedJournalDate === todayKey ? startJournalCheckIn : undefined} disabled={selectedJournalDate !== todayKey && !selectedDateHasHistory} aria-label={selectedDateHasHistory ? "Check history for selected day" : selectedJournalDate === todayKey ? "Check in for today" : "No check-in saved for selected day"}><span aria-hidden="true">{selectedDateHasHistory ? "↗" : selectedJournalDate === todayKey ? "+" : "·"}</span><small>{selectedDateHasHistory ? "Check history" : selectedJournalDate === todayKey ? "Check in" : "No history"}</small></button>
      </div>
      <p className="journal-private-note">Select a day to view its history. Your journal stays on this device.</p>
      </>}
    </section> : saved && !journalCheckInActive ? <CheckInSummaryView stage={stage} saved={saved} onRestart={restart} /> : <section className="tech-card checkin-card" aria-live="polite">
      <div className="checkin-progress" aria-hidden="true"><span style={{ width: `${Math.round((Math.min(step, questions.length) / (questions.length + 1)) * 100)}%` }} /></div>
      {showMoodIntro ? <fieldset className="checkin-question mood-intro" aria-labelledby="mood-intro-title">
        <legend><h2 id="mood-intro-title">How have you felt overall today?</h2></legend>
        <div className="mood-intro-art" aria-hidden="true"><div className="mood-flower"><i /><i /><i /><i /><i /><span /></div></div>
        <div className="mood-rating">
          <label htmlFor="overall-mood-rating">Your mood today</label>
          <strong>{["Very unpleasant", "Unpleasant", "Neutral", "Pleasant", "Very pleasant"][moodRating - 1]}</strong>
          <input id="overall-mood-rating" type="range" min="1" max="5" step="1" value={moodRating} onChange={(event) => setMoodRating(Number(event.target.value))} aria-valuetext={["Very unpleasant", "Unpleasant", "Neutral", "Pleasant", "Very pleasant"][moodRating - 1]} />
          <div className="mood-rating-scale" aria-hidden="true"><span>Very unpleasant</span><span>Very pleasant</span></div>
        </div>
        <div className="checkin-nav">
          <button type="button" className="btn-link" onClick={() => beginQuestions(false)}>Skip mood check-in</button>
          <button type="button" className="btn-primary" onClick={() => beginQuestions(true)}>Continue to questions <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </fieldset> : !onNoteStep ? (() => {
        const question = questions[step];
        const current = answers[question.id];
        return <fieldset key={question.id} className="checkin-question">
          <legend><span className="checkin-count">Question {step + 1} of {questions.length}</span><h2>{question.prompt}</h2></legend>
          {question.hint ? <p className="checkin-hint">{question.hint}</p> : null}
          <div className="checkin-options">{question.options.map((option) => {
            const selected = question.multi ? Array.isArray(current) && current.includes(option.id) : current === option.id;
            return <button key={option.id} type="button" className="checkin-option" aria-pressed={selected} onClick={() => question.multi ? toggle(question.id, option.id) : choose(question.id, option.id)}>
              <span className="checkin-check" aria-hidden="true">{selected ? <Check size={14} /> : null}</span>{option.label}
            </button>;
          })}</div>
          <div className="checkin-nav">
            {step > 0 ? <button type="button" className="btn-secondary" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> Back</button> : <button type="button" className="btn-secondary" onClick={() => setShowMoodIntro(true)}><ArrowLeft size={15} aria-hidden="true" /> Mood check-in</button>}
            <button type="button" className={question.multi ? "btn-primary" : "btn-link"} onClick={() => setStep((value) => value + 1)}>{question.multi ? "Continue" : "Skip this question"}{question.multi ? <ArrowRight size={15} aria-hidden="true" /> : null}</button>
          </div>
        </fieldset>;
      })() : <div className="checkin-question">
        <p className="checkin-count">Last step · optional</p>
        <label htmlFor="checkin-note"><h2>Anything else on your mind?</h2></label>
        <p className="checkin-hint">A private note for yourself. It stays on this device.</p>
        <textarea id="checkin-note" className="field min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Something that went well, or something that's bothering you" />
        <div className="checkin-nav">
          <button type="button" className="btn-secondary" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> Back</button>
          <button type="button" className="btn-primary" onClick={finish}>See my summary <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </div>}
    </section>}
  </div>;
}

function CheckInSummaryView({ stage, saved, onRestart }: { stage: LifeStage; saved: NonNullable<SavedCheckIn>; onRestart: () => void }) {
  const summary = summarizeCheckIn(stage, saved.answers);
  const when = new Date(saved.completedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return <section className="tech-card checkin-summary" data-tone={summary.overall} aria-labelledby="checkin-summary-title">
    <div className="checkin-summary-head">
      <div><p className="checkin-count">Your wellbeing summary · {when}</p><h2 id="checkin-summary-title">{summary.headline}</h2></div>
      <button type="button" className="btn-secondary" onClick={onRestart}><RotateCcw size={15} aria-hidden="true" /> New check-in</button>
    </div>
    {summary.talkTo ? <div className="notice" data-tone="watch" role="note"><div className="notice-row"><UserRound size={18} aria-hidden="true" /><p>{summary.talkTo}</p></div></div> : null}
    <div className="builtin-steps" data-testid="builtin-steps">
      {summary.lines.length ? <><h3 className="checkin-subhead">What you told us</h3><p className="checkin-answer-summary">{summary.lines.map((line) => line.text).join(" ")}</p></> : <p className="panel-note">You skipped every question, so there's nothing to summarise yet.</p>}
      <h3 className="checkin-subhead">What might help</h3>
      <div className="checkin-suggestions">{summary.suggestions.map((item) => <article key={item.title}><h4>{item.title}</h4><p>{item.body}</p></article>)}</div>
      <small className="panel-note">Built from your own answers. Not medical advice or diagnosis.</small>
    </div>
  </section>;
}
