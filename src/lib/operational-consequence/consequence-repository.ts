import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OPERATIONAL_CONSEQUENCE_SELECTABLE_COLUMNS,
  OPERATIONAL_CONSEQUENCE_IMPACT_SELECTABLE_COLUMNS,
  OPERATIONAL_CONSEQUENCE_PATH_SELECTABLE_COLUMNS,
  OPERATIONAL_CONSEQUENCE_SCENARIO_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ConsequenceResult,
  OperationalConsequenceRow,
  OperationalConsequenceImpactRow,
  OperationalConsequencePathRow,
  OperationalConsequenceScenarioRow,
  ConsequenceSeverity,
  ConsequenceImpactHorizon,
  ConsequenceImpactType,
  ConsequenceScenarioName,
  ListConsequencesInput,
} from "./types";

const CC = OPERATIONAL_CONSEQUENCE_SELECTABLE_COLUMNS.join(",");
const CI = OPERATIONAL_CONSEQUENCE_IMPACT_SELECTABLE_COLUMNS.join(",");
const CP = OPERATIONAL_CONSEQUENCE_PATH_SELECTABLE_COLUMNS.join(",");
const CS = OPERATIONAL_CONSEQUENCE_SCENARIO_SELECTABLE_COLUMNS.join(",");

// ─── dbCreateConsequence ──────────────────────────────────────────────────────

export async function dbCreateConsequence(input: {
  workspaceId:           string;
  focusItemId:           string;
  severity:              ConsequenceSeverity;
  impactHorizon:         ConsequenceImpactHorizon;
  escalationProbability: number;
  impactScore:           number;
}): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequences")
    .insert({
      workspace_id:           input.workspaceId,
      focus_item_id:          input.focusItemId,
      severity:               input.severity,
      impact_horizon:         input.impactHorizon,
      escalation_probability: input.escalationProbability,
      impact_score:           input.impactScore,
      analysis_status:        "generated",
    })
    .select(CC)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create consequence.", failureClass: "persistence_failed" };
  }
  return { ok: true, data: data as OperationalConsequenceRow };
}

// ─── dbFindConsequenceById ────────────────────────────────────────────────────

export async function dbFindConsequenceById(
  consequenceId: string,
  workspaceId:   string
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequences")
    .select(CC)
    .eq("id", consequenceId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    return { ok: false, error: "Consequence not found.", failureClass: "not_found" };
  }
  return { ok: true, data: data as OperationalConsequenceRow };
}

// ─── dbListConsequences ───────────────────────────────────────────────────────

export async function dbListConsequences(
  input: ListConsequencesInput
): Promise<ConsequenceResult<OperationalConsequenceRow[]>> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("operational_consequences")
    .select(CC)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.focusItemId)    q = q.eq("focus_item_id",    input.focusItemId);
  if (input.severity)       q = q.eq("severity",         input.severity);
  if (input.analysisStatus) q = q.eq("analysis_status",  input.analysisStatus);
  if (input.minImpactScore !== undefined) q = q.gte("impact_score", input.minImpactScore);
  if (input.fromDate)       q = q.gte("created_at",      input.fromDate);
  if (input.toDate)         q = q.lte("created_at",      input.toDate);
  if (input.limit)          q = q.limit(input.limit);

  const { data, error } = await q;
  if (error) {
    return { ok: false, error: error.message, failureClass: "persistence_failed" };
  }
  return { ok: true, data: (data ?? []) as OperationalConsequenceRow[] };
}

// ─── dbUpdateConsequenceStatus ────────────────────────────────────────────────

export async function dbUpdateConsequenceStatus(
  consequenceId: string,
  workspaceId:   string,
  status:        "generated" | "validated" | "archived"
): Promise<ConsequenceResult<OperationalConsequenceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequences")
    .update({ analysis_status: status, updated_at: new Date().toISOString() })
    .eq("id", consequenceId)
    .eq("workspace_id", workspaceId)
    .select(CC)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update consequence status.", failureClass: "persistence_failed" };
  }
  return { ok: true, data: data as OperationalConsequenceRow };
}

// ─── dbCreateConsequenceImpact ────────────────────────────────────────────────

