import { ArrowLeft, ArrowRight, Check, RotateCcw, UserRound } from "lucide-react";
import { useState } from "react";
import { summarizeCheckIn, visibleQuestions, type CheckInAnswers } from "../domain/wellbeingCheckIn";
import { usePersistedState } from "../lib/usePersistedState";
import type { LifeStage } from "../types/horizon";

type SavedCheckIn = { answers: CheckInAnswers; note: string; completedAt: string } | null;

const COPY: Record<LifeStage, { kicker: string; title: string; lede: string }> = {
  active: { kicker: "Wellbeing · In flight", title: "Daily check-in", lede: "A few quick questions about your last sleep period, your workload and life on board. Skip anything you'd rather not answer." },
  future: { kicker: "Wellbeing · Training", title: "Training check-in", lede: "A few quick questions about sleep, recovery and how training is going this week. Skip anything you'd rather not answer." },
  retired: { kicker: "Wellbeing · After flight", title: "A moment for yourself", lede: "Start with your feelings and connections. The questions are optional, one at a time, and your answers stay on this device." },
};

export function WellbeingCheckIn({ stage }: { stage: LifeStage }) {
  const [saved, setSaved] = usePersistedState<SavedCheckIn>(`horizon:checkin:${stage}`, null);
  const [answers, setAnswers] = useState<CheckInAnswers>({});
  const [note, setNote] = useState("");
  const [step, setStep] = useState(0);
  const questions = visibleQuestions(stage, answers);
  const onNoteStep = step >= questions.length;
  const copy = COPY[stage];

  const restart = () => { setSaved(null); setAnswers({}); setNote(""); setStep(0); };
  const choose = (questionId: string, optionId: string) => {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    setStep((current) => current + 1);
  };
  const toggle = (questionId: string, optionId: string) => setAnswers((current) => {
    const list = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
    return { ...current, [questionId]: list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId] };
  });
  const finish = () => setSaved({ answers, note: note.trim(), completedAt: new Date().toISOString() });

  return <div className="page">
    <header className="page-header">
      <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-lede">{copy.lede}</p></div>
    </header>
    {saved ? <CheckInSummaryView stage={stage} saved={saved} onRestart={restart} /> : <section className="tech-card checkin-card" aria-live="polite">
      <div className="checkin-progress" aria-hidden="true"><span style={{ width: `${Math.round((Math.min(step, questions.length) / (questions.length + 1)) * 100)}%` }} /></div>
      {!onNoteStep ? (() => {
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
            {step > 0 ? <button type="button" className="btn-secondary" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> Back</button> : <span />}
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
    {summary.lines.length ? <div><h3 className="checkin-subhead">What you told us</h3><ul className="checkin-lines">{summary.lines.map((line, index) => <li key={index} data-concern={line.concern}>{line.text}</li>)}</ul></div> : <p className="panel-note">You skipped every question, so there's nothing to summarise yet.</p>}
    {saved.note ? <div><h3 className="checkin-subhead">Your note</h3><p className="checkin-note">{saved.note}</p></div> : null}
    <div><h3 className="checkin-subhead">What might help</h3><div className="checkin-suggestions">{summary.suggestions.map((item) => <article key={item.title}><h4>{item.title}</h4><p>{item.body}</p></article>)}</div></div>
    <p className="panel-footnote">This summary comes from your own answers. It is not a medical assessment or diagnosis.</p>
  </section>;
}
