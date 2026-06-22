import { createPlatformEvent } from "@/lib/platform-events";
import { dbFindProgramById } from "@/lib/programs/program-repository";
import { dbFindParseResultById } from "@/lib/program-roadmap-parser/program-roadmap-parse-result-repository";
import { dbCreateProgramEpic } from "@/lib/program-epics/program-epic-repository";
import { dbCreateProgramSprint } from "@/lib/program-sprints/program-sprint-repository";
import { dbCreateProgramCard } from "@/lib/program-cards/program-card-repository";
import { buildMaterializationPlan } from "./program-materialization-engine";
import {
  dbCreateProgramMaterialization,
  dbFindActiveMaterialization,
  dbFindProgramMaterializationById,
  dbListProgramMaterializations,
  dbArchiveProgramMaterialization,
  dbUpdateProgramMaterialization,
} from "./program-materialization-repository";
import type {
  MaterializeProgramRoadmapInput,
  ProgramMaterializationReport,
  ProgramMaterializationResult,
  ProgramMaterializationRow,
} from "./types";
import type { ProgramRoadmapParseResult } from "@/lib/program-roadmap-parser/types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function validation<T>(error: string): ProgramMaterializationResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

export async function materializeProgramRoadmap(
  input: MaterializeProgramRoadmapInput
): Promise<ProgramMaterializationResult<{ materialization: ProgramMaterializationRow; report: ProgramMaterializationReport }>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.programId)) return validation("programId must be a UUID.");
  if (!validUuid(input.parseResultId)) return validation("parseResultId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  // Step 1: Validate program exists
  const programResult = await dbFindProgramById(input.programId, input.workspaceId);
  if (!programResult.ok) return { ok: false, error: "Program not found.", failureClass: "not_found" };

  // Step 2: Validate parse result exists
  const parseResultRow = await dbFindParseResultById(input.parseResultId, input.workspaceId);
  if (!parseResultRow.ok) return { ok: false, error: "Parse result not found.", failureClass: "not_found" };

  // Step 3: Validate parse result status
  const parseStatus = parseResultRow.data.status;
  if (parseStatus === "INVALID") {
    return { ok: false, error: "Cannot materialize an INVALID parse result.", failureClass: "validation_failed" };
  }

  // Check parse result belongs to this program
  if (parseResultRow.data.program_id !== input.programId) {
    return { ok: false, error: "Parse result does not belong to this program.", failureClass: "validation_failed" };
  }

  // Step 4: Check for duplicate materialization
  const existing = await dbFindActiveMaterialization(input.programId, input.parseResultId, input.workspaceId);
  if (!existing.ok) return existing;
  if (existing.data !== null) {
    return {
      ok: false,
      error: "A materialization already exists for this program and parse result.",
      failureClass: "MATERIALIZATION_ALREADY_EXISTS",
    };
  }

  // Create materialization record (RUNNING)
  const materializationResult = await dbCreateProgramMaterialization({
    workspaceId: input.workspaceId,
    programId: input.programId,
    sourceId: parseResultRow.data.source_id,
    parseResultId: input.parseResultId,
  });
  if (!materializationResult.ok) return materializationResult;

  const materialization = materializationResult.data;

  // Emit STARTED event
  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "PROGRAM_MATERIALIZATION_STARTED",
    eventCategory: "project",
    source: "user_action",
    correlationId: input.programId,
    rawReferenceTable: "program_materializations",
    rawReferenceId: materialization.id,
    learningEligible: false,
    eventPayload: { materializationId: materialization.id, programId: input.programId, parseResultId: input.parseResultId },
  });

  // Parse result json → ProgramRoadmapParseResult
  const parseResult = parseResultRow.data.result_json as unknown as ProgramRoadmapParseResult;

  // Build plan
  const plan = buildMaterializationPlan(parseResult);

  const report: ProgramMaterializationReport = {
    epicsCreated: 0,
    sprintsCreated: 0,
    cardsCreated: 0,
    skippedCards: 0,
    warnings: [...plan.warnings],
    createdEntities: { epicIds: [], sprintIds: [], cardIds: [] },
  };

  // Map epicNumber → created epicId
  const epicIdByNumber = new Map<number, string>();

  try {
    // Step 5: Materialize Epics
    for (const epicPlan of plan.epics) {
      const epicResult = await dbCreateProgramEpic({
        workspaceId: input.workspaceId,
        programId: input.programId,
        number: epicPlan.number,
        title: epicPlan.title,
        description: null,
        status: "BACKLOG",
        orderIndex: epicPlan.orderIndex,
      });
      if (!epicResult.ok) {
        report.warnings.push(`Failed to create Epic ${epicPlan.number}: ${epicResult.error}`);
        continue;
      }
      epicIdByNumber.set(epicPlan.number, epicResult.data.id);
      report.createdEntities.epicIds.push(epicResult.data.id);
      report.epicsCreated++;

      await createPlatformEvent({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType: "user",
        eventType: "PROGRAM_EPIC_MATERIALIZED",
        eventCategory: "project",
        source: "user_action",
        correlationId: materialization.id,
        rawReferenceTable: "program_epics",
        rawReferenceId: epicResult.data.id,
        learningEligible: false,
        eventPayload: { epicId: epicResult.data.id, epicNumber: epicPlan.number, materializationId: materialization.id },
      });
    }

    // Map sprintNumber → created sprintId
    const sprintIdByNumber = new Map<number, string>();

    // Step 6: Materialize Sprints
    for (const sprintPlan of plan.sprints) {
      const epicId = epicIdByNumber.get(sprintPlan.epicNumber);
      if (!epicId) {
        report.warnings.push(`Sprint ${sprintPlan.number}: Epic ${sprintPlan.epicNumber} was not created, sprint skipped.`);
        continue;
      }
      const sprintResult = await dbCreateProgramSprint({
        workspaceId: input.workspaceId,
        programId: input.programId,
        epicId,
        number: sprintPlan.number,
        title: sprintPlan.title,
        description: null,
        objective: sprintPlan.objective,
        status: "BACKLOG",
        orderIndex: sprintPlan.orderIndex,
      });
      if (!sprintResult.ok) {
        report.warnings.push(`Failed to create Sprint ${sprintPlan.number}: ${sprintResult.error}`);
        continue;
      }
      sprintIdByNumber.set(sprintPlan.number, sprintResult.data.id);
      report.createdEntities.sprintIds.push(sprintResult.data.id);
      report.sprintsCreated++;

      await createPlatformEvent({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType: "user",
        eventType: "PROGRAM_SPRINT_MATERIALIZED",
        eventCategory: "project",
        source: "user_action",
        correlationId: materialization.id,
        rawReferenceTable: "program_sprints",
        rawReferenceId: sprintResult.data.id,
        learningEligible: false,
        eventPayload: { sprintId: sprintResult.data.id, sprintNumber: sprintPlan.number, materializationId: materialization.id },
      });
    }

    // Step 7: Materialize Cards
    for (const cardPlan of plan.cards) {
      const epicId = epicIdByNumber.get(cardPlan.epicNumber) ?? null;
      const sprintId = sprintIdByNumber.get(cardPlan.sprintNumber) ?? null;

      if (!sprintId) {
        report.warnings.push(`Card "${cardPlan.title}": Sprint ${cardPlan.sprintNumber} was not created, card skipped.`);
        report.skippedCards++;
        continue;
      }

      const cardResult = await dbCreateProgramCard({
        workspaceId: input.workspaceId,
        programId: input.programId,
        epicId,
        sprintId,
        title: cardPlan.title,
        description: null,
        promptBody: null,
        type: cardPlan.type,
        status: "BACKLOG",
        orderIndex: cardPlan.orderIndex,
        materializationSource: materialization.id,
        materializationType: cardPlan.materializationType,
        sourceLineNumber: cardPlan.sourceLineNumber,
        materializationId: materialization.id,
      });
      if (!cardResult.ok) {
        report.warnings.push(`Failed to create card "${cardPlan.title}": ${cardResult.error}`);
        report.skippedCards++;
        continue;
      }
      report.createdEntities.cardIds.push(cardResult.data.id);
      report.cardsCreated++;

      await createPlatformEvent({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType: "user",
        eventType: "PROGRAM_CARD_MATERIALIZED",
        eventCategory: "project",
        source: "user_action",
        correlationId: materialization.id,
        rawReferenceTable: "program_cards",
        rawReferenceId: cardResult.data.id,
        learningEligible: false,
        eventPayload: {
          cardId: cardResult.data.id,
          cardType: cardPlan.type,
          materializationType: cardPlan.materializationType,
          materializationId: materialization.id,
        },
      });
    }

    // Step 8: Mark COMPLETED
    const completedResult = await dbUpdateProgramMaterialization(materialization.id, input.workspaceId, {
      status: "COMPLETED",
      epics_created: report.epicsCreated,
      sprints_created: report.sprintsCreated,
      cards_created: report.cardsCreated,
      completed_at: new Date().toISOString(),
    });
    if (!completedResult.ok) return completedResult;

    // Step 9: Emit COMPLETED event
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: "user",
      eventType: "PROGRAM_MATERIALIZATION_COMPLETED",
      eventCategory: "project",
      source: "user_action",
      correlationId: input.programId,
      rawReferenceTable: "program_materializations",
      rawReferenceId: materialization.id,
      learningEligible: false,
      eventPayload: {
        materializationId: materialization.id,
        programId: input.programId,
        epicsCreated: report.epicsCreated,
        sprintsCreated: report.sprintsCreated,
        cardsCreated: report.cardsCreated,
      },
    });

    return { ok: true, data: { materialization: completedResult.data, report } };
  } catch (err) {
    // Mark FAILED
    await dbUpdateProgramMaterialization(materialization.id, input.workspaceId, {
      status: "ARCHIVED",
      completed_at: new Date().toISOString(),
    });
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: "user",
      eventType: "PROGRAM_MATERIALIZATION_FAILED",
      eventCategory: "project",
      source: "user_action",
      correlationId: input.programId,
      rawReferenceTable: "program_materializations",
      rawReferenceId: materialization.id,
      learningEligible: false,
      eventPayload: { materializationId: materialization.id, programId: input.programId, error: String(err) },
    });
    return { ok: false, error: "Materialization failed unexpectedly.", failureClass: "persistence_failed" };
  }
}

