import type { StoredRow } from "../../server/ingestReceiver";

/**
 * Browser side of the local webhook receiver. It only fetches the untrusted rows the receiver
 * caught; cleaning and analysis happen in the shared pipeline (domain/ingest).
 * The receiver exists only on the dev server, so every call must tolerate it being absent.
 */
export type WebhookStatus =
  | { available: true; token: string; rows: number; retentionHours: number }
  | { available: false };

export interface WebhookPage { rows: StoredRow[]; lastId: number; more: boolean; }

/** Resolves `available: false` for anything unexpected (production build, preview server, network error, HTML fallback page). */
export async function fetchWebhookStatus(): Promise<WebhookStatus> {
  try {
    const response = await fetch("/api/ingest/status", { headers: { Accept: "application/json" } });
    if (!response.ok) return { available: false };
    const data = (await response.json()) as { ok?: unknown; token?: unknown; rows?: unknown; retentionHours?: unknown };
    if (data.ok !== true || typeof data.token !== "string") return { available: false };
    return { available: true, token: data.token, rows: Number(data.rows) || 0, retentionHours: Number(data.retentionHours) || 48 };
  } catch { return { available: false }; }
}

/** Returns null when the receiver cannot be reached. */
export async function fetchWebhookRows(after: number): Promise<WebhookPage | null> {
  try {
    const response = await fetch(`/api/ingest/readings?after=${encodeURIComponent(String(after))}&limit=5000`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const data = (await response.json()) as { rows?: unknown; lastId?: unknown; more?: unknown };
    if (!Array.isArray(data.rows)) return null;
    const rows = data.rows.filter((row): row is StoredRow => Boolean(row) && typeof (row as StoredRow).id === "number" && typeof (row as StoredRow).receivedAt === "number" && typeof (row as StoredRow).fields === "object");
    return { rows, lastId: Number(data.lastId) || after, more: data.more === true };
  } catch { return null; }
}

/** A ready-to-copy example request for a sending service. */
export function curlExample(origin: string, token: string): string {
  return `curl -X POST ${origin}/api/ingest \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"readings":[{"timestamp":"${new Date().toISOString()}","metric":"heart_rate","value":64,"unit":"bpm","deviceId":"my-device"}]}'`;
}
