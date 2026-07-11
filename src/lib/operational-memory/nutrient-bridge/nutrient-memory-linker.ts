import crypto from "node:crypto";
import type { NutrientLinkType, NutrientMemoryLink } from "./nutrient-bridge-types";

export type NutrientLinkPersistenceResult = {
  status: "persisted" | "failed" | "skipped";
  linkId: string;
  error?: string;
};

export type NutrientRecurrenceUpdateResult = {
  status: "updated" | "failed" | "skipped";
  recordId: string;
  error?: string;
};

// ─── Link construction ────────────────────────────────────────────────────────

export function buildNutrientMemoryLink(
  nutrientId: string,
  operationalMemoryRecordId: string,
  linkType: NutrientLinkType,
  scope: { companyId: string; workspaceId: string; projectId: string | null },
  confidence: number,
  metadata: Record<string, unknown> = {},
): NutrientMemoryLink {
  return {
    id: crypto.randomUUID(),
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    nutrientId,
    operationalMemoryRecordId,
    linkType,
    confidence: Math.max(0, Math.min(1, confidence)),
    createdAt: new Date().toISOString(),
    metadata,
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function persistNutrientMemoryLink(
  link: NutrientMemoryLink,
): Promise<NutrientLinkPersistenceResult> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("operational_memory_nutrient_links").insert({
      id: link.id,
      company_id: link.companyId,
      workspace_id: link.workspaceId,
      project_id: link.projectId ?? null,
      nutrient_id: link.nutrientId,
      operational_memory_record_id: link.operationalMemoryRecordId,
      link_type: link.linkType,
      confidence: link.confidence,
      created_at: link.createdAt,
      metadata: link.metadata,
    });

    if (error) {
      return {
        status: "failed",
        linkId: link.id,
        error: `operational_memory_nutrient_links insert failed: ${error.message}`,
      };
    }

    return { status: "persisted", linkId: link.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "failed", linkId: link.id, error: `link_persistence_unavailable: ${message}` };
  }
}

// ─── Recurrence update ────────────────────────────────────────────────────────

/**
 * Updates an existing operational memory record when a new nutrient is detected
 * as a recurrence. Appends the nutrient ID and refreshes last_observed_at.
 *
 * Does NOT overwrite existing data — only appends to nutrient_ids and updates
 * timestamps. The new record still gets its own row (with parentRecordId set),
 * preserving the full history.
 */
export async function updateOperationalMemoryRecordForRecurrence(
  recordId: string,
  companyId: string,
  nutrientId: string,
): Promise<NutrientRecurrenceUpdateResult> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    // First load the current nutrient_ids array
    const { data: existing, error: loadError } = await supabase
      .from("operational_memory_runtime_records")
      .select("id, nutrient_ids")
      .eq("id", recordId)
      .eq("company_id", companyId)
      .single();

    if (loadError || !existing) {
      return {
        status: "failed",
        recordId,
        error: `recurrence_update_load_failed: ${loadError?.message ?? "not_found"}`,
      };
    }

    const existingNutrientIds: string[] = Array.isArray(existing.nutrient_ids)
      ? existing.nutrient_ids
      : [];

    if (existingNutrientIds.includes(nutrientId)) {
      return { status: "skipped", recordId };
    }

    const updatedNutrientIds = [...existingNutrientIds, nutrientId];

    const { error: updateError } = await supabase
      .from("operational_memory_runtime_records")
      .update({
        nutrient_ids: updatedNutrientIds,
        last_observed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("company_id", companyId);

    if (updateError) {
      return {
        status: "failed",
        recordId,
        error: `recurrence_update_write_failed: ${updateError.message}`,
      };
    }

    return { status: "updated", recordId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "failed", recordId, error: `recurrence_update_unavailable: ${message}` };
  }
}
