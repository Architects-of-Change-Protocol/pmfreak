"server-only";

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES,
  type PersonalExtractionResult,
  type PersonalPatternCandidate,
  type PersonalPatternCandidateExplanation,
  type PersonalPatternCandidateExport,
  type PersonalPatternCandidateObservation,
  type PersonalPatternCandidateSource,
  type PersonalPatternCandidateHealth,
  type PersonalPatternExtractionResult,
  type PersonalPatternExtractionRun,
} from "./types";
import {
  ALL_PERSONAL_RULE_IDS,
  getAllPersonalRules,
  getPersonalRuleById,
  PERSONAL_RULE_REGISTRY,
  PERSONAL_RULE_REPEATED_DECISION,
  PERSONAL_RULE_REPEATED_ESCALATION,
  PERSONAL_RULE_REPEATED_RISK_RESPONSE,
  PERSONAL_RULE_REPEATED_STAKEHOLDER,
} from "./rule-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
function validation<T>(error: string): PersonalExtractionResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
type FailureClass = "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation";
function failed<T>(error: string, failureClass: FailureClass = "persistence_failed"): PersonalExtractionResult<T> { return { ok: false, error, failureClass }; }

const candidateColumns = "id,workspace_id,pm_user_id,candidate_category,candidate_title,candidate_summary,confidence,status,observation_count,created_at,updated_at,metadata";
const sourceColumns = "id,candidate_id,source_type,source_id,relationship_type,created_at";
const runColumns = "id,workspace_id,pm_user_id,started_at,completed_at,candidate_count,rule_count,metadata";

// ─── Audit event emission ─────────────────────────────────────────────────────

