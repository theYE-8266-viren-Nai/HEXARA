import { useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, ChevronDown, Clipboard, HeartPulse, Radio, ShieldCheck, WifiOff } from "lucide-react";
import { Brand, SafetyDisclaimer } from "./AppShell";
import { ThemeToggle } from "./ThemeToggle";
import { crewMessageDraft, missionCounts, ongoingMissionCrew, syntheticCrewTrends, syntheticGroundMissions, type CrewSituation } from "../domain/groundTeam";
import { TrendChart } from "./TrendChart";

const situationLabel: Record<CrewSituation, string> = {
  urgent: "Crew report · urgent review",
  review: "Review pattern",
  usual: "No demo concern",
  data_gap: "Data unavailable",
};

const situationOrder: Record<CrewSituation, number> = { urgent: 0, review: 1, data_gap: 2, usual: 3 };

function approvedChannelUrl(): string | null {
  const configured = import.meta.env.VITE_GROUND_COMMS_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

export function GroundTeamDashboard({ onExit }: { onExit: () => void }) {
  const missions = useMemo(() => ongoingMissionCrew(syntheticGroundMissions()), []);
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  const mission = missions.find((item) => item.id === missionId) ?? missions[0];
  const [crewId, setCrewId] = useState(mission?.crew[0]?.id ?? "");
  const crew = mission?.crew.find((item) => item.id === crewId) ?? mission?.crew[0];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const counts = missionCounts(missions);
  const commsUrl = approvedChannelUrl();
  const draft = crew && mission ? drafts[crew.id] ?? crewMessageDraft(crew, mission) : "";
  const chooseMission = (id: string) => {
    const next = missions.find((item) => item.id === id);
    if (!next) return;
    setMissionId(id);
    setCrewId(next.crew[0]?.id ?? "");
    setCopyStatus("");
    setHandoffOpen(false);
  };
  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus("Draft copied. Paste it into your approved medical communications channel. No message was sent here.");
    } catch {
      setCopyStatus("Clipboard unavailable. Select and copy the draft manually. No message was sent here.");
    }
  };

  return <div className="star-field ground-page">
    <a href="#ground-main" className="skip-link">Skip to ground team dashboard</a>
    <header className="ground-topbar">
      <Brand />
      <div className="ground-top-actions"><span className="ground-demo-pill"><span /> SYNTHETIC TEAM PREVIEW</span><ThemeToggle /><button type="button" className="btn-secondary" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" /> Back to start</button></div>
    </header>
    <main id="ground-main" className="ground-main" tabIndex={-1}>
      <div className="ground-intro">
        <div><p className="eyebrow">MISSION HEALTH · GROUND VIEW</p><h1>Ground health team</h1><p>See active crew by ongoing mission, review synthetic health context, and prepare a handoff through approved channels.</p></div>
        <span className="ground-training-tag"><ShieldCheck size={17} aria-hidden="true" /> Training data only</span>
      </div>
      <p className="ground-limit" role="note">This is an invented training roster. It is not connected to NASA, astronaut accounts, live telemetry, or a real communications system.</p>

      <section className="ground-overview" aria-label="Ongoing mission summary">
        <div><span>Ongoing missions</span><strong>{counts.missions}</strong></div>
        <div><span>Active crew on board</span><strong>{counts.onboard}</strong></div>
        <div><span>Needs human review</span><strong>{counts.needsReview}</strong></div>
        <div><span>Data gaps</span><strong>{counts.dataGaps}</strong></div>
      </section>

      <div className="ground-layout">
        <aside className="ground-missions" aria-labelledby="ground-missions-title">
          <div className="ground-section-heading"><p className="eyebrow">01 / SELECT MISSION</p><h2 id="ground-missions-title">Ongoing missions</h2></div>
          <div className="ground-mission-list">{missions.map((item) => <button key={item.id} type="button" className="ground-mission-button" aria-pressed={mission?.id === item.id} onClick={() => chooseMission(item.id)}><span className="ground-mission-icon"><Radio size={18} aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{item.destination} · {item.crew.length} active crew on board</small></span></button>)}</div>
          <p className="ground-list-note">Only active astronauts marked on board in missions currently in progress appear here.</p>
        </aside>

        <div className="ground-detail">
          {mission ? <>
            <section aria-labelledby="ground-crew-title">
              <div className="ground-section-heading"><p className="eyebrow">02 / CREW ROSTER</p><h2 id="ground-crew-title">{mission.name}</h2><p>{mission.destination} · Synthetic mission · {mission.crew.length} active crew</p></div>
              <div className="ground-crew-list">{[...mission.crew].sort((a, b) => situationOrder[a.situation] - situationOrder[b.situation]).map((person) => <button key={person.id} type="button" className="ground-crew-button" aria-pressed={crew?.id === person.id} onClick={() => { setCrewId(person.id); setCopyStatus(""); setHandoffOpen(false); }}><strong>{person.name}</strong><span>{person.role}</span></button>)}</div>
            </section>

            {crew ? <section className="ground-person tech-card" aria-labelledby="ground-person-title">
              <div className="ground-person-head"><div><p className="eyebrow">03 / CREW DETAIL</p><h2 id="ground-person-title">{crew.name} <span>· {crew.callSign}</span></h2><p>{crew.role} · {mission.name}</p></div><span className="ground-situation" data-situation={crew.situation}>{situationLabel[crew.situation]}</span></div>
              <p className="ground-person-summary">{crew.summary}</p>
              <div className="ground-metrics" aria-label="Synthetic health snapshot"><div><HeartPulse size={17} aria-hidden="true" /><span>Resting heart rate</span><strong>{crew.heartRate === undefined ? "Unavailable" : `${crew.heartRate} bpm`}</strong></div><div><Activity size={17} aria-hidden="true" /><span>Oxygen saturation</span><strong>{crew.oxygen === undefined ? "Unavailable" : `${crew.oxygen}%`}</strong></div><div><Activity size={17} aria-hidden="true" /><span>Sleep duration</span><strong>{crew.sleepHours === undefined ? "Unavailable" : `${crew.sleepHours} h`}</strong></div></div>
              <p className="ground-source"><WifiOff size={14} aria-hidden="true" /> Synthetic snapshot · {crew.dataQuality === "missing" ? "readings unavailable" : "illustrative values"} · no live connection</p>
              {crew.reportedConcern ? <div className="ground-reported" role="status"><strong>Crew-reported concern in this scenario</strong><p>{crew.reportedConcern}</p></div> : null}
            </section> : null}
          </> : <p>No ongoing missions are available in this demo.</p>}
        </div>
      </div>

      {crew && mission ? <section className="ground-trends" aria-labelledby="ground-trends-title">
        <div className="ground-section-heading"><p className="eyebrow">04 / CREW TRENDS</p><h2 id="ground-trends-title">{crew.name}'s trends</h2><p>Select any astronaut above to see all six synthetic signals. Dotted lines are illustrative baselines.</p></div>
        {crew.dataQuality === "missing" ? <p className="ground-trend-gap" role="status">Latest readings are unavailable for {crew.name}. These charts end with the last synthetic historical day and do not imply a current status.</p> : null}
        <div className="ground-trend-grid">{syntheticCrewTrends(crew).map((trend) => <article key={trend.metric} className="ground-trend-card tech-card"><div className="ground-trend-card-head"><h3>{trend.label}</h3><strong>{crew.dataQuality === "missing" ? "Latest unavailable" : `${trend.value} ${trend.unit}`}</strong></div><p>{trend.aggregationPeriod} · {trend.source}</p><TrendChart metric={trend} compact /><div className="ground-trend-foot">Illustrative baseline: {trend.baseline} {trend.unit}</div></article>)}</div>
      </section> : null}

      {crew && mission ? <section className="ground-handoff tech-card" aria-labelledby="ground-handoff-title">
        <div className="ground-handoff-head"><div className="ground-section-heading"><p className="eyebrow">05 / COORDINATE SUPPORT</p><h2 id="ground-handoff-title">Prepare a crew handoff</h2><p>Use your organization’s approved flight medical procedures. This demo cannot assess an emergency or contact the crew.</p></div><button type="button" className="ground-handoff-toggle" aria-expanded={handoffOpen} aria-controls="ground-handoff-content" onClick={() => setHandoffOpen((open) => !open)}>{handoffOpen ? "Hide handoff" : "Open handoff"} <ChevronDown size={17} aria-hidden="true" /></button></div>
        {handoffOpen ? <div id="ground-handoff-content" className="ground-handoff-content">
        <ol className="ground-steps"><li><span>01</span><div><strong>Confirm the report and data quality</strong><p>Check the crew member’s report, source, and timestamp through approved channels. Do not treat a missing signal as reassurance.</p></div></li><li><span>02</span><div><strong>Reach the medical team</strong><p>For an urgent concern, use the mission’s medical contingency process to contact the flight surgeon and crew medical officer. Confirm receipt.</p></div></li><li><span>03</span><div><strong>Document the handoff</strong><p>Record who was contacted, when, and what they advised in the approved mission system. This preview does not record or send a clinical handoff.</p></div></li></ol>
        <label className="ground-draft-label" htmlFor="ground-message">Message draft for {crew.callSign}</label>
        <textarea id="ground-message" className="field ground-draft" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [crew.id]: event.target.value }))} rows={4} maxLength={1000} />
        <div className="ground-handoff-actions"><button type="button" className="btn-primary" onClick={() => void copyDraft()}><Clipboard size={16} aria-hidden="true" /> Copy draft for approved channel</button>{commsUrl ? <a className="btn-secondary" href={commsUrl} target="_blank" rel="noreferrer">Open configured channel <ArrowUpRight size={15} aria-hidden="true" /></a> : <span>No approved communications link configured.</span>}</div>
        {copyStatus ? <p className="ground-copy-status" role="status">{copyStatus}</p> : null}
        <p className="ground-handoff-foot">No message is transmitted by OrbitWell. Follow the flight surgeon’s and crew medical officer’s instructions; do not use this dashboard for treatment decisions.</p>
        </div> : null}
      </section> : null}
    </main>
    <SafetyDisclaimer />
  </div>;
}
