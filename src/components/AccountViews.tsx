import { ArrowLeft, ArrowRight, Compass, LogIn, Orbit, Rocket, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { emptyProfile, profileGroups, STAGE_CHOICES, validateProfile, type AstronautProfile, type ProfileField, type ProfileGroup } from "../domain/astronautAccount";
import { checkCredentials, type Account, type AccountRepository } from "../lib/accountRepository";
import type { LifeStage } from "../types/horizon";
import { Brand, SafetyDisclaimer } from "./AppShell";

const STAGE_ICONS: Record<LifeStage, typeof Rocket> = { future: Rocket, active: Orbit, retired: Compass };

type Mode = "login" | "signup" | "complete";

/**
 * The account screen for one stage, opened from its card on the start page. People log in or create an
 * account for that stage before they can use the website. An account only opens the stage it belongs to.
 */
export function AccountScreen({ stage, repository, account, onDone, onBack, onLogOut }: { stage: LifeStage; repository: AccountRepository; account?: Account | null; onDone: (account: Account) => void; onBack: () => void; onLogOut: () => void }) {
  const remembered = account && account.profile?.stage === stage ? account : null;
  const needsProfile = account && !account.profile ? account : null;
  const [mode, setMode] = useState<Mode>(needsProfile ? "complete" : "login");
  const choice = STAGE_CHOICES.find((item) => item.stage === stage)!;
  const Icon = STAGE_ICONS[stage];
  return <main className="star-field onboarding account-page">
    <div className="onboarding-container">
      <header className="onboarding-topbar"><Brand /></header>
      <div className="account-layout">
        <button type="button" className="btn-link account-back" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Choose a different stage</button>
        <div className="account-stage"><span className="stage-choice-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.5} /></span><div><p className="account-stage-title">{choice.title}</p><p className="account-stage-body">{choice.body}</p></div></div>
        {repository.mode === "local" ? <p className="account-local-note" role="note">Cloud accounts are unavailable here, so accounts are saved only in this browser.</p> : null}
        {remembered && mode === "login" ? <section className="tech-card account-card" aria-labelledby="continue-title">
          <h1 id="continue-title">Welcome back, {remembered.profile!.fullName.split(" ")[0]}</h1>
          <p className="page-lede">You're logged in as {remembered.email}.</p>
          <div className="account-nav"><button type="button" className="btn-link" onClick={onLogOut}>Log out</button><button type="button" className="btn-primary" onClick={() => onDone(remembered)}>Continue <ArrowRight size={15} aria-hidden="true" /></button></div>
        </section> : null}
        {!remembered && mode === "login" ? <LoginForm stage={stage} repository={repository} onDone={onDone} onSignup={() => setMode("signup")} /> : null}
        {mode !== "login" ? <SignupFlow stage={stage} repository={repository} account={mode === "complete" ? needsProfile : null} onDone={onDone} onLogin={() => setMode("login")} /> : null}
      </div>
    </div>
    <SafetyDisclaimer landing />
  </main>;
}

function LoginForm({ stage, repository, onDone, onSignup }: { stage: LifeStage; repository: AccountRepository; onDone: (account: Account) => void; onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(undefined);
    const result = await repository.signIn(email, password);
    if (result.account?.profile && result.account.profile.stage !== stage) {
      // Each stage only opens its own accounts.
      await repository.signOut();
      setBusy(false);
      const cardName = result.account.profile.stage === "future" ? "Future astronaut" : stageName(result.account.profile.stage);
      setError(`This account is registered as ${withArticle(stageName(result.account.profile.stage))}. Go back and choose the ${cardName} card to log in.`);
      return;
    }
    setBusy(false);
    if (result.account) onDone(result.account); else setError(result.error ?? "Log in failed.");
  };
  return <section className="tech-card account-card" aria-labelledby="login-title">
    <h1 id="login-title">Log in</h1>
    <p className="page-lede">Log in to your {stageName(stage)} account to continue.</p>
    <form className="account-form" onSubmit={submit} noValidate>
      <TextField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      <TextField id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={busy}><LogIn size={16} aria-hidden="true" />{busy ? "Logging in…" : "Log in"}</button>
    </form>
    <p className="account-switch">New here? <button type="button" className="btn-link" onClick={onSignup}>Create an account</button></p>
  </section>;
}

function withArticle(name: string): string {
  return `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}`;
}

function stageName(stage: LifeStage): string {
  return STAGE_CHOICES.find((item) => item.stage === stage)!.title;
}

type SignupStep = "account" | "identity" | ProfileGroup["id"];

const JOURNEY_LEDE: Record<LifeStage, string> = {
  future: "Where you are in astronaut training. Skip anything that doesn't apply yet.",
  active: "Details of the mission you're on now.",
  retired: "A short summary of your time in space.",
};

function stepCopy(step: SignupStep, stage: LifeStage): { title: string; lede: string } {
  switch (step) {
    case "account": return { title: "Create your account", lede: `Each ${stageName(stage).toLowerCase()} has their own account and private profile.` };
    case "identity": return { title: "Who you are", lede: "Your full name is the only required detail. You can edit everything later on your Profile page." };
    case "personal": return { title: "Personal details", lede: "Basic details your care team may ask for. Leave out anything you'd rather not share." };
    case "journey": return { title: profileGroups(stage)[1].title, lede: JOURNEY_LEDE[stage] };
    case "careTeam": return { title: "Care team and contacts", lede: "The people who support you. They're shown for your reference; OrbitWell never contacts them." };
  }
}

/** Only the errors that belong to one step, so each page can be checked before moving on. */
function errorsForStep(step: SignupStep, errors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => step === "identity" ? !key.includes(".") : key.startsWith(`${step}.`)));
}

