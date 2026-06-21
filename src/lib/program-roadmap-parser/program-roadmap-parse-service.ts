import { createPlatformEvent } from "@/lib/platform-events";
import { dbFindProgramRoadmapSourceById } from "@/lib/program-roadmap-sources/program-roadmap-source-repository";
import { parseProgramRoadmapText } from "./program-roadmap-parser";
import {
  dbArchiveParseResult,
  dbCreateParseResult,
  dbFindParseResultById,
  dbGetLatestParseResult,
  dbListParseResults,
} from "./program-roadmap-parse-result-repository";
import type {
  ProgramRoadmapParseResult,
  ProgramRoadmapParseResultEventType,
  ProgramRoadmapParseResultRow,
  ProgramRoadmapParserResult,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function validation<T>(error: string): ProgramRoadmapParserResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitParseEvent(
  row: ProgramRoadmapParseResultRow,
  eventType: ProgramRoadmapParseResultEventType,
  actorId: string | null
): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  const event = await createPlatformEvent({
    workspaceId: row.workspace_id,
    actorId: actorId ?? undefined,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "document",
    source: "user_action",
    correlationId: row.program_id,
    causationId: null,
    rawReferenceTable: "program_roadmap_parse_results",
    rawReferenceId: row.id,
    learningEligible: false,
    eventPayload: {
      parseResultId: row.id,
      programId: row.program_id,
      sourceId: row.source_id,
      status: row.status,
      epicCount: row.epic_count,
      sprintCount: row.sprint_count,
      errorCount: row.error_count,
      warningCount: row.warning_count,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: row };
}

export async function parseProgramRoadmapSource(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
  actorId?: string | null;
}): Promise<ProgramRoadmapParserResult<{ row: ProgramRoadmapParseResultRow; parseResult: ProgramRoadmapParseResult }>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.sourceId)) return validation("sourceId must be a UUID.");

  const sourceResult = await dbFindProgramRoadmapSourceById(input.sourceId, input.workspaceId);
  if (!sourceResult.ok) {
    return { ok: false, error: "Roadmap source not found.", failureClass: "not_found" };
  }

  const source = sourceResult.data;
  if (source.program_id !== input.programId) {
    return { ok: false, error: "Roadmap source does not belong to this program.", failureClass: "validation_failed" };
  }

  const parseResult = parseProgramRoadmapText({
    programId: input.programId,
    sourceId: input.sourceId,
    rawText: source.raw_text,
  });

  const resultJson = {
    programId: parseResult.programId,
    sourceId: parseResult.sourceId,
    parsedAt: parseResult.parsedAt.toISOString(),
    status: parseResult.status,
    epics: parseResult.epics,
    warnings: parseResult.warnings,
    errors: parseResult.errors,
    stats: parseResult.stats,
  } as Record<string, unknown>;

  const persistResult = await dbCreateParseResult({
    workspaceId: input.workspaceId,
    programId: input.programId,
    sourceId: input.sourceId,
    status: parseResult.status,
    resultJson,
    errorCount: parseResult.errors.length,
    warningCount: parseResult.warnings.length,
    epicCount: parseResult.stats.epicCount,
    sprintCount: parseResult.stats.sprintCount,
    parsedAt: parseResult.parsedAt,
  });
  if (!persistResult.ok) return persistResult;

  const eventType: ProgramRoadmapParseResultEventType =
    parseResult.status === "INVALID"
      ? "PROGRAM_ROADMAP_PARSE_FAILED"
      : "PROGRAM_ROADMAP_PARSED";

  const emitResult = await emitParseEvent(persistResult.data, eventType, input.actorId ?? null);
  if (!emitResult.ok) return emitResult;

  return { ok: true, data: { row: persistResult.data, parseResult } };
}

export async function getProgramRoadmapParseResult(input: {
  workspaceId: string;
  parseResultId: string;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.parseResultId)) return validation("parseResultId must be a UUID.");
  return dbFindParseResultById(input.parseResultId, input.workspaceId);
}

export async function listProgramRoadmapParseResults(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.sourceId)) return validation("sourceId must be a UUID.");
  return dbListParseResults(input);
}

export async function getLatestProgramRoadmapParseResult(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow | null>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.sourceId)) return validation("sourceId must be a UUID.");
  return dbGetLatestParseResult(input);
}

export async function archiveProgramRoadmapParseResult(input: {
  workspaceId: string;
  programId: string;
  parseResultId: string;
  actorId?: string | null;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.parseResultId)) return validation("parseResultId must be a UUID.");

  const result = await dbArchiveParseResult(input.parseResultId, input.workspaceId);
  if (!result.ok) return result;

  return emitParseEvent(result.data, "PROGRAM_ROADMAP_PARSE_RESULT_ARCHIVED", input.actorId ?? null);
}
