import type { SupabaseClient } from "@supabase/supabase-js";
import { canCreateOperationalEvidence, evaluateOperationalDecisionAuthority, type OperationalWorkspaceRole } from "./authority";
import type { DecisionStatus, DeriveEvidenceInput, EvidenceProvenanceResult, OperationalSummary } from "./types";
import { createHash, randomUUID } from "node:crypto";
import {
  createPMFreakMaterialActionProposal,
  evaluatePMFreakMaterialActionGovernance,
  type PMFreakMaterialActionClass,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

export const SIGNAL_DETECTOR_KEY = "system/deterministic:governance_signal_detector_v1";

type Client = SupabaseClient;
type Scope = { workspaceId: string; projectId: string; userId: string; role?: OperationalWorkspaceRole | null };
export type CaptureOperationalInput = {
  sourceKey: string;
  idempotencyKey: string;
  title: string;
  content: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string | null;
  externalId?: string | null;
};

function requireValue(value: string | undefined | null, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, operation: string): T {
  if (result.error || result.data === null) throw new Error(`${operation}: ${result.error?.message ?? "no_data"}`);
  return result.data;
}

export async function deriveEvidence(client: Client, scope: Scope, input: DeriveEvidenceInput): Promise<EvidenceProvenanceResult> {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("evidence_write_role_denied");
  for (const [value, name] of [[input.normalizedEventId, "normalized_event_id"], [input.idempotencyKey, "idempotency_key"], [input.evaluatedAt, "evaluated_at"]] as const) requireValue(value, name);
  if (!Number.isFinite(input.confidenceScore) || input.confidenceScore < 0 || input.confidenceScore > 1) throw new Error("confidence_score_invalid");
  const evaluatedAt = new Date(input.evaluatedAt);
  if (Number.isNaN(evaluatedAt.valueOf())) throw new Error("evaluated_at_invalid");
  const staleAt = input.staleAt ? new Date(input.staleAt) : null;
  if (staleAt && Number.isNaN(staleAt.valueOf())) throw new Error("stale_at_invalid");
  const result = await client.rpc("derive_operational_evidence", {
    p_workspace_id: scope.workspaceId, p_project_id: scope.projectId,
    p_normalized_event_id: input.normalizedEventId, p_idempotency_key: input.idempotencyKey.trim(),
    p_assertion_type: input.assertionType, p_classification: input.classification,
    p_confidence_score: input.confidenceScore, p_missing_data_state: input.missingDataState,
    p_evaluated_at: evaluatedAt.toISOString(), p_stale_at: staleAt?.toISOString() ?? null,
  });
  return unwrap(result, "derive_operational_evidence") as EvidenceProvenanceResult;
}

export async function captureOperationalInput(client: Client, scope: Scope, input: CaptureOperationalInput) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("intake_write_role_denied");
  for (const [value, name] of [[input.sourceKey, "source_key"], [input.idempotencyKey, "idempotency_key"], [input.title, "title"], [input.content, "content"], [input.occurredAt, "occurred_at"], [input.correlationId, "correlation_id"]] as const) requireValue(value, name);
  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.valueOf())) throw new Error("occurred_at_invalid");
  const result = await client.rpc("capture_operational_input", {
    p_workspace_id: scope.workspaceId, p_project_id: scope.projectId,
    p_source_key: input.sourceKey.trim(), p_idempotency_key: input.idempotencyKey.trim(),
    p_title: input.title.trim(), p_content: input.content.trim(), p_occurred_at: occurredAt.toISOString(),
    p_correlation_id: input.correlationId, p_causation_id: input.causationId || null, p_external_id: input.externalId?.trim() || null,
  });
  return unwrap(result, "capture_operational_input") as Record<string, unknown>;
}

export async function runEvidenceDecisionChain(client: Client, scope: Scope, evidenceItemId: string) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("operational_chain_role_denied");
  const result = await client.rpc("materialize_operational_chain", { p_evidence_item_id: requireValue(evidenceItemId, "evidence_item_id") });
  if (result.error) {
    await client.rpc("record_operational_chain_failure", { p_evidence_item_id: evidenceItemId, p_error_message: result.error.message });
    throw new Error(`materialize_operational_chain: ${result.error.message}`);
  }
  return result.data as { evidenceItemId: string; detector: string; chain: Array<Record<string, unknown>>; agentRunId: string };
}