export async function dbCreateConsequenceImpact(input: {
  workspaceId:          string;
  consequenceId:        string;
  impactType:           ConsequenceImpactType;
  affectedEntityType:   string;
  affectedEntityCount:  number;
  impactScore:          number;
  description:          string;
}): Promise<ConsequenceResult<OperationalConsequenceImpactRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_impacts")
    .insert({
      workspace_id:          input.workspaceId,
      consequence_id:        input.consequenceId,
      impact_type:           input.impactType,
      affected_entity_type:  input.affectedEntityType,
      affected_entity_count: input.affectedEntityCount,
      impact_score:          input.impactScore,
      description:           input.description,
    })
    .select(CI)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create impact.", failureClass: "persistence_failed" };
  }
  return { ok: true, data: data as OperationalConsequenceImpactRow };
}

// ─── dbListConsequenceImpacts ─────────────────────────────────────────────────

export async function dbListConsequenceImpacts(
  consequenceId: string,
  workspaceId:   string
): Promise<ConsequenceResult<OperationalConsequenceImpactRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_impacts")
    .select(CI)
    .eq("consequence_id", consequenceId)
    .eq("workspace_id",   workspaceId)
    .order("impact_score", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, failureClass: "persistence_failed" };
  }
  return { ok: true, data: (data ?? []) as OperationalConsequenceImpactRow[] };
}

// ─── dbCreateConsequencePath ──────────────────────────────────────────────────

export async function dbCreateConsequencePath(input: {
  workspaceId:       string;
  consequenceId:     string;
  sourceEntityType:  string;
  sourceEntityId:    string;
  targetEntityType:  string;
  targetEntityId:    string;
  relationshipType:  string;
  cascadeDepth:      number;
}): Promise<ConsequenceResult<OperationalConsequencePathRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_paths")
    .insert({
      workspace_id:      input.workspaceId,
      consequence_id:    input.consequenceId,
      source_entity_type: input.sourceEntityType,
      source_entity_id:  input.sourceEntityId,
      target_entity_type: input.targetEntityType,
      target_entity_id:  input.targetEntityId,
      relationship_type: input.relationshipType,
      cascade_depth:     input.cascadeDepth,
    })
    .select(CP)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create path.", failureClass: "persistence_failed" };
  }
  return { ok: true, data: data as OperationalConsequencePathRow };
}

// ─── dbListConsequencePaths ───────────────────────────────────────────────────

export async function dbListConsequencePaths(
  consequenceId: string,
  workspaceId:   string
): Promise<ConsequenceResult<OperationalConsequencePathRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_paths")
    .select(CP)
    .eq("consequence_id", consequenceId)
    .eq("workspace_id",   workspaceId)
    .order("cascade_depth", { ascending: true });

  if (error) {
    return { ok: false, error: error.message, failureClass: "persistence_failed" };
  }
  return { ok: true, data: (data ?? []) as OperationalConsequencePathRow[] };
}

// ─── dbCreateConsequenceScenario ──────────────────────────────────────────────

export async function dbCreateConsequenceScenario(input: {
  workspaceId:         string;
  consequenceId:       string;
  scenarioName:        ConsequenceScenarioName;
  scenarioDescription: string;
  probability:         number;
}): Promise<ConsequenceResult<OperationalConsequenceScenarioRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_scenarios")
    .insert({
      workspace_id:        input.workspaceId,
      consequence_id:      input.consequenceId,
      scenario_name:       input.scenarioName,
      scenario_description: input.scenarioDescription,
      probability:         input.probability,
    })
    .select(CS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create scenario.", failureClass: "persistence_failed" };
  }
  return { ok: true, data: data as OperationalConsequenceScenarioRow };
}

// ─── dbListConsequenceScenarios ───────────────────────────────────────────────

export async function dbListConsequenceScenarios(
  consequenceId: string,
  workspaceId:   string
): Promise<ConsequenceResult<OperationalConsequenceScenarioRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_consequence_scenarios")
    .select(CS)
    .eq("consequence_id", consequenceId)
    .eq("workspace_id",   workspaceId)
    .order("probability",  { ascending: false });

  if (error) {
    return { ok: false, error: error.message, failureClass: "persistence_failed" };
  }
  return { ok: true, data: (data ?? []) as OperationalConsequenceScenarioRow[] };
}
