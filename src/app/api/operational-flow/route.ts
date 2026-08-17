import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import {
  captureOperationalInput,
  deriveEvidence,
  dispatchGovernedMaterialActionToTask,
  ensureExpectedOutcome,
  getCompleteLineageProjection,
  getOperationalSummary,
  proposeGovernedMaterialAction,
  reconstructAuditTrail,
  recordHumanDecision,
  recordOutcomeObservation,
  revokeGovernedMaterialAction,
  runEvidenceDecisionChain,
} from "@/lib/operational-flow/operational-flow-service";
import { buildCanonicalAuditExportPackage } from "@/lib/audit-export";
import type { EvidenceAssertionType, EvidenceClassification, MissingDataState } from "@/lib/operational-flow/types";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE_ID = "/api/operational-flow";
const DECISION_STATUSES = new Set(["accepted", "rejected", "modified", "escalated", "needs_more_evidence"]);
const ASSERTION_TYPES = new Set(["FACT", "INFERENCE", "ASSUMPTION"]);
const CLASSIFICATIONS = new Set(["UNCLASSIFIED", "PROJECT_STATUS", "RISK", "ISSUE", "DECISION_CONTEXT", "DELIVERY"]);
const MISSING_DATA_STATES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const OBSERVATION_STATES = new Set(["achieved", "partial", "failed", "disputed", "inconclusive"]);

