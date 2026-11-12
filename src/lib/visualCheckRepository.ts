import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisualCheck } from "../domain/visualCheck";

/**
 * Persists derived visual-check summaries only. There is no field for frames,
 * images, or video, so raw camera data cannot be saved through this boundary.
 */
export type VisualCheckRepository = ReturnType<typeof createVisualCheckRepository>;
export type SaveResult = { ok: true } | { ok: false; reason: string };

const LOCAL_KEY = "horizon:visual-checks";

export function readLocalVisualChecks(): VisualCheck[] {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as VisualCheck[]; } catch { return []; }
}

export function writeLocalVisualChecks(checks: VisualCheck[]) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(checks.slice(-50))); } catch { /* storage unavailable */ }
}

export function toVisualCheckRow(check: VisualCheck, userId: string) {
  return {
    id: check.checkId,
    user_id: userId,
    owner_key: check.ownerKey,
    check_type: check.checkType,
    started_at: check.startedAt,
    completed_at: new Date(new Date(check.startedAt).getTime() + check.duration * 1000).toISOString(),
    completion_status: check.completionStatus,
    observed_features: check.observedFeatures,
    user_reported_context: check.userReportedSymptoms,
    comparison_summary: check.comparisonSummary,
    support_recommendation: check.supportRecommendation,
    camera_quality: check.observedFeatures.cameraQuality,
    is_synthetic: check.isSynthetic,
  };
}

export function createVisualCheckRepository(client: SupabaseClient | null, userId: string | null) {
  return {
    /** Local history for personal comparison; filtered to one owner by the caller. */
    listLocal: readLocalVisualChecks,
    saveLocal(check: VisualCheck) { writeLocalVisualChecks([...readLocalVisualChecks().filter((c) => c.checkId !== check.checkId), check]); },
    /** Cloud save of the derived summary. Never reports success unless Supabase confirms the row. */
    async saveCloud(check: VisualCheck): Promise<SaveResult> {
      if (!client || !userId) return { ok: false, reason: "Cloud save unavailable; the result is kept on this device only." };
      try {
        const { data, error } = await client.from("visual_checks").upsert(toVisualCheckRow(check, userId), { onConflict: "id" }).select("id").single();
        if (error || !data) return { ok: false, reason: error?.message ?? "Cloud save failed." };
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : "Cloud save failed." };
      }
    },
  };
}
