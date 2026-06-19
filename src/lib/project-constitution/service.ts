import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ChangeProjectConstitutionStatusInput,
  CreateProjectConstitutionInput,
  ProjectConstitutionLifecycleEvent,
  ProjectConstitutionRecord,
  ProjectConstitutionStatus,
  ProjectConstitutionSummary,
  Result,
  SoftDeleteProjectConstitutionInput,
  UpdateProjectConstitutionInput,
} from "./types";

const STATUSES: ProjectConstitutionStatus[] = ["draft", "active", "on_hold", "completed", "cancelled"];

const columns =
  "id,workspace_id,name,description,status,sponsor,client,pm_responsible_id,objectives,constraints,start_date,target_end_date,created_by,created_at,updated_at,deleted_at,metadata";

const summaryColumns =
  "id,workspace_id,name,status,sponsor,client,pm_responsible_id,start_date,target_end_date,created_at,updated_at";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function requiredText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validIsoDate(value: string | null | undefined): boolean {
  if (value == null) return true;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}
function validation<T>(error: string): Result<T> { return { ok: false, error, failureClass: "validation_failed" }; }

async function emitConstitutionEvent(
  record: ProjectConstitutionRecord,
  eventType: ProjectConstitutionLifecycleEvent,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
  payload: Record<string, unknown> = {},
): Promise<Result<ProjectConstitutionRecord>> {
  const event = await createPlatformEvent({
    workspaceId: record.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: correlationId ?? record.id,
    causationId: causationId ?? null,
    rawReferenceTable: "project_constitutions",
    rawReferenceId: record.id,
    eventPayload: {
      constitutionId: record.id,
      name: record.name,
      status: record.status,
      ...payload,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: record };
}

export async function createProjectConstitution(input: CreateProjectConstitutionInput): Promise<Result<ProjectConstitutionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!requiredText(input.name)) return validation("name is required.");
  if (input.pmResponsibleId != null && !validUuid(input.pmResponsibleId)) return validation("pmResponsibleId must be a UUID.");
  if (!validIsoDate(input.startDate)) return validation("startDate must be a valid ISO date (YYYY-MM-DD).");
  if (!validIsoDate(input.targetEndDate)) return validation("targetEndDate must be a valid ISO date (YYYY-MM-DD).");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_constitutions")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      status: "draft",
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

  if (error || !data) return { ok: false, error: "Unable to create project constitution.", failureClass: "persistence_failed" };
  return emitConstitutionEvent(data, "PROJECT_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function updateProjectConstitution(input: UpdateProjectConstitutionInput): Promise<Result<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.updatedBy)) return validation("updatedBy must be a UUID.");
  if (input.name !== undefined && !requiredText(input.name)) return validation("name cannot be empty.");
  if (input.pmResponsibleId != null && !validUuid(input.pmResponsibleId)) return validation("pmResponsibleId must be a UUID.");
  if (!validIsoDate(input.startDate)) return validation("startDate must be a valid ISO date (YYYY-MM-DD).");
  if (!validIsoDate(input.targetEndDate)) return validation("targetEndDate must be a valid ISO date (YYYY-MM-DD).");

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

  if (error || !data) return { ok: false, error: "Project constitution not found or update failed.", failureClass: "persistence_failed" };
  return emitConstitutionEvent(data, "PROJECT_UPDATED", input.updatedBy, input.correlationId, input.causationId, { updatedBy: input.updatedBy });
}

export async function changeProjectConstitutionStatus(input: ChangeProjectConstitutionStatusInput): Promise<Result<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.changedBy)) return validation("changedBy must be a UUID.");
  if (!STATUSES.includes(input.status)) return validation(`status must be one of: ${STATUSES.join(", ")}.`);

  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase
    .from("project_constitutions")
    .select(columns)
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .single<ProjectConstitutionRecord>();

  if (readError || !current) return { ok: false, error: "Project constitution not found.", failureClass: "not_found" };
  if (current.status === input.status) return { ok: true, data: current };

  const { data, error } = await supabase
    .from("project_constitutions")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return { ok: false, error: "Unable to change project constitution status.", failureClass: "persistence_failed" };
  return emitConstitutionEvent(data, "PROJECT_STATUS_CHANGED", input.changedBy, input.correlationId, input.causationId, { previousStatus: current.status, newStatus: input.status });
}

export async function softDeleteProjectConstitution(input: SoftDeleteProjectConstitutionInput): Promise<Result<ProjectConstitutionRecord>> {
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.deletedBy)) return validation("deletedBy must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const deletedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_constitutions")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", input.constitutionId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .select(columns)
    .single<ProjectConstitutionRecord>();

  if (error || !data) return { ok: false, error: "Project constitution not found or already deleted.", failureClass: "not_found" };
  return emitConstitutionEvent(data, "PROJECT_ARCHIVED", input.deletedBy, input.correlationId, input.causationId, { deletedBy: input.deletedBy, deletedAt });
}

export async function getProjectConstitution(constitutionId: string, workspaceId: string): Promise<Result<ProjectConstitutionRecord>> {
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

  if (error || !data) return { ok: false, error: "Project constitution not found.", failureClass: "not_found" };
  return { ok: true, data };
}

export async function listProjectConstitutions(workspaceId: string, status?: ProjectConstitutionStatus): Promise<Result<ProjectConstitutionSummary[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (status !== undefined && !STATUSES.includes(status)) return validation(`status must be one of: ${STATUSES.join(", ")}.`);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_constitutions")
    .select(summaryColumns)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (status !== undefined) query = query.eq("status", status);

  const { data, error } = await query.returns<ProjectConstitutionSummary[]>();
  if (error || !data) return { ok: false, error: "Unable to list project constitutions.", failureClass: "persistence_failed" };
  return { ok: true, data };
}
