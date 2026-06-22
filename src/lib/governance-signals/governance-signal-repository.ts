import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS,
  GOVERNANCE_SIGNAL_EVIDENCE_SELECTABLE_COLUMNS,
  GOVERNANCE_SIGNAL_RECOMMENDATION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  GovernanceSignalRow,
  GovernanceSignalEvidenceRow,
  GovernanceSignalRecommendationRow,
} from "@/lib/db/database-contract";
import type {
  GovernanceSignalResult,
  GovernanceSignalSeverity,
  GovernanceSignalStatus,
  GovernanceSignalType,
  GovernanceSignalSource,
} from "./types";

const SIGNAL_COLS = GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS.join(",");
const EVIDENCE_COLS = GOVERNANCE_SIGNAL_EVIDENCE_SELECTABLE_COLUMNS.join(",");
const RECOMMENDATION_COLS = GOVERNANCE_SIGNAL_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): GovernanceSignalResult<T> {
  return { ok: false, error: "Signal not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): GovernanceSignalResult<T> {
  return { ok: false, error: `Unable to ${action} signal.`, failureClass: "persistence_failed" };
}

export async function dbCreateGovernanceSignal(input: {
  workspaceId: string;
  signalType: GovernanceSignalType;
  signalSource: GovernanceSignalSource;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  severity: GovernanceSignalSeverity;
  confidenceScore: number;
}): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signals")
    .insert({
      workspace_id: input.workspaceId,
      signal_type: input.signalType,
      signal_source: input.signalSource,
      source_entity_type: input.sourceEntityType,
      source_entity_id: input.sourceEntityId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      confidence_score: input.confidenceScore,
      status: "active",
    })
    .select(SIGNAL_COLS)
    .single<GovernanceSignalRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindGovernanceSignalById(
  id: string,
  workspaceId: string
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signals")
    .select(SIGNAL_COLS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single<GovernanceSignalRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListGovernanceSignals(input: {
  workspaceId: string;
  severity?: GovernanceSignalSeverity;
  status?: GovernanceSignalStatus;
  signalType?: GovernanceSignalType;
  source?: GovernanceSignalSource;
  fromDate?: string;
  toDate?: string;
}): Promise<GovernanceSignalResult<GovernanceSignalRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("governance_signals")
    .select(SIGNAL_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("detected_at", { ascending: false });

  if (input.severity) query = query.eq("severity", input.severity);
  if (input.status) query = query.eq("status", input.status);
  if (input.signalType) query = query.eq("signal_type", input.signalType);
  if (input.source) query = query.eq("signal_source", input.source);
  if (input.fromDate) query = query.gte("detected_at", input.fromDate);
  if (input.toDate) query = query.lte("detected_at", input.toDate);

  const { data, error } = await query;
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as GovernanceSignalRow[] };
}

export async function dbUpdateGovernanceSignalStatus(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(SIGNAL_COLS)
    .single<GovernanceSignalRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbCreateSignalEvidence(input: {
  workspaceId: string;
  signalId: string;
  evidenceType: string;
  referenceEntityType: string;
  referenceEntityId: string;
  contributionWeight: number;
}): Promise<GovernanceSignalResult<GovernanceSignalEvidenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signal_evidence")
    .insert({
      workspace_id: input.workspaceId,
      signal_id: input.signalId,
      evidence_type: input.evidenceType,
      reference_entity_type: input.referenceEntityType,
      reference_entity_id: input.referenceEntityId,
      contribution_weight: input.contributionWeight,
    })
    .select(EVIDENCE_COLS)
    .single<GovernanceSignalEvidenceRow>();
  if (error || !data) return persistFailed("create evidence");
  return { ok: true, data };
}

export async function dbListSignalEvidence(
  signalId: string,
  workspaceId: string
): Promise<GovernanceSignalResult<GovernanceSignalEvidenceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signal_evidence")
    .select(EVIDENCE_COLS)
    .eq("signal_id", signalId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) return persistFailed("list evidence");
  return { ok: true, data: (data ?? []) as unknown as GovernanceSignalEvidenceRow[] };
}

export async function dbCreateSignalRecommendation(input: {
  workspaceId: string;
  signalId: string;
  recommendationId: string;
  confidenceScore: number;
}): Promise<GovernanceSignalResult<GovernanceSignalRecommendationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signal_recommendations")
    .insert({
      workspace_id: input.workspaceId,
      signal_id: input.signalId,
      recommendation_id: input.recommendationId,
      confidence_score: input.confidenceScore,
    })
    .select(RECOMMENDATION_COLS)
    .single<GovernanceSignalRecommendationRow>();
  if (error || !data) return persistFailed("create signal recommendation");
  return { ok: true, data };
}

export async function dbListSignalRecommendations(
  signalId: string,
  workspaceId: string
): Promise<GovernanceSignalResult<GovernanceSignalRecommendationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_signal_recommendations")
    .select(RECOMMENDATION_COLS)
    .eq("signal_id", signalId)
    .eq("workspace_id", workspaceId)
    .order("confidence_score", { ascending: false });
  if (error) return persistFailed("list signal recommendations");
  return { ok: true, data: (data ?? []) as unknown as GovernanceSignalRecommendationRow[] };
}

export async function dbCountActiveSignalsByType(
  workspaceId: string,
  signalType: GovernanceSignalType,
  sourceEntityId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("governance_signals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("signal_type", signalType)
    .eq("source_entity_id", sourceEntityId)
    .eq("status", "active");
  return count ?? 0;
}

export async function dbListActiveSignalsByWorkspace(
  workspaceId: string
): Promise<GovernanceSignalResult<GovernanceSignalRow[]>> {
  return dbListGovernanceSignals({ workspaceId, status: "active" });
}