export async function recordHumanDecision(client: Client, scope: Scope, input: {
  recommendationId?: string | null;
  manualEvidenceItemId?: string | null;
  decision: string;
  decisionStatus: DecisionStatus;
  rationale: string;
}) {
  const result = await client.rpc("record_operational_decision", {
    p_recommendation_id: input.recommendationId || null,
    p_manual_evidence_item_id: input.manualEvidenceItemId || null,
    p_decision: requireValue(input.decision, "decision"),
    p_decision_status: input.decisionStatus,
    p_rationale: requireValue(input.rationale, "rationale"),
  });
  return unwrap(result, "record_operational_decision") as Record<string, unknown>;
}

export type ProposeMaterialActionInput = {
  decisionId: string;
  idempotencyKey: string;
  actionClass: PMFreakMaterialActionClass;
  actionType: string;
  targetResourceType: string;
  targetResourceId: string;
  intendedOperation: string;
  intendedEffect: string;
  risk: "low" | "medium" | "high" | "critical" | "unknown";
  reversibility: "reversible" | "partially_reversible" | "irreversible" | "unknown";
  sideEffect: "internal" | "external" | "authority" | "knowledge" | "unknown";
  justification: string;
  createdAt: string;
  evaluationTime: string;
  expiresAt: string;
};

