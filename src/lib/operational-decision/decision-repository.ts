import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OPERATIONAL_DECISION_SELECTABLE_COLUMNS,
  OPERATIONAL_DECISION_OPTION_SELECTABLE_COLUMNS,
  OPERATIONAL_DECISION_EVALUATION_SELECTABLE_COLUMNS,
  OPERATIONAL_DECISION_TRADEOFF_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  DecisionResult,
  OperationalDecisionRow,
  OperationalDecisionOptionRow,
  OperationalDecisionEvaluationRow,
  OperationalDecisionTradeoffRow,
  DecisionCategory,
  DecisionStatus,
  DecisionOptionType,
  DecisionEffortLevel,
  DecisionRiskLevel,
  DecisionTradeoffType,
  ListDecisionsInput,
} from "./types";

const CD  = OPERATIONAL_DECISION_SELECTABLE_COLUMNS.join(",");
const CO  = OPERATIONAL_DECISION_OPTION_SELECTABLE_COLUMNS.join(",");
const CE  = OPERATIONAL_DECISION_EVALUATION_SELECTABLE_COLUMNS.join(",");
const CT  = OPERATIONAL_DECISION_TRADEOFF_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound<T>(entity: string): DecisionResult<T> {
  return { ok: false, error: `${entity} not found.`, failureClass: "not_found" };
}

function persistFailed<T>(action: string): DecisionResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── dbCreateDecision ─────────────────────────────────────────────────────────

export async function dbCreateDecision(input: {
  workspaceId:      string;
  consequenceId:    string;
  decisionCategory: DecisionCategory;
  decisionScore:    number;
  decisionConfidence: number;
}): Promise<DecisionResult<OperationalDecisionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decisions")
    .insert({
      workspace_id:       input.workspaceId,
      consequence_id:     input.consequenceId,
      decision_category:  input.decisionCategory,
      decision_status:    "generated",
      decision_score:     input.decisionScore,
      decision_confidence: input.decisionConfidence,
    })
    .select(CD)
    .single<OperationalDecisionRow>();

  if (error || !data) return persistFailed("create decision");
  return { ok: true, data };
}

// ─── dbFindDecisionById ───────────────────────────────────────────────────────

export async function dbFindDecisionById(
  decisionId:  string,
  workspaceId: string
): Promise<DecisionResult<OperationalDecisionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decisions")
    .select(CD)
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .single<OperationalDecisionRow>();

  if (error || !data) return notFound("Decision");
  return { ok: true, data };
}

// ─── dbListDecisions ──────────────────────────────────────────────────────────

export async function dbListDecisions(
  input: ListDecisionsInput
): Promise<DecisionResult<OperationalDecisionRow[]>> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("operational_decisions")
    .select(CD)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.consequenceId)    q = q.eq("consequence_id",    input.consequenceId);
  if (input.decisionCategory) q = q.eq("decision_category", input.decisionCategory);
  if (input.decisionStatus)   q = q.eq("decision_status",   input.decisionStatus);
  if (input.minScore !== undefined)      q = q.gte("decision_score",      input.minScore);
  if (input.minConfidence !== undefined) q = q.gte("decision_confidence", input.minConfidence);
  if (input.fromDate)         q = q.gte("created_at",        input.fromDate);
  if (input.toDate)           q = q.lte("created_at",        input.toDate);
  if (input.limit)            q = q.limit(input.limit);

  const { data, error } = await q.returns<OperationalDecisionRow[]>();
  if (error) return persistFailed("list decisions");
  return { ok: true, data: data ?? [] };
}

// ─── dbUpdateDecisionStatus ───────────────────────────────────────────────────

export async function dbUpdateDecisionStatus(
  decisionId:  string,
  workspaceId: string,
  status:      DecisionStatus
): Promise<DecisionResult<OperationalDecisionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decisions")
    .update({ decision_status: status, updated_at: new Date().toISOString() })
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .select(CD)
    .single<OperationalDecisionRow>();

  if (error || !data) return persistFailed("update decision status");
  return { ok: true, data };
}

// ─── dbSetRecommendedOption ───────────────────────────────────────────────────

export async function dbSetRecommendedOption(
  decisionId:          string,
  workspaceId:         string,
  recommendedOptionId: string,
  decisionScore:       number,
  decisionConfidence:  number
): Promise<DecisionResult<OperationalDecisionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decisions")
    .update({
      recommended_option_id: recommendedOptionId,
      decision_score:        decisionScore,
      decision_confidence:   decisionConfidence,
      decision_status:       "recommended",
      updated_at:            new Date().toISOString(),
    })
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .select(CD)
    .single<OperationalDecisionRow>();

  if (error || !data) return persistFailed("set recommended option");
  return { ok: true, data };
}

