import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import {
  GOVERNANCE_COMPLIANCE_SNAPSHOT_SELECTABLE_COLUMNS,
  GOVERNANCE_COMPLIANCE_GAP_SELECTABLE_COLUMNS,
  GOVERNANCE_COMPLIANCE_EVIDENCE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  GovernanceComplianceSnapshotRow,
  GovernanceComplianceGapRow,
  GovernanceComplianceEvidenceRow,
} from "@/lib/db/database-contract";

import { calculateConstitutionCompliance } from "./engines/constitution-compliance";
import { calculateAuthorityCompliance }    from "./engines/authority-compliance";
import { calculateRatificationCompliance } from "./engines/ratification-compliance";
import { calculateDecisionCompliance }     from "./engines/decision-compliance";
import { calculateExecutionCompliance }    from "./engines/execution-compliance";
import { calculateLearningCompliance }     from "./engines/learning-compliance";
import { calculateOverallCompliance }      from "./engines/overall-compliance";
import { classifyGovernanceComplianceStatus } from "./engines/status-classification";
import { detectGovernanceGaps }            from "./engines/gap-detection";
import { calculateGovernanceDebt }         from "./engines/debt-engine";
import { identifyGovernanceHotspots }      from "./engines/hotspot-engine";

import type {
  GovernanceComplianceResult,
  GenerateGovernanceComplianceSnapshotInput,
  GetGovernanceComplianceSnapshotInput,
  ListGovernanceComplianceSnapshotsInput,
  GovernanceComplianceStatus,
  ConstitutionComplianceInput,
  AuthorityComplianceInput,
  RatificationComplianceInput,
  DecisionComplianceInput,
  ExecutionComplianceInput,
  LearningComplianceInput,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS = GOVERNANCE_COMPLIANCE_SNAPSHOT_SELECTABLE_COLUMNS.join(",");
const GAP_COLS      = GOVERNANCE_COMPLIANCE_GAP_SELECTABLE_COLUMNS.join(",");
const EVIDENCE_COLS = GOVERNANCE_COMPLIANCE_EVIDENCE_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): GovernanceComplianceResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(resource = "Resource"): GovernanceComplianceResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}
function persistFailed<T>(action: string): GovernanceComplianceResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── generateGovernanceComplianceSnapshot ────────────────────────────────────

