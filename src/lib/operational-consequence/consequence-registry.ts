import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbCreateConsequence,
  dbFindConsequenceById,
  dbListConsequences,
  dbUpdateConsequenceStatus,
  dbCreateConsequenceImpact,
  dbListConsequenceImpacts,
  dbCreateConsequencePath,
  dbListConsequencePaths,
  dbListConsequenceScenarios,
  dbCreateConsequenceScenario,
} from "./consequence-repository";
import { calculateImpactScore, calculateConsequenceSeverity } from "./impact-engine";
import { analyzeCascadeEffects } from "./cascade-engine";
import { calculateEscalationProbability } from "./escalation-engine";
import { generateConsequenceScenarios } from "./scenario-engine";
import { calculateImpactHorizon } from "./horizon-engine";
import { generateDecisionSupport } from "./decision-support-engine";
import { getOperationalConsequenceLineage } from "./lineage-engine";
import { CONSEQUENCE_ANALYSIS_STATUSES } from "./types";
import type {
  ConsequenceResult,
  OperationalConsequenceRow,
  ConsequenceAnalysis,
  ConsequenceLineage,
  DecisionSupport,
  ConsequenceEventType,
  GenerateConsequenceInput,
  GetConsequenceInput,
  ListConsequencesInput,
  ValidateConsequenceInput,
  ArchiveConsequenceInput,
  GetConsequenceLineageInput,
  ConsequenceImpactType,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): ConsequenceResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitConsequenceEvent(
  workspaceId:   string,
  consequenceId: string,
  focusItemId:   string,
  projectId:     string,
  eventType:     ConsequenceEventType,
  actorId:       string,
  extra?:        Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    projectId,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "system",
    source:            "system",
    correlationId:     consequenceId,
    rawReferenceTable: "operational_consequences",
    rawReferenceId:    consequenceId,
    learningEligible:  false,
    eventPayload:      { consequenceId, focusItemId, ...extra },
  });
}

// ─── resolveProjectId ─────────────────────────────────────────────────────────
// Resolves the real project_id for a focus item via its command center.

async function resolveProjectId(focusItemId: string, workspaceId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: fi } = await supabase
    .from("operational_focus_items")
    .select("command_center_id")
    .eq("id", focusItemId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!fi) return focusItemId;
  const { data: cc } = await supabase
    .from("operational_command_centers")
    .select("project_id")
    .eq("id", fi.command_center_id)
    .eq("workspace_id", workspaceId)
    .single();
  return (cc?.project_id as string) ?? focusItemId;
}

// ─── Impact type mapping ──────────────────────────────────────────────────────

const FOCUS_TYPE_TO_IMPACT_TYPE: Record<string, ConsequenceImpactType> = {
  governance:     "governance",
  execution:      "execution",
  authority:      "authority",
  ratification:   "ratification",
  commitment:     "commitment",
  projection:     "projection",
  reality:        "reality",
  recommendation: "recommendation",
  risk:           "risk",
  health:         "health",
};

// ─── generateOperationalConsequence ──────────────────────────────────────────

