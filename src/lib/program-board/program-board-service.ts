import { createPlatformEvent } from "@/lib/platform-events";
import { dbGetProgramCards, dbGetProgramCardById, dbUpdateBoardColumn } from "./program-board-repository";
import { VALID_TRANSITIONS, resolveMovedEventType } from "./types";
import type {
  ProgramBoardColumn,
  ProgramBoardResult,
  ProgramBoardStats,
  ProgramExecutionBoard,
  ProgramCardRow,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function validation<T>(error: string): ProgramBoardResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function buildStats(cards: ProgramCardRow[]): ProgramBoardStats {
  const total = cards.length;
  const backlogCount = cards.filter(c => c.board_column === "BACKLOG").length;
  const readyCount = cards.filter(c => c.board_column === "READY").length;
  const inProgressCount = cards.filter(c => c.board_column === "IN_PROGRESS").length;
  const inReviewCount = cards.filter(c => c.board_column === "IN_REVIEW").length;
  const doneCount = cards.filter(c => c.board_column === "DONE").length;
  const completionPercentage = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  return { totalCards: total, backlogCount, readyCount, inProgressCount, inReviewCount, doneCount, completionPercentage };
}

export async function getProgramExecutionBoard(input: {
  workspaceId: string;
  programId: string;
}): Promise<ProgramBoardResult<ProgramExecutionBoard>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");

  const result = await dbGetProgramCards(input.programId, input.workspaceId);
  if (!result.ok) return result;

  const cards = result.data;
  const board: ProgramExecutionBoard = {
    backlog: cards.filter(c => c.board_column === "BACKLOG"),
    ready: cards.filter(c => c.board_column === "READY"),
    inProgress: cards.filter(c => c.board_column === "IN_PROGRESS"),
    inReview: cards.filter(c => c.board_column === "IN_REVIEW"),
    done: cards.filter(c => c.board_column === "DONE"),
    stats: buildStats(cards),
  };

  return { ok: true, data: board };
}

export async function getBoardStats(input: {
  workspaceId: string;
  programId: string;
}): Promise<ProgramBoardResult<ProgramBoardStats>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");

  const result = await dbGetProgramCards(input.programId, input.workspaceId);
  if (!result.ok) return result;

  return { ok: true, data: buildStats(result.data) };
}

export async function moveProgramCard(input: {
  workspaceId: string;
  cardId: string;
  targetColumn: ProgramBoardColumn;
  actorId: string;
}): Promise<ProgramBoardResult<ProgramCardRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.cardId)) return validation("cardId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbGetProgramCardById(input.cardId, input.workspaceId);
  if (!current.ok) return current;

  const card = current.data;
  const fromColumn = card.board_column;
  const allowed = VALID_TRANSITIONS[fromColumn] ?? [];

  if (!allowed.includes(input.targetColumn)) {
    return {
      ok: false,
      error: `Invalid transition from ${fromColumn} to ${input.targetColumn}.`,
      failureClass: "INVALID_BOARD_TRANSITION",
    };
  }

  const updated = await dbUpdateBoardColumn(input.cardId, input.workspaceId, input.targetColumn);
  if (!updated.ok) return updated;

  const eventType = resolveMovedEventType(input.targetColumn, fromColumn);
  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType,
    eventCategory: "project",
    source: "user_action",
    correlationId: updated.data.program_id,
    causationId: null,
    rawReferenceTable: "program_cards",
    rawReferenceId: updated.data.id,
    learningEligible: false,
    eventPayload: {
      cardId: updated.data.id,
      programId: updated.data.program_id,
      fromColumn,
      toColumn: input.targetColumn,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };

  return { ok: true, data: updated.data };
}
