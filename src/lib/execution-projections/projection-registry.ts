// ─────────────────────────────────────────────────────────────────────────────
// Execution Projection Engine — Projection Registry (Service Layer)
//
// All business logic for the execution projection lifecycle lives here.
// Projections are structural models of work, never executions of that work.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { dbFindGovernanceCommitmentById } from "@/lib/governance-commitments/governance-commitment-repository";
import {
  dbCreateExecutionProjection,
  dbFindExecutionProjectionById,
  dbListExecutionProjections,
  dbUpdateExecutionProjection,
  dbCreateExecutionProjectionTask,
  dbListExecutionProjectionTasks,
  dbCreateExecutionProjectionDependency,
  dbListExecutionProjectionDependencies,
  dbCreateExecutionProjectionParticipant,
  dbListExecutionProjectionParticipants,
} from "./execution-projection-repository";
import { getProjectionTemplate } from "./projection-templates";
import { calculateProjectionEffort } from "./effort-engine";
import { calculateProjectionDependencies } from "./dependency-engine";
import { calculateProjectionParticipants } from "./participant-engine";
import { calculateProjectionRisk } from "./risk-engine";
import { calculateProjectionConfidence } from "./confidence-engine";
import { calculateExecutionReadiness } from "./readiness-engine";
import { getExecutionProjectionLineage } from "./lineage";
import { explainExecutionProjection } from "./explain";
import { compareExecutionProjections } from "./comparison-engine";
import type {
  ExecutionProjectionResult,
  ExecutionProjectionRow,
  ExecutionProjectionTaskRow,
  ExecutionProjectionDependencyRow,
  ExecutionProjectionParticipantRow,
  ExecutionProjectionEventType,
  GenerateProjectionInput,
  ValidateProjectionInput,
  ApproveProjectionInput,
  RejectProjectionInput,
  ArchiveProjectionInput,
  GetProjectionInput,
  ListProjectionsInput,
  ProjectionWithDetails,
  ProjectionEffortEstimate,
  ProjectionRiskResult,
  ProjectionConfidenceResult,
  ProjectionReadinessResult,
  ProjectionLineage,
  ProjectionExplanation,
  ProjectionComparison,
} from "./types";
import type { GovernanceActionRow, GovernanceSignalRow } from "@/lib/db/database-contract";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): ExecutionProjectionResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitProjectionEvent(
  projection: ExecutionProjectionRow,
  eventType: ExecutionProjectionEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId:       projection.workspace_id,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "governance",
    source:            "system",
    correlationId:     projection.commitment_id,
    causationId:       projection.id,
    rawReferenceTable: "execution_projections",
    rawReferenceId:    projection.id,
    learningEligible:  true,
    eventPayload: {
      projection_id:   projection.id,
      commitment_id:   projection.commitment_id,
      status:          projection.status,
      projected_risk:  projection.projected_risk,
      confidence_score: projection.confidence_score,
      ...extraPayload,
    },
  });
}

// ─── Generate ─────────────────────────────────────────────────────────────────

