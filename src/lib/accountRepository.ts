import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanProfile, type AstronautProfile } from "../domain/astronautAccount";
import type { LifeStage } from "../types/horizon";

/**
 * Astronaut accounts. With Supabase configured, accounts use Supabase Auth (email + password) and the
 * `astronaut_profiles` table (owner-only RLS). Without it, a browser-only demo store keeps the app usable;
 * those accounts exist only in that browser and are labelled as such in the UI.
 */
export interface Account { userId: string; email: string; profile: AstronautProfile | null }
export interface AccountResult { account?: Account; error?: string; notice?: string }
export interface AccountRepository {
  mode: "cloud" | "local";
  current(): Promise<Account | null>;
  signUp(email: string, password: string, profile: AstronautProfile): Promise<AccountResult>;
  signIn(email: string, password: string): Promise<AccountResult>;
  signOut(): Promise<void>;
  saveProfile(account: Account, profile: AstronautProfile): Promise<AccountResult>;
}

export const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkCredentials(email: string, password: string): string | undefined {
  if (!EMAIL.test(email.trim())) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) return `Use a password with at least ${MIN_PASSWORD} characters.`;
  return undefined;
}

export function createAccountRepository(client: SupabaseClient | null): AccountRepository {
  return client ? cloudRepository(client) : localRepository();
}

type ProfileRow = { stage: LifeStage; full_name: string; call_sign: string; agency: string; details: { personal?: Record<string, string>; journey?: Record<string, string>; careTeam?: Record<string, string> } | null };

function fromRow(row: ProfileRow | null): AstronautProfile | null {
  if (!row) return null;
  const details = row.details ?? {};
  return { stage: row.stage, fullName: row.full_name, callSign: row.call_sign ?? "", agency: row.agency ?? "", personal: details.personal ?? {}, journey: details.journey ?? {}, careTeam: details.careTeam ?? {} };
}

function toRow(userId: string, profile: AstronautProfile) {
  const clean = cleanProfile(profile);
  return { user_id: userId, stage: clean.stage, full_name: clean.fullName, call_sign: clean.callSign, agency: clean.agency, details: { personal: clean.personal, journey: clean.journey, careTeam: clean.careTeam } };
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Log in instead.";
  if (/email not confirmed/i.test(message)) return "Confirm your email address first, using the link we sent you.";
  if (/signups not allowed|email signups are disabled/i.test(message)) return "New accounts are switched off for this project. Ask the project owner to enable email sign-up in Supabase.";
  if (/relation .*astronaut_profiles|schema cache/i.test(message)) return "Profiles can't be saved yet: the astronaut_profiles table is missing in Supabase. Ask the project owner to run the latest migration.";
  return message;
}

function cloudRepository(client: SupabaseClient): AccountRepository {
  const loadProfile = async (userId: string) => {
    const { data, error } = await client.from("astronaut_profiles").select("stage,full_name,call_sign,agency,details").eq("user_id", userId).maybeSingle();
    return { profile: fromRow(data as ProfileRow | null), error: error?.message };
  };
  return {
    mode: "cloud",
    async current() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user || user.is_anonymous || !user.email) return null;
      const { profile } = await loadProfile(user.id);
      return { userId: user.id, email: user.email, profile };
    },
    async signUp(email, password, profile) {
      const invalid = checkCredentials(email, password);
      if (invalid) return { error: invalid };
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) return { error: friendly(error.message) };
      if (!data.user) return { error: "The account could not be created. Try again." };
      if (!data.session) return { notice: "Check your email to confirm your account, then log in." };
      const saved = await client.from("astronaut_profiles").upsert(toRow(data.user.id, profile));
      const account = { userId: data.user.id, email: data.user.email ?? email.trim(), profile: cleanProfile(profile) };
      if (saved.error) return { account, error: `Your account was created, but the profile was not saved: ${friendly(saved.error.message)}` };
      return { account };
    },
    async signIn(email, password) {
      if (!email.trim() || !password) return { error: "Enter your email and password." };
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return { error: friendly(error?.message ?? "Log in failed.") };
      const { profile, error: profileError } = await loadProfile(data.user.id);
      return { account: { userId: data.user.id, email: data.user.email ?? email.trim(), profile }, error: profileError ? friendly(profileError) : undefined };
    },
    async signOut() {
      await client.auth.signOut();
    },
    async saveProfile(account, profile) {
      const { error } = await client.from("astronaut_profiles").upsert(toRow(account.userId, profile));
      if (error) return { error: `Not saved: ${friendly(error.message)}` };
      return { account: { ...account, profile: cleanProfile(profile) } };
    },
  };
}

/* ---------- Browser-only demo accounts (used when Supabase is not configured) ---------- */

const ACCOUNTS_KEY = "orbitwell:accounts";
const SESSION_KEY = "orbitwell:session";
type StoredAccount = { userId: string; email: string; salt: string; hash: string; profile: AstronautProfile | null };

function readStore(): Record<string, StoredAccount> {
  try { return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "{}"); } catch { return {}; }
}
function writeStore(store: Record<string, StoredAccount>) {
  try { window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
}
function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
async function hashPassword(password: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (const char of `${salt}:${password}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `weak-${hash}`;
}

function localRepository(): AccountRepository {
  const toAccount = (stored: StoredAccount): Account => ({ userId: stored.userId, email: stored.email, profile: stored.profile });
  return {
    mode: "local",
    async current() {
      let email: string | null = null;
      try { email = window.localStorage.getItem(SESSION_KEY); } catch { /* storage unavailable */ }
      const stored = email ? readStore()[email] : undefined;
      return stored ? toAccount(stored) : null;
    },
    async signUp(email, password, profile) {
      const invalid = checkCredentials(email, password);
      if (invalid) return { error: invalid };
      const key = email.trim().toLowerCase();
      const store = readStore();
      if (store[key]) return { error: "An account with this email already exists. Log in instead." };
      const salt = randomId();
      store[key] = { userId: randomId(), email: email.trim(), salt, hash: await hashPassword(password, salt), profile: cleanProfile(profile) };
      writeStore(store);
      try { window.localStorage.setItem(SESSION_KEY, key); } catch { /* storage unavailable */ }
      return { account: toAccount(store[key]) };
    },
    async signIn(email, password) {
      const key = email.trim().toLowerCase();
      const stored = readStore()[key];
      if (!stored || stored.hash !== await hashPassword(password, stored.salt)) return { error: "That email and password don't match an account." };
      try { window.localStorage.setItem(SESSION_KEY, key); } catch { /* storage unavailable */ }
      return { account: toAccount(stored) };
    },
    async signOut() {
      try { window.localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
    },
    async saveProfile(account, profile) {
      const store = readStore();
      const key = account.email.toLowerCase();
      if (!store[key]) return { error: "This account no longer exists in this browser." };
      store[key] = { ...store[key], profile: cleanProfile(profile) };
      writeStore(store);
      return { account: toAccount(store[key]) };
    },
  };
}
