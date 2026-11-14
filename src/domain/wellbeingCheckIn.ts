import type { LifeStage } from "../types/horizon";

/**
 * Question-based wellbeing check-in. Each stage asks its own realistic questions; every answer
 * carries a concern level (0 = going well … 3 = hard) for one wellbeing area. The summary is
 * plain language and never diagnostic. Answers that mention pain, worsening symptoms, or a very
 * low mood always point to a person (crew medic, flight surgeon, or doctor).
 */
export type WellbeingArea = "sleep" | "energy" | "mood" | "stress" | "body" | "connection" | "purpose" | "readiness" | "followUp";

export interface CheckInOption { id: string; label: string; concern: 0 | 1 | 2 | 3; summary: string; escalate?: boolean }
export interface CheckInQuestion {
  id: string;
  area: WellbeingArea;
  prompt: string;
  hint?: string;
  options: CheckInOption[];
  /** Follow-up shown only when the previous answer in this area has at least this concern. */
  showWhen?: { questionId: string; minConcern: number };
  multi?: boolean;
}
export type CheckInAnswers = Record<string, string | string[]>;

const sleepOptions = (place: string): CheckInOption[] => [
  { id: "rested", label: "Slept through and woke up rested", concern: 0, summary: "You slept well and woke up rested." },
  { id: "okay", label: "Woke a few times, but feel okay", concern: 1, summary: "Your sleep was a little broken, but you feel okay." },
  { id: "tired", label: "Broken sleep, still tired", concern: 2, summary: `Your sleep ${place} was broken and you still feel tired.` },
  { id: "barely", label: "Barely slept", concern: 3, summary: "You barely slept." },
];

const moodOptions: CheckInOption[] = [
  { id: "good", label: "Good, I feel like myself", concern: 0, summary: "Your mood has been good." },
  { id: "steady", label: "Steady, nothing special", concern: 0, summary: "Your mood has been steady." },
  { id: "flat", label: "Flat or irritable", concern: 2, summary: "You have been feeling flat or irritable." },
  { id: "low", label: "Low, and it's hard to shake", concern: 3, summary: "Your mood has been low and hard to shake.", escalate: true },
];

