import { describe, expect, it } from "vitest";
import { createIngestReceiver, shapeRow, type IngestRequest, type ReceiverOptions } from "./ingestReceiver";

const TOKEN = "test-token-123";
const make = (over: Partial<ReceiverOptions> = {}) => { let t = 1_000_000; const clock = { t, advance: (ms: number) => { t += ms; } }; const r = createIngestReceiver({ token: TOKEN, now: () => t, ...over }); return { r, clock }; };
const req = (over: Partial<IngestRequest> = {}): IngestRequest => ({ method: "POST", path: "/api/ingest", query: {}, headers: { host: "localhost:5173", authorization: `Bearer ${TOKEN}` }, body: "[]", ...over });
const post = (rows: unknown) => req({ body: JSON.stringify(rows) });
const reading = (over: Record<string, unknown> = {}) => ({ timestamp: "2026-11-12T08:00:00Z", metric: "heart_rate", value: 62, unit: "bpm", deviceId: "band", ...over });

describe("routing and guards", () => {
  it("ignores paths that are not its own", () => {
    expect(make().r.handle(req({ path: "/api/other" }))).toBeNull();
    expect(make().r.handle(req({ path: "/" }))).toBeNull();
  });
  it("answers only on localhost hosts", () => {
    const { r } = make();
    expect(r.handle(req({ headers: { host: "evil.example.com", authorization: `Bearer ${TOKEN}` } }))!.status).toBe(403);
    expect(r.handle(req({ headers: { host: "192.168.1.5:5173", authorization: `Bearer ${TOKEN}` } }))!.status).toBe(403);
    expect(r.handle(req({ headers: { authorization: `Bearer ${TOKEN}` } }))!.status).toBe(403);
    for (const host of ["localhost:5173", "127.0.0.1:5174", "[::1]:5173"]) expect(r.handle(req({ headers: { host, authorization: `Bearer ${TOKEN}` } }))!.status).toBe(202);
  });
  it("refuses cross-origin browser requests but allows same-origin and header-less clients", () => {
    const { r } = make();
    const withOrigin = (origin: string) => r.handle(req({ headers: { host: "localhost:5173", origin, authorization: `Bearer ${TOKEN}` } }))!.status;
    expect(withOrigin("https://evil.example.com")).toBe(403);
    expect(withOrigin("http://localhost:9999")).toBe(403);
    expect(withOrigin("http://localhost:5173")).toBe(202);
    expect(r.handle(req())!.status).toBe(202);
  });
  it("rejects wrong methods and unknown endpoints", () => {
    const { r } = make();
    expect(r.handle(req({ method: "GET" }))!.status).toBe(405);
    expect(r.handle(req({ method: "POST", path: "/api/ingest/status" }))!.status).toBe(405);
    expect(r.handle(req({ method: "POST", path: "/api/ingest/readings" }))!.status).toBe(405);
    expect(r.handle(req({ method: "GET", path: "/api/ingest/nope" }))!.status).toBe(404);
  });
});

