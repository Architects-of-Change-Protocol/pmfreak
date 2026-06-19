// ─────────────────────────────────────────────────────────────────────────────
// Project Constitution — unified service
// Foundation CRUD (Sprint 1) + Lifecycle Governance (Sprint 2)
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transitionValidationFailure, validateConstitutionTransition } from "./state-machine";
import type {
  ConstitutionExport,
  ConstitutionLifecycleEventName,
  ConstitutionLifecycleHistoryEntry,
  ConstitutionListFilters,
  ConstitutionResult,
  ConstitutionStatus,
  CreateProjectConstitutionInput,
  ProjectConstitutionRecord,
  ProjectConstitutionSummary,
  SoftDeleteProjectConstitutionInput,
  UpdateProjectConstitutionInput,
} from "./types";

// ─── Column lists ─────────────────────────────────────────────────────────────

const columns =
  "id,workspace_id,project_id,name,description,sponsor,client,pm_responsible_id,objectives,constraints,start_date,target_end_date,created_by,created_at,updated_at,deleted_at,metadata,status,current_status,status_changed_at,status_changed_by,lifecycle_version";

const summaryColumns =
  "id,workspace_id,project_id,name,current_status,sponsor,client,pm_responsible_id,start_date,target_end_date,lifecycle_version,created_at,updated_at";

const historyColumns =
  "id,workspace_id,constitution_id,from_status,to_status,changed_by,changed_at,reason,lifecycle_version_after,metadata";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function requiredText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validIsoDate(value: string | null | undefined): boolean {
  if (value == null) return true;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}
function validation<T>(error: string): ConstitutionResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function persistence<T>(error: string): ConstitutionResult<T> { return { ok: false, error, failureClass: "persistence_failed" }; }
function notFound<T>(error: string): ConstitutionResult<T> { return { ok: false, error, failureClass: "not_found" }; }

// ─── Shared audit event emitter ───────────────────────────────────────────────

async function emitConstitutionEvent(
  record: ProjectConstitutionRecord,
  eventType: ConstitutionLifecycleEventName,
  actorId: string,
  correlationId: string | null | undefined,
  causationId: string | null | undefined,
  payload: Record<string, unknown> = {},
): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  const event = await createPlatformEvent({
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: correlationId ?? record.id,
    causationId: causationId ?? null,
    rawReferenceTable: "project_constitutions",
    rawReferenceId: record.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      constitutionId: record.id,
      name: record.name,
      currentStatus: record.current_status,
      lifecycleVersion: record.lifecycle_version,
      ...payload,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: record };
}

// ─── Foundation: create ───────────────────────────────────────────────────────

export async function createProjectConstitution(input: CreateProjectConstitutionInput): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!requiredText(input.name)) return validation("name is required.");
  if (input.projectId != null && !validUuid(input.projectId)) return validation("projectId must be a UUID.");
  if (input.pmResponsibleId != null && !validUuid(input.pmResponsibleId)) return validation("pmResponsibleId must be a UUID.");
  if (!validIsoDate(input.startDate)) return validation("startDate must be a valid ISO date (YYYY-MM-DD).");
  if (!validIsoDate(input.targetEndDate)) return validation("targetEndDate must be a valid ISO date (YYYY-MM-DD).");

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      status: "draft",
      current_status: "draft" as ConstitutionStatus,
      status_changed_at: now,
      status_changed_by: input.createdBy,
      lifecycle_version: 1,
      sponsor: input.sponsor?.trim() ?? null,
      client: input.client?.trim() ?? null,
      pm_responsible_id: input.pmResponsibleId ?? null,
      objectives: input.objectives ?? [],
      constraints: input.constraints ?? [],
      start_date: input.startDate ?? null,
      target_end_date: input.targetEndDate ?? null,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return persistence("Unable to create project constitution.");
  return emitConstitutionEvent(data, "CONSTITUTION_CREATED", input.createdBy, input.correlationId, input.causationId);
}

// ─── Foundation: read ─────────────────────────────────────────────────────────

