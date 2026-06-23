import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbCreateProjectOSSnapshot,
  dbFindProjectOSSnapshotById,
  dbListProjectOSSnapshots,
  dbUpdateProjectOSSnapshotStatus,
  dbCreateProjectOSAttentionItem,
  dbListProjectOSAttentionItems,
  dbCreateProjectOSContextLink,
} from "./project-os-repository";
import {
  calculateGovernanceOSHealth,
  calculateExecutionOSHealth,
  calculateMemoryOSHealth,
  calculateRecommendationOSHealth,
  calculateProjectOperatingHealth,
} from "./health-engine";
import { detectProjectAttentionItems } from "./attention-engine";
import { composeProjectOperatingContext } from "./context-engine";
import { getProjectOSLineage } from "./lineage-engine";
import type {
  ProjectOSResult,
  ProjectOSSnapshotRow,
  ProjectOSAttentionItemRow,
  ProjectOSOperatingContext,
  ProjectOSLineage,
  ProjectOSSnapshotPayload,
  ProjectOSHealthScore,
  ProjectOSEventType,
  GenerateProjectOSSnapshotInput,
  GetProjectOSSnapshotInput,
  ListProjectOSSnapshotsInput,
  ValidateProjectOSSnapshotInput,
  ArchiveProjectOSSnapshotInput,
  GetProjectOperatingContextInput,
  GetProjectOSLineageInput,
  DetectedAttentionItem,
} from "./types";
import { PROJECT_OS_SNAPSHOT_STATUSES } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): ProjectOSResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitOSEvent(
  workspaceId: string,
  projectId: string,
  snapshotId: string,
  eventType: ProjectOSEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    projectId,
    actorId,
    actorType: "system",
    eventType,
    eventCategory: "system",
    source: "system",
    correlationId: snapshotId,
    rawReferenceTable: "project_os_snapshots",
    rawReferenceId: snapshotId,
    learningEligible: false,
    eventPayload: {
      snapshotId,
      projectId,
      ...extraPayload,
    },
  });
}

// ─── generateProjectOSSnapshot ────────────────────────────────────────────────

