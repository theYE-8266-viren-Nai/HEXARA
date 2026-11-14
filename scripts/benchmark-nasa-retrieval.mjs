import { readFile } from "node:fs/promises";
import { NASA_BENCHMARK_QUESTIONS } from "./nasa-benchmark-questions.mjs";

const localEnv = await readFile(".env.local", "utf8").catch(() => "");
const parsed = Object.fromEntries(localEnv.split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const url = process.env.SUPABASE_URL ?? parsed.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? parsed.VITE_SUPABASE_PUBLISHABLE_KEY;
const ingestSecret = process.env.NASA_INGEST_SECRET;
if (!url || !publishableKey || !ingestSecret) throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and NASA_INGEST_SECRET are required.");

let passed = 0;
for (const item of NASA_BENCHMARK_QUESTIONS) {
  const response = await fetch(`${url}/functions/v1/nasa-corpus-ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: publishableKey, "x-ingest-secret": ingestSecret },
    body: JSON.stringify({ action: "benchmark", question: item.question }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${item.category}: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const ids = (payload.matches ?? []).map((match) => match.sourceId);
  const ok = item.expected.some((id) => ids.includes(id));
  if (ok) passed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} [${item.category}] ${item.question}\n  top 5: ${ids.join(", ") || "none"}`);
}
const percentage = Math.round((passed / NASA_BENCHMARK_QUESTIONS.length) * 1000) / 10;
console.log(`NASA retrieval benchmark: ${passed}/${NASA_BENCHMARK_QUESTIONS.length} (${percentage}%) relevant source in top five.`);
if (percentage < 90) process.exitCode = 1;
