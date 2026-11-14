import { ArrowRight, Activity, ArrowUpRight, Heart, Moon, Utensils, Users, Radio } from "lucide-react";
import type { ViewName } from "./AppShell";

const panel = "tech-card p-5 sm:p-7";
const careSource = "https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space/";
const bodySource = "https://www.nasa.gov/humans-in-space/the-human-body-in-space/";
const healthSource = "https://www.nasa.gov/reference/fundamentals-of-human-health/";

const workflow: { title: string; body: string; view: ViewName; action: string }[] = [
  { title: "Confirm your workspace", body: "In Profile, check the selected traveler, Active stage, and data source. Demo scenarios and replay controls change simulated data; they do not change a real device or mission record.", view: "profile", action: "Check Profile" },
  { title: "Start with Home", body: "Check the source, last sync, and quality before reading the cards. Identify which signals are simulated and which come from an imported or connected source. Missing or stale data is a limitation, not a reassuring result.", view: "home", action: "Open Home" },
  { title: "Read the trend in context", body: "Use Trends to compare readings with your own earlier pattern. Open an alert's reason and note the affected signal and dates. A personal baseline describes earlier readings; it is not a medical target or a fitness clearance.", view: "trends", action: "Review Trends" },
  { title: "Add how you actually feel", body: "In Wellbeing, answer the daily questions about sleep, energy, comfort, and mission workload. Review the summary and add useful context. These check-ins stay in this browser's LocalStorage; entering a note does not notify a clinician.", view: "wellbeing", action: "Open Wellbeing" },
  { title: "Use Movement as a practice tool", body: "Review the camera consent and limits before a guided check. Its movement summary is approximate and cannot assess bone density, diagnose injury, or approve you for a task. Do not attempt a movement that your mission team has restricted.", view: "movement", action: "Explore Movement" },
  { title: "Resolve gaps before interpreting", body: "For a disconnected or poor-quality source, check fit and connection using the device's instructions, then review Profile. Live partial-day readings are display-only for alerts; supported completed days need enough reliable coverage and history.", view: "profile", action: "Review connections" },
];

const habits = [
  { title: "Protect sleep and recovery", icon: Moon, source: bodySource, sourceLabel: "NASA: sleep and isolation", body: "Protect the sleep opportunity in your mission schedule and follow the assigned lighting routine. Tell your crew or flight surgeon when fatigue, repeated poor sleep, or workload starts affecting attention or tasks. Use Wellbeing to keep context alongside the numbers." },
  { title: "Follow your exercise prescription", icon: Activity, source: careSource, sourceLabel: "NASA: exercise and crew care", body: "Complete the resistance and aerobic work assigned by your mission specialists, using approved equipment and technique. Exercise helps counter changes to muscle, bone, and cardiovascular function in microgravity. Report pain or difficulty completing the plan rather than increasing intensity to improve an app score." },
  { title: "Keep nutrition and hydration on plan", icon: Utensils, source: healthSource, sourceLabel: "NASA: food and nutrition", body: "Follow your mission team's food, fluid, and food-safety plan. Use the official intake log when required; OrbitWell does not track calories, nutrients, or hydration. Report poor appetite, trouble eating or drinking, or supply issues to the team. Supplements and fluid targets belong to your individualized plan." },
  { title: "Make room for crew connection", icon: Users, source: careSource, sourceLabel: "NASA: behavioral health support", body: "Keep scheduled private medical and behavioral-health check-ins, communicate workload concerns early, and make time for crew and personal support contacts. A mood entry can help you explain a pattern, but it does not replace a conversation with the support team." },
  { title: "Respect environmental procedures", icon: Radio, source: bodySource, sourceLabel: "NASA: spaceflight hazards", body: "Follow vehicle procedures for radiation, cabin conditions, hygiene, and equipment checks. Use the mission dosimeter and operational alerts for radiation decisions. OrbitWell's synthetic dose display and public solar-event context cannot authorize an EVA, assess shielding, or tell you whether exposure is safe." },
];

function SourceLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-cyan-200 underline underline-offset-4">{children}<ArrowUpRight size={13} aria-hidden="true" /></a>;
}

