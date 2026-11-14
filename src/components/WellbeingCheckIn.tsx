import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { summarizeCheckIn, visibleQuestions, type CheckInAnswers, type WellbeingArea } from "../domain/wellbeingCheckIn";
import { usePersistedState } from "../lib/usePersistedState";
import type { LifeStage } from "../types/horizon";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWellbeingFeedbackRepository } from "../lib/wellbeingFeedbackRepository";

type SavedCheckIn = { answers: CheckInAnswers; note: string; completedAt: string } | null;

const COPY: Record<LifeStage, { kicker: string; title: string; lede: string }> = {
  active: { kicker: "Wellbeing · In flight", title: "Daily check-in", lede: "A few quick questions about your last sleep period, your workload and life on board. Skip anything you'd rather not answer." },
  future: { kicker: "Wellbeing · Training", title: "Training check-in", lede: "A few quick questions about sleep, recovery and how training is going this week. Skip anything you'd rather not answer." },
  retired: { kicker: "Wellbeing · After flight", title: "A moment for yourself", lede: "Start with your feelings and connections. The questions are optional, one at a time, and your answers stay on this device." },
};

const SUMMARY_CONTEXT: Record<LifeStage, string> = {
  active: "This helps you notice changes during mission work.",
  future: "This helps you build a personal preparation pattern.",
  retired: "This helps you notice changes during long-term follow-up.",
};

const GROUP_ORDER = ["Sleep and recovery", "Energy and workload", "Mood and stress", "Body comfort", "Crew, family, and purpose"] as const;
const GROUP_BY_AREA: Record<WellbeingArea, (typeof GROUP_ORDER)[number]> = {
  sleep: "Sleep and recovery",
  energy: "Energy and workload",
  stress: "Energy and workload",
  mood: "Mood and stress",
  body: "Body comfort",
  connection: "Crew, family, and purpose",
  purpose: "Crew, family, and purpose",
  readiness: "Crew, family, and purpose",
  followUp: "Crew, family, and purpose",
};