describe("POST /api/ingest", () => {
  it("requires the bearer token", () => {
    const { r } = make();
    expect(r.handle(req({ headers: { host: "localhost" } }))!.status).toBe(401);
    expect(r.handle(req({ headers: { host: "localhost", authorization: "Bearer wrong" } }))!.status).toBe(401);
    expect(r.handle(req({ headers: { host: "localhost", authorization: TOKEN } }))!.status).toBe(401);
    expect(r.handle(req({ headers: { host: "localhost", authorization: `Bearer ${TOKEN}x` } }))!.status).toBe(401);
    expect(r.size()).toBe(0);
  });
  it("accepts an array or a { readings } object and reports counts", () => {
    const { r } = make();
    expect(r.handle(post([reading(), reading({ value: 63 })]))).toMatchObject({ status: 202, json: { accepted: 2, rejected: 0 } });
    expect(r.handle(post({ readings: [reading(), 5, null, "x", []] }))).toMatchObject({ status: 202, json: { accepted: 1, rejected: 4 } });
    expect(r.size()).toBe(3);
  });
  it("rejects invalid JSON, wrong shapes, too many rows and oversized bodies", () => {
    const { r } = make({ maxRowsPerRequest: 3, maxBodyChars: 200 });
    expect(r.handle(req({ body: "{oops" }))!.status).toBe(400);
    expect(r.handle(post({ nope: 1 }))!.status).toBe(400);
    expect(r.handle(post("text"))!.status).toBe(400);
    expect(r.handle(post([reading(), reading(), reading(), reading()]))!.status).toBe(413);
    expect(r.handle(req({ body: JSON.stringify([reading({ deviceId: "x".repeat(60) }), reading(), reading()]) }))!.status).toBe(413);
    expect(r.size()).toBe(0);
  });
  it("keeps only known, bounded, primitive fields", () => {
    expect(shapeRow({ Metric: "HR", VALUE: 60, __proto__: { x: 1 }, constructor: "x", evil: "<script>", nested: { a: 1 }, deviceId: "a\u0000b".padEnd(200, "z"), n: NaN })).toEqual({ metric: "HR", value: 60, deviceid: "ab" + "z".repeat(62) });
    expect(shapeRow({ evil: 1 })).toBeNull();
    expect(shapeRow({ value: Infinity })).toBeNull();
    expect(shapeRow([1])).toBeNull();
  });
  it("never pollutes prototypes through hostile keys", () => {
    const { r } = make();
    r.handle(req({ body: '[{"__proto__":{"polluted":true},"metric":"hr","value":1,"timestamp":"2026-11-12T00:00:00Z"}]' }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("status and readings", () => {
  it("reports status with the token and limits", () => {
    const { r } = make();
    expect(r.handle(req({ method: "GET", path: "/api/ingest/status" }))).toMatchObject({ status: 200, json: { ok: true, rows: 0, retentionHours: 48, token: TOKEN } });
  });
  it("returns rows after a cursor, in order", () => {
    const { r } = make();
    r.handle(post([reading({ value: 60 }), reading({ value: 61 }), reading({ value: 62 })]));
    const first = r.handle(req({ method: "GET", path: "/api/ingest/readings", query: { after: "0", limit: "2" } }))!.json as { rows: Array<{ id: number }>; lastId: number; more: boolean };
    expect(first.rows.map((x) => x.id)).toEqual([1, 2]);
    expect(first.more).toBe(true);
    const rest = r.handle(req({ method: "GET", path: "/api/ingest/readings", query: { after: String(first.lastId) } }))!.json as { rows: Array<{ id: number }>; more: boolean };
    expect(rest.rows.map((x) => x.id)).toEqual([3]);
    expect(rest.more).toBe(false);
    expect((r.handle(req({ method: "GET", path: "/api/ingest/readings", query: { after: "abc" } }))!.json as { rows: unknown[] }).rows).toHaveLength(3);
  });
});

describe("retention and caps", () => {
  it("drops rows older than the retention window", () => {
    const { r, clock } = make({ retentionMs: 1000 });
    r.handle(post([reading()]));
    clock.advance(500); r.handle(post([reading({ value: 63 })]));
    expect(r.size()).toBe(2);
    clock.advance(700); // first row is now 1200 ms old
    expect(r.handle(req({ method: "GET", path: "/api/ingest/status" }))!.json).toMatchObject({ rows: 1 });
  });
  it("caps rows per metric, keeping the newest, without starving other metrics", () => {
    const { r } = make({ maxRowsPerMetric: 3 });
    r.handle(post([...Array.from({ length: 6 }, (_, i) => reading({ value: 60 + i })), reading({ metric: "spo2", value: 97, unit: "%" })]));
    const rows = (r.handle(req({ method: "GET", path: "/api/ingest/readings" }))!.json as { rows: Array<{ fields: Record<string, unknown> }> }).rows;
    expect(rows.filter((x) => x.fields.metric === "heart_rate").map((x) => x.fields.value)).toEqual([63, 64, 65]);
    expect(rows.filter((x) => x.fields.metric === "spo2")).toHaveLength(1);
  });
  it("limits the number of distinct metric names", () => {
    const { r } = make();
    r.handle(post(Array.from({ length: 60 }, (_, i) => reading({ metric: `m${i}` }))));
    const rows = (r.handle(req({ method: "GET", path: "/api/ingest/readings", query: { limit: "100" } }))!.json as { rows: Array<{ fields: Record<string, unknown> }> }).rows;
    expect(new Set(rows.map((x) => x.fields.metric)).size).toBeLessThanOrEqual(33);
  });
});