export async function generateOperationalConsequence(
  input: GenerateConsequenceInput
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.focusItemId)) return validation("focusItemId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  // Load focus item
  const supabase = await createSupabaseServerClient();
  const { data: focusItem, error: fiErr } = await supabase
    .from("operational_focus_items")
    .select("id, workspace_id, focus_type, priority, focus_score, command_center_id")
    .eq("id", input.focusItemId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (fiErr || !focusItem) {
    return { ok: false, error: "Focus item not found.", failureClass: "not_found" };
  }

  // Load command center to get the real project_id for event emission
  const { data: commandCenter } = await supabase
    .from("operational_command_centers")
    .select("project_id")
    .eq("id", focusItem.command_center_id)
    .eq("workspace_id", input.workspaceId)
    .single();
  const projectId = (commandCenter?.project_id as string) ?? input.focusItemId;

  // Count dependencies (focus links) — scoped to workspace for isolation
  const { count: depCount } = await supabase
    .from("operational_focus_links")
    .select("id", { count: "exact", head: true })
    .eq("focus_item_id", input.focusItemId)
    .eq("workspace_id", input.workspaceId);

  const dependencyCount = depCount ?? 0;

  // Count active (not completed/rejected/cancelled/etc.) commitments in workspace
  const { count: openCommits } = await supabase
    .from("governance_commitments")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .in("status", ["pending_acceptance", "accepted", "active", "delegated"]);

  // Count active (not resolved/dismissed) governance_violation signals
  const { count: activeViolations } = await supabase
    .from("governance_signals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .eq("signal_type", "governance_violation")
    .in("status", ["active", "acknowledged"]);

  const priorityGovernanceImpact: Record<string, number> = { critical: 80, high: 60, medium: 40, low: 20 };
  const priorityExecutionImpact:  Record<string, number> = { critical: 75, high: 55, medium: 35, low: 15 };

  const impactScore = calculateImpactScore({
    focusScore:            focusItem.focus_score,
    operationalPriority:   focusItem.priority,
    dependencyCount,
    governanceImpact:      priorityGovernanceImpact[focusItem.priority] ?? 20,
    executionImpact:       priorityExecutionImpact[focusItem.priority]  ?? 15,
    historicalSimilarity:  50,
  });

  const severity    = calculateConsequenceSeverity(impactScore);
  const horizon     = calculateImpactHorizon(severity);

  const escalationProbability = calculateEscalationProbability({
    severity,
    dependencyDensity:         dependencyCount,
    openCommitments:           openCommits ?? 0,
    activeViolations:          activeViolations ?? 0,
    historicalEscalationRate:  0.5,
  });

  // Persist consequence
  const cResult = await dbCreateConsequence({
    workspaceId:           input.workspaceId,
    focusItemId:           input.focusItemId,
    severity,
    impactHorizon:         horizon,
    escalationProbability,
    impactScore,
  });
  if (!cResult.ok) return cResult;
  const consequence = cResult.data;

  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_CONSEQUENCE_GENERATED", input.actorId,
    { severity, impactScore, escalationProbability, impactHorizon: horizon }
  );

  // Persist impact record — fail generation if it cannot be stored
  const impactType = FOCUS_TYPE_TO_IMPACT_TYPE[focusItem.focus_type] ?? "governance";
  const impactResult = await dbCreateConsequenceImpact({
    workspaceId:         input.workspaceId,
    consequenceId:       consequence.id,
    impactType,
    affectedEntityType:  "operational_focus_items",
    affectedEntityCount: dependencyCount + 1,
    impactScore,
    description:
      `A ${severity} ${focusItem.focus_type} focus item with score ${focusItem.focus_score} ` +
      `will affect ${dependencyCount + 1} downstream entities if left unresolved within ${horizon}.`,
  });
  if (!impactResult.ok) return impactResult;

  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_IMPACT_SCORE_CALCULATED", input.actorId,
    { impactScore, severity }
  );

  // Cascade analysis and persist paths
  const cascade = analyzeCascadeEffects({
    focusType:    focusItem.focus_type,
    focusItemId:  input.focusItemId,
    entityCounts: { operational_focus_items: dependencyCount + 1 },
  });

  const chain = cascade.chain;
  for (let i = 0; i < chain.length - 1; i++) {
    const src = chain[i];
    const tgt = chain[i + 1];
    const pathResult = await dbCreateConsequencePath({
      workspaceId:      input.workspaceId,
      consequenceId:    consequence.id,
      sourceEntityType: src.entityType,
      sourceEntityId:   src.entityId === "cascade" ? consequence.id : src.entityId,
      targetEntityType: tgt.entityType,
      targetEntityId:   tgt.entityId === "cascade" ? consequence.id : tgt.entityId,
      relationshipType: "cascade_effect",
      cascadeDepth:     i,
    });
    if (!pathResult.ok) return pathResult;
  }

  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_CASCADE_ANALYZED", input.actorId,
    { cascadeDepth: cascade.maxDepth, totalAffectedEntities: cascade.totalAffectedEntities }
  );

  // Generate and persist scenarios
  const scenarios = generateConsequenceScenarios({
    focusType:             focusItem.focus_type,
    severity,
    escalationProbability,
    impactScore,
  });

  for (const s of scenarios) {
    const scenarioResult = await dbCreateConsequenceScenario({
      workspaceId:         input.workspaceId,
      consequenceId:       consequence.id,
      scenarioName:        s.name,
      scenarioDescription: s.description,
      probability:         s.probability,
    });
    if (!scenarioResult.ok) return scenarioResult;
  }

  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_SCENARIO_GENERATED", input.actorId,
    { scenarioCount: scenarios.length }
  );

  // Decision support event
  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_DECISION_SUPPORT_GENERATED", input.actorId,
    {
      recommendedAction:     FOCUS_TYPE_TO_IMPACT_TYPE[focusItem.focus_type],
      impactIfIgnored:       severity,
      blockedEntityCount:    dependencyCount + 1,
      escalationProbability,
    }
  );

  await emitConsequenceEvent(
    input.workspaceId, consequence.id, input.focusItemId, projectId,
    "OPERATIONAL_ESCALATION_PROBABILITY_CALCULATED", input.actorId,
    { escalationProbability }
  );

  return { ok: true, data: consequence };
}

// ─── getOperationalConsequence ────────────────────────────────────────────────

export async function getOperationalConsequence(
  input: GetConsequenceInput
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");
  return dbFindConsequenceById(input.consequenceId, input.workspaceId);
}

// ─── listOperationalConsequences ──────────────────────────────────────────────

