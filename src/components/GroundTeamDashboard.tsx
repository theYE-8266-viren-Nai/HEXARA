import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Radio, ShieldCheck } from "lucide-react";
import { Brand, SafetyDisclaimer } from "./AppShell";
import { missionCounts, ongoingMissionCrew, syntheticCrewTrends, syntheticGroundMissions, type CrewSituation } from "../domain/groundTeam";
import { TrendChart } from "./TrendChart";

const situationLabel: Record<CrewSituation, string> = {
  urgent: "Crew report · urgent review",
  review: "Review pattern",
  usual: "No demo concern",
  data_gap: "Data unavailable",
};

const situationOrder: Record<CrewSituation, number> = { urgent: 0, review: 1, data_gap: 2, usual: 3 };

export function GroundTeamDashboard({ onExit }: { onExit: () => void }) {
  const missions = useMemo(() => ongoingMissionCrew(syntheticGroundMissions()), []);
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  const mission = missions.find((item) => item.id === missionId) ?? missions[0];
  const [crewId, setCrewId] = useState(mission?.crew[0]?.id ?? "");
  const crew = mission?.crew.find((item) => item.id === crewId) ?? mission?.crew[0];
  const [missionsOpen, setMissionsOpen] = useState(false);
  const counts = missionCounts(missions);
  const chooseMission = (id: string) => {
    const next = missions.find((item) => item.id === id);
    if (!next) return;
    setMissionId(id);
    setCrewId(next.crew[0]?.id ?? "");
    setMissionsOpen(false);
  };

  return <div className="star-field ground-page">
    <a href="#ground-main" className="skip-link">Skip to ground team dashboard</a>
    <header className="ground-topbar">
      <Brand />
      <div className="ground-top-actions"><span className="ground-demo-pill"><span /> SYNTHETIC TEAM PREVIEW</span><button type="button" className="btn-secondary" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" /> Back to start</button></div>
    </header>
    <main id="ground-main" className="ground-main" tabIndex={-1}>
      <div className="ground-intro">
        <div><p className="eyebrow">MISSION HEALTH · GROUND VIEW</p><h1>Ground health team</h1><p>See active crew by ongoing mission and review their synthetic health trends.</p></div>
        <span className="ground-training-tag"><ShieldCheck size={17} aria-hidden="true" /> Training data only</span>
      </div>
      <p className="ground-limit" role="note">This is an invented training roster. It is not connected to NASA, astronaut accounts, live telemetry, or a real communications system.</p>

      <section className="ground-overview" aria-label="Ongoing mission summary">
        <div><span>Ongoing missions</span><strong>{counts.missions}</strong></div>
        <div><span>Active crew on board</span><strong>{counts.onboard}</strong></div>
        <div><span>Needs human review</span><strong>{counts.needsReview}</strong></div>
        <div><span>Data gaps</span><strong>{counts.dataGaps}</strong></div>
      </section>

      <div className={`ground-layout${missionsOpen ? " ground-layout-missions-open" : ""}`}>
        <aside className="ground-missions" aria-label="Mission selector">
          <button type="button" className="ground-mission-toggle" aria-label={missionsOpen ? "Hide ongoing missions" : "Open ongoing missions"} aria-expanded={missionsOpen} aria-controls="ground-mission-options" onClick={() => setMissionsOpen((open) => !open)}><span><span className="eyebrow">01 / SELECT MISSION</span><strong>Ongoing missions</strong><small>{mission?.name ?? "No ongoing mission"}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
          <div id="ground-mission-options" className="ground-mission-options" hidden={!missionsOpen}>
            <div className="ground-mission-list">{missions.map((item) => <button key={item.id} type="button" className="ground-mission-button" aria-pressed={mission?.id === item.id} onClick={() => chooseMission(item.id)}><span className="ground-mission-icon"><Radio size={18} aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{item.destination} · {item.crew.length} active crew on board</small></span></button>)}</div>
            <p className="ground-list-note">Only active astronauts marked on board in missions currently in progress appear here.</p>
          </div>
        </aside>

        <div className="ground-detail">
          {mission ? <>
            <section aria-labelledby="ground-crew-title">
              <div className="ground-section-heading"><p className="eyebrow">02 / CREW ROSTER</p><h2 id="ground-crew-title">{mission.name}</h2><p>{mission.destination} · Synthetic mission · {mission.crew.length} active crew</p></div>
              <div className="ground-crew-list">{[...mission.crew].sort((a, b) => situationOrder[a.situation] - situationOrder[b.situation]).map((person) => <button key={person.id} type="button" className="ground-crew-button" aria-pressed={crew?.id === person.id} onClick={() => setCrewId(person.id)}><strong>{person.name}</strong><span>{person.role}</span></button>)}</div>
            </section>

            {crew ? <section className="ground-trends" aria-labelledby="ground-trends-title">
              <div className="ground-trend-intro"><div className="ground-section-heading"><p className="eyebrow">03 / CREW TRENDS</p><h2 id="ground-trends-title">{crew.name}'s trends</h2><p>{crew.role} · {crew.callSign} · Six synthetic signals with illustrative baselines.</p></div><span className="ground-situation" data-situation={crew.situation}>{situationLabel[crew.situation]}</span></div>
              {crew.reportedConcern ? <p className="ground-trend-concern" role="status"><strong>Crew report:</strong> {crew.reportedConcern}</p> : null}
              {crew.dataQuality === "missing" ? <p className="ground-trend-gap" role="status">Latest readings are unavailable for {crew.name}. These charts end with the last synthetic historical day and do not imply a current status.</p> : null}
              <div className="ground-trend-grid">{syntheticCrewTrends(crew).map((trend) => <article key={trend.metric} className="ground-trend-card tech-card"><div className="ground-trend-card-head"><h3>{trend.label}</h3><strong>{crew.dataQuality === "missing" ? "Latest unavailable" : `${trend.value} ${trend.unit}`}</strong></div><p>{trend.aggregationPeriod} · {trend.source}</p><TrendChart metric={trend} compact /><div className="ground-trend-foot">Illustrative baseline: {trend.baseline} {trend.unit}</div></article>)}</div>
            </section> : null}
          </> : <p>No ongoing missions are available in this demo.</p>}
        </div>
      </div>

    </main>
    <SafetyDisclaimer />
  </div>;
}