export async function getProjectConstitution(constitutionId: string, workspaceId: string): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  if (!validUuid(constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .select(columns)
    .eq("id", constitutionId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return notFound("Project constitution not found.");
  return { ok: true, data };
}

export async function listProjectConstitutions(workspaceId: string, status?: ConstitutionStatus): Promise<ConstitutionResult<ProjectConstitutionSummary[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_constitutions")
    .select(summaryColumns)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (status !== undefined) query = query.eq("current_status", status);

  const { data, error } = await query.returns<ProjectConstitutionSummary[]>();
  if (error || !data) return persistence("Unable to list project constitutions.");
  return { ok: true, data };
}

export async function listConstitutions(filters: ConstitutionListFilters): Promise<ConstitutionResult<ProjectConstitutionSummary[]>> {
  if (!validUuid(filters.workspaceId)) return validation("workspaceId must be a UUID.");
  if (filters.projectId !== undefined && !validUuid(filters.projectId)) return validation("projectId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_constitutions")
    .select(summaryColumns)
    .eq("workspace_id", filters.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.status) {
    query = query.eq("current_status", filters.status);
  } else if (filters.excludeArchived !== false) {
    query = query.neq("current_status", "archived");
  }

  const { data, error } = await query.returns<ProjectConstitutionSummary[]>();
  if (error || !data) return persistence("Unable to list project constitutions.");
  return { ok: true, data };
}

// ─── Foundation: update ───────────────────────────────────────────────────────

export async function updateProjectConstitution(input: UpdateProjectConstitutionInput): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.updatedBy)) return validation("updatedBy must be a UUID.");
  if (input.name !== undefined && !requiredText(input.name)) return validation("name cannot be empty.");
  if (input.pmResponsibleId != null && !validUuid(input.pmResponsibleId)) return validation("pmResponsibleId must be a UUID.");
  if (!validIsoDate(input.startDate)) return validation("startDate must be a valid ISO date (YYYY-MM-DD).");
  if (!validIsoDate(input.targetEndDate)) return validation("targetEndDate must be a valid ISO date (YYYY-MM-DD).");

  const current = await getProjectConstitution(input.constitutionId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.current_status === "archived") {
    return { ok: false, error: "Archived constitutions are read-only and cannot be updated.", failureClass: "governance_violation" };
  }
  if (current.data.current_status !== "draft") {
    return { ok: false, error: `Constitution in status '${current.data.current_status}' cannot be directly edited; use the amendment process.`, failureClass: "governance_violation" };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if ("description" in input) patch.description = input.description?.trim() ?? null;
  if ("sponsor" in input) patch.sponsor = input.sponsor?.trim() ?? null;
  if ("client" in input) patch.client = input.client?.trim() ?? null;
  if ("pmResponsibleId" in input) patch.pm_responsible_id = input.pmResponsibleId ?? null;
  if (input.objectives !== undefined) patch.objectives = input.objectives;
  if (input.constraints !== undefined) patch.constraints = input.constraints;
  if ("startDate" in input) patch.start_date = input.startDate ?? null;
  if ("targetEndDate" in input) patch.target_end_date = input.targetEndDate ?? null;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .update(patch)
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return persistence("Unable to update project constitution.");
  return emitConstitutionEvent(data, "CONSTITUTION_UPDATED", input.updatedBy, input.correlationId, input.causationId, {
    updatedBy: input.updatedBy,
    updatedFields: Object.keys(patch).filter((k) => k !== "updated_at"),
  });
}

// ─── Foundation: soft delete ──────────────────────────────────────────────────

export async function softDeleteProjectConstitution(input: SoftDeleteProjectConstitutionInput): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.deletedBy)) return validation("deletedBy must be a UUID.");

  const current = await getProjectConstitution(input.constitutionId, input.workspaceId);
  if (!current.ok) return current;

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  // Attempt lifecycle transition to archived (validated by state machine)
  const canArchive = validateConstitutionTransition(current.data.current_status, "archived");
  const lifecyclePatch: Record<string, unknown> = {};
  if (canArchive.ok) {
    lifecyclePatch.current_status = "archived";
    lifecyclePatch.status_changed_at = now;
    lifecyclePatch.status_changed_by = input.deletedBy;
    lifecyclePatch.lifecycle_version = current.data.lifecycle_version + 1;
  }

  const { data, error } = await supabase
    .from("project_constitutions")
    .update({ deleted_at: now, updated_at: now, ...lifecyclePatch })
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return notFound("Project constitution not found or already deleted.");

  if (canArchive.ok) {
    const { error: historyError } = await supabase
      .from("constitution_lifecycle_history")
      .insert({
        workspace_id: input.workspaceId,
        constitution_id: input.constitutionId,
        from_status: current.data.current_status,
        to_status: "archived",
        changed_by: input.deletedBy,
        changed_at: now,
        reason: "Soft deleted",
        lifecycle_version_after: data.lifecycle_version,
        metadata: {},
      });
    if (historyError) return persistence("Unable to record lifecycle history on soft delete.");
  }

  return emitConstitutionEvent(data, "CONSTITUTION_ARCHIVED", input.deletedBy, input.correlationId, input.causationId, {
    deletedBy: input.deletedBy,
    deletedAt: now,
  });
}