export async function generateProjectOSSnapshot(
  input: GenerateProjectOSSnapshotInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId))   return validation("projectId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { workspaceId, projectId } = input;

  // Fetch raw domain counts in parallel
  const [
    constitutionResult,
    signalResult,
    violationResult,
    commitmentResult,
    projectionResult,
    driftResult,
    varianceResult,
    artifactResult,
    memoryResult,
    digestResult,
    learningResult,
    recommendationResult,
  ] = await Promise.all([
    supabase
      .from("project_constitutions")
      .select("id,lifecycle_status,version")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .eq("lifecycle_status", "active")
      .maybeSingle(),

    supabase
      .from("governance_signals")
      .select("id,severity,status")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "acknowledged"]),

    supabase
      .from("authority_violations")
      .select("id,status")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "unresolved"]),

    supabase
      .from("governance_commitments")
      .select("id,status,due_date,title")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .not("status", "eq", "cancelled"),

    supabase
      .from("execution_projections")
      .select("id,status,projection_accuracy")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId),

    supabase
      .from("execution_drifts")
      .select("id,severity,drift_type,description")
      .eq("workspace_id", workspaceId)
      .is("resolved_at", null),

    supabase
      .from("execution_variances")
      .select("id,severity,variance_type,variance_percentage")
      .eq("workspace_id", workspaceId)
      .in("severity", ["high", "critical"]),

    supabase
      .from("constitutional_artifacts")
      .select("id")
      .eq("workspace_id", workspaceId),

    supabase
      .from("operational_memory_entries")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId),

    supabase
      .from("constitutional_digests")
      .select("id")
      .eq("workspace_id", workspaceId),

    supabase
      .from("learning_patterns")
      .select("id")
      .eq("workspace_id", workspaceId),

    supabase
      .from("recommendations")
      .select("id,status,confidence_score")
      .eq("workspace_id", workspaceId),
  ]);

  // ── Derive governance metrics ──
  const signals = signalResult.data ?? [];
  const criticalSignals = signals.filter((s) => s.severity === "critical").length;
  const activeSignals   = signals.length;
  const unresolvedViolations = (violationResult.data ?? []).length;
  const governanceHealthScore = calculateGovernanceOSHealth({
    activeSignals,
    criticalSignals,
    unresolvedViolations,
  });

  // ── Derive execution metrics ──
  const now = new Date();
  const commitments    = commitmentResult.data ?? [];
  const activeCommitments  = commitments.length;
  const overdueCommitments = commitments.filter(
    (c) =>
      c.due_date != null &&
      c.status !== "completed" &&
      new Date(c.due_date as string) < now
  ).length;

  const projections     = projectionResult.data ?? [];
  const accuracyValues  = projections
    .map((p) => p.projection_accuracy as number | null)
    .filter((a): a is number => a !== null);
  const projectionAccuracy =
    accuracyValues.length > 0
      ? Math.round(accuracyValues.reduce((s, v) => s + v, 0) / accuracyValues.length)
      : 100;

  const executionHealthScore = calculateExecutionOSHealth({
    activeCommitments,
    overdueCommitments,
    projectionAccuracy,
  });

  // ── Derive memory metrics ──
  const artifacts       = (artifactResult.data ?? []).length;
  const memoryRecords   = (memoryResult.data ?? []).length;
  const digests         = (digestResult.data ?? []).length;
  const learningPatterns = (learningResult.data ?? []).length;
  const memoryHealthScore = calculateMemoryOSHealth({
    artifacts,
    memoryRecords,
    digests,
    learningPatterns,
  });

  // ── Derive recommendation metrics ──
  const recs = recommendationResult.data ?? [];
  const activeRecommendations       = recs.filter((r) => r.status === "active" || r.status === "published" || r.status === "validated").length;
  const highConfidenceRecommendations = recs.filter(
    (r) => (r.confidence_score as number) >= 0.75 && (r.status === "active" || r.status === "published" || r.status === "validated")
  ).length;
  const ignoredRecommendations = recs.filter((r) => r.status === "ignored" || r.status === "dismissed").length;
  const recommendationHealthScore = calculateRecommendationOSHealth({
    activeRecommendations,
    highConfidenceRecommendations,
    ignoredRecommendations,
  });

  // ── Aggregate health ──
  const health: ProjectOSHealthScore = calculateProjectOperatingHealth({
    projectId,
    workspaceId,
    governanceHealthScore,
    executionHealthScore,
    memoryHealthScore,
    recommendationHealthScore,
  });

  // ── Constitution summary ──
  const constitution = constitutionResult.data;

  // ── Detect attention items (before persisting snapshot — we need a placeholder id) ──
  // We'll use a temp UUID placeholder for the attention engine; real IDs persisted after create
  const TEMP_SNAPSHOT_ID = "00000000-0000-0000-0000-000000000000";
  const attentionItems: DetectedAttentionItem[] = detectProjectAttentionItems({
    signals: signals.map((s) => ({
      id: s.id as string,
      signal_type: (s as Record<string, unknown>).signal_type as string ?? "",
      severity: s.severity as string,
      status: s.status as string,
      title: "",
    })),
    commitments: commitments.map((c) => ({
      id: c.id as string,
      status: c.status as string,
      title: c.title as string,
      due_date: c.due_date as string | null,
    })),
    drifts: (driftResult.data ?? []).map((d) => ({
      id: d.id as string,
      severity: d.severity as string,
      drift_type: d.drift_type as string,
      description: d.description as string,
    })),
    violations: (violationResult.data ?? []).map((v) => ({
      id: v.id as string,
      status: v.status as string,
    })),
    recommendations: recs.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      confidence_score: r.confidence_score as number,
    })),
    variances: (varianceResult.data ?? []).map((v) => ({
      id: v.id as string,
      severity: v.severity as string,
      variance_type: v.variance_type as string,
      variance_percentage: v.variance_percentage as number,
    })),
    operatingHealthScore: health.operatingHealthScore,
    snapshotId: TEMP_SNAPSHOT_ID,
  });

  // ── Build snapshot payload ──
  const payload: ProjectOSSnapshotPayload = {
    project: { project_id: projectId, workspace_id: workspaceId },
    constitution: {
      status: constitution?.lifecycle_status ?? "none",
      version: (constitution?.version as number) ?? 0,
      ratified: constitution != null,
    },
    governance: {
      active_signals: activeSignals,
      critical_signals: criticalSignals,
      unresolved_violations: unresolvedViolations,
      governance_health: governanceHealthScore,
    },
    execution: {
      active_commitments: activeCommitments,
      overdue_commitments: overdueCommitments,
      execution_health: executionHealthScore,
      projection_accuracy: projectionAccuracy,
    },
    memory: { artifacts, memory_records: memoryRecords, digests, learning_patterns: learningPatterns },
    recommendations: {
      active_recommendations: activeRecommendations,
      high_confidence_recommendations: highConfidenceRecommendations,
      ignored_recommendations: ignoredRecommendations,
    },
    attention: attentionItems.map((a) => a.attentionType),
  };

  // ── Persist snapshot ──
  const snapshotResult = await dbCreateProjectOSSnapshot({
    workspaceId,
    projectId,
    health,
    payload,
  });
  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;

  // ── Persist attention items ──
  for (const item of attentionItems) {
    const itemResult = await dbCreateProjectOSAttentionItem({
      workspaceId,
      snapshotId: snapshot.id,
      item,
    });
    if (itemResult.ok) {
      await emitOSEvent(workspaceId, projectId, snapshot.id, "PROJECT_OS_ATTENTION_ITEM_CREATED", input.actorId, {
        attentionType: item.attentionType,
        attentionSeverity: item.attentionSeverity,
      });
    }
  }

  // ── Persist context links for major entities ──
  const linkEntities = [
    ...signals.slice(0, 10).map((s) => ({ entityType: "governance_signals", entityId: s.id as string, relationshipType: "active_signal" })),
    ...commitments.slice(0, 10).map((c) => ({ entityType: "governance_commitments", entityId: c.id as string, relationshipType: "commitment" })),
    ...projections.slice(0, 5).map((p) => ({ entityType: "execution_projections", entityId: p.id as string, relationshipType: "projection" })),
  ];
  for (const link of linkEntities) {
    await dbCreateProjectOSContextLink({
      workspaceId,
      snapshotId: snapshot.id,
      ...link,
    });
  }

  await emitOSEvent(workspaceId, projectId, snapshot.id, "PROJECT_OS_SNAPSHOT_GENERATED", input.actorId, {
    operatingHealthScore: health.operatingHealthScore,
    attentionItemCount: attentionItems.length,
  });

  await emitOSEvent(workspaceId, projectId, snapshot.id, "PROJECT_OS_HEALTH_CALCULATED", input.actorId, {
    operatingHealthScore: health.operatingHealthScore,
    governanceHealthScore: health.governanceHealthScore,
    executionHealthScore: health.executionHealthScore,
    memoryHealthScore: health.memoryHealthScore,
    recommendationHealthScore: health.recommendationHealthScore,
  });

  return { ok: true, data: snapshot };
}

