import type { SupabaseClient } from "@supabase/supabase-js";
import { VISUAL_CHECK_DISCLAIMER, describeObservations, taskFor, type ComparisonSummary, type ObservedFeatures, type VisualCheck, type VisualCheckType } from "../domain/visualCheck";

/**
 * Persists derived visual-check summaries only. There is no field for frames,
 * images, or video, so raw camera data cannot be saved through this boundary.
 */
export type VisualCheckRepository = ReturnType<typeof createVisualCheckRepository>;
export type SaveResult = { ok: true } | { ok: false; reason: string };
export type CloudVisualChecksResult = { data: VisualCheck[]; warning?: string };

type CloudVisualCheckRow = {
  id: string;
  owner_key: string;
  check_type: VisualCheckType;
  started_at: string;
  completion_status: VisualCheck["completionStatus"];
  observed_features: ObservedFeatures;
  comparison_summary: ComparisonSummary;
  is_synthetic: boolean;
};

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

/** Rebuilds the display-safe part of a check. Home never requests the private symptom/note JSON. */
export function fromCloudVisualCheckRow(row: CloudVisualCheckRow): VisualCheck {
  const task = taskFor(row.check_type);
  return {
    checkId: row.id,
    ownerKey: row.owner_key,
    stage: row.owner_key.split(":", 1)[0] as VisualCheck["stage"],
    checkType: row.check_type,
    startedAt: row.started_at,
    duration: row.observed_features.movementDurationSeconds,
    cameraConsent: false,
    completionStatus: row.completion_status,
    observedFeatures: row.observed_features,
    userReportedSymptoms: { discomfort: "none", symptoms: "" },
    comparisonSummary: row.comparison_summary,
    observationSummary: describeObservations(row.observed_features, task),
    supportRecommendation: "Review this practice summary as personal context only.",
    disclaimer: VISUAL_CHECK_DISCLAIMER,
    isSynthetic: row.is_synthetic,
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
    /** Owner-filtered cloud history for the Home body. RLS applies the same user boundary again. */
    async listCloud(ownerKey: string): Promise<CloudVisualChecksResult> {
      if (!client || !userId) return { data: [], warning: "Cloud movement history is unavailable." };
      try {
        const { data, error } = await client.from("visual_checks")
          .select("id,owner_key,check_type,started_at,completion_status,observed_features,comparison_summary,is_synthetic")
          .eq("user_id", userId)
          .eq("owner_key", ownerKey)
          .order("started_at", { ascending: false })
          .limit(50);
        if (error) return { data: [], warning: error.message };
        return { data: (data ?? []).map((row) => fromCloudVisualCheckRow(row as CloudVisualCheckRow)) };
      } catch (error) {
        return { data: [], warning: error instanceof Error ? error.message : "Cloud movement history could not be loaded." };
      }
    },
  };
}
