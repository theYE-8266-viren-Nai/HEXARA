import { Activity, ArrowUpRight, Camera, ChartNoAxesCombined, Compass, HeartHandshake, Menu, Orbit, ShieldCheck, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LifeStage } from "../types/horizon";
import { ThemeToggle } from "./ThemeToggle";

export type ViewName = "home" | "trends" | "movement" | "wellbeing" | "guidance" | "profile";
const navigation: Array<{ id: ViewName; label: string; icon: typeof Activity }> = [
  { id: "home", label: "Home", icon: Activity },
  { id: "trends", label: "Trends", icon: ChartNoAxesCombined },
  { id: "movement", label: "Movement", icon: Camera },
  { id: "wellbeing", label: "Wellbeing", icon: HeartHandshake },
  { id: "guidance", label: "Guidance", icon: Compass },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function Brand() {
  return <div className="brand"><span className="brand-symbol"><Orbit size={25} strokeWidth={1.5} aria-hidden="true" /></span><div><p className="brand-name">horizon<span>.</span></p><p className="brand-caption">SPACE · HEALTH · HUMAN</p></div></div>;
}

export function SafetyDisclaimer({ landing = false }: { landing?: boolean }) {
  return <div className={`safety-disclaimer ${landing ? "landing-disclaimer" : ""}`}><ShieldCheck size={13} aria-hidden="true" /><span>Simulated data. Not medical advice. Not diagnostic.</span></div>;
}

export function AppShell({ activeView, onViewChange, stage, onStageChange, children }: { activeView: ViewName; onViewChange: (view: ViewName) => void; stage: LifeStage; onStageChange: (stage: LifeStage) => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const workspaceLabel = stage === "future" ? "Preparation workspace" : stage === "retired" ? "Post-mission workspace" : "Active monitoring workspace";
  const chooseView = (view: ViewName) => { onViewChange(view); setMobileOpen(false); };
  return <div className="star-field app-layout">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <aside className="app-sidebar">
      <Brand />
      <p className="nav-caption">YOUR WORKSPACE</p>
      <Nav activeView={activeView} onChoose={chooseView} />
      <div className="sidebar-bottom"><div className="mission-note"><Orbit size={23} strokeWidth={1} aria-hidden="true" /><p>A little perspective.<br /><span>A clearer next step.</span></p><button type="button" onClick={() => chooseView("guidance")}>Explore guidance <ArrowUpRight size={14} /></button></div><p className="demo-label"><span /> SYNTHETIC RESEARCH DEMO</p></div>
    </aside>
    <div className="app-body">
      <header className="app-topbar">
        <button type="button" className="mobile-menu icon-button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="mobile-menu" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        <div className="workspace-breadcrumb"><span>Mission control</span><span aria-hidden="true">/</span><p>{workspaceLabel}</p></div>
        <label className="stage-control">Stage<select aria-label="Life stage" value={stage} onChange={(event) => onStageChange(event.target.value as LifeStage)}><option value="future">Future</option><option value="active">Active</option><option value="retired">Retired</option></select></label>
        <ThemeToggle />
        <span className="workspace-avatar" aria-hidden="true"><Orbit size={19} /></span>
      </header>
      {mobileOpen ? <div id="mobile-menu" className="mobile-drawer"><Nav activeView={activeView} onChoose={chooseView} /></div> : null}
      <main id="workspace" className="workspace-content" tabIndex={-1}>{children}</main>
    </div>
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav">{navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => chooseView(id)} aria-current={activeView === id ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
    <SafetyDisclaimer />
  </div>;
}

function Nav({ activeView, onChoose }: { activeView: ViewName; onChoose: (view: ViewName) => void }) {
  return <nav aria-label="Workspace navigation" className="workspace-nav">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onChoose(id)} aria-current={activeView === id ? "page" : undefined}><Icon size={18} strokeWidth={1.6} aria-hidden="true" />{label}{activeView === id ? <span className="nav-active-dot" /> : null}</button>)}</nav>;
}
