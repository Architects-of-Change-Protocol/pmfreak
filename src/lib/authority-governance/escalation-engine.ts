import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AuthorityResult,
  AuthorityEscalationRecord,
  CreateEscalationInput,
  ResolveEscalationInput,
  EscalationTarget,
} from "./types";

const COLUMNS =
  "id,workspace_id,trigger_type,action_entity_type,action_entity_id,action_type,required_authority,escalated_to,escalated_by,status,resolution,resolved_by,resolved_at,violation_id,created_at,updated_at";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): AuthorityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<AuthorityResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): AuthorityResult<T> {
  return { ok: false, error, failureClass };
}

// ─── createEscalation ───────────────────────────────────────────────────────

export async function createEscalation(
  input: CreateEscalationInput,
): Promise<AuthorityResult<AuthorityEscalationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.escalatedBy)) return validation("escalatedBy must be a UUID.");
  if (!input.requiredAuthority) return validation("requiredAuthority is required.");
  if (!input.actionType) return validation("actionType is required.");

  const escalatedTo: EscalationTarget = input.escalatedTo ?? "governance_board";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("authority_escalations")
    .insert({
      workspace_id: input.workspaceId,
      trigger_type: input.triggerType,
      action_entity_type: input.actionEntityType,
      action_entity_id: input.actionEntityId,
      action_type: input.actionType,
      required_authority: input.requiredAuthority,
      escalated_to: escalatedTo,
      escalated_by: input.escalatedBy,
      status: "pending",
      violation_id: input.violationId ?? null,
    })
    .select(COLUMNS)
    .single<AuthorityEscalationRecord>();

  if (error || !data) return failed("Unable to create escalation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.escalatedBy,
    actorType: "user",
    eventType: "AUTHORITY_ESCALATION_CREATED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_escalations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "confidential",
    eventPayload: {
      escalationId: data.id,
      triggerType: input.triggerType,
      actionEntityType: input.actionEntityType,
      actionEntityId: input.actionEntityId,
      requiredAuthority: input.requiredAuthority,
      escalatedTo,
      violationId: input.violationId ?? null,
    },
  });

  return { ok: true, data };
}

// ─── resolveEscalation ──────────────────────────────────────────────────────

export async function resolveEscalation(
  input: ResolveEscalationInput,
): Promise<AuthorityResult<AuthorityEscalationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.escalationId)) return validation("escalationId must be a UUID.");
  if (!validUuid(input.resolvedBy)) return validation("resolvedBy must be a UUID.");
  if (!input.resolution?.trim()) return validation("resolution text is required.");

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("authority_escalations")
    .update({
      status: "resolved",
      resolution: input.resolution,
      resolved_by: input.resolvedBy,
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", input.escalationId)
    .eq("workspace_id", input.workspaceId)
    .select(COLUMNS)
    .single<AuthorityEscalationRecord>();

  if (error || !data) return failed("Unable to resolve escalation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.resolvedBy,
    actorType: "user",
    eventType: "AUTHORITY_ESCALATION_RESOLVED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_escalations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      escalationId: data.id,
      resolvedBy: input.resolvedBy,
      resolution: input.resolution,
    },
  });

  return { ok: true, data };
}

// ─── listPendingEscalations ──────────────────────────────────────────────────

export async function listPendingEscalations(input: {
  workspaceId: string;
  escalatedTo?: EscalationTarget;
}): Promise<AuthorityResult<AuthorityEscalationRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("authority_escalations")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .in("status", ["pending", "acknowledged"]);

  if (input.escalatedTo) query = query.eq("escalated_to", input.escalatedTo);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .returns<AuthorityEscalationRecord[]>();

  if (error) return failed("Unable to list escalations.");
  return { ok: true, data: data ?? [] };
}

// ─── escalateFromViolation ───────────────────────────────────────────────────
// Creates an escalation automatically from a detected violation.

export async function escalateFromViolation(input: {
  workspaceId: string;
  violationId: string;
  actionEntityType: string;
  actionEntityId: string;
  actionType: string;
  requiredAuthority: string;
  escalatedBy: string;
  escalatedTo?: EscalationTarget;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<AuthorityResult<AuthorityEscalationRecord>> {
  return createEscalation({
    workspaceId: input.workspaceId,
    triggerType: "governance_violation",
    actionEntityType: input.actionEntityType,
    actionEntityId: input.actionEntityId,
    actionType: input.actionType,
    requiredAuthority: input.requiredAuthority,
    escalatedTo: input.escalatedTo ?? "governance_board",
    escalatedBy: input.escalatedBy,
    violationId: input.violationId,
    correlationId: input.correlationId,
    causationId: input.causationId,
  });
}
