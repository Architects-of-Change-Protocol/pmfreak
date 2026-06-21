import { createPlatformEvent } from "@/lib/platform-events";
import { dbArchiveProgramCard, dbCreateProgramCard, dbFindProgramCardById, dbListProgramCards, dbUpdateProgramCard } from "./program-card-repository";
import { PROGRAM_CARD_TYPES, PROGRAM_ITEM_STATUSES_CARDS } from "./types";
import type { CreateProgramCardInput, ProgramCardEventType, ProgramCardResult, ProgramCardRow, UpdateProgramCardInput } from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): ProgramCardResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitCardEvent(
  card: ProgramCardRow,
  eventType: ProgramCardEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<ProgramCardResult<ProgramCardRow>> {
  const event = await createPlatformEvent({
    workspaceId: card.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: card.program_id,
    causationId: null,
    rawReferenceTable: "program_cards",
    rawReferenceId: card.id,
    learningEligible: false,
    eventPayload: { cardId: card.id, programId: card.program_id, type: card.type, status: card.status, ...extraPayload },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: card };
}

export async function createProgramCard(input: CreateProgramCardInput): Promise<ProgramCardResult<ProgramCardRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (input.epicId != null && !validUuid(input.epicId)) return validation("epicId must be a UUID.");
  if (input.sprintId != null && !validUuid(input.sprintId)) return validation("sprintId must be a UUID.");
  if (!required(input.title)) return validation("title is required.");
  if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
  if (!PROGRAM_CARD_TYPES.includes(input.type)) {
    return validation(`type must be one of: ${PROGRAM_CARD_TYPES.join(", ")}.`);
  }
  if (typeof input.orderIndex !== "number" || !Number.isInteger(input.orderIndex)) {
    return validation("orderIndex must be an integer.");
  }
  const status = input.status ?? "DRAFT";
  if (!PROGRAM_ITEM_STATUSES_CARDS.includes(status as typeof PROGRAM_ITEM_STATUSES_CARDS[number])) {
    return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES_CARDS.join(", ")}.`);
  }

  const result = await dbCreateProgramCard({
    workspaceId: input.workspaceId,
    programId: input.programId,
    epicId: input.epicId ?? null,
    sprintId: input.sprintId ?? null,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    promptBody: input.promptBody ?? null,
    type: input.type,
    status,
    orderIndex: input.orderIndex,
  });
  if (!result.ok) return result;
  return emitCardEvent(result.data, "PROGRAM_CARD_CREATED", input.actorId);
}

export async function updateProgramCard(
  cardId: string,
  workspaceId: string,
  input: UpdateProgramCardInput
): Promise<ProgramCardResult<ProgramCardRow>> {
  if (!validUuid(cardId)) return validation("cardId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbFindProgramCardById(cardId, workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description?.trim() ?? null;
  if (input.promptBody !== undefined) patch.prompt_body = input.promptBody ?? null;
  if (input.status !== undefined) {
    if (!PROGRAM_ITEM_STATUSES_CARDS.includes(input.status as typeof PROGRAM_ITEM_STATUSES_CARDS[number])) {
      return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES_CARDS.join(", ")}.`);
    }
    if (input.status === "ARCHIVED") return validation("Use DELETE to archive a card.");
    patch.status = input.status;
  }
  if (input.orderIndex !== undefined) {
    if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    patch.order_index = input.orderIndex;
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const result = await dbUpdateProgramCard(cardId, workspaceId, patch);
  if (!result.ok) return result;
  return emitCardEvent(result.data, "PROGRAM_CARD_UPDATED", input.actorId);
}

export async function archiveProgramCard(
  cardId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramCardResult<ProgramCardRow>> {
  if (!validUuid(cardId)) return validation("cardId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const result = await dbArchiveProgramCard(cardId, workspaceId);
  if (!result.ok) return result;
  return emitCardEvent(result.data, "PROGRAM_CARD_ARCHIVED", actorId);
}

export async function getProgramCard(
  cardId: string,
  workspaceId: string
): Promise<ProgramCardResult<ProgramCardRow>> {
  if (!validUuid(cardId)) return validation("cardId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindProgramCardById(cardId, workspaceId);
}

export async function listProgramCards(
  programId: string,
  workspaceId: string
): Promise<ProgramCardResult<ProgramCardRow[]>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListProgramCards(programId, workspaceId);
}