function SignupFlow({ stage, repository, account, onDone, onLogin }: { stage: LifeStage; repository: AccountRepository; account: Account | null; onDone: (account: Account) => void; onLogin: () => void }) {
  const completing = Boolean(account);
  const steps: SignupStep[] = completing ? ["identity", "personal", "journey", "careTeam"] : ["account", "identity", "personal", "journey", "careTeam"];
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profile, setProfile] = useState<AstronautProfile>(emptyProfile(stage));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const current = steps[step];
  const last = step === steps.length - 1;
  const copy = stepCopy(current, stage);

  const next = () => {
    setError(undefined);
    if (current === "account") {
      const invalid = checkCredentials(email, password) ?? (password !== confirm ? "The passwords don't match." : undefined);
      if (invalid) { setError(invalid); return; }
    } else {
      const found = errorsForStep(current, validateProfile(profile));
      setErrors(found);
      if (Object.keys(found).length) { setError("Check the highlighted fields."); return; }
    }
    setStep((value) => value + 1);
  };
  const submit = async () => {
    const found = validateProfile(profile);
    setErrors(found);
    if (Object.keys(found).length) {
      // Send the person back to the first page with a problem.
      const firstBad = steps.findIndex((item) => item !== "account" && Object.keys(errorsForStep(item, found)).length);
      if (firstBad >= 0) setStep(firstBad);
      setError("Check the highlighted fields.");
      return;
    }
    setBusy(true); setError(undefined);
    const result = account ? await repository.saveProfile(account, profile) : await repository.signUp(email, password, profile);
    setBusy(false);
    if (result.notice) { setNotice(result.notice); return; }
    if (result.account && !result.error) { onDone(result.account); return; }
    setError(result.error ?? "The account could not be created.");
  };

  if (notice) return <section className="tech-card account-card" role="status"><h1>Almost there</h1><p className="page-lede">{notice}</p><button type="button" className="btn-primary" onClick={onLogin}>Go to log in</button></section>;

  return <section className="tech-card account-card account-card-step" aria-labelledby="signup-title">
    <div className="checkin-progress" aria-hidden="true"><span style={{ width: `${Math.round(((step + 1) / steps.length) * 100)}%` }} /></div>
    <p className="checkin-count">Step {step + 1} of {steps.length}</p>
    <h1 id="signup-title">{copy.title}</h1>
    <p className="page-lede">{copy.lede}</p>
    <form className="account-form" onSubmit={(event) => { event.preventDefault(); if (last) void submit(); else next(); }} noValidate>
      {current === "account" ? <>
        <TextField id="signup-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField id="signup-password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters" value={password} onChange={setPassword} />
        <TextField id="signup-confirm" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      </> : <ProfileFields key={current} profile={profile} onChange={setProfile} errors={errors} sections={[current]} />}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="account-nav">
        {step > 0 ? <button type="button" className="btn-secondary" onClick={() => { setError(undefined); setStep((value) => value - 1); }}><ArrowLeft size={15} aria-hidden="true" /> Back</button> : <span />}
        {last
          ? <button type="submit" className="btn-primary" disabled={busy}><UserPlus size={16} aria-hidden="true" />{busy ? "Saving…" : completing ? "Save profile" : "Create account"}</button>
          : <button type="submit" className="btn-primary">Continue <ArrowRight size={15} aria-hidden="true" /></button>}
      </div>
    </form>
    {!completing && step === 0 ? <p className="account-switch">Already have an account? <button type="button" className="btn-link" onClick={onLogin}>Log in</button></p> : null}
  </section>;
}

