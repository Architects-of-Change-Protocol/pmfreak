import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transitionValidationFailure, validateConstitutionTransition } from "./state-machine";
import type {
  ConstitutionLifecycleEventName,
  ConstitutionLifecycleHistoryEntry,
  ConstitutionRecord,
  ConstitutionResult,
  ConstitutionStatus,
} from "./types";

const constitutionColumns = "id,workspace_id,project_id,title,description,current_status,status_changed_at,status_changed_by,lifecycle_version,created_by,created_at,updated_at,metadata";
const historyColumns = "id,workspace_id,constitution_id,from_status,to_status,changed_by,changed_at,reason,lifecycle_version_after,metadata";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
function validation<T>(error: string): ConstitutionResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass: ConstitutionResult<never>["failureClass"] = "persistence_failed"): ConstitutionResult<T> { return { ok: false, error, failureClass }; }

function eventTypeForTransition(to: ConstitutionStatus): ConstitutionLifecycleEventName {
  const map: Record<ConstitutionStatus, ConstitutionLifecycleEventName> = {
    proposed:  "CONSTITUTION_PROPOSED",
    approved:  "CONSTITUTION_APPROVED",
    active:    "CONSTITUTION_ACTIVATED",
    suspended: "CONSTITUTION_SUSPENDED",
    closed:    "CONSTITUTION_CLOSED",
    archived:  "CONSTITUTION_ARCHIVED",
    draft:     "CONSTITUTION_STATUS_CHANGED",
  };
  return map[to];
}

async function emitConstitutionEvent(
  constitution: ConstitutionRecord,
  eventType: ConstitutionLifecycleEventName,
  actorId: string,
  fromStatus: ConstitutionStatus,
  reason: string | null,
): Promise<ConstitutionResult<ConstitutionRecord>> {
  const event = await createPlatformEvent({
    workspaceId: constitution.workspace_id,
    projectId: constitution.project_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: constitution.id,
    causationId: null,
    rawReferenceTable: "project_constitutions",
    rawReferenceId: constitution.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      constitutionId: constitution.id,
      projectId: constitution.project_id,
      fromStatus,
      toStatus: constitution.current_status,
      lifecycleVersion: constitution.lifecycle_version,
      reason: reason ?? null,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };

  // Always emit the generic event alongside the specific one
  if (eventType !== "CONSTITUTION_STATUS_CHANGED") {
    const generic = await createPlatformEvent({
      workspaceId: constitution.workspace_id,
      projectId: constitution.project_id,
      actorId,
      actorType: "user",
      eventType: "CONSTITUTION_STATUS_CHANGED",
      eventCategory: "governance",
      source: "user_action",
      correlationId: constitution.id,
      causationId: event.event.id,
      rawReferenceTable: "project_constitutions",
      rawReferenceId: constitution.id,
      learningEligible: false,
      visibility: "workspace",
      sensitivityLevel: "internal",
      eventPayload: {
        constitutionId: constitution.id,
        projectId: constitution.project_id,
        fromStatus,
        toStatus: constitution.current_status,
        lifecycleVersion: constitution.lifecycle_version,
        specificEvent: eventType,
        reason: reason ?? null,
      },
    });
    if (!generic.ok) return { ok: false, error: generic.error, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: constitution };
}

export async function createConstitution(input: {
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string | null;
  createdBy: string;
  metadata?: Record<string, unknown>;
}): Promise<ConstitutionResult<ConstitutionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId)) return validation("projectId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (typeof input.title !== "string" || input.title.trim().length === 0) return validation("title is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description ?? null,
      current_status: "draft" as ConstitutionStatus,
      status_changed_at: new Date().toISOString(),
      status_changed_by: input.createdBy,
      lifecycle_version: 1,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(constitutionColumns)
    .single<ConstitutionRecord>();

  if (error || !data) return failed("Unable to create project constitution.");
  return { ok: true, data };
}

export async function getConstitution(constitutionId: string, workspaceId: string): Promise<ConstitutionResult<ConstitutionRecord>> {
  if (!validUuid(constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .select(constitutionColumns)
    .eq("id", constitutionId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionRecord>();

  if (error || !data) return failed("Project constitution not found.", "not_found");
  return { ok: true, data };
}

export async function changeConstitutionStatus(input: {
  constitutionId: string;
  workspaceId: string;
  targetStatus: ConstitutionStatus;
  actorId: string;
  reason?: string | null;
}): Promise<ConstitutionResult<ConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID (authenticated actor required).");

  const current = await getConstitution(input.constitutionId, input.workspaceId);
  if (!current.ok) return current;

  const transition = validateConstitutionTransition(current.data.current_status, input.targetStatus);
  if (!transition.ok) return transitionValidationFailure(transition.error);

  const newVersion = current.data.lifecycle_version + 1;
  const now = new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  const { data: updated, error: updateError } = await supabase
    .from("project_constitutions")
    .update({
      current_status: input.targetStatus,
      status_changed_at: now,
      status_changed_by: input.actorId,
      lifecycle_version: newVersion,
      updated_at: now,
    })
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .select(constitutionColumns)
    .single<ConstitutionRecord>();

  if (updateError || !updated) return failed("Unable to update constitution status.");

  const { error: historyError } = await supabase
    .from("constitution_lifecycle_history")
    .insert({
      workspace_id: input.workspaceId,
      constitution_id: input.constitutionId,
      from_status: current.data.current_status,
      to_status: input.targetStatus,
      changed_by: input.actorId,
      changed_at: now,
      reason: input.reason ?? null,
      lifecycle_version_after: newVersion,
      metadata: {},
    });

  if (historyError) return failed("Unable to record lifecycle history.");

  const specificEvent = eventTypeForTransition(input.targetStatus);
  return emitConstitutionEvent(updated, specificEvent, input.actorId, current.data.current_status, input.reason ?? null);
}

export async function getConstitutionLifecycleHistory(input: {
  constitutionId: string;
  workspaceId: string;
}): Promise<ConstitutionResult<ConstitutionLifecycleHistoryEntry[]>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  // Verify workspace isolation before querying history
  const constitutionCheck = await getConstitution(input.constitutionId, input.workspaceId);
  if (!constitutionCheck.ok) return constitutionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitution_lifecycle_history")
    .select(historyColumns)
    .eq("constitution_id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .order("changed_at", { ascending: true });

  if (error) return failed("Unable to retrieve lifecycle history.");
  return { ok: true, data: data as ConstitutionLifecycleHistoryEntry[] };
}

export { explainConstitutionLifecycle } from "./lifecycle-explanation";
