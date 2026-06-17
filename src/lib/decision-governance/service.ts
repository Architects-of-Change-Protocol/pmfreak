import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent, getPlatformEvents } from "@/lib/platform-events";
import { transitionValidationFailure, validateDecisionTransition } from "./state-machine";
import type {
  DecisionAuditPackage,
  DecisionEffectivenessSnapshot,
  DecisionEvidenceLink,
  DecisionEvidenceRelationship,
  DecisionImplementationRecord,
  DecisionLifecycleEvent,
  DecisionLineage,
  DecisionOutcomeRecord,
  DecisionOutcomeStatus,
  DecisionOutcomeType,
  DecisionRecord,
  DecisionStatus,
  DecisionSummary,
  DecisionType,
  Result,
} from "./types";

const DECISION_STATUSES: DecisionStatus[] = ["draft", "pending_review", "approved", "rejected", "implemented", "expired"];
const DECISION_TYPES: DecisionType[] = ["risk_response", "scope_change", "schedule_change", "budget_change", "resource_change", "stakeholder_action", "governance_exception", "vendor_action", "dependency_resolution", "other"];
const RELATIONSHIPS: DecisionEvidenceRelationship[] = ["supports", "contradicts", "required_for", "reviewed_during", "triggered_by"];
const OUTCOME_TYPES: DecisionOutcomeType[] = ["risk_reduction", "schedule_improvement", "cost_avoidance", "stakeholder_alignment", "resource_optimization", "governance_compliance", "other"];
const OUTCOME_STATUSES: DecisionOutcomeStatus[] = ["success", "partial_success", "failure", "unknown"];

const columns = "id,workspace_id,project_id,decision_type,decision_status,title,summary,decision_rationale,recommendation_id,approved_by,rejected_by,implemented_by,created_by,created_at,approved_at,rejected_at,implemented_at,implementation_notes,closed_at,metadata";
const evidenceColumns = "id,decision_id,evidence_id,evidence_type,relationship_type,created_at";
const outcomeColumns = "id,workspace_id,project_id,decision_id,outcome_type,outcome_status,summary,recorded_by,recorded_at,metadata";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function requiredText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validation<T>(error: string): Result<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function governance<T>(error: string): Result<T> { return { ok: false, error, failureClass: "governance_violation" }; }
function msBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const delta = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(delta) ? delta : null;
}