export function StagePicker({ value, onChange }: { value: LifeStage | null; onChange: (stage: LifeStage) => void }) {
  return <fieldset className="stage-picker"><legend className="sr-only">Mission stage</legend>{STAGE_CHOICES.map(({ stage, title, body }) => {
    const Icon = STAGE_ICONS[stage];
    return <label key={stage} className="stage-choice" data-selected={value === stage || undefined}>
      <input type="radio" name="account-stage" value={stage} checked={value === stage} onChange={() => onChange(stage)} />
      <span className="stage-choice-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.5} /></span>
      <span><strong>{title}</strong><span>{body}</span></span>
    </label>;
  })}</fieldset>;
}

/** Identity fields plus the stage's personal, journey and care-team groups. Used for sign-up and editing. */
/**
 * Identity plus the stage's personal, journey and care-team groups. Sign-up shows one section per page
 * (`sections`); the edit form shows them all.
 */
export function ProfileFields({ profile, onChange, errors, showStage = false, sections }: { profile: AstronautProfile; onChange: (profile: AstronautProfile) => void; errors: Record<string, string>; showStage?: boolean; sections?: Array<"identity" | ProfileGroup["id"]> }) {
  const setGroup = (group: ProfileGroup["id"], key: string, value: string) => onChange({ ...profile, [group]: { ...profile[group], [key]: value } });
  const shows = (section: "identity" | ProfileGroup["id"]) => !sections || sections.includes(section);
  const single = Boolean(sections && sections.length === 1);
  return <div className="profile-fields">
    {showStage ? <FormSection title="Mission stage"><StagePicker value={profile.stage} onChange={(stage) => onChange({ ...profile, stage })} /></FormSection> : null}
    {shows("identity") ? <FormSection title="Identity" hideTitle={single}>
      <div className="field-grid">
        <TextField id="profile-fullName" label="Full name" required value={profile.fullName} onChange={(value) => onChange({ ...profile, fullName: value })} error={errors.fullName} />
        <TextField id="profile-callSign" label="Call sign" value={profile.callSign} onChange={(value) => onChange({ ...profile, callSign: value })} error={errors.callSign} />
        <TextField id="profile-agency" label="Agency" value={profile.agency} onChange={(value) => onChange({ ...profile, agency: value })} />
      </div>
    </FormSection> : null}
    {profileGroups(profile.stage).filter((group) => shows(group.id)).map((group) => <FormSection key={group.id} title={group.title} hideTitle={single}>
      <div className="field-grid">{group.fields.map((field) => <ProfileInput key={field.key} id={`profile-${group.id}-${field.key}`} field={field} value={profile[group.id][field.key] ?? ""} error={errors[`${group.id}.${field.key}`]} onChange={(value) => setGroup(group.id, field.key, value)} />)}</div>
    </FormSection>)}
  </div>;
}

function FormSection({ title, children, hideTitle = false }: { title: string; children: ReactNode; hideTitle?: boolean }) {
  // On a one-section page the page heading already names it, so the legend is kept for screen readers only.
  return <fieldset className="form-section"><legend className={hideTitle ? "sr-only" : undefined}>{title}</legend>{children}</fieldset>;
}

function ProfileInput({ id, field, value, error, onChange }: { id: string; field: ProfileField; value: string; error?: string; onChange: (value: string) => void }) {
  const label = field.unit && field.unit !== "years" ? `${field.label} (${field.unit})` : field.label;
  if (field.kind === "select") return <div className="form-field"><label htmlFor={id}>{label}</label><select id={id} className="field" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Not provided</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
  return <TextField id={id} label={label} type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} placeholder={field.placeholder} value={value} onChange={onChange} error={error} />;
}

function TextField({ id, label, value, onChange, type = "text", hint, error, required, placeholder, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; hint?: string; error?: string; required?: boolean; placeholder?: string; autoComplete?: string }) {
  return <div className="form-field">
    <label htmlFor={id}>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}{hint ? <span className="form-hint"> · {hint}</span> : null}</label>
    <input id={id} className="field" type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
    {error ? <p id={`${id}-error`} className="form-error">{error}</p> : null}
  </div>;
}