// ─── getProjectOSSnapshot ─────────────────────────────────────────────────────

export async function getProjectOSSnapshot(
  input: GetProjectOSSnapshotInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a UUID.");
  return dbFindProjectOSSnapshotById(input.snapshotId, input.workspaceId);
}

// ─── listProjectOSSnapshots ───────────────────────────────────────────────────

export async function listProjectOSSnapshots(
  input: ListProjectOSSnapshotsInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.projectId && !validUuid(input.projectId)) {
    return validation("projectId must be a UUID.");
  }
  if (input.status && !PROJECT_OS_SNAPSHOT_STATUSES.includes(input.status)) {
    return validation(`status must be one of: ${PROJECT_OS_SNAPSHOT_STATUSES.join(", ")}.`);
  }
  return dbListProjectOSSnapshots(input);
}

// ─── validateProjectOSSnapshot ────────────────────────────────────────────────

export async function validateProjectOSSnapshot(
  input: ValidateProjectOSSnapshotInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindProjectOSSnapshotById(input.snapshotId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.snapshot_status !== "generated") {
    return validation(
      `Snapshot can only be validated from 'generated' status (current: ${current.data.snapshot_status}).`
    );
  }

  const result = await dbUpdateProjectOSSnapshotStatus(
    input.snapshotId,
    input.workspaceId,
    "validated"
  );
  if (!result.ok) return result;

  await emitOSEvent(
    input.workspaceId,
    result.data.project_id,
    input.snapshotId,
    "PROJECT_OS_SNAPSHOT_VALIDATED",
    input.actorId
  );

  return result;
}

