// Admin-only NASA corpus ingestion. Deploy with --no-verify-jwt; the high-entropy ingest secret is still required.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const NASA_URL = /^https:\/\/([a-z0-9-]+\.)*(nasa\.gov|nasa\.mil)\//i;
const equal = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let value = 0; for (let i = 0; i < a.length; i += 1) value |= a.charCodeAt(i) ^ b.charCodeAt(i); return value === 0; };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const expected = Deno.env.get("NASA_INGEST_SECRET") ?? "";
  if (!equal(request.headers.get("x-ingest-secret") ?? "", expected)) return json(401, { error: "authentication_required" });
  const raw = await request.text();
  if (raw.length > 300_000) return json(413, { error: "too_large" });
  let body: unknown; try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (record(body) && body.action === "benchmark") {
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 500) return json(400, { error: "invalid_question" });
    try {
      const session = new Supabase.ai.Session("gte-small");
      const embedding = await session.run(question, { mean_pool: true, normalize: true });
      if (!Array.isArray(embedding) || embedding.length !== 384) return json(502, { error: "embedding_failed" });
      const result = await client.rpc("search_nasa_chunks", { query_text: question, query_embedding: embedding, match_count: 5 });
      if (result.error) return json(500, { error: "search_failed", detail: result.error.message });
      const matches = (result.data ?? []).map((row: Record<string, unknown>) => ({
        sourceId: row.source_id,
        title: row.title,
        collection: row.collection,
        semanticSimilarity: row.semantic_similarity,
        combinedScore: row.combined_score,
      }));
      return json(200, { matches });
    } catch { return json(502, { error: "benchmark_unavailable" }); }
  }
  if (!record(body) || !record(body.document) || !Array.isArray(body.chunks)) return json(400, { error: "invalid_request" });
  const document = body.document;
  const chunks = body.chunks.filter(record);
  if (typeof document.source_id !== "string" || typeof document.title !== "string" || typeof document.url !== "string" || !NASA_URL.test(document.url)
    || typeof document.collection !== "string" || typeof document.checksum !== "string" || chunks.length !== 1) return json(400, { error: "invalid_document" });
  if (chunks.some((chunk) => typeof chunk.content !== "string" || chunk.content.length < 40 || chunk.content.length > 12_000 || !Number.isInteger(chunk.chunk_index))) return json(400, { error: "invalid_chunk" });

  const session = new Supabase.ai.Session("gte-small");
  try {
    const embedded = [];
    for (const chunk of chunks) {
      const embedding = await session.run(chunk.content as string, { mean_pool: true, normalize: true });
      if (!Array.isArray(embedding) || embedding.length !== 384 || embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) return json(502, { error: "embedding_failed" });
      embedded.push({ ...chunk, embedding });
    }
    const result = await client.rpc("replace_nasa_document", { p_document: document, p_chunks: embedded });
    if (result.error) return json(500, { error: "document_not_saved", detail: result.error.message });
    return json(200, { documentId: result.data, chunks: embedded.length });
  } catch { return json(502, { error: "ingestion_unavailable" }); }
});
