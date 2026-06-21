import { createPlatformEvent } from "@/lib/platform-events";
import { dbArchiveProgramEpic, dbCreateProgramEpic, dbFindProgramEpicById, dbListProgramEpics, dbUpdateProgramEpic } from "./program-epic-repository";
import { PROGRAM_ITEM_STATUSES } from "./types";
import type { CreateProgramEpicInput, ProgramEpicEventType, ProgramEpicResult, ProgramEpicRow, UpdateProgramEpicInput } from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): ProgramEpicResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitEpicEvent(
  epic: ProgramEpicRow,
  eventType: ProgramEpicEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  const event = await createPlatformEvent({
    workspaceId: epic.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: epic.program_id,
    causationId: null,
    rawReferenceTable: "program_epics",
    rawReferenceId: epic.id,
    learningEligible: false,
    eventPayload: { epicId: epic.id, programId: epic.program_id, status: epic.status, ...extraPayload },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: epic };
}

export async function createProgramEpic(input: CreateProgramEpicInput): Promise<ProgramEpicResult<ProgramEpicRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
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
  if (!PROGRAM_ITEM_STATUSES.includes(status)) {
    return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
  }

  const result = await dbCreateProgramEpic({
    workspaceId: input.workspaceId,
    programId: input.programId,
    number: input.number,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    status,
    orderIndex: input.orderIndex,
  });
  if (!result.ok) return result;
  return emitEpicEvent(result.data, "PROGRAM_EPIC_CREATED", input.actorId);
}

export async function updateProgramEpic(
  epicId: string,
  workspaceId: string,
  input: UpdateProgramEpicInput
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  if (!validUuid(epicId)) return validation("epicId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbFindProgramEpicById(epicId, workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() ?? null;
  }
  if (input.status !== undefined) {
    if (!PROGRAM_ITEM_STATUSES.includes(input.status)) {
      return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
    }
    if (input.status === "ARCHIVED") return validation("Use DELETE to archive an epic.");
    patch.status = input.status;
  }
  if (input.orderIndex !== undefined) {
    if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    patch.order_index = input.orderIndex;
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const result = await dbUpdateProgramEpic(epicId, workspaceId, patch);
  if (!result.ok) return result;
  return emitEpicEvent(result.data, "PROGRAM_EPIC_UPDATED", input.actorId);
}

export async function archiveProgramEpic(
  epicId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  if (!validUuid(epicId)) return validation("epicId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const result = await dbArchiveProgramEpic(epicId, workspaceId);
  if (!result.ok) return result;
  return emitEpicEvent(result.data, "PROGRAM_EPIC_ARCHIVED", actorId);
}

export async function getProgramEpic(
  epicId: string,
  workspaceId: string
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  if (!validUuid(epicId)) return validation("epicId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindProgramEpicById(epicId, workspaceId);
}

export async function listProgramEpics(
  programId: string,
  workspaceId: string
): Promise<ProgramEpicResult<ProgramEpicRow[]>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListProgramEpics(programId, workspaceId);
}
