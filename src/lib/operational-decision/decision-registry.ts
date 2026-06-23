import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbCreateDecision,
  dbFindDecisionById,
  dbListDecisions,
  dbUpdateDecisionStatus,
  dbSetRecommendedOption,
  dbCreateDecisionOption,
  dbListDecisionOptions,
  dbCreateDecisionEvaluation,
  dbListDecisionEvaluations,
  dbCreateDecisionTradeoff,
  dbListDecisionTradeoffs,
} from "./decision-repository";
import { generateDecisionAlternatives } from "./alternative-engine";
import { evaluateDecisionOptions }       from "./evaluation-engine";
import { calculateDecisionScore }        from "./scoring-engine";
import { calculateDecisionConfidence }   from "./confidence-engine";
import { analyzeDecisionTradeoffs }      from "./tradeoff-engine";
import { selectRecommendedDecision }     from "./recommendation-engine";
import { compareDecisionOptions }        from "./comparative-engine";
import { generateOperationalDecisionSupport } from "./decision-support-engine";
import { getOperationalDecisionLineage } from "./lineage-engine";
import { DECISION_STATUSES, DECISION_CATEGORIES } from "./types";
import type {
  DecisionResult,
  OperationalDecisionRow,
  OperationalDecisionAnalysis,
  OperationalDecisionLineage,
  DecisionEventType,
  GenerateDecisionInput,
  GetDecisionInput,
  ListDecisionsInput,
  ValidateDecisionInput,
  ArchiveDecisionInput,
  GetDecisionLineageInput,
  DecisionCategory,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): DecisionResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitDecisionEvent(
  workspaceId: string,
  decisionId:  string,
  consequenceId: string,
  projectId:   string,
  eventType:   DecisionEventType,
  actorId:     string,
  extra?:      Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    projectId,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "decision",
    source:            "system",
    correlationId:     decisionId,
    rawReferenceTable: "operational_decisions",
    rawReferenceId:    decisionId,
    learningEligible:  false,
    eventPayload:      { decisionId, consequenceId, ...extra },
  });
}

async function resolveDecisionContext(
  decisionId:  string,
  workspaceId: string
): Promise<{ consequenceId: string; projectId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: dec } = await supabase
    .from("operational_decisions")
    .select("consequence_id")
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!dec) return { consequenceId: decisionId, projectId: decisionId };

  const { data: cons } = await supabase
    .from("operational_consequences")
    .select("focus_item_id")
    .eq("id", dec.consequence_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!cons) return { consequenceId: dec.consequence_id, projectId: dec.consequence_id };

  const { data: fi } = await supabase
    .from("operational_focus_items")
    .select("command_center_id")
    .eq("id", cons.focus_item_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!fi) return { consequenceId: dec.consequence_id, projectId: dec.consequence_id };

  const { data: cc } = await supabase
    .from("operational_command_centers")
    .select("project_id")
    .eq("id", fi.command_center_id)
    .eq("workspace_id", workspaceId)
    .single();

  return {
    consequenceId: dec.consequence_id,
    projectId:     (cc?.project_id as string) ?? dec.consequence_id,
  };
}

const FOCUS_TYPE_TO_DECISION_CATEGORY: Record<string, DecisionCategory> = {
  governance:     "governance",
  execution:      "execution",
  authority:      "authority",
  ratification:   "ratification",
  commitment:     "commitment",
  projection:     "projection",
  reality:        "execution",
  recommendation: "governance",
  risk:           "risk",
  health:         "risk",
};

// ─── generateOperationalDecision ─────────────────────────────────────────────

