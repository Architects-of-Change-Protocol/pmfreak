import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import { classifyGovernanceComplianceStatus } from "./engines/status-classification";
import { detectGovernanceGaps } from "./engines/gap-detection";
import { calculateGovernanceDebt } from "./engines/debt-engine";
import { identifyGovernanceHotspots } from "./engines/hotspot-engine";
import { generateGovernanceComplianceSnapshot } from "./compliance-registry";

import type {
  GovernanceComplianceResult,
  GenerateGovernanceScorecardInput,
  GovernanceScorecard,
  GovernanceComplianceSnapshotRow,
  GovernanceComplianceDomain,
} from "./types";

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
function notFound<T>(): GovernanceComplianceResult<T> {
  return { ok: false, error: "Project Manager not found.", failureClass: "not_found" };
}

// ─── buildScorecardExplanation ────────────────────────────────────────────────

function buildScorecardExplanation(snapshot: GovernanceComplianceSnapshotRow): GovernanceScorecard["explanation"] {
  const domainScores: Record<GovernanceComplianceDomain, number> = {
    constitution: Number(snapshot.constitution_score),
    authority:    Number(snapshot.authority_score),
    ratification: Number(snapshot.ratification_score),
    decision:     Number(snapshot.decision_score),
    execution:    Number(snapshot.execution_score),
    learning:     Number(snapshot.learning_score),
  };

  const domainLabels: Record<GovernanceComplianceDomain, string> = {
    constitution: "Constitution",
    authority:    "Authority",
    ratification: "Ratification",
    decision:     "Decision",
    execution:    "Execution",
    learning:     "Learning",
  };

  const compliantDomains: string[] = [];
  const warningDomains:   string[] = [];
  const criticalDomains:  string[] = [];

  for (const [domain, score] of Object.entries(domainScores) as [GovernanceComplianceDomain, number][]) {
    const status = classifyGovernanceComplianceStatus(score);
    const label  = domainLabels[domain];
    if (status === "compliant")      compliantDomains.push(`${label} (${score})`);
    else if (status === "warning")   warningDomains.push(`${label} (${score})`);
    else                             criticalDomains.push(`${label} (${score})`);
  }

  const overallStatus = classifyGovernanceComplianceStatus(Number(snapshot.overall_score));
  const summary = overallStatus === "compliant"
    ? `Governance compliance is strong at ${snapshot.overall_score}. Most domains meet the constitutional model.`
    : overallStatus === "warning"
    ? `Governance compliance is at ${snapshot.overall_score}. Some domains require attention to meet the constitutional model.`
    : `Governance compliance is critical at ${snapshot.overall_score}. Immediate attention required across multiple domains.`;

  return { summary, compliantDomains, warningDomains, criticalDomains };
}

// ─── generateGovernanceScorecard ─────────────────────────────────────────────

export async function generateGovernanceScorecard(
  input: GenerateGovernanceScorecardInput
): Promise<GovernanceComplianceResult<GovernanceScorecard>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: pm } = await supabase
    .from("project_managers")
    .select("id,display_name,email")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!pm) return notFound();

  const snapshotResult = await generateGovernanceComplianceSnapshot({
    workspaceId: input.workspaceId,
    pmId:        input.pmId,
  });

  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;

  const { data: gapRows } = await supabase
    .from("governance_compliance_gaps")
    .select("domain,gap_type,severity,description,evidence_count")
    .eq("snapshot_id", snapshot.id)
    .eq("workspace_id", input.workspaceId);

  const gaps = (gapRows ?? []).map((g: { domain: GovernanceComplianceDomain; gap_type: string; severity: string; description: string; evidence_count: number }) => ({
    domain:        g.domain,
    gapType:       g.gap_type,
    severity:      g.severity as "low" | "medium" | "high" | "critical",
    description:   g.description,
    evidenceCount: g.evidence_count,
  }));

  const debt     = calculateGovernanceDebt(gaps);
  const hotspots = identifyGovernanceHotspots(gaps);

  const scorecard: GovernanceScorecard = {
    pm: { id: pm.id, name: pm.display_name, email: pm.email },
    scores: {
      constitution: Number(snapshot.constitution_score),
      authority:    Number(snapshot.authority_score),
      ratification: Number(snapshot.ratification_score),
      decision:     Number(snapshot.decision_score),
      execution:    Number(snapshot.execution_score),
      learning:     Number(snapshot.learning_score),
      overall:      Number(snapshot.overall_score),
    },
    status:    snapshot.compliance_status,
    gaps,
    debt,
    hotspots,
    explanation: buildScorecardExplanation(snapshot),
    generatedAt: snapshot.generated_at,
  };

  return { ok: true, data: scorecard };
}

// ─── explainGovernanceScorecard ───────────────────────────────────────────────

export function explainGovernanceScorecard(scorecard: GovernanceScorecard): string {
  const lines: string[] = [
    `PM: ${scorecard.pm.name} <${scorecard.pm.email}>`,
    `Overall Compliance: ${scorecard.scores.overall} (${scorecard.status})`,
    "",
    "Domain Scores:",
    `  Constitution:  ${scorecard.scores.constitution}`,
    `  Authority:     ${scorecard.scores.authority}`,
    `  Ratification:  ${scorecard.scores.ratification}`,
    `  Decision:      ${scorecard.scores.decision}`,
    `  Execution:     ${scorecard.scores.execution}`,
    `  Learning:      ${scorecard.scores.learning}`,
    "",
    scorecard.explanation.summary,
  ];

  if (scorecard.explanation.compliantDomains.length > 0) {
    lines.push("", "Compliant Domains:", ...scorecard.explanation.compliantDomains.map((d) => `  ✓ ${d}`));
  }
  if (scorecard.explanation.warningDomains.length > 0) {
    lines.push("", "Warning Domains:", ...scorecard.explanation.warningDomains.map((d) => `  ⚠ ${d}`));
  }
  if (scorecard.explanation.criticalDomains.length > 0) {
    lines.push("", "Critical Domains:", ...scorecard.explanation.criticalDomains.map((d) => `  ✗ ${d}`));
  }

  if (scorecard.gaps.length > 0) {
    lines.push("", `Governance Gaps (${scorecard.gaps.length}):`);
    for (const gap of scorecard.gaps) {
      lines.push(`  [${gap.severity.toUpperCase()}] ${gap.domain}: ${gap.description}`);
    }
  }

  if (scorecard.hotspots.length > 0) {
    lines.push("", "Hotspots:");
    for (const h of scorecard.hotspots) {
      lines.push(`  ${h.domain}: ${h.gapCount} gap(s) — dominant severity: ${h.dominantSeverity}`);
    }
  }

  lines.push("", `Debt: low=${scorecard.debt.low} medium=${scorecard.debt.medium} high=${scorecard.debt.high} critical=${scorecard.debt.critical}`);
  lines.push(`Generated At: ${scorecard.generatedAt}`);

  return lines.join("\n");
}