async function emitDecisionEvent(decision: DecisionRecord, eventType: DecisionLifecycleEvent, actorId: string, correlationId?: string | null, causationId?: string | null, payload: Record<string, unknown> = {}): Promise<Result<DecisionRecord>> {
  const event = await createPlatformEvent({
    workspaceId: decision.workspace_id,
    projectId: decision.project_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "decision",
    source: "user_action",
    correlationId: correlationId ?? decision.id,
    causationId: causationId ?? null,
    rawReferenceTable: "project_decisions",
    rawReferenceId: decision.id,
    eventPayload: { decisionId: decision.id, decisionType: decision.decision_type, decisionStatus: decision.decision_status, recommendationId: decision.recommendation_id, ...payload },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: decision };
}

async function emitOutcomeEvent(decision: DecisionRecord, outcome: DecisionOutcomeRecord, eventType: DecisionLifecycleEvent, actorId: string, correlationId?: string | null, causationId?: string | null): Promise<Result<DecisionOutcomeRecord>> {
  const event = await createPlatformEvent({
    workspaceId: outcome.workspace_id,
    projectId: outcome.project_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "outcome",
    source: "user_action",
    correlationId: correlationId ?? decision.id,
    causationId: causationId ?? decision.id,
    rawReferenceTable: "decision_outcomes",
    rawReferenceId: outcome.id,
    eventPayload: { decisionId: decision.id, outcomeId: outcome.id, outcomeType: outcome.outcome_type, outcomeStatus: outcome.outcome_status },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: outcome };
}

export async function createDecision(input: { workspaceId: string; projectId: string; decisionType: DecisionType; title: string; summary: string; createdBy: string; decisionRationale?: string | null; recommendationId?: string | null; metadata?: Record<string, unknown>; evidenceLinks?: Array<{ evidenceId: string; evidenceType: string; relationshipType: DecisionEvidenceRelationship }>; correlationId?: string | null; causationId?: string | null; }): Promise<Result<DecisionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId)) return validation("projectId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!DECISION_TYPES.includes(input.decisionType)) return validation(`decisionType must be one of: ${DECISION_TYPES.join(", ")}.`);
  if (!requiredText(input.title)) return validation("title is required.");
  if (!requiredText(input.summary)) return validation("summary is required.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("project_decisions").insert({ workspace_id: input.workspaceId, project_id: input.projectId, decision_type: input.decisionType, decision_status: "draft", title: input.title.trim(), summary: input.summary.trim(), decision_rationale: input.decisionRationale ?? null, recommendation_id: input.recommendationId ?? null, created_by: input.createdBy, metadata: input.metadata ?? {} }).select(columns).single<DecisionRecord>();
  if (error || !data) return { ok: false, error: "Unable to create decision.", failureClass: "persistence_failed" };
  if (input.evidenceLinks?.length) {
    const linkResult = await linkDecisionEvidence(data.id, input.evidenceLinks);
    if (!linkResult.ok) return linkResult as Result<DecisionRecord>;
  }
  return emitDecisionEvent(data, "DECISION_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function linkDecisionEvidence(decisionId: string, links: Array<{ evidenceId: string; evidenceType: string; relationshipType: DecisionEvidenceRelationship }>): Promise<Result<DecisionEvidenceLink[]>> {
  if (!validUuid(decisionId)) return validation("decisionId must be a UUID.");
  if (!links.length) return validation("At least one evidence link is required.");
  for (const link of links) {
    if (!validUuid(link.evidenceId)) return validation("evidenceId must be a UUID.");
    if (!requiredText(link.evidenceType)) return validation("evidenceType is required.");
    if (!RELATIONSHIPS.includes(link.relationshipType)) return validation(`relationshipType must be one of: ${RELATIONSHIPS.join(", ")}.`);
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("decision_evidence_links").insert(links.map((l) => ({ decision_id: decisionId, evidence_id: l.evidenceId, evidence_type: l.evidenceType.trim(), relationship_type: l.relationshipType }))).select(evidenceColumns).returns<DecisionEvidenceLink[]>();
  if (error || !data) return { ok: false, error: "Unable to link decision evidence.", failureClass: "persistence_failed" };
  return { ok: true, data };
}

async function transitionDecision(decisionId: string, actorId: string, status: DecisionStatus, eventType: DecisionLifecycleEvent, patch: Partial<DecisionRecord>, correlationId?: string | null, causationId?: string | null): Promise<Result<DecisionRecord>> {
  if (!validUuid(decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  if (!DECISION_STATUSES.includes(status)) return validation("Invalid decision status.");
  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase.from("project_decisions").select(columns).eq("id", decisionId).single<DecisionRecord>();
  if (readError || !current) return { ok: false, error: "Decision not found.", failureClass: "not_found" };
  const transition = validateDecisionTransition(current.decision_status, status);
  if (!transition.ok) return transitionValidationFailure(transition.error);
  if (status === "implemented" && (!current.approved_at || !current.approved_by)) return governance("Decision implementation requires approved_at and approved_by.");
  const { data, error } = await supabase.from("project_decisions").update({ ...patch, decision_status: status }).eq("id", decisionId).select(columns).single<DecisionRecord>();
  if (error || !data) return { ok: false, error: "Unable to update decision.", failureClass: "persistence_failed" };
  return emitDecisionEvent(data, eventType, actorId, correlationId, causationId);
}

export const submitDecision = (decisionId: string, submittedBy: string, correlationId?: string | null, causationId?: string | null) => transitionDecision(decisionId, submittedBy, "pending_review", "DECISION_SUBMITTED", {}, correlationId, causationId);
export const approveDecision = (decisionId: string, approvedBy: string, rationale?: string | null, correlationId?: string | null, causationId?: string | null) => transitionDecision(decisionId, approvedBy, "approved", "DECISION_APPROVED", { approved_by: approvedBy, approved_at: new Date().toISOString(), decision_rationale: rationale ?? undefined } as Partial<DecisionRecord>, correlationId, causationId);
export const rejectDecision = (decisionId: string, rejectedBy: string, rationale?: string | null, correlationId?: string | null, causationId?: string | null) => transitionDecision(decisionId, rejectedBy, "rejected", "DECISION_REJECTED", { rejected_by: rejectedBy, rejected_at: new Date().toISOString(), closed_at: new Date().toISOString(), decision_rationale: rationale ?? undefined } as Partial<DecisionRecord>, correlationId, causationId);

export async function implementDecision(decisionId: string, implementedBy: string, implementationNotes?: string | null, correlationId?: string | null, causationId?: string | null): Promise<Result<DecisionRecord>> {
  const implementedAt = new Date().toISOString();
  const result = await transitionDecision(decisionId, implementedBy, "implemented", "DECISION_IMPLEMENTED", { closed_at: implementedAt, implemented_by: implementedBy, implemented_at: implementedAt, implementation_notes: implementationNotes ?? null } as Partial<DecisionRecord>, correlationId, causationId);
  if (!result.ok) return result;
  return emitDecisionEvent(result.data, "DECISION_IMPLEMENTATION_RECORDED", implementedBy, correlationId, causationId, { implementedBy, implementedAt, implementationNotes: implementationNotes ?? null });
}
export const expireDecision = (decisionId: string, expiredBy: string, correlationId?: string | null, causationId?: string | null) => transitionDecision(decisionId, expiredBy, "expired", "DECISION_EXPIRED", { closed_at: new Date().toISOString() } as Partial<DecisionRecord>, correlationId, causationId);

export async function recordDecisionOutcome(input: { decisionId: string; outcomeType: DecisionOutcomeType; outcomeStatus: DecisionOutcomeStatus; summary: string; recordedBy: string; metadata?: Record<string, unknown>; correlationId?: string | null; causationId?: string | null; }): Promise<Result<DecisionOutcomeRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.recordedBy)) return validation("recordedBy must be a UUID.");
  if (!OUTCOME_TYPES.includes(input.outcomeType)) return validation(`outcomeType must be one of: ${OUTCOME_TYPES.join(", ")}.`);
  if (!OUTCOME_STATUSES.includes(input.outcomeStatus)) return validation(`outcomeStatus must be one of: ${OUTCOME_STATUSES.join(", ")}.`);
  if (!requiredText(input.summary)) return validation("summary is required.");
  const decisionResult = await getDecision(input.decisionId);
  if (!decisionResult.ok) return decisionResult as Result<DecisionOutcomeRecord>;
  const decision = decisionResult.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("decision_outcomes").insert({ workspace_id: decision.workspace_id, project_id: decision.project_id, decision_id: decision.id, outcome_type: input.outcomeType, outcome_status: input.outcomeStatus, summary: input.summary.trim(), recorded_by: input.recordedBy, metadata: input.metadata ?? {} }).select(outcomeColumns).single<DecisionOutcomeRecord>();
  if (error || !data) return { ok: false, error: "Unable to record decision outcome.", failureClass: "persistence_failed" };
  const base = await emitOutcomeEvent(decision, data, "DECISION_OUTCOME_RECORDED", input.recordedBy, input.correlationId, input.causationId);
  if (!base.ok) return base;
  const statusEvent = input.outcomeStatus === "success" ? "DECISION_OUTCOME_SUCCESS" : input.outcomeStatus === "partial_success" ? "DECISION_OUTCOME_PARTIAL_SUCCESS" : input.outcomeStatus === "failure" ? "DECISION_OUTCOME_FAILURE" : null;
  return statusEvent ? emitOutcomeEvent(decision, data, statusEvent, input.recordedBy, input.correlationId, data.id) : { ok: true, data };
}

export async function getDecision(decisionId: string): Promise<Result<DecisionRecord>> {
  if (!validUuid(decisionId)) return validation("decisionId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("project_decisions").select(columns).eq("id", decisionId).single<DecisionRecord>();
  if (error || !data) return { ok: false, error: "Decision not found.", failureClass: "not_found" };
  return { ok: true, data };
}

export async function listProjectDecisions(projectId: string): Promise<Result<DecisionSummary[]>> {
  if (!validUuid(projectId)) return validation("projectId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("project_decisions").select(`${columns}, decision_evidence_links(id), decision_outcomes(id)`).eq("project_id", projectId).order("created_at", { ascending: false });
  if (error || !data) return { ok: false, error: "Unable to list decisions.", failureClass: "persistence_failed" };
  return { ok: true, data: (data as Array<DecisionRecord & { decision_evidence_links?: unknown[]; decision_outcomes?: unknown[] }>).map((d) => ({ id: d.id, workspace_id: d.workspace_id, project_id: d.project_id, decision_type: d.decision_type, decision_status: d.decision_status, title: d.title, summary: d.summary, created_at: d.created_at, approved_at: d.approved_at, closed_at: d.closed_at, evidenceCount: d.decision_evidence_links?.length ?? 0, outcomeCount: d.decision_outcomes?.length ?? 0 })) };
}

export function buildDecisionEffectivenessSnapshot(input: { decision: DecisionRecord; evidence: DecisionEvidenceLink[]; implementation: DecisionImplementationRecord | null; outcomes: DecisionOutcomeRecord[]; }): DecisionEffectivenessSnapshot {
  const latestOutcome = [...input.outcomes].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
  return { decisionId: input.decision.id, decisionType: input.decision.decision_type, approvalDuration: msBetween(input.decision.created_at, input.decision.approved_at), timeToImplementation: msBetween(input.decision.approved_at, input.implementation?.implemented_at ?? null), outcomeStatus: latestOutcome?.outcome_status ?? null, evidenceCount: input.evidence.length, recommendationPresent: Boolean(input.decision.recommendation_id) };
}

export async function buildDecisionLineage(decisionId: string): Promise<Result<DecisionLineage>> {
  const decisionResult = await getDecision(decisionId);
  if (!decisionResult.ok) return decisionResult as Result<DecisionLineage>;
  const decision = decisionResult.data;
  const supabase = await createSupabaseServerClient();
  const [{ data: evidence }, { data: outcomes }, { data: recommendation }] = await Promise.all([
    supabase.from("decision_evidence_links").select(evidenceColumns).eq("decision_id", decisionId).returns<DecisionEvidenceLink[]>(),
    supabase.from("decision_outcomes").select(outcomeColumns).eq("decision_id", decisionId).order("recorded_at", { ascending: true }).returns<DecisionOutcomeRecord[]>(),
    decision.recommendation_id ? supabase.from("recommended_actions").select("*").eq("id", decision.recommendation_id).returns<Array<Record<string, unknown>>>() : Promise.resolve({ data: [] }),
  ]);
  const implementation: DecisionImplementationRecord | null = decision.implemented_by || decision.implemented_at || decision.implementation_notes ? { decision_id: decision.id, implemented_by: decision.implemented_by, implemented_at: decision.implemented_at, implementation_notes: decision.implementation_notes } : null;
  const events = await getPlatformEvents({ workspaceId: decision.workspace_id, projectId: decision.project_id, eventCategory: "decision", correlationId: decision.id, limit: 100 });
  const outcomeEvents = await getPlatformEvents({ workspaceId: decision.workspace_id, projectId: decision.project_id, eventCategory: "outcome", correlationId: decision.id, limit: 100 });
  const platformEvents = [...(events.ok ? events.events : []), ...(outcomeEvents.ok ? outcomeEvents.events : [])].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  return { ok: true, data: { decision, evidence: evidence ?? [], recommendations: recommendation ?? [], approvals: { approvedBy: decision.approved_by, approvedAt: decision.approved_at, rejectedBy: decision.rejected_by, rejectedAt: decision.rejected_at }, implementation, outcomes: outcomes ?? [], events: platformEvents, platformEvents } };
}

export async function exportDecisionAuditPackage(decisionId: string): Promise<Result<DecisionAuditPackage>> {
  const lineage = await buildDecisionLineage(decisionId);
  if (!lineage.ok) return lineage as Result<DecisionAuditPackage>;
  const effectivenessSnapshot = buildDecisionEffectivenessSnapshot({ decision: lineage.data.decision, evidence: lineage.data.evidence, implementation: lineage.data.implementation, outcomes: lineage.data.outcomes });
  return { ok: true, data: { decision: lineage.data.decision, evidence: lineage.data.evidence, approvals: lineage.data.approvals, implementation: lineage.data.implementation, outcomes: lineage.data.outcomes, effectivenessSnapshot, lineage: lineage.data, events: lineage.data.events } };
}
