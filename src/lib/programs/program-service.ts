import { createPlatformEvent } from "@/lib/platform-events";
import { dbArchiveProgram, dbCreateProgram, dbFindProgramById, dbListPrograms, dbUpdateProgram } from "./program-repository";
import { PROGRAM_STATUSES, PROGRAM_TYPES } from "./types";
import type { CreateProgramInput, ProgramEventType, ProgramExplanation, ProgramResult, ProgramRow, ProgramStatus, UpdateProgramInput } from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): ProgramResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitProgramEvent(
  program: ProgramRow,
  eventType: ProgramEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<ProgramResult<ProgramRow>> {
  const event = await createPlatformEvent({
    workspaceId: program.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: program.id,
    causationId: null,
    rawReferenceTable: "programs",
    rawReferenceId: program.id,
    learningEligible: false,
    eventPayload: { programId: program.id, programType: program.type, status: program.status, ...extraPayload },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: program };
}

export async function createProgram(input: CreateProgramInput): Promise<ProgramResult<ProgramRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.ownerId)) return validation("ownerId must be a UUID.");
  if (!required(input.name)) return validation("name is required.");
  if (input.name.trim().length > 200) return validation("name must be 200 characters or fewer.");
  if (!PROGRAM_TYPES.includes(input.type)) return validation(`type must be one of: ${PROGRAM_TYPES.join(", ")}.`);
  if (input.description !== undefined && input.description !== null && input.description.length > 5000) {
    return validation("description must be 5000 characters or fewer.");
  }
  const result = await dbCreateProgram({
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    type: input.type,
    ownerId: input.ownerId,
  });
  if (!result.ok) return result;
  return emitProgramEvent(result.data, "PROGRAM_CREATED", input.ownerId);
}

export async function updateProgram(
  programId: string,
  workspaceId: string,
  input: UpdateProgramInput
): Promise<ProgramResult<ProgramRow>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbFindProgramById(programId, workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!required(input.name)) return validation("name cannot be empty.");
    if (input.name.trim().length > 200) return validation("name must be 200 characters or fewer.");
    patch.name = input.name.trim();
  }
  if (input.description !== undefined) {
    if (input.description !== null && input.description.length > 5000) return validation("description must be 5000 characters or fewer.");
    patch.description = input.description?.trim() ?? null;
  }
  if (input.status !== undefined) {
    if (!PROGRAM_STATUSES.includes(input.status)) return validation(`status must be one of: ${PROGRAM_STATUSES.join(", ")}.`);
    if (input.status === "ARCHIVED") return validation("Use DELETE /programs/:id to archive a program.");
    patch.status = input.status;
  }
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.targetDate !== undefined) patch.target_date = input.targetDate;

  // Use the patched value when explicitly provided (including null clears), else fall back to current.
  const startDate = input.startDate !== undefined ? input.startDate : current.data.start_date;
  const targetDate = input.targetDate !== undefined ? input.targetDate : current.data.target_date;
  if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
    return validation("targetDate must be on or after startDate.");
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const result = await dbUpdateProgram(programId, workspaceId, patch);
  if (!result.ok) return result;

  const eventType: ProgramEventType =
    input.status !== undefined && input.status !== current.data.status
      ? "PROGRAM_STATUS_CHANGED"
      : "PROGRAM_UPDATED";

  return emitProgramEvent(result.data, eventType, input.actorId, {
    previousStatus: current.data.status,
  });
}

export async function archiveProgram(
  programId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramResult<ProgramRow>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const result = await dbArchiveProgram(programId, workspaceId);
  if (!result.ok) return result;
  return emitProgramEvent(result.data, "PROGRAM_ARCHIVED", actorId);
}

export async function getProgram(
  programId: string,
  workspaceId: string
): Promise<ProgramResult<ProgramRow>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindProgramById(programId, workspaceId);
}

export async function listPrograms(
  workspaceId: string
): Promise<ProgramResult<ProgramRow[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListPrograms(workspaceId);
}

export function explainProgram(program: ProgramRow): ProgramExplanation {
  const typeLabels: Record<string, string> = {
    SOFTWARE_DEVELOPMENT: "Software Development",
    INFRASTRUCTURE_PROJECT: "Infrastructure Project",
    CUSTOMER_ONBOARDING: "Customer Onboarding",
    AOC_PROTOCOL_ADOPTION: "AOC Protocol Adoption",
    ORGANIZATIONAL_CHANGE: "Organizational Change",
    STRATEGIC_INITIATIVE: "Strategic Initiative",
    INTERNAL_PROGRAM: "Internal Program",
    CUSTOM: "Custom",
  };
  return {
    id: program.id,
    name: program.name,
    type: program.type,
    status: program.status,
    owner: program.owner_id,
    createdAt: program.created_at,
    summary: `${program.name} is a ${typeLabels[program.type] ?? program.type} program currently in ${program.status.toLowerCase()} state.${program.description ? ` ${program.description}` : ""}`,
  };
}