export async function listOperationalConsequences(
  input: ListConsequencesInput
): Promise<ConsequenceResult<OperationalConsequenceRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.focusItemId && !validUuid(input.focusItemId)) {
    return validation("focusItemId must be a UUID.");
  }
  if (input.analysisStatus && !CONSEQUENCE_ANALYSIS_STATUSES.includes(input.analysisStatus)) {
    return validation(`analysisStatus must be one of: ${CONSEQUENCE_ANALYSIS_STATUSES.join(", ")}.`);
  }
  return dbListConsequences(input);
}

// ─── validateOperationalConsequence ──────────────────────────────────────────

export async function validateOperationalConsequence(
  input: ValidateConsequenceInput
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");
  if (!validUuid(input.actorId))       return validation("actorId must be a UUID.");

  const current = await dbFindConsequenceById(input.consequenceId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.analysis_status !== "generated") {
    return validation(
      `Consequence can only be validated from 'generated' status (current: ${current.data.analysis_status}).`
    );
  }

  const result = await dbUpdateConsequenceStatus(input.consequenceId, input.workspaceId, "validated");
  if (!result.ok) return result;

  const projectId = await resolveProjectId(result.data.focus_item_id, input.workspaceId);
  await emitConsequenceEvent(
    input.workspaceId, input.consequenceId, result.data.focus_item_id, projectId,
    "OPERATIONAL_CONSEQUENCE_VALIDATED", input.actorId
  );

  return result;
}

// ─── archiveOperationalConsequence ────────────────────────────────────────────

export async function archiveOperationalConsequence(
  input: ArchiveConsequenceInput
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");
  if (!validUuid(input.actorId))       return validation("actorId must be a UUID.");

  const current = await dbFindConsequenceById(input.consequenceId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.analysis_status === "archived") {
    return validation("Consequence is already archived.");
  }

  const result = await dbUpdateConsequenceStatus(input.consequenceId, input.workspaceId, "archived");
  if (!result.ok) return result;

  const projectId = await resolveProjectId(result.data.focus_item_id, input.workspaceId);
  await emitConsequenceEvent(
    input.workspaceId, input.consequenceId, result.data.focus_item_id, projectId,
    "OPERATIONAL_CONSEQUENCE_ARCHIVED", input.actorId
  );

  return result;
}

// ─── getConsequenceAnalysis ───────────────────────────────────────────────────
// Returns the full consequence with all sub-entities and decision support.

export async function getConsequenceAnalysis(
  input: GetConsequenceInput
): Promise<ConsequenceResult<ConsequenceAnalysis>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");

  const [cResult, impactsResult, pathsResult, scenariosResult] = await Promise.all([
    dbFindConsequenceById(input.consequenceId, input.workspaceId),
    dbListConsequenceImpacts(input.consequenceId, input.workspaceId),
    dbListConsequencePaths(input.consequenceId, input.workspaceId),
    dbListConsequenceScenarios(input.consequenceId, input.workspaceId),
  ]);

  if (!cResult.ok)         return cResult;
  if (!impactsResult.ok)   return impactsResult;
  if (!pathsResult.ok)     return pathsResult;
  if (!scenariosResult.ok) return scenariosResult;

  const consequence = cResult.data;
  const impacts     = impactsResult.data;
  const paths       = pathsResult.data;
  const scenarios   = scenariosResult.data;

  const totalAffected = impacts.reduce((s, i) => s + i.affected_entity_count, 0);

  const decisionSupport: DecisionSupport = generateDecisionSupport({
    focusItemId:           consequence.focus_item_id,
    focusType:             impacts[0]?.impact_type ?? "governance",
    recommendedActionType: null,
    blockedEntityCount:    totalAffected,
    escalationProbability: consequence.escalation_probability,
    severity:              consequence.severity,
    impactHorizon:         consequence.impact_horizon,
    impactScore:           consequence.impact_score,
  });

  return {
    ok: true,
    data: { consequence, impacts, paths, scenarios, decisionSupport },
  };
}

// ─── getOperationalConsequenceLineageForConsequence ───────────────────────────

export async function getOperationalConsequenceLineageForConsequence(
  input: GetConsequenceLineageInput
): Promise<ConsequenceResult<ConsequenceLineage>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");
  if (!validUuid(input.actorId))       return validation("actorId must be a UUID.");

  const result = await getOperationalConsequenceLineage({
    workspaceId:   input.workspaceId,
    consequenceId: input.consequenceId,
  });

  if (result.ok) {
    const projectId = await resolveProjectId(result.data.focusItemId, input.workspaceId);
    await emitConsequenceEvent(
      input.workspaceId, input.consequenceId, result.data.focusItemId, projectId,
      "OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED", input.actorId,
      { layerCount: result.data.chain.length }
    );
  }

  return result;
}
