/**
 * Local webhook receiver (development only).
 *
 * A pure request handler, independent of Vite and Node, so it can be unit tested. It only
 * CATCHES untrusted rows from an external device or service and holds them in memory for a
 * short time. It does not clean or analyze anything: the browser runs the rows through the
 * shared sanitizer in domain/ingest exactly like every other source.
 *
 * Storage is in memory only (lost when the dev server stops): nothing is written to disk or
 * sent to the cloud. Retention and size are capped.
 *
 * This is a local demo control, not production security: the token only stops other programs
 * and web pages from posting by accident. Host and Origin are checked so a web page on another
 * site (or a DNS-rebinding trick) cannot talk to it.
 */

export interface IngestRequest {
  method: string;
  /** Path without the query string, e.g. "/api/ingest". */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string | undefined>;
  body: string;
}
export interface IngestResponse { status: number; json: unknown; }

export interface ReceiverOptions {
  token: string;
  now?: () => number;
  retentionMs?: number;
  maxRowsPerMetric?: number;
  maxBodyChars?: number;
  maxRowsPerRequest?: number;
}

export interface StoredRow { id: number; receivedAt: number; fields: Record<string, string | number>; }

export const RECEIVER_DEFAULTS = {
  retentionMs: 48 * 3_600_000,
  maxRowsPerMetric: 20_000,
  maxBodyChars: 256 * 1024,
  maxRowsPerRequest: 1000,
  maxMetricKeys: 32,
  maxTextChars: 64,
};

/** The only fields kept from a posted row. Everything else is dropped. */
const ALLOWED_FIELDS = new Set([
  "timestamp", "time", "ts", "datetime", "observed_at",
  "metric", "type", "measurement", "value", "reading", "val", "unit", "units",
  "deviceid", "device_id", "device", "context", "activity", "signal_quality", "signalquality", "contact",
]);
const METRIC_FIELDS = ["metric", "type", "measurement"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");
const hostName = (host: string) => host.trim().toLowerCase().replace(/:\d+$/, "");
const reply = (status: number, json: unknown): IngestResponse => ({ status, json });

/** Constant-time comparison, so response timing does not leak the token. */
function sameToken(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Keeps only known fields with primitive values and bounded length. Returns null if the row is unusable. */
export function shapeRow(raw: unknown): Record<string, string | number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = normalizeKey(key);
    if (!ALLOWED_FIELDS.has(name)) continue;
    if (typeof value === "number") { if (Number.isFinite(value)) out[name] = value; }
    else if (typeof value === "string") out[name] = value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, RECEIVER_DEFAULTS.maxTextChars);
  }
  return Object.keys(out).length ? out : null;
}

export function createIngestReceiver(options: ReceiverOptions) {
  const now = options.now ?? (() => Date.now());
  const retentionMs = options.retentionMs ?? RECEIVER_DEFAULTS.retentionMs;
  const maxPerMetric = options.maxRowsPerMetric ?? RECEIVER_DEFAULTS.maxRowsPerMetric;
  const maxBody = options.maxBodyChars ?? RECEIVER_DEFAULTS.maxBodyChars;
  const maxRows = options.maxRowsPerRequest ?? RECEIVER_DEFAULTS.maxRowsPerRequest;
  let rows: StoredRow[] = [];
  let nextId = 1;

  const metricKey = (fields: Record<string, string | number>): string => {
    for (const name of METRIC_FIELDS) { const v = fields[name]; if (typeof v === "string" && v) return normalizeKey(v).slice(0, 32); }
    return "unknown";
  };

  const prune = () => {
    const cutoff = now() - retentionMs;
    rows = rows.filter((row) => row.receivedAt >= cutoff);
    const counts = new Map<string, number>();
    // Walk newest to oldest and keep at most `maxPerMetric` rows for each metric.
    const kept: StoredRow[] = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const key = metricKey(rows[i].fields);
      const count = counts.get(key) ?? 0;
      if (count < maxPerMetric) { counts.set(key, count + 1); kept.push(rows[i]); }
    }
    rows = kept.reverse();
  };

  const guard = (req: IngestRequest): IngestResponse | null => {
    const host = req.headers.host;
    if (!host || !LOCAL_HOSTS.has(hostName(host))) return reply(403, { error: "This receiver only answers on localhost." });
    const origin = req.headers.origin;
    if (origin) {
      const originHost = origin.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
      if (originHost.toLowerCase() !== host.toLowerCase()) return reply(403, { error: "Cross-origin requests are not allowed." });
    }
    return null;
  };

  return {
    /** Returns null when the path is not ours, so the caller can pass the request on. */
    handle(req: IngestRequest): IngestResponse | null {
      if (req.path !== "/api/ingest" && !req.path.startsWith("/api/ingest/")) return null;
      const blocked = guard(req);
      if (blocked) return blocked;
      prune();

      if (req.path === "/api/ingest/status") {
        if (req.method !== "GET") return reply(405, { error: "Use GET." });
        return reply(200, { ok: true, rows: rows.length, retentionHours: retentionMs / 3_600_000, maxRowsPerMetric: maxPerMetric, token: options.token });
      }

      if (req.path === "/api/ingest/readings") {
        if (req.method !== "GET") return reply(405, { error: "Use GET." });
        const after = Number(req.query.after ?? 0);
        const limit = Math.min(Math.max(Number(req.query.limit ?? 5000) || 5000, 1), 20_000);
        const fresh = rows.filter((row) => row.id > (Number.isFinite(after) ? after : 0));
        const page = fresh.slice(0, limit);
        return reply(200, { rows: page, lastId: page.at(-1)?.id ?? (Number.isFinite(after) ? after : 0), more: fresh.length > page.length });
      }

      if (req.path === "/api/ingest") {
        if (req.method !== "POST") return reply(405, { error: "Use POST." });
        const auth = req.headers.authorization ?? "";
        if (!auth.startsWith("Bearer ") || !sameToken(auth.slice(7).trim(), options.token)) return reply(401, { error: "Missing or wrong token. Send: Authorization: Bearer <token>." });
        if (req.body.length > maxBody) return reply(413, { error: `Body is larger than ${Math.round(maxBody / 1024)} KB.` });
        let parsed: unknown;
        try { parsed = JSON.parse(req.body); } catch { return reply(400, { error: "Body is not valid JSON." }); }
        const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { readings?: unknown }).readings) ? (parsed as { readings: unknown[] }).readings : null;
        if (!list) return reply(400, { error: 'Send a JSON array of readings, or { "readings": [...] }.' });
        if (list.length > maxRows) return reply(413, { error: `At most ${maxRows} readings per request.` });
        const metricKeys = new Set(rows.map((row) => metricKey(row.fields)));
        let accepted = 0; let rejected = 0;
        for (const item of list) {
          const fields = shapeRow(item);
          if (!fields) { rejected += 1; continue; }
          let key = metricKey(fields);
          if (!metricKeys.has(key) && metricKeys.size >= RECEIVER_DEFAULTS.maxMetricKeys) { fields.metric = "unknown"; key = "unknown"; }
          metricKeys.add(key);
          rows.push({ id: nextId++, receivedAt: now(), fields });
          accepted += 1;
        }
        prune();
        return reply(202, { accepted, rejected, note: "Rows are checked and cleaned in the app, not here." });
      }

      return reply(404, { error: "Unknown endpoint." });
    },
    size: () => rows.length,
  };
}