async function authorize(projectId: string, workspaceId: string, permission: "read" | "write") {
  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    const supabase = await createSupabaseServerClient();
    const [{ data: project }, { data: membership }] = await Promise.all([
      supabase.from("projects").select("workspace_id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!project || !membership?.role) throw new AccessDeniedError("Project workspace mismatch.", { reason: "project_scope_violation" });
    if (permission === "write" && !["owner", "admin", "pm"].includes(String(membership.role))) {
      throw new AccessDeniedError("Operational write role denied.", { reason: "role_missing_write_permission" });
    }
    return { user, supabase, role: String(membership.role) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Operational flow access denied.", actorUserId: userId, workspaceId, projectId, requestedPermission: permission, deniedPermission: permission, eventType: "project_scope_violation" });
    }
    throw error;
  }
}

function scopeFromUrl(request: Request) {
  const url = new URL(request.url);
  return {
    workspaceId: url.searchParams.get("workspaceId")?.trim() ?? "",
    projectId: url.searchParams.get("projectId")?.trim() ?? "",
    view: url.searchParams.get("view")?.trim() ?? "",
    outcomeId: url.searchParams.get("outcomeId")?.trim() || undefined,
    taskId: url.searchParams.get("taskId")?.trim() || undefined,
    correlationId: url.searchParams.get("correlationId")?.trim() || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  };
}

export async function GET(request: Request) {
  const { workspaceId, projectId, view, outcomeId, taskId, correlationId, limit } = scopeFromUrl(request);
  if (!workspaceId || !projectId) return Response.json({ error: "workspaceId and projectId are required." }, { status: 400 });
  const authorized = await authorize(projectId, workspaceId, "read");
  if (authorized instanceof Response) return authorized;
  try {
    if (view === "lineage") {
      const lineages = await getCompleteLineageProjection(authorized.supabase, workspaceId, projectId, { outcomeId, taskId });
      return Response.json({ lineages });
    }
    if (view === "audit") {
      const auditTrail = await reconstructAuditTrail(authorized.supabase, workspaceId, projectId, { correlationId, limit });
      return Response.json({ auditTrail });
    }
    if (view === "audit_export") {
      // P2-20: one canonical, redacted, gap-aware package. Same authorize() gate, same
      // request-scoped client — the export layer adds no data access of its own.
      const auditExport = await buildCanonicalAuditExportPackage(authorized.supabase, workspaceId, projectId, {
        outcomeId, taskId, correlationId, auditRecordLimit: limit,
      });
      return Response.json({ auditExport });
    }
    return Response.json(await getOperationalSummary(authorized.supabase, workspaceId, projectId, authorized.user.id));
  } catch (error) {
    return safeLegacyErrorResponse("/api/operational-flow", error, "Unable to load operational flow. Please retry.");
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const workspaceId = String(body.workspaceId ?? "").trim();
  const projectId = String(body.projectId ?? "").trim();
  const operation = String(body.operation ?? "").trim();
  if (!workspaceId || !projectId || !operation) return Response.json({ error: "workspaceId, projectId and operation are required." }, { status: 400 });
  if (![
    "capture_input",
    "derive_evidence",
    "run_chain",
    "record_decision",
    "propose_material_action",
    "dispatch_material_action_to_task",
    "revoke_material_action",
    "ensure_expected_outcome",
    "record_outcome_observation",
  ].includes(operation)) return Response.json({ error: "Unsupported public operation." }, { status: 400 });
  const authorized = await authorize(projectId, workspaceId, "write");
  if (authorized instanceof Response) return authorized;
  const scope = { workspaceId, projectId, userId: authorized.user.id, role: authorized.role };

  try {
    if (operation === "capture_input") {
      return Response.json(await captureOperationalInput(authorized.supabase, scope, {
        sourceKey: String(body.sourceKey ?? "manual-demo:v1"), idempotencyKey: String(body.idempotencyKey ?? ""),
        title: String(body.title ?? ""), content: String(body.content ?? ""), occurredAt: String(body.occurredAt ?? ""),
        correlationId: String(body.correlationId ?? ""), causationId: body.causationId ? String(body.causationId) : null,
        externalId: body.externalId ? String(body.externalId) : null,
      }), { status: 201 });
    }
    if (operation === "derive_evidence") {
      const assertionType = String(body.assertionType ?? "");
      const classification = String(body.classification ?? "");
      const missingDataState = String(body.missingDataState ?? "");
      if (!ASSERTION_TYPES.has(assertionType) || !CLASSIFICATIONS.has(classification) || !MISSING_DATA_STATES.has(missingDataState)) {
        return Response.json({ error: "Explicit assertionType, classification and missingDataState are required." }, { status: 400 });
      }
      const result = await deriveEvidence(authorized.supabase, scope, {
        normalizedEventId: String(body.normalizedEventId ?? ""), idempotencyKey: String(body.idempotencyKey ?? ""),
        assertionType: assertionType as EvidenceAssertionType, classification: classification as EvidenceClassification,
        confidenceScore: Number(body.confidenceScore), missingDataState: missingDataState as MissingDataState,
        evaluatedAt: String(body.evaluatedAt ?? ""), staleAt: body.staleAt ? String(body.staleAt) : null,
      });
      return Response.json(result, { status: result.disposition === "created" ? 201 : 200 });
    }
    if (operation === "run_chain") return Response.json(await runEvidenceDecisionChain(authorized.supabase, scope, String(body.evidenceItemId ?? "")));
    if (operation === "propose_material_action") {
      const actionClass = String(body.actionClass ?? "");
      const risk = String(body.risk ?? ""); const reversibility = String(body.reversibility ?? ""); const sideEffect = String(body.sideEffect ?? "");
      if (!["ordinary_business_write","external_write","authority_mutation","material_agent_action","knowledge_elevation","policy_classified"].includes(actionClass)
        || !["low","medium","high","critical","unknown"].includes(risk) || !["reversible","partially_reversible","irreversible","unknown"].includes(reversibility)
        || !["internal","external","authority","knowledge","unknown"].includes(sideEffect)) return Response.json({ error: "Invalid material action classification." }, { status: 400 });
      const result = await proposeGovernedMaterialAction(authorized.supabase, scope, {
        decisionId: String(body.decisionId ?? ""), idempotencyKey: String(body.idempotencyKey ?? ""),
        actionClass: actionClass as "ordinary_business_write" | "external_write" | "authority_mutation" | "material_agent_action" | "knowledge_elevation" | "policy_classified",
        actionType: String(body.actionType ?? ""), targetResourceType: String(body.targetResourceType ?? ""), targetResourceId: String(body.targetResourceId ?? ""),
        intendedOperation: String(body.intendedOperation ?? ""), intendedEffect: String(body.intendedEffect ?? ""), risk: risk as "low" | "medium" | "high" | "critical" | "unknown",
        reversibility: reversibility as "reversible" | "partially_reversible" | "irreversible" | "unknown", sideEffect: sideEffect as "internal" | "external" | "authority" | "knowledge" | "unknown",
        justification: String(body.justification ?? ""), createdAt: String(body.createdAt ?? ""), evaluationTime: String(body.evaluationTime ?? ""), expiresAt: String(body.expiresAt ?? ""),
      });
      return Response.json(result, { status: result.disposition === "created" ? 201 : result.disposition === "conflict" ? 409 : 200 });
    }
    if (operation === "dispatch_material_action_to_task") {
      const result = await dispatchGovernedMaterialActionToTask(authorized.supabase, scope, {
        actionId: String(body.actionId ?? ""),
        expectedProposalDigest: body.expectedProposalDigest ? String(body.expectedProposalDigest) : null,
      });
      const status =
        result.disposition === "created" ? 201 :
        result.disposition === "existing" ? 200 :
        result.disposition === "conflict" ? 409 :
        409;
      return Response.json(result, { status });
    }
    if (operation === "revoke_material_action") return Response.json(await revokeGovernedMaterialAction(authorized.supabase, scope, {
      actionId: String(body.actionId ?? ""), evaluationTime: String(body.evaluationTime ?? ""), reasonCode: String(body.reasonCode ?? "governance_revoked"),
    }));
    if (operation === "ensure_expected_outcome") {
      const result = await ensureExpectedOutcome(authorized.supabase, scope, {
        taskId: String(body.taskId ?? ""),
        expectedResult: String(body.expectedResult ?? ""),
        successCriteria: Array.isArray(body.successCriteria) ? body.successCriteria : [],
        correlationId: String(body.correlationId ?? ""),
        causationId: body.causationId ? String(body.causationId) : null,
      });
      return Response.json(result, { status: result.disposition === "created" ? 201 : 200 });
    }
    if (operation === "record_outcome_observation") {
      const observationState = String(body.observationState ?? "");
      if (!OBSERVATION_STATES.has(observationState)) return Response.json({ error: "Invalid observationState." }, { status: 400 });
      const missingDataState = String(body.missingDataState ?? "COMPLETE");
      if (!MISSING_DATA_STATES.has(missingDataState)) return Response.json({ error: "Invalid missingDataState." }, { status: 400 });
      const evidenceReferenceIds = Array.isArray(body.evidenceReferenceIds) ? body.evidenceReferenceIds.map(String) : [];
      const result = await recordOutcomeObservation(authorized.supabase, scope, {
        outcomeId: String(body.outcomeId ?? ""),
        observationState: observationState as "achieved" | "partial" | "failed" | "disputed" | "inconclusive",
        summary: String(body.summary ?? ""),
        evidenceReferenceIds,
        confidenceScore: Number(body.confidenceScore ?? 1.0),
        missingDataState: missingDataState as "COMPLETE" | "PARTIAL" | "UNKNOWN",
        observedAt: String(body.observedAt ?? ""),
        evaluatedAt: String(body.evaluatedAt ?? ""),
        staleAt: body.staleAt ? String(body.staleAt) : null,
        correlationId: String(body.correlationId ?? ""),
        causationId: body.causationId ? String(body.causationId) : null,
        idempotencyKey: String(body.idempotencyKey ?? ""),
      });
      const status = result.disposition === "created" ? 201 : result.disposition === "conflict" ? 409 : 200;
      return Response.json(result, { status });
    }
    const decisionStatus = String(body.decisionStatus ?? "");
    if (!DECISION_STATUSES.has(decisionStatus)) return Response.json({ error: "Invalid decisionStatus." }, { status: 400 });
    return Response.json(await recordHumanDecision(authorized.supabase, scope, {
      recommendationId: body.recommendationId ? String(body.recommendationId) : null,
      manualEvidenceItemId: body.manualEvidenceItemId ? String(body.manualEvidenceItemId) : null,
      decision: String(body.decision ?? ""), decisionStatus: decisionStatus as "accepted" | "rejected" | "modified" | "escalated" | "needs_more_evidence",
      rationale: String(body.rationale ?? ""),
    }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operational flow failed.";
    const status = /idempotency_conflict/.test(message) ? 409 : /denied|authority|access/.test(message) ? 403 : /required|mismatch|invalid|not_found|incomplete|malformed|source_(degraded|stale|unavailable|revoked)/.test(message) ? 400 : 500;
    if (status === 500) return safeLegacyErrorResponse("/api/operational-flow", error, "Operational flow failed. Please retry.");
    return Response.json({ error: message }, { status });
  }
}
