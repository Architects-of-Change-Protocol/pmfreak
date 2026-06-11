import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";

export type DecisionInput = {
  actionId: string;
  decision: "accepted" | "rejected" | "deferred" | "converted_to_task";
  reason?: string;
  deferredUntil?: string;
  convertedTaskId?: string;
  metadata?: Record<string, unknown>;
};

type RecommendedActionRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  status: string;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  deferred_until: string | null;
  converted_task_id: string | null;
  decision_metadata: Record<string, unknown>;
  updated_at: string;
  governance_event_id: string | null;
};

export type RecommendedActionDecisionResult =
  | { ok: true; action: RecommendedActionRow; decisionId: string }
  | { ok: false; error: string; failureClass: string };

const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ["accepted", "rejected", "deferred", "converted_to_task"],
  deferred: ["accepted", "rejected", "converted_to_task"],
  accepted: ["converted_to_task"],
  rejected: [],
  converted_to_task: [],
};

export async function decideRecommendedAction(
  input: DecisionInput
): Promise<RecommendedActionDecisionResult> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: action, error: loadError } = await supabase
    .from("recommended_actions")
    .select("id,workspace_id,project_id,status,decision_reason,decided_by,decided_at,deferred_until,converted_task_id,decision_metadata,updated_at,governance_event_id")
    .eq("id", input.actionId)
    .maybeSingle<RecommendedActionRow>();

  if (loadError) {
    return { ok: false, error: "Unable to load recommended action.", failureClass: "persistence_failed" };
  }
  if (!action) {
    return { ok: false, error: "Recommended action not found.", failureClass: "not_found" };
  }

  if (action.governance_event_id) {
    return { ok: false, error: "Governed recommendations must be decided through the evidence-backed operational decision flow.", failureClass: "governed_flow_required" };
  }

  try {
    await requireProjectAccess(action.project_id, "write");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization check failed.", failureClass: "unauthorized" };
  }

  const allowedTransitions = VALID_TRANSITIONS[action.status] ?? [];
  if (!allowedTransitions.includes(input.decision)) {
    return {
      ok: false,
      error: `Cannot transition from '${action.status}' to '${input.decision}'.`,
      failureClass: "invalid_transition",
    };
  }

  if (input.decision === "deferred" && !input.deferredUntil) {
    return { ok: false, error: "deferredUntil is required when deferring.", failureClass: "validation_failed" };
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: input.decision,
    decision_reason: input.reason ?? null,
    decided_by: userId,
    decided_at: now,
    decision_metadata: input.metadata ?? {},
    updated_at: now,
  };

  if (input.decision === "deferred") {
    updatePayload.deferred_until = input.deferredUntil;
  }
  if (input.decision === "converted_to_task" && input.convertedTaskId) {
    updatePayload.converted_task_id = input.convertedTaskId;
  }

  const { data: updatedAction, error: updateError } = await supabase
    .from("recommended_actions")
    .update(updatePayload)
    .eq("id", input.actionId)
    .select("id,workspace_id,project_id,status,decision_reason,decided_by,decided_at,deferred_until,converted_task_id,decision_metadata,updated_at")
    .single<RecommendedActionRow>();

  if (updateError || !updatedAction) {
    return { ok: false, error: "Unable to persist decision.", failureClass: "persistence_failed" };
  }

  const { data: decisionRow, error: auditError } = await supabase
    .from("recommended_action_decisions")
    .insert({
      workspace_id: action.workspace_id,
      project_id: action.project_id,
      recommended_action_id: action.id,
      previous_status: action.status,
      new_status: input.decision,
      decision_reason: input.reason ?? null,
      decision_metadata: input.metadata ?? {},
      decided_by: userId,
      decided_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (auditError || !decisionRow) {
    console.error("recommended_actions.audit_failed", {
      actionId: action.id,
      previousStatus: action.status,
      newStatus: input.decision,
      error: auditError?.message ?? "no row returned",
    });
    return { ok: false, error: "Decision applied but audit record failed.", failureClass: "persistence_failed" };
  }

  console.info("recommended_actions.decision_recorded", {
    actionId: action.id,
    projectId: action.project_id,
    previousStatus: action.status,
    newStatus: input.decision,
    decidedBy: userId,
    decisionId: decisionRow.id,
  });

  return { ok: true, action: updatedAction, decisionId: decisionRow.id };
}