export function WellbeingCheckIn({ stage, client }: { stage: LifeStage; client: SupabaseClient | null }) {
  const [saved, setSaved] = usePersistedState<SavedCheckIn>(`horizon:checkin:${stage}`, null);
  const [answers, setAnswers] = useState<CheckInAnswers>({});
  const [note, setNote] = useState("");
  const [step, setStep] = useState(0);
  const [showMoodIntro, setShowMoodIntro] = useState(stage === "future");
  const [moodRating, setMoodRating] = useState(3);
  const questions = visibleQuestions(stage, answers);
  const onNoteStep = step >= questions.length;
  const copy = COPY[stage];

  const restart = () => { setSaved(null); setAnswers({}); setNote(""); setStep(0); setMoodRating(3); setShowMoodIntro(stage === "future"); };
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
  const finish = () => setSaved({ answers, note: note.trim(), completedAt: new Date().toISOString() });

  return <div className="page">
    <header className="page-header">
      <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-lede">{copy.lede}</p></div>
    </header>
    {saved ? <CheckInSummaryView stage={stage} saved={saved} onRestart={restart} client={client} /> : <section className="tech-card checkin-card" aria-live="polite">
      <div className="checkin-progress" aria-hidden="true"><span style={{ width: `${Math.round((Math.min(step, questions.length) / (questions.length + 1)) * 100)}%` }} /></div>
      {showMoodIntro ? <fieldset className="checkin-question mood-intro" aria-labelledby="mood-intro-title">
        <legend><span className="checkin-count">A moment for you · Future traveler</span><h2 id="mood-intro-title">How have you felt overall today?</h2></legend>
        <p className="checkin-hint">Take a moment to check in with yourself before your training questions.</p>
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
            {step > 0 ? <button type="button" className="btn-secondary" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> Back</button> : stage === "future" ? <button type="button" className="btn-secondary" onClick={() => setShowMoodIntro(true)}><ArrowLeft size={15} aria-hidden="true" /> Mood check-in</button> : <span />}
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

function CheckInSummaryView({ stage, saved, onRestart, client }: { stage: LifeStage; saved: NonNullable<SavedCheckIn>; onRestart: () => void; client: SupabaseClient | null }) {
  const summary = summarizeCheckIn(stage, saved.answers);
  const when = new Date(saved.completedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const answerGroups = GROUP_ORDER.map((group) => ({ group, lines: summary.lines.filter((line) => GROUP_BY_AREA[line.area] === group) })).filter((group) => group.lines.length);
  const primarySuggestion = summary.suggestions[0];
  const suggestionReason = primarySuggestion?.area ? `This suggestion is based on your answers about ${GROUP_BY_AREA[primarySuggestion.area].toLowerCase()}.` : "This is a general reminder to keep noticing your own pattern.";
  const [feedback, setFeedback] = useState<string>();
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackWarning, setFeedbackWarning] = useState<string>();
  // The AI is never called on its own: nothing is sent to the cloud until the person presses the button.
  const getFeedback = async () => {
    setFeedbackBusy(true); setFeedbackWarning(undefined);
    const result = await createWellbeingFeedbackRepository(client).generate({ stage, headline: summary.headline, concern: summary.overall, lines: summary.lines.map((line) => line.text) });
    if (result.text) setFeedback(result.text); else setFeedbackWarning(result.warning ?? result.error ?? "AI feedback is unavailable right now.");
    setFeedbackBusy(false);
  };
  const buttonLabel = feedbackBusy ? "Thinking…" : feedback ? "Refresh reflection" : feedbackWarning ? "Try again" : "Generate reflection";
  return <section className="tech-card checkin-summary" data-tone={summary.overall} aria-labelledby="checkin-summary-title">
    <div className="checkin-summary-head">
      <div><p className="checkin-count">Wellbeing check-in · {when}</p><h2 id="checkin-summary-title">{summary.headline}</h2><p className="checkin-summary-context">{SUMMARY_CONTEXT[stage]}</p></div>
      <button type="button" className="btn-secondary" onClick={onRestart}><RotateCcw size={15} aria-hidden="true" /> New check-in</button>
    </div>
    <div className="builtin-steps" data-testid="builtin-steps">
      <section className="checkin-answer-section" aria-labelledby="checkin-answers-title">
        <h3 id="checkin-answers-title" className="checkin-subhead">What you told us</h3>
        {answerGroups.length ? <div className="checkin-answer-groups">{answerGroups.map(({ group, lines }) => <section key={group} className="checkin-answer-group"><h4>{group}</h4><ul className="checkin-lines">{lines.map((line, index) => <li key={`${line.area}-${index}`} data-concern={line.concern}><strong>{line.label ?? line.text}</strong>{line.label ? <span className="checkin-answer-detail">Selected in your check-in</span> : null}</li>)}</ul></section>)}</div> : <p className="panel-note">You skipped every question, so there is no answer summary yet.</p>}
      </section>
      <section className="checkin-next-step" aria-labelledby="checkin-next-step-title">
        <h3 id="checkin-next-step-title" className="checkin-subhead">Suggested next step</h3>
        {primarySuggestion ? <article className="checkin-suggestion-primary"><h4>{primarySuggestion.title}</h4><p>{primarySuggestion.body}</p><small>{suggestionReason}</small></article> : null}
      </section>
    </div>
    <details className="checkin-feedback">
      <summary className="checkin-feedback-summary"><span><span className="ai-feedback-label">Optional AI reflection</span><strong>Want a second explanation?</strong></span><span className="checkin-optional-label">Optional</span></summary>
      <div className="checkin-feedback-body">
        <p className="panel-note">Horizon can turn the selected check-in themes into a short reflection and one or two possible next steps. Your private note and wearable readings are not sent.</p>
        <button type="button" className="btn-secondary" onClick={() => void getFeedback()} disabled={feedbackBusy}>{buttonLabel}</button>
        {feedbackBusy && !feedback ? <p className="panel-note" role="status">Horizon is preparing a reflection from this check-in…</p> : null}
        {feedback ? <article className="ai-feedback" aria-live="polite"><p className="ai-feedback-result-label">AI-assisted reflection</p><p>{feedback}</p><small>Educational only. Not medical advice, diagnosis, or mission guidance.</small></article> : null}
        {feedbackWarning ? <p className="chat-warning" role="status">{feedbackWarning}</p> : null}
      </div>
    </details>
  </section>;
}
