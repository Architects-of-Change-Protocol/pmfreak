import { createPlatformEvent } from "@/lib/platform-events";
import { createPattern } from "@/lib/organizational-patterns/pattern-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXTRACTION_MINIMUM_OCCURRENCES,
  type ExtractionResult,
  type PatternCandidate,
  type PatternCandidateExplanation,
  type PatternCandidateExport,
  type PatternCandidateRule,
  type PatternCandidateSource,
  type PatternExtractionHealth,
  type PatternExtractionObservation,
  type PatternExtractionResult,
  type PatternExtractionRun,
} from "./types";
import {
  ALL_RULE_IDS,
  getAllRules,
  getRuleById,
  RULE_REGISTRY,
  RULE_REPEATED_DECISION_OUTCOME,
  RULE_REPEATED_DECISION_REJECTION,
  RULE_REPEATED_DEPENDENCY_DELAY,
  RULE_REPEATED_RISK_ESCALATION,
} from "./rule-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
function validation<T>(error: string): ExtractionResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" = "persistence_failed"): ExtractionResult<T> { return { ok: false, error, failureClass }; }

const candidateColumns = "id,workspace_id,pattern_category,candidate_title,candidate_summary,observation_count,confidence,status,rule_id,promoted_pattern_id,created_at,updated_at,metadata";
const sourceColumns = "id,candidate_id,source_type,source_id,source_label,created_at";
const runColumns = "id,workspace_id,started_at,completed_at,candidate_count,rule_count,metadata";

// ─── Audit event emission ─────────────────────────────────────────────────────

async function emitExtractionEvent(
  workspaceId: string,
  eventType: string,
  actorId: string | null | undefined,
  payload: Record<string, unknown>,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<ExtractionResult<true>> {
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
    eventPayload: payload,
  });
  if (!result.ok) return { ok: false, error: result.error, failureClass: "event_emission_failed" };
  return { ok: true, data: true };
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

