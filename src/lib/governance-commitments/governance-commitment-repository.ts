import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GOVERNANCE_COMMITMENT_SELECTABLE_COLUMNS,
  GOVERNANCE_COMMITMENT_HISTORY_SELECTABLE_COLUMNS,
  GOVERNANCE_COMMITMENT_DELEGATION_SELECTABLE_COLUMNS,
  GOVERNANCE_COMMITMENT_EVIDENCE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  GovernanceCommitmentRow,
  GovernanceCommitmentHistoryRow,
  GovernanceCommitmentDelegationRow,
  GovernanceCommitmentEvidenceRow,
} from "@/lib/db/database-contract";
import type {
  GovernanceCommitmentResult,
  GovernanceCommitmentStatus,
  GovernanceCommitmentPriority,
  GovernanceCommitmentOutcome,
} from "./types";

const COMMITMENT_COLS  = GOVERNANCE_COMMITMENT_SELECTABLE_COLUMNS.join(",");
const HISTORY_COLS     = GOVERNANCE_COMMITMENT_HISTORY_SELECTABLE_COLUMNS.join(",");
const DELEGATION_COLS  = GOVERNANCE_COMMITMENT_DELEGATION_SELECTABLE_COLUMNS.join(",");
const EVIDENCE_COLS    = GOVERNANCE_COMMITMENT_EVIDENCE_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): GovernanceCommitmentResult<T> {
  return { ok: false, error: "Commitment not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): GovernanceCommitmentResult<T> {
  return { ok: false, error: `Unable to ${action} commitment.`, failureClass: "persistence_failed" };
}

// ─── Commitments ──────────────────────────────────────────────────────────────

export async function dbCreateGovernanceCommitment(input: {
  workspaceId: string;
  actionId: string;
  commitmentTitle: string;
  commitmentDescription: string;
  ownerId: string;
  ownerType: string;
  priority: GovernanceCommitmentPriority;
  dueDate: string;
}): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitments")
    .insert({
      workspace_id:           input.workspaceId,
      action_id:              input.actionId,
      commitment_title:       input.commitmentTitle,
      commitment_description: input.commitmentDescription,
      owner_id:               input.ownerId,
      owner_type:             input.ownerType,
      priority:               input.priority,
      status:                 "pending_acceptance",
      due_date:               input.dueDate,
    })
    .select(COMMITMENT_COLS)
    .single<GovernanceCommitmentRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindGovernanceCommitmentById(
  id: string,
  workspaceId: string
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitments")
    .select(COMMITMENT_COLS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single<GovernanceCommitmentRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListGovernanceCommitments(input: {
  workspaceId: string;
  status?: GovernanceCommitmentStatus;
  ownerId?: string;
  priority?: GovernanceCommitmentPriority;
  fromDueDate?: string;
  toDueDate?: string;
  actionId?: string;
}): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("governance_commitments")
    .select(COMMITMENT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.status)      query = query.eq("status", input.status);
  if (input.ownerId)     query = query.eq("owner_id", input.ownerId);
  if (input.priority)    query = query.eq("priority", input.priority);
  if (input.actionId)    query = query.eq("action_id", input.actionId);
  if (input.fromDueDate) query = query.gte("due_date", input.fromDueDate);
  if (input.toDueDate)   query = query.lte("due_date", input.toDueDate);

  const { data, error } = await query;
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as GovernanceCommitmentRow[] };
}

export async function dbUpdateGovernanceCommitment(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(COMMITMENT_COLS)
    .single<GovernanceCommitmentRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbListActiveCommitmentsForBreach(
  workspaceId: string,
  nowIso: string
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitments")
    .select(COMMITMENT_COLS)
    .eq("workspace_id", workspaceId)
    .in("status", ["accepted", "active", "delegated", "pending_acceptance"])
    .lt("due_date", nowIso);
  if (error) return persistFailed("list overdue");
  return { ok: true, data: (data ?? []) as unknown as GovernanceCommitmentRow[] };
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function dbCreateCommitmentHistory(input: {
  workspaceId: string;
  commitmentId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string | null;
}): Promise<GovernanceCommitmentResult<GovernanceCommitmentHistoryRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_history")
    .insert({
      workspace_id:    input.workspaceId,
      commitment_id:   input.commitmentId,
      previous_status: input.previousStatus,
      new_status:      input.newStatus,
      changed_by:      input.changedBy,
      reason:          input.reason ?? null,
    })
    .select(HISTORY_COLS)
    .single<GovernanceCommitmentHistoryRow>();
  if (error || !data) return persistFailed("create history");
  return { ok: true, data };
}

export async function dbListCommitmentHistory(
  commitmentId: string,
  workspaceId: string
): Promise<GovernanceCommitmentResult<GovernanceCommitmentHistoryRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_history")
    .select(HISTORY_COLS)
    .eq("commitment_id", commitmentId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) return persistFailed("list history");
  return { ok: true, data: (data ?? []) as unknown as GovernanceCommitmentHistoryRow[] };
}

// ─── Delegations ──────────────────────────────────────────────────────────────

export async function dbCreateCommitmentDelegation(input: {
  workspaceId: string;
  commitmentId: string;
  delegatedBy: string;
  delegatedTo: string;
  reason: string;
}): Promise<GovernanceCommitmentResult<GovernanceCommitmentDelegationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_delegations")
    .insert({
      workspace_id:  input.workspaceId,
      commitment_id: input.commitmentId,
      delegated_by:  input.delegatedBy,
      delegated_to:  input.delegatedTo,
      reason:        input.reason,
      status:        "pending",
    })
    .select(DELEGATION_COLS)
    .single<GovernanceCommitmentDelegationRow>();
  if (error || !data) return persistFailed("create delegation");
  return { ok: true, data };
}

export async function dbListCommitmentDelegations(
  commitmentId: string,
  workspaceId: string
): Promise<GovernanceCommitmentResult<GovernanceCommitmentDelegationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_delegations")
    .select(DELEGATION_COLS)
    .eq("commitment_id", commitmentId)
    .eq("workspace_id", workspaceId)
    .order("delegated_at", { ascending: false });
  if (error) return persistFailed("list delegations");
  return { ok: true, data: (data ?? []) as unknown as GovernanceCommitmentDelegationRow[] };
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function dbCreateCommitmentEvidence(input: {
  workspaceId: string;
  commitmentId: string;
  artifactId?: string | null;
  memoryRecordId?: string | null;
  description: string;
}): Promise<GovernanceCommitmentResult<GovernanceCommitmentEvidenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_evidence")
    .insert({
      workspace_id:     input.workspaceId,
      commitment_id:    input.commitmentId,
      artifact_id:      input.artifactId ?? null,
      memory_record_id: input.memoryRecordId ?? null,
      description:      input.description,
    })
    .select(EVIDENCE_COLS)
    .single<GovernanceCommitmentEvidenceRow>();
  if (error || !data) return persistFailed("create evidence");
  return { ok: true, data };
}

export async function dbListCommitmentEvidence(
  commitmentId: string,
  workspaceId: string
): Promise<GovernanceCommitmentResult<GovernanceCommitmentEvidenceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_commitment_evidence")
    .select(EVIDENCE_COLS)
    .eq("commitment_id", commitmentId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) return persistFailed("list evidence");
  return { ok: true, data: (data ?? []) as unknown as GovernanceCommitmentEvidenceRow[] };
}
