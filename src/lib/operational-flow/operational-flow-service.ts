import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { canCreateOperationalEvidence, evaluateOperationalDecisionAuthority, type OperationalWorkspaceRole } from "./authority";
import type { DecisionStatus, OperationalSummary } from "./types";

export const SIGNAL_DETECTOR_KEY = "system/deterministic:governance_signal_detector_v1";

type Client = SupabaseClient;
type Scope = { workspaceId: string; projectId: string; userId: string; role?: OperationalWorkspaceRole | null };
type EvidenceInput = {
  sourceType: "manual_note" | "email" | "meeting_minutes" | "ticket" | "conversation" | "document_reference";
  title: string;
  content: string;
  sourceReference?: string | null;
  confidenceLevel?: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
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

export async function createEvidenceItem(client: Client, scope: Scope, input: EvidenceInput) {
  if (!canCreateOperationalEvidence(scope.role ?? null)) throw new Error("evidence_write_role_denied");
  const result = await client.from("evidence_items").insert({
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    created_by: scope.userId,
    source_type: input.sourceType,
    title: requireValue(input.title, "title"),
    content: requireValue(input.content, "content"),
    source_reference: input.sourceReference?.trim() || null,
    confidence_level: input.confidenceLevel ?? "medium",
    status: "recorded",
    metadata: input.metadata ?? {},
    evidence_hash: "0".repeat(64),
    version: 1,
  }).select("*").single();
  return unwrap(result, "create_evidence_item") as Record<string, unknown>;
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

async function loadActorRole(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`load_operational_actor_role: ${error.message}`);
  return (data?.role as OperationalWorkspaceRole | undefined) ?? null;
}

export async function getOperationalSummary(client: Client, workspaceId: string, projectId: string, userId: string): Promise<OperationalSummary> {
  const [evidence, signals, risks, governance, recommendations, decisions, assuranceResult, actorRole] = await Promise.all([
    client.from("evidence_items").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    client.from("operational_signals").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("risk_issue_records").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("governance_events").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.from("recommended_actions").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).not("governance_event_id", "is", null).order("created_at", { ascending: false }).limit(30),
    client.from("operational_decision_records").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    client.rpc("get_operational_assurance_summary", { p_workspace_id: workspaceId, p_project_id: projectId }),
    loadActorRole(client, workspaceId, userId),
  ]);
  for (const result of [evidence, signals, risks, governance, recommendations, decisions]) {
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
    evidence: evidence.data ?? [],
    signals: signals.data ?? [],
    risksIssues: risks.data ?? [],
    governanceEvents: governance.data ?? [],
    recommendations: safeRecommendations,
    decisions: decisions.data ?? [],
    evidenceLinks: links.data ?? [],
    assurance: assuranceResult.data as OperationalSummary["assurance"],
    actor: { role: actorRole, canCreateEvidence: canCreateOperationalEvidence(actorRole) },
  };
}