const QUESTIONS: Record<LifeStage, CheckInQuestion[]> = {
  active: [
    { id: "sleep", area: "sleep", prompt: "How did you sleep in your last sleep period?", options: sleepOptions("on board") },
    { id: "sleepFactors", area: "sleep", prompt: "What got in the way of your sleep?", hint: "Choose any that apply.", multi: true, showWhen: { questionId: "sleep", minConcern: 2 }, options: [
      { id: "noise", label: "Fan or equipment noise", concern: 0, summary: "noise" },
      { id: "light", label: "Light in the crew quarters", concern: 0, summary: "light" },
      { id: "schedule", label: "Schedule shift or late operations", concern: 0, summary: "a schedule shift" },
      { id: "temperature", label: "Too warm or too cold", concern: 0, summary: "temperature" },
      { id: "thoughts", label: "Thinking about work or home", concern: 0, summary: "a busy mind" },
      { id: "discomfort", label: "Physical discomfort", concern: 0, summary: "physical discomfort" },
    ] },
    { id: "energy", area: "energy", prompt: "How is your energy for today's tasks?", options: [
      { id: "full", label: "Ready for a full workload", concern: 0, summary: "You feel ready for a full workload." },
      { id: "essentials", label: "Enough for the essentials", concern: 1, summary: "You have enough energy for the essentials." },
      { id: "low", label: "Running low", concern: 2, summary: "Your energy is running low." },
      { id: "exhausted", label: "Exhausted", concern: 3, summary: "You feel exhausted." },
    ] },
    { id: "workload", area: "stress", prompt: "How manageable does today's workload feel?", options: [
      { id: "comfortable", label: "Comfortable", concern: 0, summary: "Today's workload feels comfortable." },
      { id: "busy", label: "Busy, but manageable", concern: 1, summary: "Today is busy but manageable." },
      { id: "stretched", label: "Stretched thin", concern: 2, summary: "You feel stretched thin by today's workload." },
      { id: "overwhelming", label: "Overwhelming", concern: 3, summary: "Today's workload feels overwhelming." },
    ] },
    { id: "mood", area: "mood", prompt: "How has your mood been since you woke up?", options: moodOptions },
    { id: "crew", area: "connection", prompt: "How are things with the crew right now?", options: [
      { id: "well", label: "We're working well together", concern: 0, summary: "Things with the crew are going well." },
      { id: "fine", label: "Fine, everyone is heads-down", concern: 1, summary: "The crew is fine but busy." },
      { id: "friction", label: "There's some friction", concern: 2, summary: "There is some friction in the crew." },
      { id: "tense", label: "It feels tense", concern: 3, summary: "The crew atmosphere feels tense." },
    ] },
    { id: "home", area: "connection", prompt: "When did you last have a call with family or friends?", options: [
      { id: "recent", label: "In the last couple of days", concern: 0, summary: "You spoke with home recently." },
      { id: "week", label: "About a week ago", concern: 1, summary: "Your last call home was about a week ago." },
      { id: "long", label: "It's been a while", concern: 2, summary: "It has been a while since you spoke with home." },
    ] },
    { id: "body", area: "body", prompt: "Any physical discomfort today?", options: [
      { id: "none", label: "None", concern: 0, summary: "You have no physical discomfort." },
      { id: "mild", label: "Mild: headache, congestion or back ache", concern: 1, summary: "You have mild discomfort, such as a headache, congestion or back ache." },
      { id: "affecting", label: "Noticeable, and it's affecting my work", concern: 2, summary: "You have discomfort that is affecting your work.", escalate: true },
      { id: "worsening", label: "Pain, or symptoms getting worse", concern: 3, summary: "You have pain or worsening symptoms.", escalate: true },
    ] },
  ],
  future: [
    { id: "sleep", area: "sleep", prompt: "How did you sleep last night?", options: sleepOptions("last night") },
    { id: "recovery", area: "body", prompt: "How does your body feel after your latest training session?", options: [
      { id: "recovered", label: "Fully recovered", concern: 0, summary: "Your body has recovered from training." },
      { id: "sore", label: "A bit sore", concern: 1, summary: "You are a bit sore after training." },
      { id: "stiff", label: "Very sore or stiff", concern: 2, summary: "You are very sore or stiff after training." },
      { id: "injury", label: "Pain that feels like an injury", concern: 3, summary: "You have pain that feels like an injury.", escalate: true },
    ] },
    { id: "energy", area: "energy", prompt: "How is your energy going into today's training?", options: [
      { id: "full", label: "Ready to push", concern: 0, summary: "You feel ready to push in training." },
      { id: "enough", label: "Enough to get through", concern: 1, summary: "You have enough energy to get through training." },
      { id: "low", label: "Running low", concern: 2, summary: "Your energy is running low." },
      { id: "drained", label: "Drained", concern: 3, summary: "You feel drained." },
    ] },
    { id: "learning", area: "readiness", prompt: "How confident do you feel about what you're learning this week?", options: [
      { id: "confident", label: "Confident", concern: 0, summary: "You feel confident about this week's training." },
      { id: "getting", label: "Getting there", concern: 1, summary: "You are getting there with this week's training." },
      { id: "unsure", label: "Unsure about some parts", concern: 2, summary: "You feel unsure about parts of this week's training." },
      { id: "behind", label: "Behind and worried about it", concern: 3, summary: "You feel behind and worried about your training." },
    ] },
    { id: "balance", area: "stress", prompt: "How is the training schedule fitting with the rest of your life?", options: [
      { id: "balanced", label: "Well balanced", concern: 0, summary: "Training fits well with the rest of your life." },
      { id: "busy", label: "Busy, but okay", concern: 1, summary: "Training is busy but okay." },
      { id: "squeezing", label: "It's squeezing out rest and family time", concern: 2, summary: "Training is squeezing out rest and family time." },
      { id: "unsustainable", label: "It feels unsustainable", concern: 3, summary: "Your schedule feels unsustainable." },
    ] },
    { id: "mood", area: "mood", prompt: "How has your mood been this week?", options: moodOptions },
    { id: "mission", area: "purpose", prompt: "How do you feel about the mission ahead?", options: [
      { id: "excited", label: "Excited", concern: 0, summary: "You feel excited about the mission ahead." },
      { id: "nervous", label: "Excited, and a bit nervous", concern: 1, summary: "You feel excited and a bit nervous about the mission." },
      { id: "anxious", label: "Mostly anxious", concern: 2, summary: "You feel mostly anxious about the mission." },
      { id: "doubts", label: "I'm having doubts", concern: 3, summary: "You are having doubts about the mission." },
    ] },
  ],
  retired: [
    { id: "sleep", area: "sleep", prompt: "How have you been sleeping this week?", options: sleepOptions("this week") },
    { id: "body", area: "body", prompt: "How is your body feeling these days?", hint: "Think about joints, balance and general strength.", options: [
      { id: "strong", label: "Strong and steady", concern: 0, summary: "Your body feels strong and steady." },
      { id: "aches", label: "Some aches or stiffness", concern: 1, summary: "You have some aches or stiffness." },
      { id: "balance", label: "Balance or dizziness is bothering me", concern: 2, summary: "Balance or dizziness has been bothering you.", escalate: true },
      { id: "pain", label: "New or worsening pain", concern: 3, summary: "You have new or worsening pain.", escalate: true },
    ] },
    { id: "energy", area: "energy", prompt: "How is your energy for an ordinary day?", options: [
      { id: "plenty", label: "Plenty", concern: 0, summary: "You have plenty of energy for an ordinary day." },
      { id: "enough", label: "Enough", concern: 1, summary: "You have enough energy for an ordinary day." },
      { id: "low", label: "Lower than I'd like", concern: 2, summary: "Your energy is lower than you would like." },
      { id: "drained", label: "Drained most days", concern: 3, summary: "You feel drained most days." },
    ] },
    { id: "mood", area: "mood", prompt: "How has your mood been lately?", options: moodOptions },
    { id: "connection", area: "connection", prompt: "How connected do you feel to the people around you?", options: [
      { id: "very", label: "Very connected", concern: 0, summary: "You feel very connected to the people around you." },
      { id: "somewhat", label: "Somewhat connected", concern: 1, summary: "You feel somewhat connected to the people around you." },
      { id: "isolated", label: "A bit isolated", concern: 2, summary: "You feel a bit isolated." },
      { id: "alone", label: "Very alone", concern: 3, summary: "You feel very alone." },
    ] },
    { id: "purpose", area: "purpose", prompt: "How does life after flying feel right now?", options: [
      { id: "settled", label: "Settled, with a clear purpose", concern: 0, summary: "Life after flying feels settled and purposeful." },
      { id: "adjusting", label: "Adjusting well", concern: 1, summary: "You are adjusting well to life after flying." },
      { id: "missing", label: "I miss mission life", concern: 2, summary: "You miss mission life." },
      { id: "lost", label: "Struggling to find direction", concern: 3, summary: "You are struggling to find direction after flying." },
    ] },
    { id: "followUp", area: "followUp", prompt: "Are you keeping up with your long-term health follow-ups?", options: [
      { id: "current", label: "Yes, I'm up to date", concern: 0, summary: "Your long-term follow-ups are up to date." },
      { id: "soon", label: "One is coming up soon", concern: 0, summary: "You have a follow-up coming up soon." },
      { id: "overdue", label: "One is overdue", concern: 2, summary: "One of your follow-ups is overdue." },
      { id: "unsure", label: "I'm not sure what I need", concern: 2, summary: "You are not sure which follow-ups you need." },
    ] },
  ],
};

