import type {
  DetectedAttentionItem,
  ProjectOSAttentionSeverity,
} from "./types";

// ─── detectProjectAttentionItems ──────────────────────────────────────────────
//
// Pure function — no DB access. Takes pre-fetched domain data, returns
// attention items that need human review. Each item traces back to a
// verifiable source entity (Rule 4).

export function detectProjectAttentionItems(input: {
  signals: Array<{
    id: string;
    signal_type: string;
    severity: string;
    status: string;
    title: string;
  }>;
  commitments: Array<{
    id: string;
    status: string;
    title: string;
    due_date: string | null;
  }>;
  drifts: Array<{
    id: string;
    severity: string;
    drift_type: string;
    description: string;
  }>;
  violations: Array<{
    id: string;
    status: string;
    title?: string;
    violation_type?: string;
  }>;
  recommendations: Array<{
    id: string;
    recommendation_type?: string;
    status: string;
    confidence_score?: number;
  }>;
  variances: Array<{
    id: string;
    severity: string;
    variance_type: string;
    variance_percentage: number;
  }>;
  operatingHealthScore: number;
  snapshotId: string;
}): DetectedAttentionItem[] {
  const items: DetectedAttentionItem[] = [];
  const now = new Date();

  // Critical signals
  for (const signal of input.signals) {
    if (signal.severity === "critical" && signal.status === "active") {
      items.push({
        attentionType: "critical_signal",
        attentionSeverity: "critical",
        sourceEntityType: "governance_signals",
        sourceEntityId: signal.id,
        title: `Critical Signal: ${signal.signal_type}`,
        description: signal.title,
        recommendedAction: "Acknowledge and investigate this critical governance signal immediately.",
      });
    }
  }

  // Overdue commitments
  for (const commitment of input.commitments) {
    if (
      commitment.due_date &&
      commitment.status !== "completed" &&
      commitment.status !== "cancelled" &&
      new Date(commitment.due_date) < now
    ) {
      items.push({
        attentionType: "overdue_commitment",
        attentionSeverity: "high",
        sourceEntityType: "governance_commitments",
        sourceEntityId: commitment.id,
        title: `Overdue Commitment: ${commitment.title}`,
        description: `Commitment due ${commitment.due_date} has not been completed (status: ${commitment.status}).`,
        recommendedAction: "Review and update the commitment status or escalate to the responsible party.",
      });
    }
  }

  // Execution drift (high or critical)
  for (const drift of input.drifts) {
    if (drift.severity === "critical" || drift.severity === "persistent") {
      const severity: ProjectOSAttentionSeverity =
        drift.severity === "critical" ? "critical" : "high";
      items.push({
        attentionType: "execution_drift",
        attentionSeverity: severity,
        sourceEntityType: "execution_drifts",
        sourceEntityId: drift.id,
        title: `Execution Drift: ${drift.drift_type}`,
        description: drift.description,
        recommendedAction: "Investigate root cause of drift and adjust execution plan.",
      });
    }
  }

  // Governance violations
  for (const violation of input.violations) {
    if (violation.status === "open" || violation.status === "unresolved") {
      items.push({
        attentionType: "governance_violation",
        attentionSeverity: "high",
        sourceEntityType: "authority_violations",
        sourceEntityId: violation.id,
        title: `Unresolved Governance Violation`,
        description: violation.title ?? `Violation of type ${violation.violation_type ?? "unknown"} remains unresolved.`,
        recommendedAction: "Resolve or escalate the governance violation.",
      });
    }
  }

  // Low health score
  if (input.operatingHealthScore < 60) {
    const severity: ProjectOSAttentionSeverity =
      input.operatingHealthScore < 40 ? "critical" : "high";
    items.push({
      attentionType: "low_health_score",
      attentionSeverity: severity,
      sourceEntityType: "project_os_snapshots",
      sourceEntityId: input.snapshotId,
      title: `Low Operating Health Score: ${input.operatingHealthScore}`,
      description: `Project operating health is ${input.operatingHealthScore}/100, below the acceptable threshold of 60.`,
      recommendedAction: "Review governance signals, overdue commitments, and execution drift for remediation.",
    });
  }

  // Projection variance (high or critical)
  for (const variance of input.variances) {
    if (variance.severity === "high" || variance.severity === "critical") {
      items.push({
        attentionType: "projection_variance",
        attentionSeverity: variance.severity as ProjectOSAttentionSeverity,
        sourceEntityType: "execution_variances",
        sourceEntityId: variance.id,
        title: `Projection Variance: ${variance.variance_type}`,
        description: `${variance.variance_type} variance of ${variance.variance_percentage.toFixed(1)}% detected (severity: ${variance.severity}).`,
        recommendedAction: "Update projections to reflect reality or investigate the source of variance.",
      });
    }
  }

  // Ignored recommendations
  for (const rec of input.recommendations) {
    if (rec.status === "ignored" || rec.status === "dismissed") {
      items.push({
        attentionType: "ignored_recommendation",
        attentionSeverity: "medium",
        sourceEntityType: "recommendations",
        sourceEntityId: rec.id,
        title: `Ignored Recommendation`,
        description: `Recommendation of type ${rec.recommendation_type ?? "unknown"} was ignored without resolution.`,
        recommendedAction: "Review ignored recommendations and either apply or formally reject with rationale.",
      });
    }
  }

  return items;
}
