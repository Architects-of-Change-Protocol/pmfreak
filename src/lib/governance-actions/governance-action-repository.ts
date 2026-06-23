import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GOVERNANCE_ACTION_SELECTABLE_COLUMNS,
  GOVERNANCE_ACTION_EVIDENCE_SELECTABLE_COLUMNS,
  GOVERNANCE_ACTION_ASSIGNMENT_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  GovernanceActionRow,
  GovernanceActionEvidenceRow,
  GovernanceActionAssignmentRow,
} from "@/lib/db/database-contract";
import type {
  GovernanceActionResult,
  GovernanceActionType,
  GovernanceActionPriority,
  GovernanceActionStatus,
} from "./types";

const ACTION_COLS   = GOVERNANCE_ACTION_SELECTABLE_COLUMNS.join(",");
const EVIDENCE_COLS = GOVERNANCE_ACTION_EVIDENCE_SELECTABLE_COLUMNS.join(",");
const ASSIGN_COLS   = GOVERNANCE_ACTION_ASSIGNMENT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): GovernanceActionResult<T> {
  return { ok: false, error: "Action not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): GovernanceActionResult<T> {
  return { ok: false, error: `Unable to ${action} action.`, failureClass: "persistence_failed" };
}

export async function dbCreateGovernanceAction(input: {
  workspaceId: string;
  signalId: string;
  actionType: GovernanceActionType;
  actionPriority: GovernanceActionPriority;
  title: string;
  description: string;
  recommendedOwnerType: string;
  recommendedOwnerId: string | null;
  recommendedDueDate: string;
  justification: string;
  confidenceScore: number;
}): Promise<GovernanceActionResult<GovernanceActionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_actions")
    .insert({
      workspace_id:           input.workspaceId,
      signal_id:              input.signalId,
      action_type:            input.actionType,
      action_priority:        input.actionPriority,
      action_status:          "generated",
      title:                  input.title,
      description:            input.description,
      recommended_owner_type: input.recommendedOwnerType,
      recommended_owner_id:   input.recommendedOwnerId,
      recommended_due_date:   input.recommendedDueDate,
      justification:          input.justification,
      confidence_score:       input.confidenceScore,
    })
    .select(ACTION_COLS)
    .single<GovernanceActionRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindGovernanceActionById(
  id: string,
  workspaceId: string
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_actions")
    .select(ACTION_COLS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single<GovernanceActionRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListGovernanceActions(input: {
  workspaceId: string;
  status?: GovernanceActionStatus;
  priority?: GovernanceActionPriority;
  actionType?: GovernanceActionType;
  signalId?: string;
  ownerId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<GovernanceActionResult<GovernanceActionRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("governance_actions")
    .select(ACTION_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.status)     query = query.eq("action_status", input.status);
  if (input.priority)   query = query.eq("action_priority", input.priority);
  if (input.actionType) query = query.eq("action_type", input.actionType);
  if (input.signalId)   query = query.eq("signal_id", input.signalId);
  if (input.ownerId)    query = query.eq("recommended_owner_id", input.ownerId);
  if (input.fromDate)   query = query.gte("created_at", input.fromDate);
  if (input.toDate)     query = query.lte("created_at", input.toDate);

  const { data, error } = await query;
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as GovernanceActionRow[] };
}

export async function dbUpdateGovernanceAction(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_actions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(ACTION_COLS)
    .single<GovernanceActionRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbCreateActionEvidence(input: {
  workspaceId: string;
  actionId: string;
  signalId?: string | null;
  recommendationId?: string | null;
  learningPatternId?: string | null;
  contributionWeight: number;
}): Promise<GovernanceActionResult<GovernanceActionEvidenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_action_evidence")
    .insert({
      workspace_id:        input.workspaceId,
      action_id:           input.actionId,
      signal_id:           input.signalId ?? null,
      recommendation_id:   input.recommendationId ?? null,
      learning_pattern_id: input.learningPatternId ?? null,
      contribution_weight: input.contributionWeight,
    })
    .select(EVIDENCE_COLS)
    .single<GovernanceActionEvidenceRow>();
  if (error || !data) return persistFailed("create evidence");
  return { ok: true, data };
}

export async function dbListActionEvidence(
  actionId: string,
  workspaceId: string
): Promise<GovernanceActionResult<GovernanceActionEvidenceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_action_evidence")
    .select(EVIDENCE_COLS)
    .eq("action_id", actionId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) return persistFailed("list evidence");
  return { ok: true, data: (data ?? []) as unknown as GovernanceActionEvidenceRow[] };
}

export async function dbCreateActionAssignment(input: {
  workspaceId: string;
  actionId: string;
  assignedTo: string;
}): Promise<GovernanceActionResult<GovernanceActionAssignmentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_action_assignments")
    .insert({
      workspace_id:      input.workspaceId,
      action_id:         input.actionId,
      assigned_to:       input.assignedTo,
      assignment_status: "assigned",
    })
    .select(ASSIGN_COLS)
    .single<GovernanceActionAssignmentRow>();
  if (error || !data) return persistFailed("create assignment");
  return { ok: true, data };
}

export async function dbListActionAssignments(
  actionId: string,
  workspaceId: string
): Promise<GovernanceActionResult<GovernanceActionAssignmentRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_action_assignments")
    .select(ASSIGN_COLS)
    .eq("action_id", actionId)
    .eq("workspace_id", workspaceId)
    .order("assigned_at", { ascending: false });
  if (error) return persistFailed("list assignments");
  return { ok: true, data: (data ?? []) as unknown as GovernanceActionAssignmentRow[] };
}

export async function dbCountGeneratedActionsForSignal(
  workspaceId: string,
  signalId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("governance_actions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("signal_id", signalId)
    .in("action_status", ["generated", "reviewed", "approved"]);
  return count ?? 0;
}