export async function getProgramMaterialization(
  materializationId: string,
  programId: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  if (!validUuid(materializationId)) return validation("materializationId must be a UUID.");
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const result = await dbFindProgramMaterializationById(materializationId, workspaceId);
  if (!result.ok) return result;
  if (result.data.program_id !== programId) {
    return { ok: false, error: "Materialization not found.", failureClass: "not_found" };
  }
  return result;
}

export async function listProgramMaterializations(
  programId: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow[]>> {
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbListProgramMaterializations(programId, workspaceId);
}

export async function archiveProgramMaterialization(
  materializationId: string,
  programId: string,
  workspaceId: string,
  actorId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  if (!validUuid(materializationId)) return validation("materializationId must be a UUID.");
  if (!validUuid(programId)) return validation("programId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const existing = await dbFindProgramMaterializationById(materializationId, workspaceId);
  if (!existing.ok) return existing;
  if (existing.data.program_id !== programId) {
    return { ok: false, error: "Materialization not found.", failureClass: "not_found" };
  }

  const result = await dbArchiveProgramMaterialization(materializationId, workspaceId);
  if (!result.ok) return result;

  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType: "PROGRAM_MATERIALIZATION_FAILED",
    eventCategory: "project",
    source: "user_action",
    correlationId: programId,
    rawReferenceTable: "program_materializations",
    rawReferenceId: materializationId,
    learningEligible: false,
    eventPayload: { materializationId, programId, archived: true },
  });

  return result;
}