function deterministicUuid(value: string): string {
  const hex = createHash("sha256").update(value, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** P2-06 ends at a persisted, inert authorization record. */
export async function proposeGovernedMaterialAction(client: Client, scope: Scope, input: ProposeMaterialActionInput) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("material_action_write_denied");
  const createdAt = new Date(requireValue(input.createdAt, "created_at"));
  const evaluationTime = new Date(requireValue(input.evaluationTime, "evaluation_time"));
  const expiresAt = new Date(requireValue(input.expiresAt, "expires_at"));
  if ([createdAt, evaluationTime, expiresAt].some((value) => Number.isNaN(value.valueOf()))) throw new Error("material_action_timestamp_invalid");

  const { data: decision, error: decisionError } = await client.from("operational_decision_records")
    .select("id,workspace_id,project_id,decided_by,decision_status,recommendation_id,governance_event_id,created_at")
    .eq("id", requireValue(input.decisionId, "decision_id")).eq("workspace_id", scope.workspaceId).eq("project_id", scope.projectId).maybeSingle();
  if (decisionError || !decision || !["accepted", "modified"].includes(String(decision.decision_status))) throw new Error("material_action_source_decision_ineligible");
  if (String(decision.decided_by) !== scope.userId) throw new Error("material_action_decision_actor_mismatch");

  const { data: links, error: linksError } = await client.from("decision_evidence_links")
    .select("evidence_item_id,evidence_hash_at_decision,evidence_version_at_decision").eq("decision_record_id", input.decisionId);
  if (linksError || !links?.length) throw new Error("material_action_evidence_required");

  const role = String(scope.role);
  const isApprover = role === "owner" || role === "admin";
  const policyReference = decision.governance_event_id ? `pmfreak-governance-event:${decision.governance_event_id}` : null;
  const approvalReferences = isApprover ? [`workspace-role-approval:${role}:${scope.userId}`] : [];
  const requiredApprovalCount = input.actionClass === "ordinary_business_write" ? 0 : 1;
  const proposal = createPMFreakMaterialActionProposal({
    actionId: deterministicUuid(`${scope.workspaceId}:${input.idempotencyKey}`), workspaceId: scope.workspaceId, projectId: scope.projectId,
    originatingSubjectType: "decision", originatingSubjectId: input.decisionId, decisionReferenceId: input.decisionId,
    sourceCorrelationId: `decision:${input.decisionId}`, causationId: input.decisionId,
    evidenceReferenceIds: links.map((link) => String(link.evidence_item_id)), recommendationReferenceIds: decision.recommendation_id ? [String(decision.recommendation_id)] : [],
    actionClass: input.actionClass, actionType: input.actionType, targetResourceType: input.targetResourceType, targetResourceId: input.targetResourceId,
    intendedOperation: input.intendedOperation, intendedEffect: input.intendedEffect, risk: input.risk, reversibility: input.reversibility,
    sideEffect: input.sideEffect, proposedActorId: scope.userId, accountableActorId: scope.userId, requiredApprovalCount,
    justification: input.justification, policySnapshotReference: policyReference, grantReference: `workspace-role-grant:${role}:${scope.userId}`,
    createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString(), idempotencyKey: input.idempotencyKey, fixture: null,
  });

  const initialState = input.actionClass === "knowledge_elevation" ? "denied" : proposal.materiality === "unknown" ? "degraded" : proposal.materiality === "ordinary" ? "not_required" : policyReference ? (isApprover ? "authorized" : "requires_approval") : "unavailable";
  const evidence = {
    evaluationId: randomUUID(), evaluatedAt: evaluationTime.toISOString(), evaluatorActorId: "aoc-e:in-process:v1", state: initialState as "degraded" | "not_required" | "authorized" | "unavailable" | "denied" | "requires_approval",
    policyDecisionReference: policyReference ?? undefined, grantReference: proposal.grantReference ?? undefined,
    obligationReferenceIds: proposal.obligationReferenceIds ?? [], approvalReferenceIds: approvalReferences,
    validUntil: expiresAt.toISOString(), reasonCodes: [initialState === "authorized" ? "in_process_policy_allow" : `in_process_${initialState}`],
  };
  const evaluation = evaluatePMFreakMaterialActionGovernance(proposal, evidence, evaluationTime);
  const persistenceEvaluation = { ...evaluation.evidence, state: evaluation.state, canCommitAction: evaluation.canCommitAction,
    grantReferenceIds: evaluation.evidence.grantReference ? [evaluation.evidence.grantReference] : [], contractVersion: "pmfreak.aoc-e.in-process-governance.v1",
    evaluatorKind: "aoc_e_in_process", canExecute: false };
  const result = await client.rpc("persist_governed_material_action", { p_proposal: proposal, p_evaluation: persistenceEvaluation });
  if (result.error || !result.data) throw new Error(`persist_governed_material_action:${result.error?.message ?? "no_data"}`);
  return { ...(result.data as Record<string, unknown>), authorizationMessage: "Authorized does not mean Executed.", taskMessage: "No task has been created.", dispatchMessage: "No action has been dispatched.", remoteAocMessage: "Remote AOC writeback is not enabled." } as Record<string, unknown> & { disposition?: string };
}

export async function dispatchGovernedMaterialActionToTask(
  client: Client,
  scope: Scope,
  input: { actionId: string; expectedProposalDigest?: string | null },
) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("action_task_write_denied");

  const actionId = requireValue(input.actionId, "action_id");
  const expectedProposalDigest = input.expectedProposalDigest?.trim() || null;
  if (expectedProposalDigest && !/^[a-f0-9]{64}$/.test(expectedProposalDigest)) {
    throw new Error("action_task_expected_digest_invalid");
  }

  const result = await client.rpc("dispatch_governed_action_to_internal_task", {
    p_workspace_id: scope.workspaceId,
    p_project_id: scope.projectId,
    p_action_id: actionId,
    p_expected_proposal_digest: expectedProposalDigest,
  });

  if (result.error || !result.data) {
    throw new Error(`dispatch_governed_action_to_internal_task:${result.error?.message ?? "no_data"}`);
  }

  return result.data as Record<string, unknown> & {
    disposition?: "created" | "existing" | "conflict" | "denied";
    failureClass?: string;
  };
}

