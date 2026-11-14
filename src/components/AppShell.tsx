import { Activity, Camera, LogOut, ChartNoAxesCombined, Compass, HeartHandshake, Menu, Orbit, ShieldCheck, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LifeStage } from "../types/horizon";
import { ThemeToggle } from "./ThemeToggle";
import type { Account } from "../lib/accountRepository";
import { initialsOf } from "../domain/astronautAccount";
import { ChatWidget } from "./ChatWidget";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ViewName = "home" | "trends" | "movement" | "wellbeing" | "guidance" | "profile";

/** Movement checks are for astronauts in space and for retired astronauts doing reconditioning, not for Future travelers. */
export const viewAvailable = (view: ViewName, stage: LifeStage) => view !== "movement" || stage !== "future";
const navigation: Array<{ id: ViewName; label: string; icon: typeof Activity }> = [
  { id: "home", label: "Home", icon: Activity },
  { id: "trends", label: "Trends", icon: ChartNoAxesCombined },
  { id: "movement", label: "Movement", icon: Camera },
  { id: "wellbeing", label: "Wellbeing", icon: HeartHandshake },
  { id: "guidance", label: "Guidance", icon: Compass },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function Brand() {
  return <div className="brand"><span className="brand-symbol"><Orbit size={25} strokeWidth={1.5} aria-hidden="true" /></span><div><p className="brand-name">Orbit<span>Well</span></p><p className="brand-caption">SPACE · HEALTH · HUMAN</p></div></div>;
}

export function SafetyDisclaimer({ landing = false }: { landing?: boolean }) {
  return <div className={`safety-disclaimer ${landing ? "landing-disclaimer" : ""}`}><ShieldCheck size={13} aria-hidden="true" /><span>Simulated data. Not medical advice. Not diagnostic.</span></div>;
}

export function AppShell({ activeView, onViewChange, stage, onStageChange, children, chat, account, onLogOut }: { activeView: ViewName; onViewChange: (view: ViewName) => void; stage: LifeStage; onStageChange: (stage: LifeStage) => void; children: ReactNode; account?: Account | null; onLogOut?: () => void; chat?: { client: SupabaseClient | null; userId: string | null; openRequest?: number } }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const workspaceLabel = stage === "future" ? "Preparation workspace" : stage === "retired" ? "Post-mission workspace" : "Active monitoring workspace";
  const items = navigation.filter(({ id }) => viewAvailable(id, stage));
  const chooseView = (view: ViewName) => { onViewChange(view); setMobileOpen(false); };
  return <div className="star-field app-layout">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <aside className="app-sidebar">
      <Brand />
      <p className="nav-caption">YOUR WORKSPACE</p>
      <Nav items={items} activeView={activeView} onChoose={chooseView} />
      <div className="sidebar-bottom"><p className="demo-label"><span /> SYNTHETIC RESEARCH DEMO</p></div>
    </aside>
    <div className="app-body">
      <header className="app-topbar">
        <button type="button" className="mobile-menu icon-button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="mobile-menu" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        <div className="workspace-breadcrumb"><p>{workspaceLabel}</p></div>
        <ThemeToggle />
        {account ? <div className="account-chip"><button type="button" className="account-chip-name" onClick={() => onViewChange("profile")} title={account.email}><span className="account-chip-avatar" aria-hidden="true">{initialsOf(account.profile?.fullName ?? account.email)}</span><span className="account-chip-label">{account.profile?.fullName ?? account.email}</span></button><button type="button" className="btn-secondary" aria-label="Log out" onClick={onLogOut}><LogOut size={15} aria-hidden="true" /><span className="account-chip-label" aria-hidden="true">Log out</span></button></div> : null}
      </header>
      {mobileOpen ? <div id="mobile-menu" className="mobile-drawer"><Nav items={items} activeView={activeView} onChoose={chooseView} /></div> : null}
      <main id="workspace" className="workspace-content" tabIndex={-1}>{children}</main>
    </div>
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav">{items.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => chooseView(id)} aria-current={activeView === id ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
    <SafetyDisclaimer />
    {chat ? <ChatWidget stage={stage} client={chat.client} userId={chat.userId} openRequest={chat.openRequest} /> : null}
  </div>;
}

function Nav({ items, activeView, onChoose }: { items: typeof navigation; activeView: ViewName; onChoose: (view: ViewName) => void }) {
  return <nav aria-label="Workspace navigation" className="workspace-nav">{items.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onChoose(id)} aria-current={activeView === id ? "page" : undefined}><Icon size={18} strokeWidth={1.6} aria-hidden="true" />{label}{activeView === id ? <span className="nav-active-dot" /> : null}</button>)}</nav>;
}
