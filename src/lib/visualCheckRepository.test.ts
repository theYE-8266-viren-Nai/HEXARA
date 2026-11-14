import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createVisualCheckRepository } from "./visualCheckRepository";

function listClient(data: unknown[], error: { message: string } | null = null) {
  const calls: unknown[][] = [];
  const chain = {
    select: vi.fn((...args: unknown[]) => { calls.push(["select", ...args]); return chain; }),
    eq: vi.fn((...args: unknown[]) => { calls.push(["eq", ...args]); return chain; }),
    order: vi.fn((...args: unknown[]) => { calls.push(["order", ...args]); return chain; }),
    limit: vi.fn(async (...args: unknown[]) => { calls.push(["limit", ...args]); return { data, error }; }),
  };
  return { client: { from: vi.fn(() => chain) } as unknown as SupabaseClient, calls };
}

describe("visual check cloud history", () => {
  it("requests only display-safe fields and filters by both authenticated user and owner", async () => {
    const row = {
      id: "c1", owner_key: "retired:p1", check_type: "sit_to_stand", started_at: "2026-11-14T00:00:00.000Z",
      completion_status: "completed", is_synthetic: true,
      observed_features: { repetitionCount: 7, movementDurationSeconds: 20, leftRightBalance: 0.48, pauseCount: 1, cameraQuality: "good", qualityNotes: [] },
      comparison_summary: { trend: "first_session", statements: ["First session."], priorSessionsUsed: 0 },
    };
    const { client, calls } = listClient([row]);
    const result = await createVisualCheckRepository(client, "user-1").listCloud("retired:p1");
    expect(calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(calls).toContainEqual(["eq", "owner_key", "retired:p1"]);
    const selected = String(calls.find((call) => call[0] === "select")?.[1]);
    expect(selected).not.toMatch(/user_reported_context|support_recommendation|camera_quality/);
    expect(result.data[0]).toMatchObject({ checkId: "c1", stage: "retired", checkType: "sit_to_stand", isSynthetic: true });
    expect(result.data[0].userReportedSymptoms.symptoms).toBe("");
  });

  it("does not imply cloud history exists without a session and reports query failure", async () => {
    await expect(createVisualCheckRepository(null, null).listCloud("active:p1")).resolves.toEqual({ data: [], warning: "Cloud movement history is unavailable." });
    const { client } = listClient([], { message: "permission denied" });
    await expect(createVisualCheckRepository(client, "user-1").listCloud("active:p1")).resolves.toEqual({ data: [], warning: "permission denied" });
  });
});
