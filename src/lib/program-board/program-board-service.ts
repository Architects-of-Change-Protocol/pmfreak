import { createPlatformEvent } from "@/lib/platform-events";
import {
  dbGetProgramCards,
  dbGetProgramCardById,
  dbUpdateBoardColumn,
  dbGetProgramEpicsByIds,
  dbGetProgramSprintsByIds,
  dbGetProgramMaterializationsByIds,
  dbGetProgramRoadmapSourcesByIds,
} from "./program-board-repository";
import { VALID_TRANSITIONS, resolveMovedEventType } from "./types";
import type {
  ProgramBoardColumn,
  ProgramBoardResult,
  ProgramBoardStats,
  ProgramExecutionBoard,
  ProgramCardRow,
  ProgramBoardCard,
  ProgramCardContext,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function validation<T>(error: string): ProgramBoardResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function unique<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((v): v is T => v != null))];
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

async function enrichProgramCardsWithContext(input: {
  workspaceId: string;
  programId: string;
  cards: ProgramCardRow[];
}): Promise<ProgramBoardCard[]> {
  const { workspaceId, programId, cards } = input;

  const epicIds = unique(cards.map(c => c.epic_id));
  const sprintIds = unique(cards.map(c => c.sprint_id));
  const materializationIds = unique(cards.map(c => c.materialization_id));

  const [epicsResult, sprintsResult, matsResult] = await Promise.all([
    dbGetProgramEpicsByIds({ workspaceId, programId, epicIds }),
    dbGetProgramSprintsByIds({ workspaceId, programId, sprintIds }),
    dbGetProgramMaterializationsByIds({ workspaceId, programId, materializationIds }),
  ]);

  const epics = epicsResult.ok ? epicsResult.data : [];
  const sprints = sprintsResult.ok ? sprintsResult.data : [];
  const materializations = matsResult.ok ? matsResult.data : [];

  const sourceIds = unique(materializations.map(m => m.source_id));
  const sourcesResult = await dbGetProgramRoadmapSourcesByIds({ workspaceId, programId, sourceIds });
  const sources = sourcesResult.ok ? sourcesResult.data : [];

  const epicById = new Map(epics.map(e => [e.id, e]));
  const sprintById = new Map(sprints.map(s => [s.id, s]));
  const materializationById = new Map(materializations.map(m => [m.id, m]));
  const sourceById = new Map(sources.map(s => [s.id, s]));

  return cards.map(card => {
    const context: ProgramCardContext = {};

    const epic = card.epic_id ? epicById.get(card.epic_id) : undefined;
    if (epic) {
      context.epic = { id: epic.id, number: epic.number, title: epic.title };
    }

    const sprint = card.sprint_id ? sprintById.get(card.sprint_id) : undefined;
    if (sprint) {
      context.sprint = { id: sprint.id, number: sprint.number, title: sprint.title, objective: sprint.objective };
    }

    const mat = card.materialization_id ? materializationById.get(card.materialization_id) : undefined;
    if (mat) {
      context.materialization = { id: mat.id, parseResultId: mat.parse_result_id, createdAt: mat.created_at };
      const source = sourceById.get(mat.source_id);
      if (source) {
        context.source = { id: source.id, title: source.title, sourceType: source.source_type, version: source.version };
      }
    }

    if (card.materialization_type || card.materialization_source || card.source_line_number != null) {
      context.origin = {
        materializationType: card.materialization_type,
        materializationSource: card.materialization_source,
        sourceLineNumber: card.source_line_number,
      };
    }

    return { ...card, context };
  });
}

export async function getProgramExecutionBoard(input: {
  workspaceId: string;
  programId: string;
}): Promise<ProgramBoardResult<ProgramExecutionBoard>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");

  const result = await dbGetProgramCards(input.programId, input.workspaceId);
  if (!result.ok) return result;

  const boardCards = await enrichProgramCardsWithContext({
    workspaceId: input.workspaceId,
    programId: input.programId,
    cards: result.data,
  });

  const board: ProgramExecutionBoard = {
    backlog: boardCards.filter(c => c.board_column === "BACKLOG"),
    ready: boardCards.filter(c => c.board_column === "READY"),
    inProgress: boardCards.filter(c => c.board_column === "IN_PROGRESS"),
    inReview: boardCards.filter(c => c.board_column === "IN_REVIEW"),
    done: boardCards.filter(c => c.board_column === "DONE"),
    stats: buildStats(result.data),
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