export async function generateGovernanceComplianceSnapshot(
  input: GenerateGovernanceComplianceSnapshotInput
): Promise<GovernanceComplianceResult<GovernanceComplianceSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. Verify PM exists in workspace
  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound("Project Manager");

  // 2. Get active assignments and project IDs
  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("id,project_id,assignment_type,assigned_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const projectIds: string[] = [...new Set((assignments ?? []).map((a: { project_id: string }) => a.project_id))];

  if (projectIds.length === 0) {
    return validation("Cannot generate a compliance snapshot for a PM with no active assignments.");
  }

  // 3. Constitution data
  const { data: constitutions } = await supabase
    .from("project_constitutions")
    .select("id,lifecycle_status,project_id")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const constitutionList = constitutions ?? [];
  const constitutionIds  = constitutionList.map((c: { id: string }) => c.id);

  const { data: amendments } = constitutionIds.length > 0
    ? await supabase
        .from("constitutional_amendments")
        .select("id,constitution_id")
        .eq("workspace_id", input.workspaceId)
        .in("constitution_id", constitutionIds)
    : { data: [] };

  const amendmentsByConstitution = new Set((amendments ?? []).map((a: { constitution_id: string }) => a.constitution_id));

  const validLifecycleStatuses = ["active", "ratified"];
  const constitutionInput: ConstitutionComplianceInput = {
    constitutionCount:                constitutionList.length,
    constitutionsWithValidLifecycle:  constitutionList.filter((c: { lifecycle_status: string }) => validLifecycleStatuses.includes(c.lifecycle_status)).length,
    constitutionsWithAmendments:      constitutionList.filter((c: { id: string }) => amendmentsByConstitution.has(c.id)).length,
    completeConstitutionCount:        constitutionList.filter((c: { lifecycle_status: string }) => validLifecycleStatuses.includes(c.lifecycle_status)).length,
  };

  // 4. Authority data
  const { data: authorities } = await supabase
    .from("authority_assignments")
    .select("id,status,expires_at,delegation_scope")
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId);

  const authorityList = authorities ?? [];
  const now = new Date().toISOString();

  const authorityInput: AuthorityComplianceInput = {
    totalAuthorities:      authorityList.length,
    expiredAuthorities:    authorityList.filter((a: { status: string; expires_at: string | null }) =>
      a.status === "active" && a.expires_at !== null && a.expires_at < now
    ).length,
    revokedAuthorities:    authorityList.filter((a: { status: string }) => a.status === "revoked").length,
    invalidDelegations:    authorityList.filter((a: { delegation_scope: string | null }) => a.delegation_scope === "invalid").length,
    unauthorizedActionCount: 0,
  };

  // 5. Ratification data
  const { data: ratifications } = await supabase
    .from("constitutional_ratifications")
    .select("id,status,expires_at")
    .eq("workspace_id", input.workspaceId)
    .in("constitution_id", constitutionIds.length > 0 ? constitutionIds : ["00000000-0000-0000-0000-000000000000"]);

  const ratificationList = ratifications ?? [];

  const ratificationInput: RatificationComplianceInput = {
    totalRatifications:      ratificationList.length,
    pendingRatifications:    ratificationList.filter((r: { status: string }) => r.status === "pending").length,
    expiredRatifications:    ratificationList.filter((r: { status: string; expires_at: string | null }) =>
      r.status === "pending" && r.expires_at !== null && r.expires_at < now
    ).length,
    missingRatificationCount: Math.max(0, constitutionList.length - ratificationList.length),
  };

  // 6. Decision data
  const { data: decisions } = await supabase
    .from("operational_decisions")
    .select("id,status,authority_id,accountability_id")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const decisionList = decisions ?? [];
  const decisionIds  = decisionList.map((d: { id: string }) => d.id);

  const { data: outcomes } = decisionIds.length > 0
    ? await supabase
        .from("operational_decision_outcomes")
        .select("id,decision_id")
        .eq("workspace_id", input.workspaceId)
        .in("decision_id", decisionIds)
    : { data: [] };

  const decisionsWithOutcomeSet = new Set((outcomes ?? []).map((o: { decision_id: string }) => o.decision_id));

  const decisionInput: DecisionComplianceInput = {
    totalDecisions:              decisionList.length,
    decisionsWithLineage:        decisionList.filter((d: { status: string }) => d.status !== null).length,
    decisionsWithAuthority:      decisionList.filter((d: { authority_id: string | null }) => d.authority_id !== null).length,
    decisionsWithOutcome:        decisionList.filter((d: { id: string }) => decisionsWithOutcomeSet.has(d.id)).length,
    decisionsWithAccountability: decisionList.filter((d: { accountability_id: string | null }) => d.accountability_id !== null).length,
  };

  // 7. Execution data
  const { data: commitments } = await supabase
    .from("governance_commitments")
    .select("id,status")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const commitmentList = commitments ?? [];

  const { data: executionTasks } = await supabase
    .from("execution_tasks")
    .select("id,status,due_date,completed_at")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const taskList  = executionTasks ?? [];
  const nowStr    = new Date().toISOString();
  const driftCount = taskList.filter(
    (t: { status: string; due_date: string | null; completed_at: string | null }) =>
      t.status !== "completed" && t.due_date !== null && t.due_date < nowStr
  ).length;

  const { data: realities } = await supabase
    .from("execution_realities")
    .select("id,status")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const realityList = realities ?? [];

  const executionInput: ExecutionComplianceInput = {
    totalCommitments:    commitmentList.length,
    completedCommitments: commitmentList.filter((c: { status: string }) => c.status === "completed" || c.status === "fulfilled").length,
    driftCount,
    validatedRealities:  realityList.filter((r: { status: string }) => r.status === "validated" || r.status === "completed").length,
    totalRealities:      realityList.length,
    integrityViolations: 0,
  };

  // 8. Learning data
  const { data: memories } = await supabase
    .from("operational_memory")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const memoryList = memories ?? [];
  const memoryIds  = memoryList.map((m: { id: string }) => m.id);

  const { data: digests } = memoryIds.length > 0
    ? await supabase
        .from("constitutional_digests")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .in("memory_id", memoryIds)
    : { data: [] };

  const { data: learnings } = await supabase
    .from("constitutional_learnings")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const { data: recommendations } = await supabase
    .from("sovereign_recommendations")
    .select("id,learning_id")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const recList = recommendations ?? [];

  const learningInput: LearningComplianceInput = {
    totalMemories:             memoryList.length,
    digestCount:               (digests ?? []).length,
    learningCount:             (learnings ?? []).length,
    recommendationsWithTrace:  recList.filter((r: { learning_id: string | null }) => r.learning_id !== null).length,
    totalRecommendations:      recList.length,
  };

  // ─── Calculate domain scores ─────────────────────────────────────────────

  const constitutionScore  = calculateConstitutionCompliance(constitutionInput);
  const authorityScore     = calculateAuthorityCompliance(authorityInput);
  const ratificationScore  = calculateRatificationCompliance(ratificationInput);
  const decisionScore      = calculateDecisionCompliance(decisionInput);
  const executionScore     = calculateExecutionCompliance(executionInput);
  const learningScore      = calculateLearningCompliance(learningInput);
  const overallScore       = calculateOverallCompliance({
    constitution: constitutionScore,
    authority:    authorityScore,
    ratification: ratificationScore,
    decision:     decisionScore,
    execution:    executionScore,
    learning:     learningScore,
  });
  const complianceStatus = classifyGovernanceComplianceStatus(overallScore);

  // ─── Detect gaps ─────────────────────────────────────────────────────────

  const gaps     = detectGovernanceGaps({ constitution: constitutionInput, authority: authorityInput, ratification: ratificationInput, decision: decisionInput, execution: executionInput, learning: learningInput });
  const debt     = calculateGovernanceDebt(gaps);
  const hotspots = identifyGovernanceHotspots(gaps);

  // ─── Persist snapshot ────────────────────────────────────────────────────

  const snapshotPayload = {
    pm_name:              pm.display_name,
    pm_email:             pm.email,
    assigned_project_count: projectIds.length,
    constitution_count:   constitutionList.length,
    authority_count:      authorityList.length,
    ratification_count:   ratificationList.length,
    decision_count:       decisionList.length,
    commitment_count:     commitmentList.length,
    memory_count:         memoryList.length,
    domain_scores: {
      constitution: constitutionScore,
      authority:    authorityScore,
      ratification: ratificationScore,
      decision:     decisionScore,
      execution:    executionScore,
      learning:     learningScore,
    },
    gap_count:    gaps.length,
    debt_summary: debt,
    hotspots:     hotspots.map((h) => ({ domain: h.domain, gapCount: h.gapCount, severity: h.dominantSeverity })),
  };

  const { data: snapshot, error: snapError } = await supabase
    .from("governance_compliance_snapshots")
    .insert({
      workspace_id:        input.workspaceId,
      pm_id:               input.pmId,
      constitution_score:  constitutionScore,
      authority_score:     authorityScore,
      ratification_score:  ratificationScore,
      decision_score:      decisionScore,
      execution_score:     executionScore,
      learning_score:      learningScore,
      overall_score:       overallScore,
      compliance_status:   complianceStatus,
      snapshot_payload:    snapshotPayload,
      generated_at:        new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<GovernanceComplianceSnapshotRow>();

  if (snapError || !snapshot) return persistFailed("generate compliance snapshot");

  // ─── Persist gaps ────────────────────────────────────────────────────────

  if (gaps.length > 0) {
    const gapsToInsert = gaps.map((g) => ({
      workspace_id:  input.workspaceId,
      snapshot_id:   snapshot.id,
      domain:        g.domain,
      gap_type:      g.gapType,
      severity:      g.severity,
      description:   g.description,
      evidence_count: g.evidenceCount,
      detected_at:   new Date().toISOString(),
    }));
    await supabase.from("governance_compliance_gaps").insert(gapsToInsert);
  }

  // ─── Persist evidence ────────────────────────────────────────────────────

  const evidenceToInsert: Array<{
    workspace_id: string;
    snapshot_id: string;
    source_entity_type: string;
    source_entity_id: string;
    evidence_type: string;
    contribution_weight: number;
  }> = [];

  for (const constitution of constitutionList) {
    evidenceToInsert.push({
      workspace_id:        input.workspaceId,
      snapshot_id:         snapshot.id,
      source_entity_type:  "project_constitution",
      source_entity_id:    constitution.id,
      evidence_type:       "constitution_compliance",
      contribution_weight: constitutionList.length > 0 ? 1 / constitutionList.length : 1,
    });
  }

  for (const authority of authorityList) {
    evidenceToInsert.push({
      workspace_id:        input.workspaceId,
      snapshot_id:         snapshot.id,
      source_entity_type:  "authority_assignment",
      source_entity_id:    authority.id,
      evidence_type:       "authority_compliance",
      contribution_weight: authorityList.length > 0 ? 1 / authorityList.length : 1,
    });
  }

  for (const decision of decisionList) {
    evidenceToInsert.push({
      workspace_id:        input.workspaceId,
      snapshot_id:         snapshot.id,
      source_entity_type:  "operational_decision",
      source_entity_id:    decision.id,
      evidence_type:       "decision_compliance",
      contribution_weight: decisionList.length > 0 ? 1 / decisionList.length : 1,
    });
  }

  if (evidenceToInsert.length > 0) {
    await supabase.from("governance_compliance_evidence").insert(evidenceToInsert);
  }

  // ─── Emit audit events ───────────────────────────────────────────────────

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           input.actorId ?? null,
    actorType:         input.actorId ? "user" : "system",
    eventType:         "GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED",
    eventCategory:     "governance",
    source:            input.actorId ? "user_action" : "system",
    correlationId:     snapshot.id,
    causationId:       null,
    rawReferenceTable: "governance_compliance_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      pm_id:          input.pmId,
      snapshot_id:    snapshot.id,
      overall_score:  overallScore,
      status:         complianceStatus,
      project_count:  projectIds.length,
      gap_count:      gaps.length,
      debt:           debt,
    },
  });

  const domainEvents: Array<{ type: string; domain: string; score: number }> = [
    { type: "GOVERNANCE_CONSTITUTION_SCORE_CALCULATED",  domain: "constitution", score: constitutionScore },
    { type: "GOVERNANCE_AUTHORITY_SCORE_CALCULATED",     domain: "authority",    score: authorityScore },
    { type: "GOVERNANCE_RATIFICATION_SCORE_CALCULATED",  domain: "ratification", score: ratificationScore },
    { type: "GOVERNANCE_DECISION_SCORE_CALCULATED",      domain: "decision",     score: decisionScore },
    { type: "GOVERNANCE_EXECUTION_SCORE_CALCULATED",     domain: "execution",    score: executionScore },
    { type: "GOVERNANCE_LEARNING_SCORE_CALCULATED",      domain: "learning",     score: learningScore },
  ];

  for (const ev of domainEvents) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         ev.type as string,
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "governance_compliance_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload:      { pm_id: input.pmId, domain: ev.domain, score: ev.score },
    });
  }

  if (gaps.length > 0) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         "GOVERNANCE_GAP_DETECTED",
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "governance_compliance_gaps",
      rawReferenceId:    snapshot.id,
      eventPayload:      { pm_id: input.pmId, snapshot_id: snapshot.id, gap_count: gaps.length, debt },
    });
  }

  if (hotspots.length > 0) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         "GOVERNANCE_HOTSPOT_IDENTIFIED",
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "governance_compliance_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload:      { pm_id: input.pmId, snapshot_id: snapshot.id, hotspots },
    });
  }

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           input.actorId ?? null,
    actorType:         input.actorId ? "user" : "system",
    eventType:         "GOVERNANCE_DEBT_CALCULATED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     snapshot.id,
    causationId:       snapshot.id,
    rawReferenceTable: "governance_compliance_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload:      { pm_id: input.pmId, snapshot_id: snapshot.id, debt },
  });

  return { ok: true, data: snapshot };
}