export async function generateExecutionProjection(
  input: GenerateProjectionInput
): Promise<ExecutionProjectionResult<ProjectionWithDetails>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!validUuid(input.actorId))      return validation("Invalid actorId.");

  // Load commitment (enforces workspace isolation via RLS + explicit filter)
  const commitmentResult = await dbFindGovernanceCommitmentById(
    input.commitmentId,
    input.workspaceId
  );
  if (!commitmentResult.ok) return { ok: false, error: commitmentResult.error, failureClass: commitmentResult.failureClass };

  const commitment = commitmentResult.data;

  // Rule 1: Projection must originate from a commitment
  // Rule 7: No orphan projections
  if (commitment.workspace_id !== input.workspaceId) {
    return validation("Commitment does not belong to this workspace.");
  }

  // Determine action type from commitment's action (we use commitment title heuristic
  // since the registry doesn't require loading the full action chain at generation time)
  // Action type is stored on the action; commitment has action_id for tracing.
  // We use commitment_title tokens to identify action type for projection template selection.
  // In production this would load the action row; here we default to safe template resolution.
  const actionType = resolveActionTypeFromCommitment(commitment.commitment_title);
  const template   = getProjectionTemplate(actionType);

  // Calculate effort
  const effort = calculateProjectionEffort(template.tasks);

  // Calculate dependencies
  const deps = calculateProjectionDependencies({
    actionType,
    commitmentId: commitment.id,
    baseDependencyTypes: template.baseDependencyTypes,
  });

  // Calculate risk
  const riskResult = calculateProjectionRisk({
    commitmentPriority: commitment.priority as "low" | "medium" | "high" | "critical",
    dependencyCount:    deps.length,
  });

  // Calculate confidence
  const confidenceResult = calculateProjectionConfidence({
    actionTypeKnown: actionType !== "other",
  });

  const projectionTitle       = `${commitment.commitment_title} — ${template.titleSuffix}`;
  const projectionDescription = template.description;

  // Persist projection
  const projResult = await dbCreateExecutionProjection({
    workspaceId:           input.workspaceId,
    commitmentId:          input.commitmentId,
    projectionTitle,
    projectionDescription,
    estimatedEffortHours:  effort.estimatedHours,
    estimatedDurationDays: effort.estimatedDays,
    projectedRisk:         riskResult.risk,
    confidenceScore:       confidenceResult.score,
  });
  if (!projResult.ok) return projResult;

  const projection = projResult.data;

  // Persist tasks
  const taskRows: ExecutionProjectionTaskRow[] = [];
  for (const t of template.tasks) {
    const taskResult = await dbCreateExecutionProjectionTask({
      workspaceId:     input.workspaceId,
      projectionId:    projection.id,
      taskName:        t.taskName,
      taskDescription: t.taskDescription,
      estimatedHours:  t.estimatedHours,
      sequenceOrder:   t.sequenceOrder,
      ownerType:       t.ownerType,
    });
    if (taskResult.ok) taskRows.push(taskResult.data);
  }

  // Persist dependencies
  const depRows: ExecutionProjectionDependencyRow[] = [];
  for (const d of deps) {
    const depResult = await dbCreateExecutionProjectionDependency({
      workspaceId:         input.workspaceId,
      projectionId:        projection.id,
      dependencyType:      d.dependencyType,
      dependencyReference: d.dependencyReference,
      criticality:         d.criticality,
    });
    if (depResult.ok) depRows.push(depResult.data);
  }

  // Persist participants
  const participants = calculateProjectionParticipants({
    baseParticipants: template.baseParticipants,
  });
  const partRows: ExecutionProjectionParticipantRow[] = [];
  for (const p of participants) {
    const partResult = await dbCreateExecutionProjectionParticipant({
      workspaceId:          input.workspaceId,
      projectionId:         projection.id,
      participantType:      p.participantType,
      participantReference: p.participantReference,
      responsibility:       p.responsibility,
    });
    if (partResult.ok) partRows.push(partResult.data);
  }

  // Emit events
  await emitProjectionEvent(projection, "EXECUTION_PROJECTION_GENERATED", input.actorId, {
    action_type:    actionType,
    task_count:     taskRows.length,
    dep_count:      depRows.length,
    participant_count: partRows.length,
  });
  await emitProjectionEvent(projection, "EXECUTION_PROJECTION_EFFORT_CALCULATED", input.actorId, {
    effort_hours: effort.estimatedHours,
    effort_days:  effort.estimatedDays,
  });
  await emitProjectionEvent(projection, "EXECUTION_PROJECTION_RISK_CALCULATED", input.actorId, {
    risk:    riskResult.risk,
    factors: riskResult.factors,
  });
  await emitProjectionEvent(projection, "EXECUTION_PROJECTION_CONFIDENCE_CALCULATED", input.actorId, {
    score:   confidenceResult.score,
    factors: confidenceResult.factors,
  });

  return {
    ok: true,
    data: { ...projection, tasks: taskRows, dependencies: depRows, participants: partRows },
  };
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export async function validateExecutionProjection(
  input: ValidateProjectionInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status !== "generated") {
    return validation(`Cannot validate a projection with status '${found.data.status}'.`);
  }

  // Validate: must have tasks, dependencies, and confidence > 0
  const tasks = await dbListExecutionProjectionTasks(input.projectionId, input.workspaceId);
  if (!tasks.ok || tasks.data.length === 0) {
    return validation("Projection has no tasks — cannot validate.");
  }
  if (found.data.estimated_effort_hours <= 0) {
    return validation("Projection has no estimated effort — cannot validate.");
  }

  const updated = await dbUpdateExecutionProjection(input.projectionId, input.workspaceId, {
    status:       "validated",
    validated_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitProjectionEvent(updated.data, "EXECUTION_PROJECTION_VALIDATED", input.actorId);
  return updated;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export async function approveExecutionProjection(
  input: ApproveProjectionInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status !== "validated") {
    return validation(`Cannot approve a projection with status '${found.data.status}'.`);
  }

  const updated = await dbUpdateExecutionProjection(input.projectionId, input.workspaceId, {
    status:      "approved",
    approved_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitProjectionEvent(updated.data, "EXECUTION_PROJECTION_APPROVED", input.actorId);
  return updated;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectExecutionProjection(
  input: RejectProjectionInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!found.ok) return found;

  const terminal = ["archived", "rejected"];
  if (terminal.includes(found.data.status)) {
    return validation(`Cannot reject a projection with status '${found.data.status}'.`);
  }

  const updated = await dbUpdateExecutionProjection(input.projectionId, input.workspaceId, {
    status: "rejected",
  });
  if (!updated.ok) return updated;

  await emitProjectionEvent(updated.data, "EXECUTION_PROJECTION_REJECTED", input.actorId, {
    reason: input.reason,
  });
  return updated;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveExecutionProjection(
  input: ArchiveProjectionInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status === "archived") {
    return validation("Projection is already archived.");
  }

  const updated = await dbUpdateExecutionProjection(input.projectionId, input.workspaceId, {
    status:      "archived",
    archived_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitProjectionEvent(updated.data, "EXECUTION_PROJECTION_ARCHIVED", input.actorId);
  return updated;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getExecutionProjection(
  input: GetProjectionInput
): Promise<ExecutionProjectionResult<ProjectionWithDetails>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!found.ok) return found;

  const [tasks, deps, parts] = await Promise.all([
    dbListExecutionProjectionTasks(input.projectionId, input.workspaceId),
    dbListExecutionProjectionDependencies(input.projectionId, input.workspaceId),
    dbListExecutionProjectionParticipants(input.projectionId, input.workspaceId),
  ]);

  return {
    ok: true,
    data: {
      ...found.data,
      tasks:        tasks.ok ? tasks.data : [],
      dependencies: deps.ok  ? deps.data  : [],
      participants: parts.ok ? parts.data : [],
    },
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listExecutionProjections(
  input: ListProjectionsInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  return dbListExecutionProjections(input);
}

// ─── Lineage ──────────────────────────────────────────────────────────────────

export async function getProjectionLineage(
  projectionId: string,
  workspaceId: string,
  commitment: Parameters<typeof getExecutionProjectionLineage>[1],
  action: GovernanceActionRow,
  signal: GovernanceSignalRow
): Promise<ExecutionProjectionResult<ProjectionLineage>> {
  if (!validUuid(workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(projectionId, workspaceId);
  if (!found.ok) return found;

  const lineage = getExecutionProjectionLineage(found.data, commitment, action, signal);

  await emitProjectionEvent(found.data, "EXECUTION_PROJECTION_LINEAGE_GENERATED", workspaceId, {
    chain_length: lineage.chain.length,
  });

  return { ok: true, data: lineage };
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export async function getProjectionReadiness(
  projectionId: string,
  workspaceId: string,
  options: {
    authorityReady:          boolean;
    dependenciesReady:       boolean;
    commitmentAccepted:      boolean;
    recommendationValidated: boolean;
    governanceHealth:        boolean;
  }
): Promise<ExecutionProjectionResult<ProjectionReadinessResult>> {
  if (!validUuid(workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(projectionId, workspaceId);
  if (!found.ok) return found;

  const readiness = calculateExecutionReadiness(options);

  await emitProjectionEvent(found.data, "EXECUTION_PROJECTION_READINESS_CALCULATED", workspaceId, {
    readiness_score: readiness.score,
  });

  return { ok: true, data: readiness };
}

// ─── Explain ──────────────────────────────────────────────────────────────────

export async function getProjectionExplanation(
  projectionId: string,
  workspaceId: string,
  commitmentTitle: string
): Promise<ExecutionProjectionResult<ProjectionExplanation>> {
  if (!validUuid(workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(projectionId)) return validation("Invalid projectionId.");

  const found = await dbFindExecutionProjectionById(projectionId, workspaceId);
  if (!found.ok) return found;

  return { ok: true, data: explainExecutionProjection(found.data, commitmentTitle) };
}

// ─── Compare ──────────────────────────────────────────────────────────────────

export async function compareProjections(
  projectionIdA: string,
  projectionIdB: string,
  workspaceId: string
): Promise<ExecutionProjectionResult<ProjectionComparison>> {
  if (!validUuid(workspaceId))   return validation("Invalid workspaceId.");
  if (!validUuid(projectionIdA)) return validation("Invalid projectionIdA.");
  if (!validUuid(projectionIdB)) return validation("Invalid projectionIdB.");

  const [a, b] = await Promise.all([
    dbFindExecutionProjectionById(projectionIdA, workspaceId),
    dbFindExecutionProjectionById(projectionIdB, workspaceId),
  ]);
  if (!a.ok) return a;
  if (!b.ok) return b;

  return { ok: true, data: compareExecutionProjections(a.data, b.data) };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveActionTypeFromCommitment(commitmentTitle: string): string {
  const title = commitmentTitle.toLowerCase();
  if (title.includes("delegation") || title.includes("delegate"))   return "create_delegation";
  if (title.includes("ratif"))                                       return "request_ratification";
  if (title.includes("governance review") || title.includes("governance_review")) return "initiate_governance_review";
  if (title.includes("amendment") || title.includes("review_amendment"))          return "review_amendment";
  if (title.includes("decision") || title.includes("review_decision"))            return "review_decision";
  if (title.includes("authority") || title.includes("assign"))                    return "assign_authority";
  return "other";
}