export function checkInQuestions(stage: LifeStage): CheckInQuestion[] {
  return QUESTIONS[stage];
}

/** Questions that apply given the answers so far (follow-ups appear only when relevant). */
export function visibleQuestions(stage: LifeStage, answers: CheckInAnswers): CheckInQuestion[] {
  const questions = QUESTIONS[stage].filter((question) => {
    if (!question.showWhen) return true;
    const parent = QUESTIONS[stage].find((candidate) => candidate.id === question.showWhen!.questionId);
    const option = parent?.options.find((candidate) => candidate.id === answers[question.showWhen!.questionId]);
    return Boolean(option && option.concern >= question.showWhen.minConcern);
  });
  if (stage === "retired") {
    const order = ["mood", "connection", "purpose", "sleep", "energy", "body", "followUp"];
    return questions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  return questions;
}

export type OverallState = "steady" | "watch" | "hard";
export interface CheckInSummary {
  overall: OverallState;
  headline: string;
  lines: Array<{ area: WellbeingArea; text: string; concern: number }>;
  suggestions: Array<{ title: string; body: string }>;
  /** Present when an answer should be discussed with a person. Never sent automatically. */
  talkTo?: string;
}

const PERSON: Record<LifeStage, string> = { active: "the crew medic or flight surgeon", future: "your training physician or instructor", retired: "your doctor" };

const SUGGESTIONS: Record<LifeStage, Partial<Record<WellbeingArea, { title: string; body: string }>>> = {
  active: {
    sleep: { title: "Protect your next sleep period", body: "Before your next sleep period, switch to the pre-sleep lighting, use earplugs or the eye mask if noise or light was the problem, and avoid screens in the last half hour." },
    energy: { title: "Match today's tasks to your energy", body: "Look at today's timeline and ask the ground team whether one non-critical task can move to a better time." },
    stress: { title: "Talk through the timeline", body: "Raise the workload at the next planning conference. A small schedule change is easier to make early in the day." },
    mood: { title: "Make one small connection", body: "Share a meal or a few minutes at the window with a crewmate, or schedule a private call home." },
    connection: { title: "Reconnect with people", body: "Plan a short shared activity with the crew, or ask to book a private family conference." },
    body: { title: "Look after the discomfort", body: "Note when it started and what makes it better or worse, so you can describe it clearly." },
  },
  future: {
    sleep: { title: "Prioritise sleep before training", body: "Keep a regular bedtime this week and keep your phone out of reach for the last half hour before sleep." },
    body: { title: "Plan your recovery", body: "Choose a lighter session or active recovery today, and tell your instructor how your body feels." },
    energy: { title: "Fuel and pace the day", body: "Eat before training, keep water nearby and plan short breaks between sessions." },
    readiness: { title: "Ask about the hard parts", body: "Write down the topics you're unsure about and bring them to your instructor or a study partner." },
    stress: { title: "Protect some time off", body: "Block out one evening this week for rest or family, and treat it like a training commitment." },
    mood: { title: "Talk with your cohort", body: "Other candidates are going through the same pressure. A short chat with one of them can help." },
    purpose: { title: "Name what worries you", body: "Write down what makes you nervous about the mission and talk it through with your mentor or a flown astronaut." },
  },
  retired: {
    sleep: { title: "Build a steady sleep routine", body: "Go to bed and wake up at the same time each day, and get some daylight in the morning." },
    body: { title: "Keep moving safely", body: "Short daily walks and gentle strength or balance exercises help. Use support where you need it." },
    energy: { title: "Pace your week", body: "Spread demanding activities across the week and plan rest after busy days." },
    mood: { title: "Reach out to someone", body: "Call a friend, family member or former crewmate you trust, even just for a short chat." },
    connection: { title: "Choose one connection", body: "If you want company, consider a short call with someone you trust or a small activity with a group that feels welcoming." },
    purpose: { title: "Explore what matters now", body: "There is no deadline for a new purpose. Notice one person, place, or activity you would like to make room for this week." },
    followUp: { title: "Book your follow-up", body: "Check which long-term health follow-ups are due and add the next one to your calendar." },
  },
};

export function summarizeCheckIn(stage: LifeStage, answers: CheckInAnswers): CheckInSummary {
  const lines: CheckInSummary["lines"] = [];
  let escalate = false;
  const concernByArea = new Map<WellbeingArea, number>();
  for (const question of visibleQuestions(stage, answers)) {
    const answer = answers[question.id];
    if (question.multi) {
      const picked = question.options.filter((option) => Array.isArray(answer) && answer.includes(option.id)).map((option) => option.summary);
      if (picked.length && lines.length) {
        const last = lines[lines.length - 1];
        last.text = `${last.text.replace(/\.$/, "")}, mostly because of ${joinList(picked)}.`;
      }
      continue;
    }
    const option = question.options.find((candidate) => candidate.id === answer);
    if (!option) continue;
    lines.push({ area: question.area, text: option.summary, concern: option.concern });
    concernByArea.set(question.area, Math.max(concernByArea.get(question.area) ?? 0, option.concern));
    if (option.escalate) escalate = true;
  }
  const concerns = lines.map((line) => line.concern);
  const high = concerns.filter((value) => value >= 3).length;
  const medium = concerns.filter((value) => value === 2).length;
  const overall: OverallState = high >= 2 || (high >= 1 && medium >= 2) || escalate ? "hard" : high || medium ? "watch" : "steady";
  const headline = overall === "steady" ? "You seem to be doing well today." : overall === "watch" ? "Mostly steady, with a few things to look after." : "Today looks hard. You don't have to handle it alone.";
  const suggestions = [...concernByArea.entries()]
    .filter(([, concern]) => concern >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => SUGGESTIONS[stage][area])
    .filter((item): item is { title: string; body: string } => Boolean(item))
    .slice(0, 3);
  if (!suggestions.length) suggestions.push({ title: "Keep your routine going", body: "Whatever you're doing is working. Check in again tomorrow so changes are easier to notice." });
  return { overall, headline, lines, suggestions, talkTo: escalate ? `Some of your answers are worth talking through with ${PERSON[stage]}. This app doesn't contact anyone for you.` : undefined };
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
