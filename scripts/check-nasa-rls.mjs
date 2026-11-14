import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const localEnv = await readFile(".env.local", "utf8");
const env = Object.fromEntries(localEnv.split(/\r?\n/).filter((line) => /^\s*VITE_SUPABASE_(URL|PUBLISHABLE_KEY)\s*=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2")]; }));
const makeClient = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedOut = makeClient();
const owner = makeClient();
const stranger = makeClient();

const ownerAuth = await owner.auth.signInAnonymously();
const strangerAuth = await stranger.auth.signInAnonymously();
assert.ifError(ownerAuth.error);
assert.ifError(strangerAuth.error);
const ownerId = ownerAuth.data.user.id;
const strangerId = strangerAuth.data.user.id;

for (const client of [signedOut, owner, stranger]) {
  for (const table of ["nasa_documents", "nasa_chunks"]) {
    const result = await client.from(table).select("id").limit(1);
    assert.ok(result.error, `${table} must not be readable with a browser credential`);
  }
  const search = await client.rpc("search_nasa_chunks", { query_text: "ISS", query_embedding: Array(384).fill(0), match_count: 1 });
  assert.ok(search.error, "search_nasa_chunks must not be callable with a browser credential");
}

const conversation = await owner.from("chat_conversations").insert({ user_id: ownerId, stage: "active", title: "RLS verification" }).select("id").single();
assert.ifError(conversation.error);
try {
  const hidden = await stranger.from("chat_conversations").select("id").eq("id", conversation.data.id);
  assert.ifError(hidden.error);
  assert.equal(hidden.data.length, 0, "another user must not see the owner's conversation");
  const forged = await stranger.from("chat_messages").insert({ conversation_id: conversation.data.id, user_id: ownerId, role: "user", content: "forged" });
  assert.ok(forged.error, "another user must not write into the owner's conversation");
  const ownMessage = await owner.from("chat_messages").insert({ conversation_id: conversation.data.id, user_id: ownerId, role: "user", content: "owner check" });
  assert.ifError(ownMessage.error);
  const strangerRows = await stranger.from("chat_messages").select("id").eq("conversation_id", conversation.data.id);
  assert.ifError(strangerRows.error);
  assert.equal(strangerRows.data.length, 0, "another user must not see the owner's messages");
  assert.notEqual(ownerId, strangerId);
} finally {
  await owner.from("chat_conversations").delete().eq("id", conversation.data.id);
  await owner.auth.signOut();
  await stranger.auth.signOut();
}

console.log("PASS: NASA index/search are server-only and chat ownership RLS blocks cross-user reads and writes.");