export async function evaluateRule(
  ruleId: (typeof ALL_RULE_IDS)[number],
  workspaceId: string,
): Promise<ExtractionResult<PatternExtractionObservation[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const rule = RULE_REGISTRY[ruleId];
  const supabase = await createSupabaseServerClient();
  const observations: PatternExtractionObservation[] = [];

  if (ruleId === RULE_REPEATED_DECISION_OUTCOME) {
    const { data: decisions, error } = await supabase
      .from("project_decisions")
      .select("id,decision_type,decision_status")
      .eq("workspace_id", workspaceId)
      .eq("decision_status", "implemented")
      .returns<Array<{ id: string; decision_type: string; decision_status: string }>>();
    if (error) return failed("Unable to query project_decisions for rule evaluation.");

    const { data: outcomes, error: outErr } = await supabase
      .from("decision_outcomes")
      .select("id,decision_id,outcome_status,outcome_type")
      .eq("workspace_id", workspaceId)
      .returns<Array<{ id: string; decision_id: string; outcome_status: string; outcome_type: string }>>();
    if (outErr) return failed("Unable to query decision_outcomes for rule evaluation.");

    const outcomeByDecision = new Map<string, { outcome_status: string; outcome_id: string }>();
    for (const o of outcomes ?? []) outcomeByDecision.set(o.decision_id, { outcome_status: o.outcome_status, outcome_id: o.id });

    const groupCounts = new Map<string, { decisionIds: string[]; outcomeIds: string[] }>();
    for (const d of decisions ?? []) {
      const outcome = outcomeByDecision.get(d.id);
      if (!outcome) continue;
      const key = `${d.decision_type}::${outcome.outcome_status}`;
      const group = groupCounts.get(key) ?? { decisionIds: [], outcomeIds: [] };
      group.decisionIds.push(d.id);
      group.outcomeIds.push(outcome.outcome_id);
      groupCounts.set(key, group);
    }

    for (const [key, group] of groupCounts.entries()) {
      if (group.decisionIds.length < rule.minimumOccurrences) continue;
      const [decisionType, outcomeStatus] = key.split("::");
      observations.push({
        ruleId,
        groupKey: key,
        occurrenceCount: group.decisionIds.length,
        sourceType: "project_decision",
        sourceIds: group.decisionIds,
        sourceLabels: group.decisionIds.map((id) => `Decision ${id.slice(0, 8)} → ${decisionType} / ${outcomeStatus}`),
        candidateTitle: `Repeated ${decisionType.replace(/_/g, " ")} decisions produce ${outcomeStatus} outcomes`,
        candidateSummary: `${group.decisionIds.length} decisions of type "${decisionType}" resulted in "${outcomeStatus}" outcomes. This recurrence may indicate an organizational pattern worth capturing.`,
        patternCategory: rule.patternCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === RULE_REPEATED_RISK_ESCALATION) {
    const { data: risks, error } = await supabase
      .from("raid_items")
      .select("id,category,status,fingerprint")
      .eq("workspace_id", workspaceId)
      .eq("category", "risk")
      .in("status", ["open", "monitoring"])
      .returns<Array<{ id: string; category: string; status: string; fingerprint: string }>>();
    if (error) return failed("Unable to query raid_items for risk escalation rule.");

    const groupCounts = new Map<string, string[]>();
    for (const r of risks ?? []) {
      const group = groupCounts.get(r.status) ?? [];
      group.push(r.id);
      groupCounts.set(r.status, group);
    }

    for (const [status, ids] of groupCounts.entries()) {
      if (ids.length < rule.minimumOccurrences) continue;
      observations.push({
        ruleId,
        groupKey: `risk::${status}`,
        occurrenceCount: ids.length,
        sourceType: "raid_item",
        sourceIds: ids,
        sourceLabels: ids.map((id) => `Risk item ${id.slice(0, 8)} (${status})`),
        candidateTitle: `Recurring open risks in workspace`,
        candidateSummary: `${ids.length} risk items are in "${status}" status. Repeated unresolved risks may indicate a systemic organizational risk pattern.`,
        patternCategory: rule.patternCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === RULE_REPEATED_DEPENDENCY_DELAY) {
    const { data: deps, error } = await supabase
      .from("raid_items")
      .select("id,category,status,fingerprint")
      .eq("workspace_id", workspaceId)
      .eq("category", "dependency")
      .in("status", ["open", "monitoring"])
      .returns<Array<{ id: string; category: string; status: string; fingerprint: string }>>();
    if (error) return failed("Unable to query raid_items for dependency delay rule.");

    const ids = (deps ?? []).map((d) => d.id);
    if (ids.length >= rule.minimumOccurrences) {
      observations.push({
        ruleId,
        groupKey: "dependency::open",
        occurrenceCount: ids.length,
        sourceType: "raid_item",
        sourceIds: ids,
        sourceLabels: ids.map((id) => `Dependency item ${id.slice(0, 8)}`),
        candidateTitle: `Recurring unresolved dependencies in workspace`,
        candidateSummary: `${ids.length} dependency items remain unresolved (open or monitoring). Repeated dependency delays may indicate a systemic organizational pattern.`,
        patternCategory: rule.patternCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  if (ruleId === RULE_REPEATED_DECISION_REJECTION) {
    const { data: decisions, error } = await supabase
      .from("project_decisions")
      .select("id,decision_type,decision_status")
      .eq("workspace_id", workspaceId)
      .eq("decision_status", "rejected")
      .returns<Array<{ id: string; decision_type: string; decision_status: string }>>();
    if (error) return failed("Unable to query project_decisions for rejection rule.");

    const groupCounts = new Map<string, string[]>();
    for (const d of decisions ?? []) {
      const group = groupCounts.get(d.decision_type) ?? [];
      group.push(d.id);
      groupCounts.set(d.decision_type, group);
    }

    for (const [decisionType, ids] of groupCounts.entries()) {
      if (ids.length < rule.minimumOccurrences) continue;
      observations.push({
        ruleId,
        groupKey: `rejected::${decisionType}`,
        occurrenceCount: ids.length,
        sourceType: "project_decision",
        sourceIds: ids,
        sourceLabels: ids.map((id) => `Rejected ${decisionType} decision ${id.slice(0, 8)}`),
        candidateTitle: `Repeated rejection of ${decisionType.replace(/_/g, " ")} decisions`,
        candidateSummary: `${ids.length} "${decisionType}" decisions were rejected. Repeated rejections may indicate a governance pattern or systemic approval friction.`,
        patternCategory: rule.patternCategory,
        confidence: rule.confidenceWhenMet,
      });
    }
  }

  return { ok: true, data: observations };
}

// ─── Candidate creation ───────────────────────────────────────────────────────

export async function createPatternCandidate(input: {
  workspaceId: string;
  observation: PatternExtractionObservation;
  runId: string;
  actorId?: string | null;
  correlationId?: string | null;
}): Promise<ExtractionResult<PatternCandidate>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.runId)) return validation("runId must be a UUID.");
  if (!required(input.observation.candidateTitle)) return validation("candidateTitle is required.");

  const supabase = await createSupabaseServerClient();

  // Skip duplicate: same rule + groupKey still open in this workspace
  const { data: existing } = await supabase
    .from("organizational_pattern_candidates")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("rule_id", input.observation.ruleId)
    .eq("status", "candidate")
    .contains("metadata", { groupKey: input.observation.groupKey })
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (existing && existing.length > 0) {
    return failed("Candidate already exists for this rule/groupKey combination.", "governance_violation");
  }

  const { data: candidate, error } = await supabase
    .from("organizational_pattern_candidates")
    .insert({
      workspace_id: input.workspaceId,
      pattern_category: input.observation.patternCategory,
      candidate_title: input.observation.candidateTitle.trim(),
      candidate_summary: input.observation.candidateSummary.trim(),
      observation_count: input.observation.occurrenceCount,
      confidence: input.observation.confidence,
      status: "candidate",
      rule_id: input.observation.ruleId,
      metadata: {
        groupKey: input.observation.groupKey,
        runId: input.runId,
      },
    })
    .select(candidateColumns)
    .single<PatternCandidate>();
  if (error || !candidate) return failed("Unable to create pattern candidate.");

  // Attach sources
  if (input.observation.sourceIds.length > 0) {
    const { error: srcError } = await supabase
      .from("pattern_candidate_sources")
      .insert(
        input.observation.sourceIds.map((id, i) => ({
          candidate_id: candidate.id,
          source_type: input.observation.sourceType,
          source_id: id,
          source_label: input.observation.sourceLabels[i] ?? id,
        })),
      );
    if (srcError) return failed("Unable to attach candidate sources.");
  }

  const emitted = await emitExtractionEvent(
    input.workspaceId,
    "PATTERN_CANDIDATE_CREATED",
    input.actorId,
    {
      candidateId: candidate.id,
      ruleId: candidate.rule_id,
      patternCategory: candidate.pattern_category,
      observationCount: candidate.observation_count,
      runId: input.runId,
    },
    input.correlationId ?? candidate.id,
  );
  if (!emitted.ok) return emitted as ExtractionResult<PatternCandidate>;

  return { ok: true, data: candidate };
}

// ─── List candidates ──────────────────────────────────────────────────────────

export async function listPatternCandidates(
  workspaceId: string,
  statusFilter?: PatternCandidate["status"],
): Promise<ExtractionResult<PatternCandidate[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("organizational_pattern_candidates")
    .select(candidateColumns)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error } = await query.returns<PatternCandidate[]>();
  if (error || !data) return failed("Unable to list pattern candidates.");
  return { ok: true, data };
}

export async function getPatternCandidate(candidateId: string): Promise<ExtractionResult<PatternCandidate>> {
  if (!validUuid(candidateId)) return validation("candidateId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_pattern_candidates")
    .select(candidateColumns)
    .eq("id", candidateId)
    .single<PatternCandidate>();
  if (error || !data) return failed("Pattern candidate not found.", "not_found");
  return { ok: true, data };
}

// ─── Candidate lifecycle ──────────────────────────────────────────────────────

async function setCandidateStatus(
  candidateId: string,
  status: "rejected" | "archived",
  eventType: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<ExtractionResult<PatternCandidate>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getPatternCandidate(candidateId);
  if (!current.ok) return current;
  if (current.data.status === "promoted") return failed("Promoted candidates are immutable.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_pattern_candidates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .select(candidateColumns)
    .single<PatternCandidate>();
  if (error || !data) return failed(`Unable to ${status} candidate.`);

  const emitted = await emitExtractionEvent(
    data.workspace_id,
    eventType,
    actorId,
    { candidateId: data.id, ruleId: data.rule_id, patternCategory: data.pattern_category },
    correlationId ?? data.id,
    causationId,
  );
  if (!emitted.ok) return emitted as ExtractionResult<PatternCandidate>;
  return { ok: true, data };
}

export const rejectPatternCandidate = (candidateId: string, actorId: string, correlationId?: string | null, causationId?: string | null) =>
  setCandidateStatus(candidateId, "rejected", "PATTERN_CANDIDATE_REJECTED", actorId, correlationId, causationId);

export const archivePatternCandidate = (candidateId: string, actorId: string, correlationId?: string | null, causationId?: string | null) =>
  setCandidateStatus(candidateId, "archived", "PATTERN_CANDIDATE_ARCHIVED", actorId, correlationId, causationId);

// ─── Promotion ────────────────────────────────────────────────────────────────

export async function promotePatternCandidate(
  candidateId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<ExtractionResult<{ candidate: PatternCandidate; patternId: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getPatternCandidate(candidateId);
  if (!current.ok) return current as ExtractionResult<{ candidate: PatternCandidate; patternId: string }>;
  if (current.data.status !== "candidate") {
    return failed(`Only candidates can be promoted; current status is '${current.data.status}'.`, "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data: sources } = await supabase
    .from("pattern_candidate_sources")
    .select(sourceColumns)
    .eq("candidate_id", candidateId)
    .returns<PatternCandidateSource[]>();

  const patternSources = (sources ?? []).map((s) => ({
    sourceType: "platform_event" as const,
    sourceId: s.source_id,
    relationshipType: "supports" as const,
  }));

  // Must have at least one source; fall back to a self-referencing placeholder only if none
  const finalSources = patternSources.length > 0
    ? patternSources
    : [{ sourceType: "platform_event" as const, sourceId: current.data.id, relationshipType: "derived_from" as const }];

  const patternResult = await createPattern({
    workspaceId: current.data.workspace_id,
    patternCategory: current.data.pattern_category,
    confidence: current.data.confidence,
    title: current.data.candidate_title,
    summary: current.data.candidate_summary,
    createdBy: actorId,
    metadata: {
      promoted_from_candidate_id: current.data.id,
      rule_id: current.data.rule_id,
      observation_count: current.data.observation_count,
    },
    sources: finalSources,
    correlationId: correlationId ?? candidateId,
    causationId: causationId ?? null,
  });
  if (!patternResult.ok) return failed(`Unable to create pattern from candidate: ${patternResult.error}`);

  const { data: promoted, error } = await supabase
    .from("organizational_pattern_candidates")
    .update({ status: "promoted", promoted_pattern_id: patternResult.data.id, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .select(candidateColumns)
    .single<PatternCandidate>();
  if (error || !promoted) return failed("Unable to mark candidate as promoted.");

  const emitted = await emitExtractionEvent(
    promoted.workspace_id,
    "PATTERN_CANDIDATE_PROMOTED",
    actorId,
    {
      candidateId: promoted.id,
      patternId: patternResult.data.id,
      ruleId: promoted.rule_id,
      patternCategory: promoted.pattern_category,
    },
    correlationId ?? candidateId,
    causationId,
  );
  if (!emitted.ok) return emitted as ExtractionResult<{ candidate: PatternCandidate; patternId: string }>;

  return { ok: true, data: { candidate: promoted, patternId: patternResult.data.id } };
}

// ─── Explanation ──────────────────────────────────────────────────────────────

export async function explainPatternCandidate(candidateId: string): Promise<ExtractionResult<PatternCandidateExplanation>> {
  const candidate = await getPatternCandidate(candidateId);
  if (!candidate.ok) return candidate as ExtractionResult<PatternCandidateExplanation>;

  const rule = getRuleById(candidate.data.rule_id);

  const supabase = await createSupabaseServerClient();
  const { data: sources } = await supabase
    .from("pattern_candidate_sources")
    .select(sourceColumns)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true })
    .returns<PatternCandidateSource[]>();

  const allSources = sources ?? [];
  const byType = (type: PatternCandidateSource["source_type"]) => allSources.filter((s) => s.source_type === type);

  const reconstructedObservation: PatternExtractionObservation = {
    ruleId: candidate.data.rule_id,
    groupKey: String(candidate.data.metadata.groupKey ?? ""),
    occurrenceCount: candidate.data.observation_count,
    sourceType: allSources[0]?.source_type ?? "other",
    sourceIds: allSources.map((s) => s.source_id),
    sourceLabels: allSources.map((s) => s.source_label),
    candidateTitle: candidate.data.candidate_title,
    candidateSummary: candidate.data.candidate_summary,
    patternCategory: candidate.data.pattern_category,
    confidence: candidate.data.confidence,
  };

  return {
    ok: true,
    data: {
      candidate: candidate.data,
      rulesTriggered: rule ? [rule] : [],
      observations: [reconstructedObservation],
      sourceEvents: byType("platform_event"),
      sourceDecisions: byType("project_decision"),
      sourceOutcomes: byType("decision_outcome"),
      sourcePatterns: byType("organizational_memory"),
    },
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportPatternCandidate(candidateId: string): Promise<ExtractionResult<PatternCandidateExport>> {
  const explanation = await explainPatternCandidate(candidateId);
  if (!explanation.ok) return explanation as ExtractionResult<PatternCandidateExport>;

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
        ...explanation.data.sourcePatterns,
      ],
      lineage: { promotedPatternId: explanation.data.candidate.promoted_pattern_id },
    },
  };
}

// ─── Extraction run ───────────────────────────────────────────────────────────

export async function runPatternExtraction(
  workspaceId: string,
  actorId?: string | null,
): Promise<ExtractionResult<PatternExtractionResult>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: run, error: runError } = await supabase
    .from("pattern_extraction_runs")
    .insert({ workspace_id: workspaceId, rule_count: ALL_RULE_IDS.length })
    .select(runColumns)
    .single<PatternExtractionRun>();
  if (runError || !run) return failed("Unable to create extraction run.");

  await emitExtractionEvent(
    workspaceId,
    "PATTERN_EXTRACTION_RUN_STARTED",
    actorId,
    { runId: run.id, ruleCount: ALL_RULE_IDS.length },
    run.id,
  );

  const allObservations: PatternExtractionObservation[] = [];
  let candidatesCreated = 0;
  let candidatesSkipped = 0;

  for (const ruleId of ALL_RULE_IDS) {
    const result = await evaluateRule(ruleId, workspaceId);
    if (!result.ok) continue;

    for (const observation of result.data) {
      allObservations.push(observation);
      const created = await createPatternCandidate({
        workspaceId,
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
    .from("pattern_extraction_runs")
    .update({ completed_at: new Date().toISOString(), candidate_count: candidatesCreated })
    .eq("id", run.id);

  await emitExtractionEvent(
    workspaceId,
    "PATTERN_EXTRACTION_RUN_COMPLETED",
    actorId,
    {
      runId: run.id,
      candidatesCreated,
      candidatesSkipped,
      rulesEvaluated: ALL_RULE_IDS.length,
    },
    run.id,
  );

  return {
    ok: true,
    data: {
      runId: run.id,
      workspaceId,
      rulesEvaluated: ALL_RULE_IDS.length,
      candidatesCreated,
      candidatesSkipped,
      observations: allObservations,
    },
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getPatternExtractionHealth(workspaceId: string): Promise<ExtractionResult<PatternExtractionHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const supabase = await createSupabaseServerClient();

  const [candidatesRes, runsRes] = await Promise.all([
    supabase
      .from("organizational_pattern_candidates")
      .select(candidateColumns)
      .eq("workspace_id", workspaceId)
      .returns<PatternCandidate[]>(),
    supabase
      .from("pattern_extraction_runs")
      .select(runColumns)
      .eq("workspace_id", workspaceId)
      .returns<PatternExtractionRun[]>(),
  ]);

  if (candidatesRes.error || runsRes.error) return failed("Unable to load extraction health data.");

  const candidates = candidatesRes.data ?? [];
  const runs = runsRes.data ?? [];

  const promotedCount = candidates.filter((c) => c.status === "promoted").length;
  const totalCandidatesAcrossRuns = runs.reduce((sum, r) => sum + r.candidate_count, 0);

  return {
    ok: true,
    data: {
      runCount: runs.length,
      candidateCount: candidates.length,
      promotedCount,
      rejectedCount: candidates.filter((c) => c.status === "rejected").length,
      archivedCount: candidates.filter((c) => c.status === "archived").length,
      averageCandidatesPerRun: runs.length ? totalCandidatesAcrossRuns / runs.length : 0,
    },
  };
}

export { getAllRules, getRuleById };
