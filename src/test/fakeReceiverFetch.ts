import { createIngestReceiver } from "../server/ingestReceiver";

export const TEST_TOKEN = "test-token";

/** A `fetch` that talks straight to the real receiver code, so tests exercise browser and receiver together. */
export function createFakeReceiver(now: () => number) {
  const receiver = createIngestReceiver({ token: TEST_TOKEN, now });
  const state = { down: false, calls: 0 };
  const handle = (method: string, url: string, body = "") => {
    const [path, qs = ""] = url.split("?");
    const query: Record<string, string> = {};
    for (const pair of qs.split("&")) { const [k, v = ""] = pair.split("="); if (k) query[decodeURIComponent(k)] = decodeURIComponent(v); }
    return receiver.handle({ method, path, query, headers: { host: "localhost:5173", authorization: `Bearer ${TEST_TOKEN}` }, body });
  };
  const fetchImpl = async (input: unknown, init?: { method?: string; body?: string }) => {
    state.calls += 1;
    if (state.down) throw new TypeError("network down");
    const result = handle(init?.method ?? "GET", String(input), init?.body);
    if (!result) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: result.status < 400, status: result.status, json: async () => result.json };
  };
  /** Sends rows as an external service would. */
  const send = (rows: unknown[]) => handle("POST", "/api/ingest", JSON.stringify(rows));
  return { fetchImpl, send, state, receiver };
}
