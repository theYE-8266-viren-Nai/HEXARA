import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { NASA_SOURCES } from "./nasa-source-registry.mjs";

const localEnv = await readFile(".env.local", "utf8").catch(() => "");
const parsed = Object.fromEntries(localEnv.split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const url = process.env.SUPABASE_URL ?? parsed.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? parsed.VITE_SUPABASE_PUBLISHABLE_KEY;
const ingestSecret = process.env.NASA_INGEST_SECRET;
if (!url || !publishableKey || !ingestSecret) throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and NASA_INGEST_SECRET are required.");

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const cleanHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (_, entity) => entity[0] === "#" ? String.fromCodePoint(entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1))) : entities[entity.toLowerCase()] ?? " ").replace(/\s+/g, " ").trim();
const fetchText = async (source) => {
  try {
    const response = await fetch(source.url, { headers: { "user-agent": "Horizon NASA research demo/1.0" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(String(response.status));
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("pdf") || source.url.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
      try { return (await parser.getText()).text.replace(/\s+/g, " ").trim(); } finally { await parser.destroy(); }
    }
    return cleanHtml(await response.text());
  } catch (error) {
    console.warn(`Using reviewed fallback for ${source.id}: ${error instanceof Error ? error.message : "fetch failed"}`);
    return source.fallback;
  }
};
const chunks = (text, size = 420, overlap = 50) => {
  const words = text.split(/\s+/).filter(Boolean).slice(0, size);
  const result = [];
  for (let start = 0; start < words.length && result.length < 1; start += size - overlap) {
    const content = words.slice(start, start + size).join(" ");
    if (content.length >= 40) result.push({ chunk_index: result.length, section_title: "NASA source", content });
    if (start + size >= words.length) break;
  }
  return result;
};

let completed = 0;
for (const source of NASA_SOURCES) {
  const fetched = await fetchText(source);
  const text = `${source.fallback}\n\n${fetched}`;
  const document = { source_id: source.id, title: source.title, url: source.url, collection: source.collection, published_at: source.publishedAt ?? null, revised_at: null, checksum: createHash("sha256").update(text).digest("hex"), metadata: { ingested_by: "horizon-sync", official_nasa: true } };
  const response = await fetch(`${url}/functions/v1/nasa-corpus-ingest`, { method: "POST", headers: { "content-type": "application/json", apikey: publishableKey, "x-ingest-secret": ingestSecret }, body: JSON.stringify({ document, chunks: chunks(text) }), signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${source.id}: ${response.status} ${await response.text()}`);
  completed += 1;
  console.log(`Indexed ${source.id}`);
}
console.log(`Indexed ${completed} official NASA sources.`);
