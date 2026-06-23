import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import { classifyPMPerformanceStatus } from "./engines/status-classification";
import { generatePMPerformanceSnapshot } from "./performance-registry";

import type {
  PMPerformanceResult,
  GeneratePMScorecardInput,
  PMScorecard,
  PMPerformanceSnapshotRow,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): PMPerformanceResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(): PMPerformanceResult<T> {
  return { ok: false, error: "Project Manager not found.", failureClass: "not_found" };
}

// ─── buildExplanation ─────────────────────────────────────────────────────────

function buildExplanation(snapshot: PMPerformanceSnapshotRow): PMScorecard["explanation"] {
  const scores = {
    governance: Number(snapshot.governance_score),
    execution:  Number(snapshot.execution_score),
    prediction: Number(snapshot.prediction_accuracy_score),
    decision:   Number(snapshot.decision_effectiveness_score),
    portfolio:  Number(snapshot.portfolio_health_score),
    overall:    Number(snapshot.overall_score),
  };

  const domainLabels: Record<string, string> = {
    governance: "Governance",
    execution:  "Execution",
    prediction: "Prediction Accuracy",
    decision:   "Decision Effectiveness",
    portfolio:  "Portfolio Health",
  };

  const strengths: string[]       = [];
  const attentionAreas: string[]  = [];

  for (const [domain, score] of Object.entries(scores)) {
    if (domain === "overall") continue;
    const status = classifyPMPerformanceStatus(score);
    const label  = domainLabels[domain] ?? domain;
    if (status === "excellent" || status === "strong") {
      strengths.push(`${label} is ${status} (${score})`);
    } else if (status === "warning" || status === "critical") {
      attentionAreas.push(`${label} requires attention (${score} — ${status})`);
    }
  }

  const payload = snapshot.snapshot_payload as Record<string, unknown>;
  const supportedBy: string[] = [
    `${payload.assigned_project_count ?? 0} assigned project(s)`,
    `${payload.os_snapshot_count ?? 0} Project OS snapshot(s)`,
    `${payload.outcome_count ?? 0} decision outcome(s)`,
    `${payload.reality_count ?? 0} execution reality record(s)`,
  ];

  const overall = classifyPMPerformanceStatus(scores.overall);
  const summary =
    `Overall performance is ${overall} (${scores.overall}/100). ` +
    (strengths.length > 0
      ? `Strong domains: ${strengths.map((s) => s.split(" is ")[0]).join(", ")}. `
      : "") +
    (attentionAreas.length > 0
      ? `Domains needing support: ${attentionAreas.map((a) => a.split(" requires")[0]).join(", ")}.`
      : "All domains are performing well.");

  return { summary, strengths, attentionAreas, supportedBy };
}

// ─── generatePMScorecard ──────────────────────────────────────────────────────

export async function generatePMScorecard(
  input: GeneratePMScorecardInput
): Promise<PMPerformanceResult<PMScorecard>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // Fetch PM details
  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound();

  // Generate (or re-use latest) snapshot
  const snapshotResult = await generatePMPerformanceSnapshot({
    workspaceId: input.workspaceId,
    pmId: input.pmId,
  });

  if (!snapshotResult.ok) {
    return { ok: false, error: snapshotResult.error, failureClass: snapshotResult.failureClass };
  }

  const snapshot = snapshotResult.data;
  const payload  = snapshot.snapshot_payload as Record<string, unknown>;

  const scorecard: PMScorecard = {
    pm: {
      id:    pm.id,
      name:  pm.display_name,
      email: pm.email,
    },
    scores: {
      governance: Number(snapshot.governance_score),
      execution:  Number(snapshot.execution_score),
      prediction: Number(snapshot.prediction_accuracy_score),
      decision:   Number(snapshot.decision_effectiveness_score),
      portfolio:  Number(snapshot.portfolio_health_score),
      overall:    Number(snapshot.overall_score),
    },
    status: snapshot.performance_status,
    evidence: {
      projects:  Number(payload.assigned_project_count ?? 0),
      snapshots: Number(payload.os_snapshot_count ?? 0),
      outcomes:  Number(payload.outcome_count ?? 0),
    },
    explanation: buildExplanation(snapshot),
    generatedAt: snapshot.generated_at,
  };

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           null,
    actorType:         "system",
    eventType:         "PM_SCORECARD_GENERATED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     snapshot.id,
    causationId:       snapshot.id,
    rawReferenceTable: "pm_performance_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      pm_id:         input.pmId,
      snapshot_id:   snapshot.id,
      overall_score: scorecard.scores.overall,
      status:        scorecard.status,
    },
  });

  return { ok: true, data: scorecard };
}

// ─── explainPMScorecard ───────────────────────────────────────────────────────

export function explainPMScorecard(scorecard: PMScorecard): string {
  const { pm, scores, status, evidence, explanation } = scorecard;

  return [
    `PM: ${pm.name} (${pm.email})`,
    `Overall: ${scores.overall}/100 — ${status}`,
    ``,
    `Domain Scores:`,
    `  Governance:          ${scores.governance}`,
    `  Execution:           ${scores.execution}`,
    `  Prediction Accuracy: ${scores.prediction}`,
    `  Decision Effectiveness: ${scores.decision}`,
    `  Portfolio Health:    ${scores.portfolio}`,
    ``,
    `Summary: ${explanation.summary}`,
    ``,
    `Strengths: ${explanation.strengths.join("; ") || "None identified"}`,
    `Attention: ${explanation.attentionAreas.join("; ") || "None"}`,
    ``,
    `Evidence: ${evidence.projects} project(s), ${evidence.snapshots} OS snapshot(s), ${evidence.outcomes} outcome(s)`,
    `Supported by: ${explanation.supportedBy.join(", ")}`,
  ].join("\n");
}