async function emitPersonalExtractionEvent(
  workspaceId: string,
  eventType: string,
  actorId: string | null | undefined,
  payload: Record<string, unknown>,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalExtractionResult<true>> {
  const result = await createPlatformEvent({
    workspaceId,
    actorId: actorId ?? null,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? null,
    causationId: causationId ?? null,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: payload,
  });
  if (!result.ok) return { ok: false, error: result.error, failureClass: "event_emission_failed" };
  return { ok: true, data: true };
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

export async function evaluatePersonalPatternRule(
  ruleId: (typeof ALL_PERSONAL_RULE_IDS)[number],
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalExtractionResult<PersonalPatternCandidateObservation[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const rule = PERSONAL_RULE_REGISTRY[ruleId];
  const supabase = await createSupabaseServerClient();
  const observations: PersonalPatternCandidateObservation[] = [];

  if (ruleId === PERSONAL_RULE_REPEATED_ESCALATION) {
    const { data: memories, error } = await supabase
      .from("personal_pm_memory")
      .select("id,memory_category,status")
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .eq("memory_category", "escalation_behavior")
      .eq("status", "active")
      .returns<Array<{ id: string; memory_category: string; status: string }>>();
    if (error) return failed("Unable to query personal_pm_memory for escalation rule.");

    const ids = (memories ?? []).map((m: { id: string; memory_category: string; status: string }) => m.id);
    if (ids.length >= rule.minimumOccurrences) {
      observations.push({
        ruleId,
        groupKey: "personal_memory::escalation_behavior",
        occurrenceCount: ids.length,
        sourceType: "personal_memory",
        sourceIds: ids,
        candidateTitle: "Recurring escalation behavior in personal memory",
        candidateSummary: `${ids.length} escalation behavior records found in personal memory. Recurring escalation behaviors may indicate a personal PM pattern worth capturing and reviewing.`,
        candidateCategory: rule.candidateCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === PERSONAL_RULE_REPEATED_STAKEHOLDER) {
    const { data: memories, error } = await supabase
      .from("personal_pm_memory")
      .select("id,memory_category,status")
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .eq("memory_category", "stakeholder_behavior")
      .eq("status", "active")
      .returns<Array<{ id: string; memory_category: string; status: string }>>();
    if (error) return failed("Unable to query personal_pm_memory for stakeholder rule.");

    const ids = (memories ?? []).map((m: { id: string; memory_category: string; status: string }) => m.id);
    if (ids.length >= rule.minimumOccurrences) {
      observations.push({
        ruleId,
        groupKey: "personal_memory::stakeholder_behavior",
        occurrenceCount: ids.length,
        sourceType: "personal_memory",
        sourceIds: ids,
        candidateTitle: "Recurring stakeholder management behavior in personal memory",
        candidateSummary: `${ids.length} stakeholder behavior records found in personal memory. Recurring stakeholder management behaviors may indicate a personal PM pattern worth capturing and reviewing.`,
        candidateCategory: rule.candidateCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === PERSONAL_RULE_REPEATED_RISK_RESPONSE) {
    const { data: effectiveness, error } = await supabase
      .from("personal_pm_effectiveness")
      .select("id,outcome_classification,effectiveness_status")
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .in("outcome_classification", ["success", "partial_success"])
      .eq("effectiveness_status", "validated")
      .returns<Array<{ id: string; outcome_classification: string; effectiveness_status: string }>>();
    if (error) return failed("Unable to query personal_pm_effectiveness for risk response rule.");

    const groupCounts = new Map<string, string[]>();
    for (const e of effectiveness ?? []) {
      const group = groupCounts.get(e.outcome_classification) ?? [];
      group.push(e.id);
      groupCounts.set(e.outcome_classification, group);
    }

    for (const [classification, ids] of groupCounts.entries()) {
      if (ids.length < rule.minimumOccurrences) continue;
      observations.push({
        ruleId,
        groupKey: `personal_effectiveness::${classification}`,
        occurrenceCount: ids.length,
        sourceType: "personal_effectiveness",
        sourceIds: ids,
        candidateTitle: `Recurring ${classification.replace(/_/g, " ")} risk response outcomes`,
        candidateSummary: `${ids.length} personal effectiveness records with "${classification}" outcome classification. Repeated successful risk responses may indicate a personal PM pattern worth capturing.`,
        candidateCategory: rule.candidateCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === PERSONAL_RULE_REPEATED_DECISION) {
    const { data: memories, error } = await supabase
      .from("personal_pm_memory")
      .select("id,memory_category,status")
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .eq("memory_category", "decision_behavior")
      .eq("status", "active")
      .returns<Array<{ id: string; memory_category: string; status: string }>>();
    if (error) return failed("Unable to query personal_pm_memory for decision rule.");

    const ids = (memories ?? []).map((m: { id: string; memory_category: string; status: string }) => m.id);
    if (ids.length >= rule.minimumOccurrences) {
      observations.push({
        ruleId,
        groupKey: "personal_memory::decision_behavior",
        occurrenceCount: ids.length,
        sourceType: "personal_memory",
        sourceIds: ids,
        candidateTitle: "Recurring decision behavior in personal memory",
        candidateSummary: `${ids.length} decision behavior records found in personal memory. Recurring decision behaviors may indicate a personal PM pattern worth capturing and reviewing.`,
        candidateCategory: rule.candidateCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  return { ok: true, data: observations };
}

// ─── Candidate creation ───────────────────────────────────────────────────────

export async function createPersonalPatternCandidate(input: {
  workspaceId: string;
  pmUserId: string;
  observation: PersonalPatternCandidateObservation;
  runId: string;
  actorId?: string | null;
  correlationId?: string | null;
}): Promise<PersonalExtractionResult<PersonalPatternCandidate>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!validUuid(input.runId)) return validation("runId must be a UUID.");
  if (!required(input.observation.candidateTitle)) return validation("candidateTitle is required.");

  const supabase = await createSupabaseServerClient();

  // Skip duplicate: same rule + groupKey still open for this PM
  const { data: existing } = await supabase
    .from("personal_pm_pattern_candidates")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("pm_user_id", input.pmUserId)
    .eq("status", "candidate")
    .contains("metadata", { groupKey: input.observation.groupKey })
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (existing && existing.length > 0) {
    return failed("Candidate already exists for this rule/groupKey combination.", "governance_violation");
  }

  const { data: candidate, error } = await supabase
    .from("personal_pm_pattern_candidates")
    .insert({
      workspace_id: input.workspaceId,
      pm_user_id: input.pmUserId,
      candidate_category: input.observation.candidateCategory,
      candidate_title: input.observation.candidateTitle.trim(),
      candidate_summary: input.observation.candidateSummary.trim(),
      confidence: input.observation.confidence,
      status: "candidate",
      observation_count: input.observation.occurrenceCount,
      metadata: {
        groupKey: input.observation.groupKey,
        ruleId: input.observation.ruleId,
        runId: input.runId,
      },
    })
    .select(candidateColumns)
    .single<PersonalPatternCandidate>();
  if (error || !candidate) return failed("Unable to create personal pattern candidate.");

  // Attach sources
  if (input.observation.sourceIds.length > 0) {
    const { error: srcError } = await supabase
      .from("personal_pm_pattern_candidate_sources")
      .insert(
        input.observation.sourceIds.map((id) => ({
          candidate_id: candidate.id,
          source_type: input.observation.sourceType,
          source_id: id,
          relationship_type: "supports",
        })),
      );
    if (srcError) return failed("Unable to attach candidate sources.");
  }

  const emitted = await emitPersonalExtractionEvent(
    input.workspaceId,
    "PERSONAL_PATTERN_CANDIDATE_CREATED",
    input.actorId,
    {
      candidateId: candidate.id,
      pmUserId: input.pmUserId,
      ruleId: input.observation.ruleId,
      candidateCategory: candidate.candidate_category,
      observationCount: candidate.observation_count,
      runId: input.runId,
    },
    input.correlationId ?? candidate.id,
  );
  if (!emitted.ok) return emitted as PersonalExtractionResult<PersonalPatternCandidate>;

  return { ok: true, data: candidate };
}

// ─── List candidates ──────────────────────────────────────────────────────────

export async function listPersonalPatternCandidates(
  workspaceId: string,
  pmUserId: string,
  statusFilter?: PersonalPatternCandidate["status"],
): Promise<PersonalExtractionResult<PersonalPatternCandidate[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("personal_pm_pattern_candidates")
    .select(candidateColumns)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .order("updated_at", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error } = await query.returns<PersonalPatternCandidate[]>();
  if (error || !data) return failed("Unable to list personal pattern candidates.");
  return { ok: true, data };
}

export async function getPersonalPatternCandidate(
  candidateId: string,
  pmUserId: string,
): Promise<PersonalExtractionResult<PersonalPatternCandidate>> {
  if (!validUuid(candidateId)) return validation("candidateId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_pattern_candidates")
    .select(candidateColumns)
    .eq("id", candidateId)
    .eq("pm_user_id", pmUserId)
    .single<PersonalPatternCandidate>();
  if (error || !data) return failed("Personal pattern candidate not found.", "not_found");
  return { ok: true, data };
}

// ─── Candidate lifecycle ──────────────────────────────────────────────────────

async function setCandidateStatus(
  candidateId: string,
  pmUserId: string,
  status: "rejected" | "archived",
  eventType: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalExtractionResult<PersonalPatternCandidate>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalPatternCandidate(candidateId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "promoted") return failed("Promoted candidates are immutable.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_pattern_candidates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .eq("pm_user_id", pmUserId)
    .select(candidateColumns)
    .single<PersonalPatternCandidate>();
  if (error || !data) return failed(`Unable to ${status} personal candidate.`);

  const emitted = await emitPersonalExtractionEvent(
    data.workspace_id,
    eventType,
    actorId,
    { candidateId: data.id, pmUserId: data.pm_user_id, candidateCategory: data.candidate_category },
    correlationId ?? data.id,
    causationId,
  );
  if (!emitted.ok) return emitted as PersonalExtractionResult<PersonalPatternCandidate>;
  return { ok: true, data };
}

export const rejectPersonalPatternCandidate = (
  candidateId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
) => setCandidateStatus(candidateId, pmUserId, "rejected", "PERSONAL_PATTERN_CANDIDATE_REJECTED", actorId, correlationId, causationId);

export const archivePersonalPatternCandidate = (
  candidateId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
) => setCandidateStatus(candidateId, pmUserId, "archived", "PERSONAL_PATTERN_CANDIDATE_ARCHIVED", actorId, correlationId, causationId);

// ─── Promotion ────────────────────────────────────────────────────────────────

export async function promotePersonalPatternCandidate(
  candidateId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalExtractionResult<{ candidate: PersonalPatternCandidate; patternId: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const current = await getPersonalPatternCandidate(candidateId, pmUserId);
  if (!current.ok) return current as PersonalExtractionResult<{ candidate: PersonalPatternCandidate; patternId: string }>;
  if (current.data.status !== "candidate") {
    return failed(`Only candidates can be promoted; current status is '${current.data.status}'.`, "governance_violation");
  }

  const supabase = await createSupabaseServerClient();

  // Create personal_pm_patterns record to preserve lineage
  const { data: pattern, error: patternError } = await supabase
    .from("personal_pm_patterns")
    .insert({
      workspace_id: current.data.workspace_id,
      pm_user_id: pmUserId,
      pattern_category: current.data.candidate_category,
      title: current.data.candidate_title,
      summary: current.data.candidate_summary,
      confidence: current.data.confidence,
      status: "active",
      created_by: actorId,
      metadata: {
        promoted_from_candidate_id: current.data.id,
        rule_id: current.data.metadata.ruleId,
        observation_count: current.data.observation_count,
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (patternError || !pattern) return failed("Unable to create personal pattern from candidate.");

  const { data: promoted, error } = await supabase
    .from("personal_pm_pattern_candidates")
    .update({
      status: "promoted",
      updated_at: new Date().toISOString(),
      metadata: {
        ...current.data.metadata,
        promoted_pattern_id: pattern.id,
        promoted_at: new Date().toISOString(),
        promoted_by: actorId,
      },
    })
    .eq("id", candidateId)
    .eq("pm_user_id", pmUserId)
    .select(candidateColumns)
    .single<PersonalPatternCandidate>();
  if (error || !promoted) return failed("Unable to mark candidate as promoted.");

  const emitted = await emitPersonalExtractionEvent(
    promoted.workspace_id,
    "PERSONAL_PATTERN_CANDIDATE_PROMOTED",
    actorId,
    {
      candidateId: promoted.id,
      pmUserId: promoted.pm_user_id,
      patternId: pattern.id,
      candidateCategory: promoted.candidate_category,
    },
    correlationId ?? candidateId,
    causationId,
  );
  if (!emitted.ok) return emitted as PersonalExtractionResult<{ candidate: PersonalPatternCandidate; patternId: string }>;

  return { ok: true, data: { candidate: promoted, patternId: pattern.id } };
}

// ─── Explanation ──────────────────────────────────────────────────────────────

export async function explainPersonalPatternCandidate(
  candidateId: string,
  pmUserId: string,
): Promise<PersonalExtractionResult<PersonalPatternCandidateExplanation>> {
  const candidate = await getPersonalPatternCandidate(candidateId, pmUserId);
  if (!candidate.ok) return candidate as PersonalExtractionResult<PersonalPatternCandidateExplanation>;

  const ruleId = String(candidate.data.metadata.ruleId ?? "");
  const rule = getPersonalRuleById(ruleId);

  const supabase = await createSupabaseServerClient();
  const { data: sources } = await supabase
    .from("personal_pm_pattern_candidate_sources")
    .select(sourceColumns)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true })
    .returns<PersonalPatternCandidateSource[]>();

  const allSources = sources ?? [];
  const byType = (type: PersonalPatternCandidateSource["source_type"]) =>
    allSources.filter((s: PersonalPatternCandidateSource) => s.source_type === type);

  const reconstructedObservation: PersonalPatternCandidateObservation = {
    ruleId,
    groupKey: String(candidate.data.metadata.groupKey ?? ""),
    occurrenceCount: candidate.data.observation_count,
    sourceType: allSources[0]?.source_type ?? "personal_memory",
    sourceIds: allSources.map((s: PersonalPatternCandidateSource) => s.source_id),
    candidateTitle: candidate.data.candidate_title,
    candidateSummary: candidate.data.candidate_summary,
    candidateCategory: candidate.data.candidate_category,
    confidence: candidate.data.confidence,
  };

  return {
    ok: true,
    data: {
      candidate: candidate.data,
      rulesTriggered: rule ? [rule] : [],
      observations: [reconstructedObservation],
      sourceEvents: byType("platform_event"),
      sourceDecisions: byType("decision"),
      sourceOutcomes: byType("outcome"),
      sourcePersonalMemory: byType("personal_memory"),
      sourcePersonalPatterns: byType("personal_pattern"),
      sourcePersonalEffectiveness: byType("personal_effectiveness"),
    },
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportPersonalPatternCandidate(
  candidateId: string,
  pmUserId: string,
): Promise<PersonalExtractionResult<PersonalPatternCandidateExport>> {
  const explanation = await explainPersonalPatternCandidate(candidateId, pmUserId);
  if (!explanation.ok) return explanation as PersonalExtractionResult<PersonalPatternCandidateExport>;

  const promotedPatternId = String(explanation.data.candidate.metadata.promoted_pattern_id ?? "null") === "null"
    ? null
    : String(explanation.data.candidate.metadata.promoted_pattern_id);

  return {
    ok: true,
    data: {
      candidate: explanation.data.candidate,
      rules: explanation.data.rulesTriggered,
      observations: explanation.data.observations,
      sources: [
        ...explanation.data.sourceEvents,
        ...explanation.data.sourceDecisions,
        ...explanation.data.sourceOutcomes,
        ...explanation.data.sourcePersonalMemory,
        ...explanation.data.sourcePersonalPatterns,
        ...explanation.data.sourcePersonalEffectiveness,
      ],
      lineage: { promotedPatternId },
    },
  };
}

// ─── Extraction run ───────────────────────────────────────────────────────────

export async function runPersonalPatternExtraction(
  workspaceId: string,
  pmUserId: string,
  actorId?: string | null,
): Promise<PersonalExtractionResult<PersonalPatternExtractionResult>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: run, error: runError } = await supabase
    .from("personal_pm_pattern_extraction_runs")
    .insert({
      workspace_id: workspaceId,
      pm_user_id: pmUserId,
      rule_count: ALL_PERSONAL_RULE_IDS.length,
    })
    .select(runColumns)
    .single<PersonalPatternExtractionRun>();
  if (runError || !run) return failed("Unable to create personal pattern extraction run.");

  await emitPersonalExtractionEvent(
    workspaceId,
    "PERSONAL_PATTERN_EXTRACTION_RUN_STARTED",
    actorId,
    { runId: run.id, pmUserId, ruleCount: ALL_PERSONAL_RULE_IDS.length },
    run.id,
  );

  const allObservations: PersonalPatternCandidateObservation[] = [];
  let candidatesCreated = 0;
  let candidatesSkipped = 0;

  for (const ruleId of ALL_PERSONAL_RULE_IDS) {
    const result = await evaluatePersonalPatternRule(ruleId, workspaceId, pmUserId);
    if (!result.ok) continue;

    for (const observation of result.data) {
      allObservations.push(observation);
      const created = await createPersonalPatternCandidate({
        workspaceId,
        pmUserId,
        observation,
        runId: run.id,
        actorId,
        correlationId: run.id,
      });
      if (created.ok) candidatesCreated++;
      else candidatesSkipped++;
    }
  }

  await supabase
    .from("personal_pm_pattern_extraction_runs")
    .update({ completed_at: new Date().toISOString(), candidate_count: candidatesCreated })
    .eq("id", run.id);

  await emitPersonalExtractionEvent(
    workspaceId,
    "PERSONAL_PATTERN_EXTRACTION_RUN_COMPLETED",
    actorId,
    {
      runId: run.id,
      pmUserId,
      candidatesCreated,
      candidatesSkipped,
      rulesEvaluated: ALL_PERSONAL_RULE_IDS.length,
    },
    run.id,
  );

  return {
    ok: true,
    data: {
      runId: run.id,
      workspaceId,
      pmUserId,
      rulesEvaluated: ALL_PERSONAL_RULE_IDS.length,
      candidatesCreated,
      candidatesSkipped,
      observations: allObservations,
    },
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getPersonalPatternExtractionHealth(
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalExtractionResult<PersonalPatternCandidateHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const [candidatesRes, runsRes] = await Promise.all([
    supabase
      .from("personal_pm_pattern_candidates")
      .select(candidateColumns)
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .returns<PersonalPatternCandidate[]>(),
    supabase
      .from("personal_pm_pattern_extraction_runs")
      .select(runColumns)
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .returns<PersonalPatternExtractionRun[]>(),
  ]);

  if (candidatesRes.error || runsRes.error) return failed("Unable to load personal extraction health data.");

  const candidates = candidatesRes.data ?? [];
  const runs = runsRes.data ?? [];
  const totalCandidatesAcrossRuns = runs.reduce((sum: number, r: PersonalPatternExtractionRun) => sum + r.candidate_count, 0);

  return {
    ok: true,
    data: {
      runCount: runs.length,
      candidateCount: candidates.length,
      promotedCount: candidates.filter((c: PersonalPatternCandidate) => c.status === "promoted").length,
      rejectedCount: candidates.filter((c: PersonalPatternCandidate) => c.status === "rejected").length,
      archivedCount: candidates.filter((c: PersonalPatternCandidate) => c.status === "archived").length,
      averageCandidatesPerRun: runs.length ? totalCandidatesAcrossRuns / runs.length : 0,
    },
  };
}

export { getAllPersonalRules, getPersonalRuleById };
