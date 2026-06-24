// ─── PMO Intervention / Action Loop ──────────────────────────────────────────
//
// Human-governed action loop. All actions are proposed for human review.
// No PM assignments, capacity data, or performance records are mutated here.
// ─────────────────────────────────────────────────────────────────────────────

import { generatePMOGovernanceComplianceSnapshot } from "@/lib/pmo-governance-compliance";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PMO_INTERVENTION_ACTION_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { PMOInterventionActionRow } from "@/lib/db/database-contract";
import type { ViolationType, ViolationSeverity } from "@/lib/pmo-governance-compliance";
import type {
  PMOInterventionAction,
  PMOInterventionActionType,
  PMOInterventionApprovalStatus,
  PMOInterventionGenerateResult,
  PMOInterventionPriority,
  PMOInterventionResult,
  PMOInterventionSourceType,
  PMOInterventionStatus,
  PMOInterventionTargetType,
  GeneratePMOInterventionActionsInput,
  GetPMOInterventionActionInput,
  ListPMOInterventionActionsInput,
  UpdatePMOInterventionActionStatusInput,
} from "./types";

// ─── Column selection ─────────────────────────────────────────────────────────

const COLUMNS = PMO_INTERVENTION_ACTION_SELECTABLE_COLUMNS.join(",");

// ─── Row → domain type ────────────────────────────────────────────────────────