/** P2-06 revocation remains append-only governance evidence. */
export async function revokeGovernedMaterialAction(client: Client, scope: Scope, input: { actionId: string; evaluationTime: string; reasonCode: string }) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("material_action_revoke_denied");
  const evaluationTime = new Date(requireValue(input.evaluationTime, "evaluation_time"));
  if (Number.isNaN(evaluationTime.valueOf())) throw new Error("material_action_timestamp_invalid");
  const result = await client.rpc("revoke_governed_material_action", {
    p_action_id: requireValue(input.actionId, "action_id"), p_evaluation_id: randomUUID(),
    p_evaluated_at: evaluationTime.toISOString(), p_reason_code: requireValue(input.reasonCode, "reason_code"),
  });
  if (result.error || !result.data) throw new Error(`revoke_governed_material_action:${result.error?.message ?? "no_data"}`);
  return result.data as Record<string, unknown>;
}

async function loadActorRole(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`load_operational_actor_role: ${error.message}`);
  return (data?.role as OperationalWorkspaceRole | undefined) ?? null;
}

export async function getOperationalSummary(client: Client, workspaceId: string, projectId: string, userId: string): Promise<OperationalSummary> {
  const [sources, rawInputs, normalizedEvents, evidence, signals, risks, governance, recommendations, decisions, materialActions, materialActionEvaluations, assuranceResult, actorRole] = await Promise.all([
    client.from("operational_sources").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    client.from("operational_raw_inputs").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("captured_at", { ascending: false }).limit(20),
    client.from("operational_normalized_events").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("recorded_at", { ascending: false }).limit(20),
    client.from("evidence_items").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    client.from("operational_signals").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("risk_issue_records").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("governance_events").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("recommended_actions").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).not("governance_event_id", "is", null).order("created_at", { ascending: false }).limit(30),
    client.from("operational_decision_records").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("material_action_proposals").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("persisted_at", { ascending: false }).limit(30),
    client.from("material_action_governance_evaluations").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("recorded_at", { ascending: false }).limit(30),
    client.rpc("get_operational_assurance_summary", { p_workspace_id: workspaceId, p_project_id: projectId }),
    loadActorRole(client, workspaceId, userId),
  ]);
  for (const result of [sources, rawInputs, normalizedEvents, evidence, signals, risks, governance, recommendations, decisions, materialActions, materialActionEvaluations]) {
    if (result.error) throw new Error(`load_operational_summary: ${result.error.message}`);
  }
  if (assuranceResult.error || !assuranceResult.data) throw new Error(`load_operational_assurance: ${assuranceResult.error?.message ?? "no_data"}`);
  const decisionIds = (decisions.data ?? []).map((row) => row.id);
  const links = decisionIds.length ? await client.from("decision_evidence_links").select("*").in("decision_record_id", decisionIds) : { data: [], error: null };
  if (links.error) throw new Error(`load_evidence_links: ${links.error.message}`);
  const governanceById = new Map((governance.data ?? []).map((row) => [row.id, row]));
  const safeRecommendations = (recommendations.data ?? []).map((row) => {
    const event = governanceById.get(row.governance_event_id) as Record<string, unknown> | undefined;
    const evaluations = (["accepted", "rejected", "modified", "escalated", "needs_more_evidence"] as DecisionStatus[]).map((status) => [status, evaluateOperationalDecisionAuthority({ actorRole, authorityRequired: String(event?.authority_required ?? "baseline review"), decisionStatus: status })]);
    return { ...row, actor_authority: Object.fromEntries(evaluations) };
  });
  return {
    sources: sources.data ?? [],
    rawInputs: rawInputs.data ?? [],
    normalizedEvents: normalizedEvents.data ?? [],
    evidence: evidence.data ?? [],
    signals: signals.data ?? [],
    risksIssues: risks.data ?? [],
    governanceEvents: governance.data ?? [],
    recommendations: safeRecommendations,
    decisions: decisions.data ?? [],
    evidenceLinks: links.data ?? [],
    materialActions: materialActions.data ?? [],
    materialActionEvaluations: materialActionEvaluations.data ?? [],
    assurance: assuranceResult.data as OperationalSummary["assurance"],
    actor: { role: actorRole, canCreateEvidence: canCreateOperationalEvidence(actorRole) },
  };
}
