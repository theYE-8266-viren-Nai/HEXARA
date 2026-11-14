import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const localEnv = await readFile(".env.local", "utf8");
const env = Object.fromEntries(localEnv.split(/\r?\n/).filter((line) => /^\s*VITE_SUPABASE_(URL|PUBLISHABLE_KEY)\s*=/.test(line)).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
}));
const makeClient = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedOut = makeClient();
const owner = makeClient();
const stranger = makeClient();

const ownerAuth = await owner.auth.signInAnonymously();
const strangerAuth = await stranger.auth.signInAnonymously();
assert.ifError(ownerAuth.error);
assert.ifError(strangerAuth.error);
const ownerId = ownerAuth.data.user.id;
const checkId = randomUUID();
const row = {
  id: checkId,
  user_id: ownerId,
  owner_key: "retired:rls-check",
  check_type: "sit_to_stand",
  started_at: new Date().toISOString(),
  completion_status: "completed",
  observed_features: { repetitionCount: 4, movementDurationSeconds: 20, leftRightBalance: 0.5, pauseCount: 0, cameraQuality: "good", qualityNotes: [] },
  user_reported_context: {},
  comparison_summary: { trend: "first_session", statements: [], priorSessionsUsed: 0 },
  support_recommendation: "RLS verification row",
  camera_quality: "good",
  is_synthetic: true,
};

const inserted = await owner.from("visual_checks").insert(row).select("id").single();
assert.ifError(inserted.error);
try {
  const ownerRows = await owner.from("visual_checks").select("id").eq("id", checkId);
  assert.ifError(ownerRows.error);
  assert.equal(ownerRows.data.length, 1, "the owner must read its movement summary");

  const strangerRows = await stranger.from("visual_checks").select("id").eq("id", checkId);
  assert.ifError(strangerRows.error);
  assert.equal(strangerRows.data.length, 0, "another user must not read the owner's movement summary");

  const forged = await stranger.from("visual_checks").insert({ ...row, id: randomUUID() });
  assert.ok(forged.error, "another user must not insert a movement summary as the owner");

  const changed = await stranger.from("visual_checks").update({ completion_status: "partial" }).eq("id", checkId).select("id");
  assert.ifError(changed.error);
  assert.equal(changed.data.length, 0, "another user must not update the owner's movement summary");

  const removed = await stranger.from("visual_checks").delete().eq("id", checkId).select("id");
  assert.ifError(removed.error);
  assert.equal(removed.data.length, 0, "another user must not delete the owner's movement summary");

  const signedOutRead = await signedOut.from("visual_checks").select("id").eq("id", checkId);
  assert.ok(signedOutRead.error || signedOutRead.data.length === 0, "a signed-out visitor must not read movement summaries");
  const signedOutWrite = await signedOut.from("visual_checks").insert({ ...row, id: randomUUID() });
  assert.ok(signedOutWrite.error, "a signed-out visitor must not write movement summaries");
} finally {
  await owner.from("visual_checks").delete().eq("id", checkId);
  await owner.auth.signOut();
  await stranger.auth.signOut();
}

console.log("PASS: visual_checks RLS permits owner access and blocks cross-user and signed-out access.");