// ─── archiveProjectOSSnapshot ─────────────────────────────────────────────────

export async function archiveProjectOSSnapshot(
  input: ArchiveProjectOSSnapshotInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindProjectOSSnapshotById(input.snapshotId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.snapshot_status === "archived") {
    return validation("Snapshot is already archived.");
  }

  const result = await dbUpdateProjectOSSnapshotStatus(
    input.snapshotId,
    input.workspaceId,
    "archived"
  );
  if (!result.ok) return result;

  await emitOSEvent(
    input.workspaceId,
    result.data.project_id,
    input.snapshotId,
    "PROJECT_OS_SNAPSHOT_ARCHIVED",
    input.actorId
  );

  return result;
}

// ─── generateProjectAttentionItems ───────────────────────────────────────────

export async function generateProjectAttentionItems(input: {
  workspaceId: string;
  projectId: string;
  snapshotId: string;
  actorId: string;
}): Promise<ProjectOSResult<ProjectOSAttentionItemRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId))   return validation("projectId must be a UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  return dbListProjectOSAttentionItems(input.snapshotId, input.workspaceId);
}

// ─── getProjectOperatingContext ───────────────────────────────────────────────

export async function getProjectOperatingContext(
  input: GetProjectOperatingContextInput
): Promise<ProjectOSResult<ProjectOSOperatingContext>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId))   return validation("projectId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const result = await composeProjectOperatingContext({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    snapshotId: "00000000-0000-0000-0000-000000000000",
  });

  if (result.ok) {
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      actorId: input.actorId,
      actorType: "system",
      eventType: "PROJECT_OS_CONTEXT_COMPOSED",
      eventCategory: "system",
      source: "system",
      learningEligible: false,
      eventPayload: {
        projectId: input.projectId,
        signalCount: result.data.signals.length,
        commitmentCount: result.data.commitments.length,
        attentionItemCount: result.data.attentionItems.length,
      },
    });
  }

  return result;
}

// ─── getProjectOSLineage ──────────────────────────────────────────────────────

export async function getProjectOSLineageForProject(
  input: GetProjectOSLineageInput
): Promise<ProjectOSResult<ProjectOSLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId))   return validation("projectId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const result = await getProjectOSLineage({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });

  if (result.ok) {
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      actorId: input.actorId,
      actorType: "system",
      eventType: "PROJECT_OS_LINEAGE_GENERATED",
      eventCategory: "system",
      source: "system",
      learningEligible: false,
      eventPayload: {
        projectId: input.projectId,
        layerCount: result.data.chain.length,
      },
    });
  }

  return result;
}