export function ActiveGuidanceView({ onViewChange }: { onViewChange: (view: ViewName) => void }) {
  return <div className="space-y-7">
    <header>
      <p className="eyebrow">Guidance · Active astronaut</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Your guide to staying well on mission</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Build a steady routine, understand what OrbitWell is showing, and bring useful context to your crew medical team. Use this educational guide alongside your assigned mission procedures.</p>
      <nav aria-label="Mission guide sections" className="mt-5 flex flex-wrap gap-3 text-sm">
        {[["use-horizon", "Using OrbitWell"], ["daily-habits", "Daily habits"], ["changed-readings", "When readings change"]].map(([id, label]) => <a key={id} href={`#${id}`} className="mission-guide-button">{label}<ArrowRight size={16} aria-hidden="true" /></a>)}
      </nav>
    </header>

    <section id="use-horizon" className="scroll-mt-6" aria-labelledby="use-horizon-title">
      <p className="eyebrow">01 / Know your tools</p>
      <h2 id="use-horizon-title" className="mt-2 text-2xl font-semibold text-white">Use OrbitWell from check-in to follow-up</h2>
      <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflow.map((step, i) => <article key={step.title} className={`${panel} flex h-full flex-col`}>
          <span className="font-mono text-xs text-cyan-200">0{i + 1}</span>
          <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
          <p className="mt-2 grow text-sm leading-6 text-slate-400">{step.body}</p>
          <button type="button" onClick={() => onViewChange(step.view)} className="mt-5 flex items-center gap-2 self-start text-sm font-semibold text-cyan-200 hover:underline">{step.action}<ArrowUpRight size={15} aria-hidden="true" /></button>
        </article>)}
      </div>
    </section>

    <section id="daily-habits" className="scroll-mt-6" aria-labelledby="daily-habits-title">
      <p className="eyebrow">02 / Support your routine</p>
      <h2 id="daily-habits-title" className="mt-2 text-2xl font-semibold text-white">Daily habits for life in space</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">These reminders draw on NASA's public educational resources. Your flight surgeon and mission specialists set the schedule, limits, and targets appropriate to you.</p>
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">{habits.map(({ title, icon: Icon, body, source, sourceLabel }, index) => <details key={title} className={panel} open={index === 0}>
          <summary className="cursor-pointer text-base font-semibold text-white"><Icon className="mr-2 inline text-cyan-200" size={18} aria-hidden="true" />{title}</summary>
          <p className="mt-4 text-sm leading-7 text-slate-400">{body}</p>
          <div className="mt-3"><SourceLink href={source}>{sourceLabel}</SourceLink></div>
        </details>)}</div>
        <aside className={panel} aria-labelledby="daily-rhythm-title">
          <Heart className="text-cyan-200" size={22} aria-hidden="true" />
          <h3 id="daily-rhythm-title" className="mt-3 text-lg font-semibold text-white">A simple daily rhythm</h3>
          <ol className="mt-4 space-y-5 text-sm leading-6 text-slate-400">
            <li><strong className="block text-slate-200">Start of your day</strong>Check the assigned schedule, how you feel, and OrbitWell's source and sync status.</li>
            <li><strong className="block text-slate-200">During the workday</strong>Protect planned meals, exercise, and recovery time. Raise concerns that interfere with your tasks.</li>
            <li><strong className="block text-slate-200">Before sleep</strong>Note relevant context in Wellbeing and prepare for the next scheduled check-in.</li>
          </ol>
          <p className="mt-5 border-t border-slate-700 pt-4 text-xs leading-6 text-slate-400">Suggested organization for using this demo—not an official crew schedule or a completion score.</p>
        </aside>
      </div>
    </section>

    <section id="changed-readings" className={`${panel} scroll-mt-6`} aria-labelledby="changed-readings-title">
      <p className="eyebrow">03 / Check, interpret, follow up</p>
      <h2 id="changed-readings-title" className="mt-2 text-2xl font-semibold text-white">When a reading looks different</h2>
      <ol className="mt-5 grid gap-5 md:grid-cols-2">
        {[
          ["Check the data first", "Look at source, timestamp, fit, and quality. Check the device according to its instructions. A gap, rejected reading, or poor signal cannot establish that you are well."],
          ["Read the reason, not just the status", "Open Trends and the alert explanation. Look for repeated changes and context such as recent exercise, workload, or disturbed sleep. A change from your baseline is a prompt to review, not a diagnosis."],
          ["Tell the appropriate person", "Use approved mission communications for new, persistent, worsening, or task-limiting concerns. Seek support based on how you feel, not only on whether OrbitWell shows an alert. ORBIT cannot contact the medical team for you."],
          ["Record the agreed follow-up", "Bring the dates, affected signals, quality limitations, and your own observations to the check-in. Follow the medical team's advice and record the next review in your approved mission system; OrbitWell does not schedule or send it."],
        ].map(([title, body], i) => <li key={title} className="flex items-start gap-3"><span className="mt-0.5 font-mono text-sm text-cyan-200">0{i + 1}</span><div><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div></li>)}
      </ol>
      <p className="mt-5 border-t border-slate-700 pt-4 text-sm leading-6 text-slate-400">Do not change medication, exercise limits, fluid targets, or radiation procedures based on an app status or AI explanation.</p>
    </section>

  </div>;
}
