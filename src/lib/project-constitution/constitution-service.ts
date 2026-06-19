import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transitionValidationFailure, validateConstitutionTransition } from "./state-machine";
import type {
  ConstitutionExport,
  ConstitutionLifecycleEventName,
  ConstitutionLifecycleHistoryEntry,
  ConstitutionListFilters,
  ConstitutionRecord,
  ConstitutionResult,
  ConstitutionStatus,
} from "./types";

const constitutionColumns = "id,workspace_id,project_id,title,description,current_status,status_changed_at,status_changed_by,lifecycle_version,created_by,created_at,updated_at,metadata";
const historyColumns = "id,workspace_id,constitution_id,from_status,to_status,changed_by,changed_at,reason,lifecycle_version_after,metadata";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
function required(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validation<T>(error: string): ConstitutionResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass: Extract<ConstitutionResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): ConstitutionResult<T> { return { ok: false, error, failureClass }; }

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
  payload: Record<string, unknown>,
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
    eventPayload: payload,
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: constitution };
}

async function emitStatusChangeEvents(
  constitution: ConstitutionRecord,
  specificEvent: ConstitutionLifecycleEventName,
  actorId: string,
  fromStatus: ConstitutionStatus,
  reason: string | null,
): Promise<ConstitutionResult<ConstitutionRecord>> {
  const sharedPayload = {
    constitutionId: constitution.id,
    projectId: constitution.project_id,
    fromStatus,
    toStatus: constitution.current_status,
    lifecycleVersion: constitution.lifecycle_version,
    reason: reason ?? null,
  };

  const specificResult = await emitConstitutionEvent(constitution, specificEvent, actorId, sharedPayload);
  if (!specificResult.ok) return specificResult;

  // Always emit the generic event alongside the specific one (unless it IS the generic)
  if (specificEvent !== "CONSTITUTION_STATUS_CHANGED") {
    const generic = await createPlatformEvent({
      workspaceId: constitution.workspace_id,
      projectId: constitution.project_id,
      actorId,
      actorType: "user",
      eventType: "CONSTITUTION_STATUS_CHANGED",
      eventCategory: "governance",
      source: "user_action",
      correlationId: constitution.id,
      causationId: null,
      rawReferenceTable: "project_constitutions",
      rawReferenceId: constitution.id,
      learningEligible: false,
      visibility: "workspace",
      sensitivityLevel: "internal",
      eventPayload: { ...sharedPayload, specificEvent },
    });
    if (!generic.ok) return { ok: false, error: generic.error, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: constitution };
}

// ─── Foundation: create ───────────────────────────────────────────────────────

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
  if (!required(input.title)) return validation("title is required.");

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

  return emitConstitutionEvent(data, "CONSTITUTION_CREATED", input.createdBy, {
    constitutionId: data.id,
    projectId: data.project_id,
    title: data.title,
    lifecycleVersion: data.lifecycle_version,
  });
}

// ─── Foundation: read ─────────────────────────────────────────────────────────

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

export async function listConstitutions(filters: ConstitutionListFilters): Promise<ConstitutionResult<ConstitutionRecord[]>> {
  if (!validUuid(filters.workspaceId)) return validation("workspaceId must be a UUID.");
  if (filters.projectId !== undefined && !validUuid(filters.projectId)) return validation("projectId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_constitutions")
    .select(constitutionColumns)
    .eq("workspace_id", filters.workspaceId);

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.status) {
    query = query.eq("current_status", filters.status);
  } else if (filters.excludeArchived !== false) {
    // By default exclude archived (soft-deleted) records
    query = query.neq("current_status", "archived");
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return failed("Unable to list project constitutions.");
  return { ok: true, data: (data ?? []) as ConstitutionRecord[] };
}

// ─── Foundation: update ───────────────────────────────────────────────────────

export async function updateConstitution(input: {
  constitutionId: string;
  workspaceId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ConstitutionResult<ConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getConstitution(input.constitutionId, input.workspaceId);
  if (!current.ok) return current;

  // Soft-delete guard: archived constitutions are read-only
  if (current.data.current_status === "archived") {
    return failed("Archived constitutions are read-only and cannot be updated.", "governance_violation");
  }

  // Only draft constitutions allow direct edits; others require amendment governance
  if (current.data.current_status !== "draft") {
    return failed(
      `Constitution in status '${current.data.current_status}' cannot be directly edited; use the amendment process.`,
      "governance_violation",
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  if (Object.keys(patch).length === 1) return { ok: true, data: current.data };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .update(patch)
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .select(constitutionColumns)
    .single<ConstitutionRecord>();

  if (error || !data) return failed("Unable to update project constitution.");

  return emitConstitutionEvent(data, "CONSTITUTION_UPDATED", input.actorId, {
    constitutionId: data.id,
    projectId: data.project_id,
    updatedFields: Object.keys(patch).filter((k) => k !== "updated_at"),
    lifecycleVersion: data.lifecycle_version,
  });
}

// ─── Lifecycle: change status ─────────────────────────────────────────────────

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
  return emitStatusChangeEvents(updated, specificEvent, input.actorId, current.data.current_status, input.reason ?? null);
}

// ─── Lifecycle: history ───────────────────────────────────────────────────────

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

// ─── Foundation: export ───────────────────────────────────────────────────────

export async function exportConstitution(input: {
  constitutionId: string;
  workspaceId: string;
}): Promise<ConstitutionResult<ConstitutionExport>> {
  const constitution = await getConstitution(input.constitutionId, input.workspaceId);
  if (!constitution.ok) return constitution;

  const history = await getConstitutionLifecycleHistory(input);
  if (!history.ok) return history;

  return {
    ok: true,
    data: {
      constitution: constitution.data,
      lifecycleHistory: history.data,
      exportedAt: new Date().toISOString(),
    },
  };
}

export { explainConstitutionLifecycle } from "./lifecycle-explanation";
