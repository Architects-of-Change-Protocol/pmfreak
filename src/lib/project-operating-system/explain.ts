// ─── explainProjectOperatingSystem ────────────────────────────────────────────
//
// Human-readable explanation of what the Project OS is, how it works,
// and what it does NOT do. Enables explainability and traceability.

export function explainProjectOperatingSystem() {
  return {
    concept: "Project Operating System (Project OS)",
    summary:
      "A read-only orchestration layer that composes data from all project domains " +
      "into a unified operating snapshot. It answers: what is happening, how healthy is the project, " +
      "what requires attention, and how did we get here.",

    domains: [
      { name: "Constitution", entities: ["project_constitutions"] },
      { name: "Memory", entities: ["operational_memory_entries", "constitutional_digests"] },
      { name: "Learning", entities: ["learning_patterns"] },
      { name: "Recommendation", entities: ["recommendations"] },
      { name: "Signal", entities: ["governance_signals"] },
      { name: "Action", entities: ["governance_actions"] },
      { name: "Commitment", entities: ["governance_commitments"] },
      { name: "Projection", entities: ["execution_projections"] },
      { name: "Reality", entities: ["execution_realities", "execution_variances", "execution_drifts"] },
    ],

    principles: [
      {
        number: 1,
        text: "Project OS does not replace existing domains. It orchestrates them.",
      },
      {
        number: 2,
        text: "Project OS does not duplicate business logic. It composes existing data.",
      },
      {
        number: 3,
        text: "Project OS must be explainable. Every health score and attention item has a traceable origin.",
      },
      {
        number: 4,
        text: "Project OS must respect workspace isolation. All queries filter by workspace_id.",
      },
      {
        number: 5,
        text: "Project OS must be auditable. Every snapshot generation emits a platform event.",
      },
      {
        number: 6,
        text: "Project OS is historical. Snapshots are never deleted, only archived.",
      },
      {
        number: 7,
        text: "Project OS does not execute actions. It identifies what requires attention.",
      },
    ],

    healthModel: {
      description: "Operating health is a weighted average of four domain scores, each on a 0–100 scale.",
      weights: {
        governance: 0.35,
        execution: 0.35,
        memory: 0.15,
        recommendation: 0.15,
      },
      factors: {
        governance: [
          "Active signals penalized by severity (critical: -25, high: -10, medium: -5, low: -2)",
          "Unresolved violations: -15 per violation",
        ],
        execution: [
          "Overdue commitment ratio (0–40 penalty)",
          "Projection accuracy bonus above 70%",
        ],
        memory: [
          "No records = 60 (neutral; memory enriches but is not required)",
          "Up to +40 bonus for richness of records",
        ],
        recommendation: [
          "Ignored recommendations: -10 per ignored",
          "High-confidence active recommendations: +3 per (up to +10)",
        ],
      },
    },

    attentionModel: {
      description: "Attention items are derived from domain entities that require human review.",
      types: [
        {
          type: "critical_signal",
          trigger: "signal.severity = critical AND status = active",
          severity: "critical",
        },
        {
          type: "overdue_commitment",
          trigger: "commitment.due_date < now AND status not in (completed, cancelled)",
          severity: "high",
        },
        {
          type: "execution_drift",
          trigger: "drift.severity IN (persistent, critical)",
          severity: "high or critical",
        },
        {
          type: "governance_violation",
          trigger: "violation.status IN (open, unresolved)",
          severity: "high",
        },
        {
          type: "low_health_score",
          trigger: "operating_health_score < 60",
          severity: "high (< 60) or critical (< 40)",
        },
        {
          type: "projection_variance",
          trigger: "variance.severity IN (high, critical)",
          severity: "matches variance severity",
        },
        {
          type: "ignored_recommendation",
          trigger: "recommendation.status IN (ignored, dismissed)",
          severity: "medium",
        },
      ],
    },

    lineageChain: [
      { step: 1, layer: "Constitution", description: "Foundation of project governance rules" },
      { step: 2, layer: "Memory", description: "Operational records and artifacts" },
      { step: 3, layer: "Digest", description: "Synthesized constitutional knowledge" },
      { step: 4, layer: "Learning", description: "Patterns extracted from outcomes" },
      { step: 5, layer: "Recommendation", description: "Derived actions from learning" },
      { step: 6, layer: "Signal", description: "Detected governance anomalies" },
      { step: 7, layer: "Action", description: "Governance responses to signals" },
      { step: 8, layer: "Commitment", description: "Binding commitments from actions" },
      { step: 9, layer: "Projection", description: "Forecasted execution outcomes" },
      { step: 10, layer: "Reality", description: "Observed execution outcomes" },
      { step: 11, layer: "Snapshot", description: "Composed operating view at a point in time" },
    ],

    auditEvents: [
      "PROJECT_OS_SNAPSHOT_GENERATED",
      "PROJECT_OS_SNAPSHOT_VALIDATED",
      "PROJECT_OS_SNAPSHOT_ARCHIVED",
      "PROJECT_OS_HEALTH_CALCULATED",
      "PROJECT_OS_ATTENTION_ITEM_CREATED",
      "PROJECT_OS_CONTEXT_COMPOSED",
      "PROJECT_OS_LINEAGE_GENERATED",
    ],

    whatItDoesNotDo: [
      "Does not create governance signals, actions, or commitments.",
      "Does not execute or trigger operational actions.",
      "Does not replace domain-specific services.",
      "Does not provide a UI or dashboard.",
      "Does not auto-archive or purge historical snapshots.",
      "Does not mutate data in other domains.",
    ],
  };
}
