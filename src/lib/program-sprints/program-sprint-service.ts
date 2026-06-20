import { createPlatformEvent } from "@/lib/platform-events";
import { dbArchiveProgramSprint, dbCreateProgramSprint, dbFindProgramSprintById, dbListProgramSprints, dbUpdateProgramSprint } from "./program-sprint-repository";
import type { CreateProgramSprintInput, ProgramSprintEventType, ProgramSprintResult, ProgramSprintRow, UpdateProgramSprintInput } from "./types";

const PROGRAM_ITEM_STATUSES = ["DRAFT", "BACKLOG", "READY", "IN_PROGRESS", "IN_REVIEW", "DONE", "ARCHIVED"] as const;

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): ProgramSprintResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitSprintEvent(
  sprint: ProgramSprintRow,
  eventType: ProgramSprintEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  const event = await createPlatformEvent({
    workspaceId: sprint.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: sprint.program_id,
    causationId: null,
    rawReferenceTable: "program_sprints",
    rawReferenceId: sprint.id,
    learningEligible: false,
    eventPayload: { sprintId: sprint.id, epicId: sprint.epic_id, programId: sprint.program_id, status: sprint.status, ...extraPayload },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: sprint };
}

export async function createProgramSprint(input: CreateProgramSprintInput): Promise<ProgramSprintResult<ProgramSprintRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.epicId)) return validation("epicId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!required(input.title)) return validation("title is required.");
  if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
  if (typeof input.number !== "number" || !Number.isInteger(input.number) || input.number <= 0) {
    return validation("number must be a positive integer.");
  }
  if (typeof input.orderIndex !== "number" || !Number.isInteger(input.orderIndex)) {
    return validation("orderIndex must be an integer.");
  }
  const status = input.status ?? "DRAFT";
  if (!PROGRAM_ITEM_STATUSES.includes(status as typeof PROGRAM_ITEM_STATUSES[number])) {
    return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
  }

  const result = await dbCreateProgramSprint({
    workspaceId: input.workspaceId,
    programId: input.programId,
    epicId: input.epicId,
    number: input.number,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    objective: input.objective?.trim() ?? null,
    status,
    orderIndex: input.orderIndex,
  });
  if (!result.ok) return result;
  return emitSprintEvent(result.data, "PROGRAM_SPRINT_CREATED", input.actorId);
}

export async function updateProgramSprint(
  sprintId: string,
  workspaceId: string,
  input: UpdateProgramSprintInput
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  if (!validUuid(sprintId)) return validation("sprintId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbFindProgramSprintById(sprintId, workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description?.trim() ?? null;
  if (input.objective !== undefined) patch.objective = input.objective?.trim() ?? null;
  if (input.status !== undefined) {
    if (!PROGRAM_ITEM_STATUSES.includes(input.status as typeof PROGRAM_ITEM_STATUSES[number])) {
      return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
    }
    if (input.status === "ARCHIVED") return validation("Use DELETE to archive a sprint.");
    patch.status = input.status;
  }
  if (input.orderIndex !== undefined) {
    if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    patch.order_index = input.orderIndex;
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const result = await dbUpdateProgramSprint(sprintId, workspaceId, patch);
  if (!result.ok) return result;
  return emitSprintEvent(result.data, "PROGRAM_SPRINT_UPDATED", input.actorId);
}

export async function archiveProgramSprint(
  sprintId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  if (!validUuid(sprintId)) return validation("sprintId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const result = await dbArchiveProgramSprint(sprintId, workspaceId);
  if (!result.ok) return result;
  return emitSprintEvent(result.data, "PROGRAM_SPRINT_ARCHIVED", actorId);
}

export async function getProgramSprint(
  sprintId: string,
  workspaceId: string
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  if (!validUuid(sprintId)) return validation("sprintId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindProgramSprintById(sprintId, workspaceId);
}

export async function listProgramSprints(
  epicId: string,
  workspaceId: string
): Promise<ProgramSprintResult<ProgramSprintRow[]>> {
  if (!validUuid(epicId)) return validation("epicId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListProgramSprints(epicId, workspaceId);
}
