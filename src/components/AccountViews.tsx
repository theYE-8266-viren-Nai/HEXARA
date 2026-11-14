import { ArrowLeft, ArrowRight, Compass, LogIn, Orbit, Rocket, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { emptyProfile, profileGroups, STAGE_CHOICES, validateProfile, type AstronautProfile, type ProfileField, type ProfileGroup } from "../domain/astronautAccount";
import { checkCredentials, type Account, type AccountRepository } from "../lib/accountRepository";
import type { LifeStage } from "../types/horizon";
import { Brand, SafetyDisclaimer } from "./AppShell";
import { ThemeToggle } from "./ThemeToggle";

const STAGE_ICONS: Record<LifeStage, typeof Rocket> = { future: Rocket, active: Orbit, retired: Compass };

type Mode = "login" | "signup" | "complete";

/** Full-page account screen: log in, create an account (3 steps), or finish a profile for an account without one. */
export function AccountScreen({ mode: initialMode, repository, account, onDone, onBack }: { mode: Mode; repository: AccountRepository; account?: Account | null; onDone: (account: Account) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  return <main className="star-field onboarding account-page">
    <div className="onboarding-container">
      <header className="onboarding-topbar"><Brand /><div className="onboarding-actions"><ThemeToggle /></div></header>
      <div className="account-layout">
        <button type="button" className="btn-link account-back" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to start</button>
        {repository.mode === "local" ? <p className="account-local-note" role="note">Cloud accounts are unavailable here, so this account is saved only in this browser.</p> : null}
        {mode === "login" ? <LoginForm repository={repository} onDone={onDone} onSignup={() => setMode("signup")} /> : <SignupFlow repository={repository} account={mode === "complete" ? account ?? null : null} onDone={onDone} onLogin={() => setMode("login")} />}
      </div>
    </div>
    <SafetyDisclaimer landing />
  </main>;
}

function LoginForm({ repository, onDone, onSignup }: { repository: AccountRepository; onDone: (account: Account) => void; onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(undefined);
    const result = await repository.signIn(email, password);
    setBusy(false);
    if (result.account) onDone(result.account); else setError(result.error ?? "Log in failed.");
  };
  return <section className="tech-card account-card" aria-labelledby="login-title">
    <h1 id="login-title">Log in</h1>
    <p className="page-lede">Welcome back. Log in to see your own profile and workspace.</p>
    <form className="account-form" onSubmit={submit} noValidate>
      <TextField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      <TextField id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={busy}><LogIn size={16} aria-hidden="true" />{busy ? "Logging in…" : "Log in"}</button>
    </form>
    <p className="account-switch">New astronaut? <button type="button" className="btn-link" onClick={onSignup}>Create an account</button></p>
  </section>;
}

function SignupFlow({ repository, account, onDone, onLogin }: { repository: AccountRepository; account: Account | null; onDone: (account: Account) => void; onLogin: () => void }) {
  const completing = Boolean(account);
  const steps = completing ? ["stage", "details"] as const : ["account", "stage", "details"] as const;
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profile, setProfile] = useState<AstronautProfile>(emptyProfile("active"));
  const [stageChosen, setStageChosen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const current = steps[step];

  const next = () => {
    setError(undefined);
    if (current === "account") {
      const invalid = checkCredentials(email, password) ?? (password !== confirm ? "The passwords don't match." : undefined);
      if (invalid) { setError(invalid); return; }
    }
    if (current === "stage" && !stageChosen) { setError("Choose the stage that describes you."); return; }
    setStep((value) => value + 1);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateProfile(profile);
    setErrors(found);
    if (Object.keys(found).length) { setError("Check the highlighted fields."); return; }
    setBusy(true); setError(undefined);
    const result = account ? await repository.saveProfile(account, profile) : await repository.signUp(email, password, profile);
    setBusy(false);
    if (result.notice) { setNotice(result.notice); return; }
    if (result.account && !result.error) { onDone(result.account); return; }
    setError(result.error ?? "The account could not be created.");
  };

  if (notice) return <section className="tech-card account-card" role="status"><h1>Almost there</h1><p className="page-lede">{notice}</p><button type="button" className="btn-primary" onClick={onLogin}>Go to log in</button></section>;

  return <section className="tech-card account-card account-card-wide" aria-labelledby="signup-title">
    <p className="checkin-count">Step {step + 1} of {steps.length}</p>
    <h1 id="signup-title">{current === "account" ? "Create your account" : current === "stage" ? "Where are you in your journey?" : "Your personal details"}</h1>
    <p className="page-lede">{current === "account" ? "Each astronaut has their own account and private profile." : current === "stage" ? "This decides which workspace, check-in questions and profile details you see. You can change it later." : "These appear on your Profile page. Only your name is required, and you can edit everything later."}</p>
    <form className="account-form" onSubmit={current === "details" ? submit : (event) => { event.preventDefault(); next(); }} noValidate>
      {current === "account" ? <>
        <TextField id="signup-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField id="signup-password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters" value={password} onChange={setPassword} />
        <TextField id="signup-confirm" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      </> : null}
      {current === "stage" ? <StagePicker value={stageChosen ? profile.stage : null} onChange={(stage) => { setStageChosen(true); setProfile((value) => ({ ...value, stage })); }} /> : null}
      {current === "details" ? <ProfileFields profile={profile} onChange={setProfile} errors={errors} /> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="account-nav">
        {step > 0 ? <button type="button" className="btn-secondary" onClick={() => { setError(undefined); setStep((value) => value - 1); }}><ArrowLeft size={15} aria-hidden="true" /> Back</button> : <span />}
        {current === "details"
          ? <button type="submit" className="btn-primary" disabled={busy}><UserPlus size={16} aria-hidden="true" />{busy ? "Saving…" : completing ? "Save profile" : "Create account"}</button>
          : <button type="submit" className="btn-primary">Continue <ArrowRight size={15} aria-hidden="true" /></button>}
      </div>
    </form>
    {!completing ? <p className="account-switch">Already have an account? <button type="button" className="btn-link" onClick={onLogin}>Log in</button></p> : null}
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
export function ProfileFields({ profile, onChange, errors, showStage = false }: { profile: AstronautProfile; onChange: (profile: AstronautProfile) => void; errors: Record<string, string>; showStage?: boolean }) {
  const setGroup = (group: ProfileGroup["id"], key: string, value: string) => onChange({ ...profile, [group]: { ...profile[group], [key]: value } });
  return <div className="profile-fields">
    {showStage ? <FormSection title="Mission stage"><StagePicker value={profile.stage} onChange={(stage) => onChange({ ...profile, stage })} /></FormSection> : null}
    <FormSection title="Identity">
      <div className="field-grid">
        <TextField id="profile-fullName" label="Full name" required value={profile.fullName} onChange={(value) => onChange({ ...profile, fullName: value })} error={errors.fullName} />
        <TextField id="profile-callSign" label="Call sign" value={profile.callSign} onChange={(value) => onChange({ ...profile, callSign: value })} error={errors.callSign} />
        <TextField id="profile-agency" label="Agency" value={profile.agency} onChange={(value) => onChange({ ...profile, agency: value })} />
      </div>
    </FormSection>
    {profileGroups(profile.stage).map((group) => <FormSection key={group.id} title={group.title}>
      <div className="field-grid">{group.fields.map((field) => <ProfileInput key={field.key} id={`profile-${group.id}-${field.key}`} field={field} value={profile[group.id][field.key] ?? ""} error={errors[`${group.id}.${field.key}`]} onChange={(value) => setGroup(group.id, field.key, value)} />)}</div>
    </FormSection>)}
  </div>;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="form-section"><legend>{title}</legend>{children}</fieldset>;
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