// ─── Lifecycle: change status ─────────────────────────────────────────────────

export async function changeConstitutionStatus(input: {
  constitutionId: string;
  workspaceId: string;
  targetStatus: ConstitutionStatus;
  actorId: string;
  reason?: string | null;
}): Promise<ConstitutionResult<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID (authenticated actor required).");

  const current = await getProjectConstitution(input.constitutionId, input.workspaceId);
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
    .is("deleted_at", null)
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (updateError || !updated) return persistence("Unable to update constitution status.");

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

  if (historyError) return persistence("Unable to record lifecycle history.");

  const specificEvent = eventTypeForTransition(input.targetStatus);

  // Emit specific event
  const specificResult = await emitConstitutionEvent(updated, specificEvent, input.actorId, null, null, {
    fromStatus: current.data.current_status,
    toStatus: input.targetStatus,
    lifecycleVersion: newVersion,
    reason: input.reason ?? null,
  });
  if (!specificResult.ok) return specificResult;

  // Emit generic CONSTITUTION_STATUS_CHANGED alongside specific (unless it IS the generic)
  if (specificEvent !== "CONSTITUTION_STATUS_CHANGED") {
    const generic = await createPlatformEvent({
      workspaceId: updated.workspace_id,
      projectId: updated.project_id,
      actorId: input.actorId,
      actorType: "user",
      eventType: "CONSTITUTION_STATUS_CHANGED",
      eventCategory: "governance",
      source: "user_action",
      correlationId: updated.id,
      causationId: null,
      rawReferenceTable: "project_constitutions",
      rawReferenceId: updated.id,
      learningEligible: false,
      visibility: "workspace",
      sensitivityLevel: "internal",
      eventPayload: {
        constitutionId: updated.id,
        name: updated.name,
        fromStatus: current.data.current_status,
        toStatus: input.targetStatus,
        lifecycleVersion: newVersion,
        specificEvent,
        reason: input.reason ?? null,
      },
    });
    if (!generic.ok) return { ok: false, error: generic.error, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}

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

// ─── Lifecycle: history ───────────────────────────────────────────────────────

export async function getConstitutionLifecycleHistory(input: {
  constitutionId: string;
  workspaceId: string;
}): Promise<ConstitutionResult<ConstitutionLifecycleHistoryEntry[]>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const constitutionCheck = await getProjectConstitution(input.constitutionId, input.workspaceId);
  if (!constitutionCheck.ok) return constitutionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitution_lifecycle_history")
    .select(historyColumns)
    .eq("constitution_id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .order("changed_at", { ascending: true });

  if (error) return persistence("Unable to retrieve lifecycle history.");
  return { ok: true, data: data as ConstitutionLifecycleHistoryEntry[] };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportConstitution(input: {
  constitutionId: string;
  workspaceId: string;
}): Promise<ConstitutionResult<ConstitutionExport>> {
  const constitution = await getProjectConstitution(input.constitutionId, input.workspaceId);
  if (!constitution.ok) return constitution;
  const history = await getConstitutionLifecycleHistory(input);
  if (!history.ok) return history;
  return { ok: true, data: { constitution: constitution.data, lifecycleHistory: history.data, exportedAt: new Date().toISOString() } };
}

// ─── Re-export lifecycle explain ──────────────────────────────────────────────
export { explainConstitutionLifecycle } from "./lifecycle-explanation";
