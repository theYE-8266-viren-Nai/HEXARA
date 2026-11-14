import { beforeEach, describe, expect, it } from "vitest";
import { createAccountRepository } from "./accountRepository";
import { emptyProfile } from "../domain/astronautAccount";

const profile = { ...emptyProfile("future"), fullName: "Leon Hart", journey: { candidateClass: "2025" } };

describe("browser-only account store", () => {
  beforeEach(() => window.localStorage.clear());

  it("creates an account, keeps it signed in, and never stores the password itself", async () => {
    const repository = createAccountRepository(null);
    expect(repository.mode).toBe("local");
    const created = await repository.signUp("leon@example.com", "correct horse", profile);
    expect(created.account?.profile?.fullName).toBe("Leon Hart");
    expect((await repository.current())?.email).toBe("leon@example.com");
    expect(window.localStorage.getItem("orbitwell:accounts")).not.toContain("correct horse");
  });

  it("rejects duplicate emails, short passwords and wrong passwords", async () => {
    const repository = createAccountRepository(null);
    await repository.signUp("leon@example.com", "correct horse", profile);
    expect((await repository.signUp("LEON@example.com", "another one", profile)).error).toMatch(/already exists/);
    expect((await repository.signUp("new@example.com", "short", profile)).error).toMatch(/at least 8/);
    expect((await repository.signIn("leon@example.com", "wrong password")).error).toMatch(/don't match/);
  });

  it("logs out, logs back in and saves profile edits", async () => {
    const repository = createAccountRepository(null);
    await repository.signUp("leon@example.com", "correct horse", profile);
    await repository.signOut();
    expect(await repository.current()).toBeNull();
    const signedIn = await repository.signIn("leon@example.com", "correct horse");
    const saved = await repository.saveProfile(signedIn.account!, { ...profile, agency: "ESA" });
    expect(saved.account?.profile?.agency).toBe("ESA");
    expect((await repository.current())?.profile?.agency).toBe("ESA");
  });
});

describe("Supabase account store", () => {
  function fakeClient(options: { session?: unknown; signUpSession?: boolean; upsertError?: string; row?: unknown } = {}) {
    const calls: Record<string, unknown[]> = { upsert: [], signUp: [], eq: [] };
    const client = {
      auth: {
        getSession: async () => ({ data: { session: options.session ?? null } }),
        signUp: async (args: unknown) => { calls.signUp.push(args); return { data: { user: { id: "user-1", email: "maya@example.com" }, session: options.signUpSession === false ? null : {} }, error: null }; },
        signInWithPassword: async () => ({ data: { user: { id: "user-1", email: "maya@example.com" } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        upsert: async (row: unknown) => { calls.upsert.push(row); return { error: options.upsertError ? { message: options.upsertError } : null }; },
        select: () => ({ eq: (_column: string, value: unknown) => { calls.eq.push(value); return { maybeSingle: async () => ({ data: options.row ?? null, error: null }) }; } }),
      }),
    };
    return { client: client as never, calls };
  }

  it("signs up and saves the profile under the new user's id", async () => {
    const { client, calls } = fakeClient();
    const result = await createAccountRepository(client).signUp("maya@example.com", "station-life", { ...profile, stage: "active", fullName: "Maya Chen", journey: { mission: "Expedition 12" } });
    expect(result.error).toBeUndefined();
    expect(calls.upsert[0]).toMatchObject({ user_id: "user-1", stage: "active", full_name: "Maya Chen", details: { journey: { mission: "Expedition 12" } } });
  });

  it("asks the person to confirm their email when Supabase requires it", async () => {
    const { client } = fakeClient({ signUpSession: false });
    expect((await createAccountRepository(client).signUp("maya@example.com", "station-life", profile)).notice).toMatch(/confirm your account/);
  });

  it("explains a missing profiles table instead of failing silently", async () => {
    const { client } = fakeClient({ upsertError: 'relation "public.astronaut_profiles" does not exist' });
    expect((await createAccountRepository(client).signUp("maya@example.com", "station-life", profile)).error).toMatch(/run the latest migration/);
  });

  it("treats anonymous sessions as logged out and loads a real user's profile", async () => {
    expect(await createAccountRepository(fakeClient({ session: { user: { id: "anon", is_anonymous: true } } }).client).current()).toBeNull();
    const row = { stage: "retired", full_name: "Elena Ruiz", call_sign: "", agency: "", details: { careTeam: { primaryDoctor: "Dr. R. Castillo" } } };
    const account = await createAccountRepository(fakeClient({ session: { user: { id: "user-2", email: "elena@example.com", is_anonymous: false } }, row }).client).current();
    expect(account?.profile).toMatchObject({ stage: "retired", fullName: "Elena Ruiz", careTeam: { primaryDoctor: "Dr. R. Castillo" } });
  });
});