export async function generateOperationalDecision(
  input: GenerateDecisionInput
): Promise<DecisionResult<OperationalDecisionRow>> {
  if (!validUuid(input.workspaceId))   return validation("workspaceId must be a UUID.");
  if (!validUuid(input.consequenceId)) return validation("consequenceId must be a UUID.");
  if (!validUuid(input.actorId))       return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  // Load consequence — must belong to same workspace
  const { data: consequence, error: cErr } = await supabase
    .from("operational_consequences")
    .select("id, workspace_id, focus_item_id, severity, escalation_probability, impact_score, analysis_status")
    .eq("id", input.consequenceId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (cErr || !consequence) {
    return { ok: false, error: "Consequence not found.", failureClass: "not_found" };
  }

  // Load focus item for type resolution
  const { data: focusItem } = await supabase
    .from("operational_focus_items")
    .select("id, focus_type, command_center_id")
    .eq("id", consequence.focus_item_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  const focusType     = focusItem?.focus_type ?? "governance";
  const decisionCategory = FOCUS_TYPE_TO_DECISION_CATEGORY[focusType] ?? "governance";

  // Resolve project_id for event emission
  const { data: cc } = focusItem
    ? await supabase
        .from("operational_command_centers")
        .select("project_id")
        .eq("id", focusItem.command_center_id)
        .eq("workspace_id", input.workspaceId)
        .single()
    : { data: null };
  const projectId = (cc?.project_id as string) ?? input.consequenceId;

  // Generate alternatives
  const alternatives = generateDecisionAlternatives({
    focusType,
    severity: consequence.severity,
  });

  // Evaluate each alternative
  const evaluationResults = evaluateDecisionOptions({
    alternatives,
    consequenceSeverity:   consequence.severity,
    escalationProbability: consequence.escalation_probability,
    impactScore:           consequence.impact_score,
  });

  // Calculate aggregate decision score and confidence
  const decisionScore = calculateDecisionScore(evaluationResults);
  const decisionConfidence = calculateDecisionConfidence({
    evaluations:           evaluationResults,
    escalationProbability: consequence.escalation_probability,
    impactScore:           consequence.impact_score,
    alternativeCount:      alternatives.length,
  });

  // Persist the decision record
  const dResult = await dbCreateDecision({
    workspaceId:       input.workspaceId,
    consequenceId:     input.consequenceId,
    decisionCategory,
    decisionScore,
    decisionConfidence,
  });
  if (!dResult.ok) return dResult;
  const decision = dResult.data;

  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_GENERATED", input.actorId,
    { decisionCategory, alternativeCount: alternatives.length }
  );

  // Persist each alternative as an option and its evaluation
  const optionIdByName: Record<string, string> = {};

  for (const alt of alternatives) {
    const optResult = await dbCreateDecisionOption({
      workspaceId:       input.workspaceId,
      decisionId:        decision.id,
      optionName:        alt.optionName,
      optionDescription: alt.optionDescription,
      optionType:        alt.optionType,
      pros:              alt.pros,
      cons:              alt.cons,
      estimatedEffort:   alt.estimatedEffort,
      estimatedRisk:     alt.estimatedRisk,
    });
    if (!optResult.ok) return optResult;
    optionIdByName[alt.optionName] = optResult.data.id;
  }

  // Persist evaluations
  for (const ev of evaluationResults) {
    const optionId = optionIdByName[ev.optionName];
    if (!optionId) continue;
    const evResult = await dbCreateDecisionEvaluation({
      workspaceId:     input.workspaceId,
      decisionId:      decision.id,
      optionId,
      governanceScore: ev.scores.governanceScore,
      executionScore:  ev.scores.executionScore,
      riskScore:       ev.scores.riskScore,
      healthScore:     ev.scores.healthScore,
      overallScore:    ev.scores.overallScore,
    });
    if (!evResult.ok) return evResult;
  }

  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_EVALUATED", input.actorId,
    { evaluationCount: evaluationResults.length }
  );
  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_SCORE_CALCULATED", input.actorId,
    { decisionScore }
  );
  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_CONFIDENCE_CALCULATED", input.actorId,
    { decisionConfidence }
  );

  // Persist tradeoffs
  const tradeoffResults = analyzeDecisionTradeoffs(alternatives);
  for (const tr of tradeoffResults) {
    const optionId = optionIdByName[tr.optionName];
    if (!optionId) continue;
    for (const t of tr.tradeoffs) {
      const tResult = await dbCreateDecisionTradeoff({
        workspaceId:  input.workspaceId,
        decisionId:   decision.id,
        optionId,
        tradeoffType: t.tradeoffType,
        description:  t.description,
        impactScore:  t.impactScore,
      });
      if (!tResult.ok) return tResult;
    }
  }

  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_TRADEOFF_ANALYZED", input.actorId,
    { tradeoffCount: tradeoffResults.reduce((s, t) => s + t.tradeoffs.length, 0) }
  );

  // Select and persist recommended option
  const recommendation = selectRecommendedDecision({
    alternatives,
    evaluations: evaluationResults,
    confidence:  decisionConfidence,
  });

  if (recommendation) {
    const recommendedId = optionIdByName[recommendation.optionName];
    if (recommendedId) {
      const recResult = await dbSetRecommendedOption(
        decision.id, input.workspaceId, recommendedId, decisionScore, decisionConfidence
      );
      if (!recResult.ok) return recResult;
    }
  }

  await emitDecisionEvent(
    input.workspaceId, decision.id, input.consequenceId, projectId,
    "OPERATIONAL_DECISION_RECOMMENDED", input.actorId,
    {
      recommendedOption: recommendation?.optionName,
      score:             recommendation?.score,
      confidence:        recommendation?.confidence,
    }
  );

  // Reload the final decision with recommended_option_id set
  return dbFindDecisionById(decision.id, input.workspaceId);
}

// ─── getOperationalDecision ───────────────────────────────────────────────────

export async function getOperationalDecision(
  input: GetDecisionInput
): Promise<DecisionResult<OperationalDecisionRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");
  return dbFindDecisionById(input.decisionId, input.workspaceId);
}

// ─── listOperationalDecisions ─────────────────────────────────────────────────

export async function listOperationalDecisions(
  input: ListDecisionsInput
): Promise<DecisionResult<OperationalDecisionRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.consequenceId && !validUuid(input.consequenceId)) {
    return validation("consequenceId must be a UUID.");
  }
  if (input.decisionCategory && !DECISION_CATEGORIES.includes(input.decisionCategory)) {
    return validation(`decisionCategory must be one of: ${DECISION_CATEGORIES.join(", ")}.`);
  }
  if (input.decisionStatus && !DECISION_STATUSES.includes(input.decisionStatus)) {
    return validation(`decisionStatus must be one of: ${DECISION_STATUSES.join(", ")}.`);
  }
  return dbListDecisions(input);
}