// ─── getGovernanceComplianceSnapshot ─────────────────────────────────────────

export async function getGovernanceComplianceSnapshot(
  input: GetGovernanceComplianceSnapshotInput
): Promise<GovernanceComplianceResult<GovernanceComplianceSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_compliance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single<GovernanceComplianceSnapshotRow>();

  if (error || !data) return notFound("Compliance snapshot");
  return { ok: true, data };
}

// ─── listGovernanceComplianceSnapshots ───────────────────────────────────────

export async function listGovernanceComplianceSnapshots(
  input: ListGovernanceComplianceSnapshotsInput
): Promise<GovernanceComplianceResult<GovernanceComplianceSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("governance_compliance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false });

  if (input.pmId) {
    if (!validUuid(input.pmId)) return validation("pmId must be a valid UUID.");
    query = query.eq("pm_id", input.pmId);
  }

  if (input.status) {
    query = query.eq("compliance_status", input.status as GovernanceComplianceStatus);
  }

  if (typeof input.minScore === "number") {
    query = query.gte("overall_score", input.minScore);
  }

  if (typeof input.maxScore === "number") {
    query = query.lte("overall_score", input.maxScore);
  }

  if (input.from) {
    query = query.gte("generated_at", input.from);
  }

  if (input.to) {
    query = query.lte("generated_at", input.to);
  }

  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query.returns<GovernanceComplianceSnapshotRow[]>();
  if (error) return persistFailed("list compliance snapshots");
  return { ok: true, data: data ?? [] };
}

// ─── listGovernanceComplianceGaps ────────────────────────────────────────────

export async function listGovernanceComplianceGaps(
  snapshotId: string,
  workspaceId: string
): Promise<GovernanceComplianceResult<GovernanceComplianceGapRow[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_compliance_gaps")
    .select(GAP_COLS)
    .eq("snapshot_id", snapshotId)
    .eq("workspace_id", workspaceId)
    .order("detected_at", { ascending: false })
    .returns<GovernanceComplianceGapRow[]>();

  if (error) return persistFailed("list compliance gaps");
  return { ok: true, data: data ?? [] };
}

// ─── listGovernanceComplianceEvidence ────────────────────────────────────────

export async function listGovernanceComplianceEvidence(
  snapshotId: string,
  workspaceId: string
): Promise<GovernanceComplianceResult<GovernanceComplianceEvidenceRow[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_compliance_evidence")
    .select(EVIDENCE_COLS)
    .eq("snapshot_id", snapshotId)
    .eq("workspace_id", workspaceId)
    .returns<GovernanceComplianceEvidenceRow[]>();

  if (error) return persistFailed("list compliance evidence");
  return { ok: true, data: data ?? [] };
}