// ─── dbCreateDecisionOption ───────────────────────────────────────────────────

export async function dbCreateDecisionOption(input: {
  workspaceId:       string;
  decisionId:        string;
  optionName:        string;
  optionDescription: string;
  optionType:        DecisionOptionType;
  pros:              string[];
  cons:              string[];
  estimatedEffort:   DecisionEffortLevel;
  estimatedRisk:     DecisionRiskLevel;
}): Promise<DecisionResult<OperationalDecisionOptionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_options")
    .insert({
      workspace_id:       input.workspaceId,
      decision_id:        input.decisionId,
      option_name:        input.optionName,
      option_description: input.optionDescription,
      option_type:        input.optionType,
      pros:               JSON.stringify(input.pros),
      cons:               JSON.stringify(input.cons),
      estimated_effort:   input.estimatedEffort,
      estimated_risk:     input.estimatedRisk,
    })
    .select(CO)
    .single<OperationalDecisionOptionRow>();

  if (error || !data) return persistFailed("create decision option");
  return { ok: true, data };
}

// ─── dbListDecisionOptions ────────────────────────────────────────────────────

export async function dbListDecisionOptions(
  decisionId:  string,
  workspaceId: string
): Promise<DecisionResult<OperationalDecisionOptionRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_options")
    .select(CO)
    .eq("decision_id",  decisionId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .returns<OperationalDecisionOptionRow[]>();

  if (error) return persistFailed("list decision options");
  return { ok: true, data: data ?? [] };
}

// ─── dbCreateDecisionEvaluation ───────────────────────────────────────────────

export async function dbCreateDecisionEvaluation(input: {
  workspaceId:      string;
  decisionId:       string;
  optionId:         string;
  governanceScore:  number;
  executionScore:   number;
  riskScore:        number;
  healthScore:      number;
  overallScore:     number;
}): Promise<DecisionResult<OperationalDecisionEvaluationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_evaluations")
    .insert({
      workspace_id:     input.workspaceId,
      decision_id:      input.decisionId,
      option_id:        input.optionId,
      governance_score: input.governanceScore,
      execution_score:  input.executionScore,
      risk_score:       input.riskScore,
      health_score:     input.healthScore,
      overall_score:    input.overallScore,
    })
    .select(CE)
    .single<OperationalDecisionEvaluationRow>();

  if (error || !data) return persistFailed("create decision evaluation");
  return { ok: true, data };
}

// ─── dbListDecisionEvaluations ────────────────────────────────────────────────

export async function dbListDecisionEvaluations(
  decisionId:  string,
  workspaceId: string
): Promise<DecisionResult<OperationalDecisionEvaluationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_evaluations")
    .select(CE)
    .eq("decision_id",  decisionId)
    .eq("workspace_id", workspaceId)
    .order("overall_score", { ascending: false })
    .returns<OperationalDecisionEvaluationRow[]>();

  if (error) return persistFailed("list decision evaluations");
  return { ok: true, data: data ?? [] };
}

// ─── dbCreateDecisionTradeoff ─────────────────────────────────────────────────

export async function dbCreateDecisionTradeoff(input: {
  workspaceId:   string;
  decisionId:    string;
  optionId:      string;
  tradeoffType:  DecisionTradeoffType;
  description:   string;
  impactScore:   number;
}): Promise<DecisionResult<OperationalDecisionTradeoffRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_tradeoffs")
    .insert({
      workspace_id:  input.workspaceId,
      decision_id:   input.decisionId,
      option_id:     input.optionId,
      tradeoff_type: input.tradeoffType,
      description:   input.description,
      impact_score:  input.impactScore,
    })
    .select(CT)
    .single<OperationalDecisionTradeoffRow>();

  if (error || !data) return persistFailed("create decision tradeoff");
  return { ok: true, data };
}

// ─── dbListDecisionTradeoffs ──────────────────────────────────────────────────

export async function dbListDecisionTradeoffs(
  decisionId:  string,
  workspaceId: string
): Promise<DecisionResult<OperationalDecisionTradeoffRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_tradeoffs")
    .select(CT)
    .eq("decision_id",  decisionId)
    .eq("workspace_id", workspaceId)
    .order("impact_score", { ascending: false })
    .returns<OperationalDecisionTradeoffRow[]>();

  if (error) return persistFailed("list decision tradeoffs");
  return { ok: true, data: data ?? [] };
}