function rowToAction(row: PMOInterventionActionRow): PMOInterventionAction {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceType: row.source_type as PMOInterventionSourceType,
    sourceId: row.source_id,
    sourceSnapshotId: row.source_snapshot_id,
    sourceViolationId: row.source_violation_id,
    sourceRecommendationId: row.source_recommendation_id,
    actionType: row.action_type as PMOInterventionActionType,
    actionTitle: row.action_title,
    actionDescription: row.action_description,
    priority: row.priority as PMOInterventionPriority,
    status: row.status as PMOInterventionStatus,
    targetType: (row.target_type as PMOInterventionTargetType) ?? null,
    targetId: row.target_id,
    targetName: row.target_name,
    pmId: row.pm_id,
    projectId: row.project_id,
    evidence: row.evidence ?? null,
    // recommendation is stored as jsonb { text: string } or null
    recommendation: row.recommendation
      ? (typeof (row.recommendation as Record<string, unknown>).text === "string"
          ? ((row.recommendation as Record<string, unknown>).text as string)
          : JSON.stringify(row.recommendation))
      : null,
    requiresApproval: row.requires_approval,
    approvalStatus: row.approval_status as PMOInterventionApprovalStatus,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    completionNotes: row.completion_notes,
    dismissedBy: row.dismissed_by,
    dismissedAt: row.dismissed_at,
    dismissalReason: row.dismissal_reason,
    decisionReason: row.decision_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Violation → action type mapping ─────────────────────────────────────────

const VIOLATION_ACTION_MAP: Partial<Record<ViolationType, PMOInterventionActionType>> = {
  PM_PROFILE_MISSING: "complete_pm_profile",
  PM_ROLE_MISSING: "complete_pm_profile",
  PM_EXPERIENCE_LEVEL_MISSING: "complete_pm_profile",
  PM_ACTIVE_PROJECTS_LIMIT_MISSING: "complete_pm_profile",
  CAPACITY_SNAPSHOT_MISSING: "generate_capacity_snapshot",
  CAPACITY_SNAPSHOT_STALE: "generate_capacity_snapshot",
  NEAR_CAPACITY_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  AT_CAPACITY_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  OVERLOADED_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  OVERLOADED_NOT_IN_ATTENTION_QUEUE: "review_capacity_overload",
  PERFORMANCE_SNAPSHOT_MISSING: "generate_performance_snapshot",
  PERFORMANCE_SNAPSHOT_STALE: "generate_performance_snapshot",
  WARNING_PM_WITHOUT_RECOMMENDATION: "review_pm_performance_risk",
  CRITICAL_PM_WITHOUT_RECOMMENDATION: "escalate_critical_pm_risk",
  HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE: "review_pm_performance_risk",
  PERFORMANCE_RISK_MISSING: "review_pm_performance_risk",
  SCORE_INTERPRETATION_MISSING: "improve_evidence_coverage",
  EVIDENCE_CONFIDENCE_MISSING: "improve_evidence_coverage",
  EVIDENCE_COMPLETENESS_MISSING: "improve_evidence_coverage",
  CONFIDENCE_LEVEL_MISSING: "improve_evidence_coverage",
  LOW_CONFIDENCE_WITHOUT_RECOMMENDATION: "improve_evidence_coverage",
  MISSING_SOURCES_NOT_RECORDED: "improve_evidence_coverage",
  NEUTRAL_BASELINE_DOMAINS_NOT_RECORDED: "improve_evidence_coverage",
  CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION: "escalate_critical_pm_risk",
  CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION: "review_capacity_overload",
  PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION: "review_pm_performance_risk",
  INSUFFICIENT_EVIDENCE_WITHOUT_RECOMMENDATION: "improve_evidence_coverage",
  RECOMMENDATION_MISSING_SEVERITY: "review_intervention_readiness",
  RECOMMENDATION_MISSING_SOURCE: "review_intervention_readiness",
  RISKY_PM_NOT_IN_ATTENTION_QUEUE: "escalate_critical_pm_risk",
  INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS: "review_assignment_hygiene",
  SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS: "review_assignment_hygiene",
  ACTIVE_PM_WITH_NO_ASSIGNMENTS: "review_assignment_hygiene",
  INVALID_ASSIGNMENT_TYPE: "review_assignment_hygiene",
  PROJECT_WITHOUT_PRIMARY_PM: "review_assignment_hygiene",
  PROJECT_WITH_MULTIPLE_PRIMARY_PMS: "review_assignment_hygiene",
  OBSERVER_COUNTED_AS_CAPACITY: "review_assignment_hygiene",
  HISTORICAL_ASSIGNMENT_MISSING_REMOVED_AT: "review_assignment_hygiene",
  ASSIGNMENT_EVENT_MISSING: "review_assignment_hygiene",
  DOSSIER_IDENTITY_MISSING: "complete_pm_profile",
  DOSSIER_PROFILE_SECTION_MISSING: "complete_pm_profile",
  DOSSIER_ASSIGNMENTS_MISSING: "review_assignment_hygiene",
  DOSSIER_CAPACITY_SECTION_MISSING: "generate_capacity_snapshot",
  DOSSIER_PERFORMANCE_SECTION_MISSING: "generate_performance_snapshot",
  DOSSIER_EVIDENCE_SECTION_MISSING: "improve_evidence_coverage",
  DOSSIER_RECOMMENDATIONS_MISSING: "review_intervention_readiness",
  DOSSIER_EVENT_TIMELINE_MISSING: "review_intervention_readiness",
};

// ── Priority derivation ───────────────────────────────────────────────────────

const CRITICAL_PRIORITY_VIOLATIONS = new Set<ViolationType>([
  "OVERLOADED_WITHOUT_RECOMMENDATION",
  "CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION",
  "CRITICAL_PM_WITHOUT_RECOMMENDATION",
]);

const HIGH_PRIORITY_VIOLATIONS = new Set<ViolationType>([
  "CAPACITY_SNAPSHOT_MISSING",
  "PERFORMANCE_SNAPSHOT_MISSING",
  "LOW_CONFIDENCE_WITHOUT_RECOMMENDATION",
  "HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE",
]);

function derivePriority(
  violationType: ViolationType,
  severity: ViolationSeverity
): PMOInterventionPriority {
  if (CRITICAL_PRIORITY_VIOLATIONS.has(violationType)) return "critical";
  if (HIGH_PRIORITY_VIOLATIONS.has(violationType)) return "high";
  return severity as PMOInterventionPriority;
}

// ── Deduplication key ─────────────────────────────────────────────────────────

interface DedupParams {
  workspaceId: string;
  sourceType: PMOInterventionSourceType;
  sourceViolationId: string | null;
  actionType: PMOInterventionActionType;
  targetType: PMOInterventionTargetType | null;
  targetId: string | null;
  pmId: string | null;
  projectId: string | null;
}

function dedupKey(p: DedupParams): string {
  if (p.sourceViolationId) {
    return [p.workspaceId, p.sourceType, p.sourceViolationId, p.actionType, p.targetType ?? "", p.targetId ?? ""].join("|");
  }
  return [p.workspaceId, p.sourceType, p.actionType, p.targetType ?? "", p.targetId ?? "", p.pmId ?? "", p.projectId ?? ""].join("|");
}

const OPEN_STATUSES: PMOInterventionStatus[] = ["proposed", "approved", "in_progress"];

// ── Action titles ─────────────────────────────────────────────────────────────

const ACTION_TITLES: Record<PMOInterventionActionType, string> = {
  complete_pm_profile: "Complete PM Profile",
  generate_capacity_snapshot: "Generate Capacity Snapshot",
  review_capacity_overload: "Review Capacity Overload",
  generate_performance_snapshot: "Generate Performance Snapshot",
  improve_evidence_coverage: "Improve Evidence Coverage",
  escalate_critical_pm_risk: "Escalate Critical PM Risk",
  review_pm_performance_risk: "Review PM Performance Risk",
  review_assignment_hygiene: "Review Assignment Hygiene",
  review_evidence_quality: "Review Evidence Quality",
  review_intervention_readiness: "Review Intervention Readiness",
  manual_review: "Manual Review Required",
};

// ─── Status transition table ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PMOInterventionStatus, PMOInterventionStatus[]> = {
  proposed: ["approved", "rejected", "dismissed"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  dismissed: [],
  cancelled: [],
};

function isValidTransition(from: PMOInterventionStatus, to: PMOInterventionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── generatePMOInterventionActions ──────────────────────────────────────────

export async function generatePMOInterventionActions(
  input: GeneratePMOInterventionActionsInput
): Promise<PMOInterventionResult<PMOInterventionGenerateResult>> {
  const { workspaceId, actorId, sourceSnapshotId } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_INTERVENTION_WORKSPACE_REQUIRED" };
  }

  // Load governance snapshot
  const snapshotResult = await generatePMOGovernanceComplianceSnapshot({ workspaceId, actorId: actorId ?? undefined });

  if (!snapshotResult.ok) {
    return { ok: false, error: `Governance snapshot failed: ${snapshotResult.error}`, failureClass: "PMO_INTERVENTION_GENERATION_FAILED" };
  }

  const snapshot = snapshotResult.data;
  const snapshotId = sourceSnapshotId ?? snapshot.snapshot_id;
  const violations = snapshot.violations ?? [];

  const supabase = await createSupabaseServerClient();

  // Load existing open actions to build dedup index
  const { data: existingRows } = await supabase
    .from("pmo_intervention_actions")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .in("status", OPEN_STATUSES)
    .returns<PMOInterventionActionRow[]>();

  const existing = existingRows ?? [];
  const openKeys = new Set<string>();
  const existingOpenCount = existing.length;

  for (const row of existing) {
    openKeys.add(
      dedupKey({
        workspaceId: row.workspace_id,
        sourceType: row.source_type as PMOInterventionSourceType,
        sourceViolationId: row.source_violation_id,
        actionType: row.action_type as PMOInterventionActionType,
        targetType: (row.target_type as PMOInterventionTargetType) ?? null,
        targetId: row.target_id,
        pmId: row.pm_id,
        projectId: row.project_id,
      })
    );
  }

  const created: PMOInterventionAction[] = [];
  let skipped = 0;

  for (const violation of violations) {
    const actionType = VIOLATION_ACTION_MAP[violation.violation_type];
    if (!actionType) continue;

    const targetType: PMOInterventionTargetType | null = violation.pm_id
      ? "pm"
      : violation.project_id
      ? "project"
      : null;
    const targetId = violation.pm_id ?? violation.project_id ?? null;
    const targetName = violation.pm_name ?? violation.project_name ?? null;

    const key = dedupKey({
      workspaceId,
      sourceType: "pmo_governance_compliance",
      sourceViolationId: violation.violation_id,
      actionType,
      targetType,
      targetId,
      pmId: violation.pm_id ?? null,
      projectId: violation.project_id ?? null,
    });

    if (openKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const priority = derivePriority(violation.violation_type, violation.severity);

    const { data: insertedRow, error: insertErr } = await supabase
      .from("pmo_intervention_actions")
      .insert({
        workspace_id: workspaceId,
        source_type: "pmo_governance_compliance" as string,
        source_id: snapshotId,
        source_snapshot_id: snapshotId,
        source_violation_id: violation.violation_id,
        source_recommendation_id: null,
        action_type: actionType as string,
        action_title: ACTION_TITLES[actionType],
        action_description: violation.message,
        priority: priority as string,
        status: "proposed",
        target_type: targetType,
        target_id: targetId,
        target_name: targetName,
        pm_id: violation.pm_id ?? null,
        project_id: violation.project_id ?? null,
        evidence: violation.evidence ?? null,
        recommendation: violation.recommendation ? { text: violation.recommendation } : null,
        requires_approval: true,
        approval_status: "pending",
        created_by: actorId ?? null,
      })
      .select(COLUMNS)
      .single<PMOInterventionActionRow>();

    if (insertErr || !insertedRow) {
      console.error("pmo_intervention_actions.insert.failed", { violation: violation.violation_id, error: insertErr?.message });
      continue;
    }

    openKeys.add(key);
    created.push(rowToAction(insertedRow));
  }

  // Emit platform event (fire and forget)
  createPlatformEvent({
    workspaceId,
    actorId: actorId ?? null,
    actorType: actorId ? "user" : "system",
    eventType: "PMO_INTERVENTION_ACTION_GENERATED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    visibility: "workspace",
    sensitivityLevel: "internal",
    learningEligible: false,
    eventPayload: {
      workspace_id: workspaceId,
      source_snapshot_id: snapshotId,
      created_count: created.length,
      skipped_duplicates: skipped,
      existing_open_actions: existingOpenCount,
      generated_at: generatedAt,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    data: {
      created_actions: created,
      existing_open_actions: existingOpenCount,
      skipped_duplicates: skipped,
      source_snapshot_id: snapshotId,
      generated_at: generatedAt,
    },
  };
}

// ─── listPMOInterventionActions ───────────────────────────────────────────────

export async function listPMOInterventionActions(
  input: ListPMOInterventionActionsInput
): Promise<PMOInterventionResult<PMOInterventionAction[]>> {
  const { workspaceId, status, priority, actionType, targetType, limit } = input;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_INTERVENTION_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("pmo_intervention_actions")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (actionType) query = query.eq("action_type", actionType);
  if (targetType) query = query.eq("target_type", targetType);
  if (limit && limit > 0) query = query.limit(limit);

  const { data, error } = await query.returns<PMOInterventionActionRow[]>();

  if (error) {
    console.error("pmo_intervention_actions.list.failed", { workspaceId, error: error.message });
    return { ok: false, error: "Failed to list intervention actions.", failureClass: "PMO_INTERVENTION_STATUS_UPDATE_FAILED" };
  }

  return { ok: true, data: (data ?? []).map(rowToAction) };
}

// ─── getPMOInterventionAction ─────────────────────────────────────────────────

export async function getPMOInterventionAction(
  input: GetPMOInterventionActionInput
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  const { workspaceId, actionId } = input;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_INTERVENTION_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pmo_intervention_actions")
    .select(COLUMNS)
    .eq("id", actionId)
    .eq("workspace_id", workspaceId)
    .single<PMOInterventionActionRow>();

  if (error || !data) {
    return { ok: false, error: "Action not found.", failureClass: "PMO_INTERVENTION_ACTION_NOT_FOUND" };
  }

  return { ok: true, data: rowToAction(data) };
}

// ─── updatePMOInterventionActionStatus ───────────────────────────────────────

export async function updatePMOInterventionActionStatus(
  input: UpdatePMOInterventionActionStatusInput
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  const { workspaceId, actionId, actorId, status, decisionReason, completionNotes } = input;
  const now = input.updatedAt ?? new Date().toISOString();

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_INTERVENTION_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();

  // Read current state for transition validation
  const { data: current, error: readErr } = await supabase
    .from("pmo_intervention_actions")
    .select(COLUMNS)
    .eq("id", actionId)
    .eq("workspace_id", workspaceId)
    .single<PMOInterventionActionRow>();

  if (readErr || !current) {
    return { ok: false, error: "Action not found.", failureClass: "PMO_INTERVENTION_ACTION_NOT_FOUND" };
  }

  const currentStatus = current.status as PMOInterventionStatus;
  if (!isValidTransition(currentStatus, status)) {
    return {
      ok: false,
      error: `Invalid status transition: ${currentStatus} → ${status}.`,
      failureClass: "PMO_INTERVENTION_INVALID_STATUS_TRANSITION",
    };
  }

  // Build update fields
  const updateFields: Record<string, unknown> = {
    status: status as string,
    updated_at: now,
  };

  if (decisionReason !== undefined) updateFields.decision_reason = decisionReason ?? null;
  if (completionNotes !== undefined) updateFields.completion_notes = completionNotes ?? null;

  if (status === "approved") {
    updateFields.approval_status = "approved";
    updateFields.approved_by = actorId;
    updateFields.approved_at = now;
  } else if (status === "rejected") {
    updateFields.approval_status = "rejected";
    updateFields.rejected_by = actorId;
    updateFields.rejected_at = now;
    updateFields.rejection_reason = decisionReason ?? null;
  } else if (status === "dismissed") {
    updateFields.dismissed_by = actorId;
    updateFields.dismissed_at = now;
    updateFields.dismissal_reason = decisionReason ?? null;
  } else if (status === "completed") {
    updateFields.completed_by = actorId;
    updateFields.completed_at = now;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("pmo_intervention_actions")
    .update(updateFields)
    .eq("id", actionId)
    .eq("workspace_id", workspaceId)
    .select(COLUMNS)
    .single<PMOInterventionActionRow>();

  if (updateErr || !updated) {
    console.error("pmo_intervention_actions.update.failed", { actionId, error: updateErr?.message });
    return { ok: false, error: "Failed to update action status.", failureClass: "PMO_INTERVENTION_STATUS_UPDATE_FAILED" };
  }

  // Emit event (fire and forget)
  createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType: "PMO_INTERVENTION_ACTION_STATUS_CHANGED",
    eventCategory: "governance",
    source: "user_action",
    visibility: "workspace",
    sensitivityLevel: "internal",
    learningEligible: false,
    eventPayload: {
      workspace_id: workspaceId,
      action_id: actionId,
      action_type: current.action_type,
      previous_status: currentStatus as string,
      new_status: status as string,
      actor_id: actorId,
      changed_at: now,
    },
  }).catch(() => undefined);

  return { ok: true, data: rowToAction(updated) };
}

// ─── Thin wrappers ────────────────────────────────────────────────────────────

export async function dismissPMOInterventionAction(
  workspaceId: string,
  actionId: string,
  actorId: string,
  dismissalReason?: string
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  return updatePMOInterventionActionStatus({
    workspaceId,
    actionId,
    actorId,
    status: "dismissed",
    decisionReason: dismissalReason ?? null,
  });
}

export async function approvePMOInterventionAction(
  workspaceId: string,
  actionId: string,
  actorId: string,
  decisionReason?: string
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  return updatePMOInterventionActionStatus({
    workspaceId,
    actionId,
    actorId,
    status: "approved",
    decisionReason: decisionReason ?? null,
  });
}

export async function rejectPMOInterventionAction(
  workspaceId: string,
  actionId: string,
  actorId: string,
  rejectionReason?: string
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  return updatePMOInterventionActionStatus({
    workspaceId,
    actionId,
    actorId,
    status: "rejected",
    decisionReason: rejectionReason ?? null,
  });
}

export async function completePMOInterventionAction(
  workspaceId: string,
  actionId: string,
  actorId: string,
  completionNotes?: string
): Promise<PMOInterventionResult<PMOInterventionAction>> {
  return updatePMOInterventionActionStatus({
    workspaceId,
    actionId,
    actorId,
    status: "completed",
    completionNotes: completionNotes ?? null,
  });
}

// ─── Exports for testing ──────────────────────────────────────────────────────

export { VIOLATION_ACTION_MAP, derivePriority, dedupKey, isValidTransition, OPEN_STATUSES };
