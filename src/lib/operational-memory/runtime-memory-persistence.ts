import type {
  OperationalInterventionRecord,
  OperationalMemoryRecord,
  OperationalMemoryScope,
} from "./runtime-memory-types";

export type OperationalMemoryPersistenceResult = {
  status: "persisted" | "failed" | "skipped";
  recordId: string;
  error?: string;
};

export async function persistOperationalMemoryRecord(
  record: OperationalMemoryRecord,
): Promise<OperationalMemoryPersistenceResult> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("operational_memory_runtime_records").insert({
      id: record.id,
      company_id: record.scope.companyId,
      workspace_id: record.scope.workspaceId ?? null,
      project_id: record.scope.projectId ?? null,
      conversation_id: record.scope.conversationId ?? null,
      intervention_id: record.scope.interventionId ?? null,
      stakeholder_id: record.scope.stakeholderId ?? null,
      record_type: record.recordType,
      summary: record.summary,
      detail: record.detail ?? null,
      parent_record_id: record.parentRecordId ?? null,
      lineage_type: record.lineageType ?? null,
      resolution_status: record.resolutionStatus,
      continuity_weight: record.weights.continuityWeight,
      operational_pressure_weight: record.weights.operationalPressureWeight,
      escalation_weight: record.weights.escalationWeight,
      unresolved_weight: record.weights.unresolvedWeight,
      delivery_impact_weight: record.weights.deliveryImpactWeight,
      confidence: record.confidence,
      ingestion_source: record.ingestionSource,
      source_ref: record.sourceRef ?? null,
      nutrient_ids: record.nutrientIds,
      intervention_count: record.interventionCount,
      first_observed_at: record.firstObservedAt,
      last_observed_at: record.lastObservedAt,
      resolved_at: record.resolvedAt ?? null,
      created_at: record.createdAt,
    });

    if (error) {
      return {
        status: "failed",
        recordId: record.id,
        error: `operational_memory_runtime_records insert failed: ${error.message}`,
      };
    }

    return { status: "persisted", recordId: record.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "failed", recordId: record.id, error: `persistence_unavailable: ${message}` };
  }
}

export async function persistOperationalInterventionRecord(
  intervention: OperationalInterventionRecord,
): Promise<OperationalMemoryPersistenceResult> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("operational_intervention_records").insert({
      id: intervention.id,
      memory_record_id: intervention.memoryRecordId,
      company_id: intervention.scope.companyId,
      workspace_id: intervention.scope.workspaceId ?? null,
      project_id: intervention.scope.projectId ?? null,
      intervention_type: intervention.interventionType,
      description: intervention.description,
      attempted_at: intervention.attemptedAt,
      outcome: intervention.outcome,
      resolved_at: intervention.resolvedAt ?? null,
      failure_reason: intervention.failureReason ?? null,
      actor_ref: intervention.actorRef ?? null,
      created_at: intervention.createdAt,
    });

    if (error) {
      return {
        status: "failed",
        recordId: intervention.id,
        error: `operational_intervention_records insert failed: ${error.message}`,
      };
    }

    return { status: "persisted", recordId: intervention.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "failed", recordId: intervention.id, error: `persistence_unavailable: ${message}` };
  }
}

export async function loadOperationalMemoryRecords(
  scope: OperationalMemoryScope,
  options?: { limit?: number; unresolvedOnly?: boolean },
): Promise<OperationalMemoryRecord[]> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("operational_memory_runtime_records")
      .select("*")
      .eq("company_id", scope.companyId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 64);

    if (scope.workspaceId) query = query.eq("workspace_id", scope.workspaceId);
    if (scope.projectId) query = query.eq("project_id", scope.projectId);
    if (options?.unresolvedOnly) {
      query = query.in("resolution_status", ["unresolved", "escalated", "in_progress"]);
    }

    const { data, error } = await query;
    if (error) throw new Error(`operational_memory_runtime_records load failed: ${error.message}`);

    return (data ?? []).map(rowToRecord);
  } catch {
    return [];
  }
}

export async function loadOperationalInterventionRecords(
  memoryRecordId: string,
  companyId: string,
): Promise<OperationalInterventionRecord[]> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("operational_intervention_records")
      .select("*")
      .eq("memory_record_id", memoryRecordId)
      .eq("company_id", companyId)
      .order("attempted_at", { ascending: true });

    if (error) throw new Error(`operational_intervention_records load failed: ${error.message}`);
    return (data ?? []).map(rowToIntervention);
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: any): OperationalMemoryRecord {
  return {
    id: String(row.id),
    recordType: row.record_type,
    summary: String(row.summary ?? ""),
    detail: row.detail ?? null,
    scope: {
      companyId: String(row.company_id),
      workspaceId: row.workspace_id ?? null,
      projectId: row.project_id ?? null,
      conversationId: row.conversation_id ?? null,
      interventionId: row.intervention_id ?? null,
      stakeholderId: row.stakeholder_id ?? null,
    },
    parentRecordId: row.parent_record_id ?? null,
    lineageType: row.lineage_type ?? null,
    resolutionStatus: row.resolution_status,
    weights: {
      continuityWeight: Number(row.continuity_weight ?? 0.5),
      operationalPressureWeight: Number(row.operational_pressure_weight ?? 0.5),
      escalationWeight: Number(row.escalation_weight ?? 0.3),
      unresolvedWeight: Number(row.unresolved_weight ?? 0.5),
      deliveryImpactWeight: Number(row.delivery_impact_weight ?? 0.5),
    },
    confidence: Number(row.confidence ?? 0.7),
    ingestionSource: row.ingestion_source,
    sourceRef: row.source_ref ?? null,
    nutrientIds: Array.isArray(row.nutrient_ids) ? row.nutrient_ids : [],
    interventionCount: Number(row.intervention_count ?? 0),
    firstObservedAt: String(row.first_observed_at),
    lastObservedAt: String(row.last_observed_at),
    resolvedAt: row.resolved_at ?? null,
    createdAt: String(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIntervention(row: any): OperationalInterventionRecord {
  return {
    id: String(row.id),
    memoryRecordId: String(row.memory_record_id),
    scope: {
      companyId: String(row.company_id),
      workspaceId: row.workspace_id ?? null,
      projectId: row.project_id ?? null,
    },
    interventionType: row.intervention_type,
    description: String(row.description ?? ""),
    attemptedAt: String(row.attempted_at),
    outcome: row.outcome,
    resolvedAt: row.resolved_at ?? null,
    failureReason: row.failure_reason ?? null,
    actorRef: row.actor_ref ?? null,
    createdAt: String(row.created_at),
  };
}
