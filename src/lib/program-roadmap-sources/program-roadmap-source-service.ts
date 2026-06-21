import { createPlatformEvent } from "@/lib/platform-events";
import {
  dbArchiveProgramRoadmapSource,
  dbCreateProgramRoadmapSource,
  dbFindProgramRoadmapSourceById,
  dbGetActiveProgramRoadmapSource,
  dbGetNextVersionForProgram,
  dbListProgramRoadmapSources,
  dbSupersedeProgramRoadmapSources,
  dbUpdateProgramRoadmapSource,
} from "./program-roadmap-source-repository";
import {
  PROGRAM_ROADMAP_SOURCE_STATUSES,
  PROGRAM_ROADMAP_SOURCE_TYPES,
  RAW_TEXT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "./types";
import type {
  CreateProgramRoadmapSourceInput,
  ProgramRoadmapSourceEventType,
  ProgramRoadmapSourceResult,
  ProgramRoadmapSourceRow,
  ProgramRoadmapSourceStatus,
  UpdateProgramRoadmapSourceInput,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): ProgramRoadmapSourceResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitSourceEvent(
  source: ProgramRoadmapSourceRow,
  eventType: ProgramRoadmapSourceEventType,
  actorId: string | null,
  extraPayload?: Record<string, unknown>
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  const event = await createPlatformEvent({
    workspaceId: source.workspace_id,
    actorId: actorId ?? undefined,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "document",
    source: "user_action",
    correlationId: source.program_id,
    causationId: null,
    rawReferenceTable: "program_roadmap_sources",
    rawReferenceId: source.id,
    learningEligible: false,
    eventPayload: {
      sourceId: source.id,
      programId: source.program_id,
      sourceType: source.source_type,
      status: source.status,
      version: source.version,
      ...extraPayload,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: source };
}

export async function createProgramRoadmapSource(
  input: CreateProgramRoadmapSourceInput
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!required(input.rawText)) return validation("rawText is required.");
  if (input.rawText.length > RAW_TEXT_MAX_LENGTH) return validation(`rawText must be ${RAW_TEXT_MAX_LENGTH} characters or fewer.`);
  if (!PROGRAM_ROADMAP_SOURCE_TYPES.includes(input.sourceType)) {
    return validation(`sourceType must be one of: ${PROGRAM_ROADMAP_SOURCE_TYPES.join(", ")}.`);
  }
  if (input.title !== undefined && input.title !== null) {
    if (!required(input.title)) return validation("title cannot be empty.");
    if (input.title.length > TITLE_MAX_LENGTH) return validation(`title must be ${TITLE_MAX_LENGTH} characters or fewer.`);
  }
  const requestedStatus: ProgramRoadmapSourceStatus = input.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

  const version = await dbGetNextVersionForProgram(input.programId, input.workspaceId);

  const result = await dbCreateProgramRoadmapSource({
    workspaceId: input.workspaceId,
    programId: input.programId,
    rawText: input.rawText,
    sourceType: input.sourceType,
    title: input.title ?? null,
    version,
    status: requestedStatus,
    metadata: input.metadata ?? null,
    createdBy: input.createdBy ?? null,
  });
  if (!result.ok) return result;

  if (requestedStatus === "ACTIVE") {
    const supersede = await dbSupersedeProgramRoadmapSources(
      input.programId,
      input.workspaceId,
      result.data.id
    );
    if (!supersede.ok) return supersede;
    await emitSourceEvent(result.data, "PROGRAM_ROADMAP_SOURCE_ACTIVATED", input.createdBy ?? null);
  }

  return emitSourceEvent(result.data, "PROGRAM_ROADMAP_SOURCE_CREATED", input.createdBy ?? null);
}

export async function updateProgramRoadmapSource(
  sourceId: string,
  workspaceId: string,
  input: UpdateProgramRoadmapSourceInput
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  if (!validUuid(sourceId)) return validation("sourceId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await dbFindProgramRoadmapSourceById(sourceId, workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};

  if (input.rawText !== undefined) {
    if (!required(input.rawText)) return validation("rawText cannot be empty.");
    if (input.rawText.length > RAW_TEXT_MAX_LENGTH) return validation(`rawText must be ${RAW_TEXT_MAX_LENGTH} characters or fewer.`);
    patch.raw_text = input.rawText;
  }
  if (input.title !== undefined) {
    if (input.title !== null) {
      if (!required(input.title)) return validation("title cannot be empty.");
      if (input.title.length > TITLE_MAX_LENGTH) return validation(`title must be ${TITLE_MAX_LENGTH} characters or fewer.`);
    }
    patch.title = input.title;
  }
  if (input.status !== undefined) {
    if (!PROGRAM_ROADMAP_SOURCE_STATUSES.includes(input.status)) {
      return validation(`status must be one of: ${PROGRAM_ROADMAP_SOURCE_STATUSES.join(", ")}.`);
    }
    if (input.status === "SUPERSEDED") return validation("status SUPERSEDED is managed by the system.");
    if (input.status === "ARCHIVED") return validation("Use DELETE to archive a roadmap source.");
    patch.status = input.status;
  }
  if (input.metadata !== undefined) {
    patch.metadata = input.metadata;
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const result = await dbUpdateProgramRoadmapSource(sourceId, workspaceId, patch);
  if (!result.ok) return result;

  const becameActive =
    input.status === "ACTIVE" && current.data.status !== "ACTIVE";

  if (becameActive) {
    const supersede = await dbSupersedeProgramRoadmapSources(
      current.data.program_id,
      workspaceId,
      sourceId
    );
    if (!supersede.ok) return supersede;
    await emitSourceEvent(result.data, "PROGRAM_ROADMAP_SOURCE_ACTIVATED", input.actorId);
  }

  return emitSourceEvent(result.data, "PROGRAM_ROADMAP_SOURCE_UPDATED", input.actorId, {
    previousStatus: current.data.status,
  });
}

export async function archiveProgramRoadmapSource(
  sourceId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  if (!validUuid(sourceId)) return validation("sourceId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const result = await dbArchiveProgramRoadmapSource(sourceId, workspaceId);
  if (!result.ok) return result;
  return emitSourceEvent(result.data, "PROGRAM_ROADMAP_SOURCE_ARCHIVED", actorId);
}

export async function getProgramRoadmapSource(
  sourceId: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  if (!validUuid(sourceId)) return validation("sourceId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindProgramRoadmapSourceById(sourceId, workspaceId);
}

export async function listProgramRoadmapSources(
  programId: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow[]>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListProgramRoadmapSources(programId, workspaceId);
}

export async function getActiveProgramRoadmapSource(
  programId: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow | null>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbGetActiveProgramRoadmapSource(programId, workspaceId);
}