// ─── validateOperationalDecision ─────────────────────────────────────────────

export async function validateOperationalDecision(
  input: ValidateDecisionInput
): Promise<DecisionResult<OperationalDecisionRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindDecisionById(input.decisionId, input.workspaceId);
  if (!current.ok) return current;

  if (!["generated", "recommended"].includes(current.data.decision_status)) {
    return validation(
      `Decision can only be validated from 'generated' or 'recommended' status (current: ${current.data.decision_status}).`
    );
  }

  const result = await dbUpdateDecisionStatus(input.decisionId, input.workspaceId, "evaluated");
  if (!result.ok) return result;

  const ctx = await resolveDecisionContext(input.decisionId, input.workspaceId);
  await emitDecisionEvent(
    input.workspaceId, input.decisionId, ctx.consequenceId, ctx.projectId,
    "OPERATIONAL_DECISION_EVALUATED", input.actorId
  );

  return result;
}

// ─── archiveOperationalDecision ───────────────────────────────────────────────

export async function archiveOperationalDecision(
  input: ArchiveDecisionInput
): Promise<DecisionResult<OperationalDecisionRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindDecisionById(input.decisionId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.decision_status === "archived") {
    return validation("Decision is already archived.");
  }

  const result = await dbUpdateDecisionStatus(input.decisionId, input.workspaceId, "archived");
  if (!result.ok) return result;

  const ctx = await resolveDecisionContext(input.decisionId, input.workspaceId);
  await emitDecisionEvent(
    input.workspaceId, input.decisionId, ctx.consequenceId, ctx.projectId,
    "OPERATIONAL_DECISION_ARCHIVED", input.actorId
  );

  return result;
}

// ─── getOperationalDecisionAnalysis ──────────────────────────────────────────

export async function getOperationalDecisionAnalysis(
  input: GetDecisionInput
): Promise<DecisionResult<OperationalDecisionAnalysis>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");

  const [dResult, optionsResult, evaluationsResult, tradeoffsResult] = await Promise.all([
    dbFindDecisionById(input.decisionId, input.workspaceId),
    dbListDecisionOptions(input.decisionId, input.workspaceId),
    dbListDecisionEvaluations(input.decisionId, input.workspaceId),
    dbListDecisionTradeoffs(input.decisionId, input.workspaceId),
  ]);

  if (!dResult.ok)          return dResult;
  if (!optionsResult.ok)    return optionsResult;
  if (!evaluationsResult.ok)return evaluationsResult;
  if (!tradeoffsResult.ok)  return tradeoffsResult;

  const decision    = dResult.data;
  const options     = optionsResult.data;
  const evaluations = evaluationsResult.data;
  const tradeoffs   = tradeoffsResult.data;

  const evalForEngine = evaluations.map((e) => ({
    optionName: options.find((o) => o.id === e.option_id)?.option_name ?? e.option_id,
    scores: {
      governanceScore: e.governance_score,
      executionScore:  e.execution_score,
      riskScore:       e.risk_score,
      healthScore:     e.health_score,
      overallScore:    e.overall_score,
    },
  }));

  const alternatives = options.map((o) => ({
    optionName:        o.option_name,
    optionDescription: o.option_description,
    optionType:        o.option_type,
    pros:              safeParseArray(o.pros),
    cons:              safeParseArray(o.cons),
    estimatedEffort:   o.estimated_effort,
    estimatedRisk:     o.estimated_risk,
  }));

  const recommendation = selectRecommendedDecision({
    alternatives,
    evaluations: evalForEngine,
    confidence:  decision.decision_confidence,
  }) ?? {
    optionName: decision.recommended_option_id ?? "",
    score:      decision.decision_score,
    confidence: decision.decision_confidence,
    rationale:  "Recommendation derived from stored evaluation.",
  };

  const comparative = compareDecisionOptions(evalForEngine);

  const support = generateOperationalDecisionSupport({
    decisionId: decision.id,
    recommendation,
    comparative,
  });

  return {
    ok:   true,
    data: { decision, options, evaluations, tradeoffs, recommendation, comparative, support },
  };
}

// ─── getOperationalDecisionLineageForDecision ─────────────────────────────────

export async function getOperationalDecisionLineageForDecision(
  input: GetDecisionLineageInput
): Promise<DecisionResult<OperationalDecisionLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const result = await getOperationalDecisionLineage({
    workspaceId: input.workspaceId,
    decisionId:  input.decisionId,
  });

  if (result.ok) {
    const ctx = await resolveDecisionContext(input.decisionId, input.workspaceId);
    await emitDecisionEvent(
      input.workspaceId, input.decisionId, ctx.consequenceId, ctx.projectId,
      "OPERATIONAL_DECISION_LINEAGE_GENERATED", input.actorId,
      { layerCount: result.data.chain.length }
    );
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
