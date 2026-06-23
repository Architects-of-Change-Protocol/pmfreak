// ─── Explain Capability ───────────────────────────────────────────────────────
//
// Provides a human-readable explanation of the Operational Command Center:
// what it is, how it works, what it does not do, and how to interpret
// its outputs. Satisfies Principle 3 (explainability) at the system level.

export function explainOperationalCommandCenter() {
  return {
    name: "Operational Command Center",
    epic: "EPIC 4 — Project Operating System",
    sprint: "Sprint 2",
    purpose:
      "Transforms Project OS Snapshots and their Attention Items into a prioritized, explainable, and traceable Operational Focus layer. The Command Center answers: What must be attended to first? Why? What happens if it is not addressed? What action is recommended? Who is responsible? How urgent is it?",

    principles: [
      { number: 1, label: "Does not create new reality", description: "The Command Center only surfaces existing data — it never invents signals, violations, or risks." },
      { number: 2, label: "Prioritizes existing reality", description: "All focus items derive from real Attention Items detected by the Project OS Snapshot engine." },
      { number: 3, label: "Every focus is explainable", description: "Each Focus Item includes a human-readable rationale describing why it requires attention." },
      { number: 4, label: "Every focus is traceable", description: "Every Focus Item is linked to its source Attention Item and ultimately to the domain entity that generated it." },
      { number: 5, label: "Every focus relates to an action", description: "Every Focus Item has a recommended intervention — the Command Center never leaves the operator without a next step." },
      { number: 6, label: "Does not execute actions", description: "The Command Center recommends actions but never executes them. Human decision and authority are always required." },
    ],

    architecture: {
      layers: [
        "Project OS Snapshot",
        "Attention Items",
        "Focus Scoring",
        "Operational Focus",
        "Command Center State",
      ],
      flow: "Project OS Snapshot → Attention Items → Focus Detection Engine → Focus Score → Priority → Rationale → Intervention Mapping → Owner Recommendation → Due Date → Operational Focus Item → Command Center",
    },

    commandCenterModel: {
      commandStatus: ["generated", "validated", "archived"],
      overallPriority: ["low", "medium", "high", "critical"],
      fields: ["id", "workspace_id", "project_id", "snapshot_id", "command_status", "overall_priority", "focus_score", "generated_at"],
    },

    focusModel: {
      focusTypes: ["governance", "execution", "authority", "ratification", "recommendation", "commitment", "projection", "reality", "risk", "health"],
      focusStatuses: ["open", "acknowledged", "in_progress", "resolved", "dismissed"],
      fields: ["id", "command_center_id", "attention_item_id", "focus_type", "priority", "focus_score", "title", "description", "rationale", "recommended_action_type", "recommended_owner_type", "recommended_due_date", "status"],
    },

    scoringModel: {
      scale: "0 to 100",
      dimensions: [
        { name: "Attention Severity", description: "Base score from the severity of the source attention item (critical=40, high=28, medium=16, low=8)" },
        { name: "Source Criticality", description: "Bonus based on attention type — authority_gap and ratification_stall score highest" },
        { name: "Health Impact", description: "Penalty weight based on how far below 100 the operating health score is" },
        { name: "Time Sensitivity", description: "Additional urgency bonus for critical and high severity items" },
        { name: "Blocker Effect", description: "Bonus for items that block downstream governance or execution work" },
        { name: "Recommendation Confidence", description: "Inverse confidence component — lower confidence increases uncertainty score" },
      ],
    },

    priorityModel: {
      rules: [
        { range: "0–39", priority: "low" },
        { range: "40–64", priority: "medium" },
        { range: "65–84", priority: "high" },
        { range: "85–100", priority: "critical" },
      ],
      dueDates: [
        { priority: "critical", due: "24h" },
        { priority: "high", due: "48h" },
        { priority: "medium", due: "7d" },
        { priority: "low", due: "14d" },
      ],
    },

    interventionMapping: {
      authority_gap:           "create_delegation",
      ratification_stall:      "request_ratification",
      governance_violation:    "initiate_governance_review",
      critical_signal:         "escalate_signal",
      overdue_commitment:      "breach_commitment",
      execution_drift:         "review_projection",
      projection_variance:     "review_execution_reality",
      ignored_recommendation:  "reactivate_recommendation",
      low_health_score:        "initiate_health_review",
    },

    ownerRecommendation: {
      authority_gap:           "sponsor",
      ratification_stall:      "sponsor",
      governance_violation:    "governance_board",
      critical_signal:         "governance_board",
      overdue_commitment:      "commitment_owner",
      execution_drift:         "project_manager",
      projection_variance:     "project_manager",
      ignored_recommendation:  "project_manager",
      low_health_score:        "project_manager",
    },

    lineageChain: [
      "Constitution",
      "Memory",
      "Learning",
      "Recommendation",
      "Signal",
      "Action",
      "Commitment",
      "Projection",
      "Reality",
      "Project OS Snapshot",
      "Command Center",
      "Focus Item",
    ],

    auditEvents: [
      { event: "OPERATIONAL_COMMAND_CENTER_GENERATED",    description: "Emitted when a new Command Center is generated from a snapshot" },
      { event: "OPERATIONAL_COMMAND_CENTER_VALIDATED",    description: "Emitted when a Command Center is validated by an operator" },
      { event: "OPERATIONAL_COMMAND_CENTER_ARCHIVED",     description: "Emitted when a Command Center is soft-archived" },
      { event: "OPERATIONAL_FOCUS_ITEM_CREATED",          description: "Emitted for each Focus Item created from an Attention Item" },
      { event: "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED",     description: "Emitted when a Focus Item is acknowledged" },
      { event: "OPERATIONAL_FOCUS_ITEM_STARTED",          description: "Emitted when work on a Focus Item begins" },
      { event: "OPERATIONAL_FOCUS_ITEM_RESOLVED",         description: "Emitted when a Focus Item is resolved" },
      { event: "OPERATIONAL_FOCUS_ITEM_DISMISSED",        description: "Emitted when a Focus Item is dismissed" },
      { event: "OPERATIONAL_FOCUS_SCORE_CALCULATED",      description: "Emitted when the aggregate focus score is calculated for a Command Center" },
      { event: "OPERATIONAL_PRIORITY_CALCULATED",         description: "Emitted when the overall priority is calculated for a Command Center" },
      { event: "OPERATIONAL_FOCUS_LINEAGE_GENERATED",     description: "Emitted when the operational focus lineage is reconstructed" },
    ],

    whatItDoesNotDo: [
      "Does not execute recommended actions automatically",
      "Does not modify source entities (snapshots, attention items, signals, commitments)",
      "Does not create governance signals, violations, or commitments",
      "Does not render UI or dashboards",
      "Does not delete historical data — archive only",
      "Does not assign actions to specific users — only recommends role types",
    ],

    useCases: [
      {
        scenario: "Authority gap blocking ratification",
        input: { attention_type: "authority_gap", attention_severity: "critical" },
        output: { focus_type: "authority", priority: "critical", recommended_action_type: "create_delegation", recommended_owner_type: "sponsor", due: "24h" },
      },
      {
        scenario: "Execution drift in active sprint",
        input: { attention_type: "execution_drift", attention_severity: "high" },
        output: { focus_type: "execution", priority: "high", recommended_action_type: "review_projection", recommended_owner_type: "project_manager", due: "48h" },
      },
      {
        scenario: "Overdue commitment",
        input: { attention_type: "overdue_commitment", attention_severity: "high" },
        output: { focus_type: "commitment", priority: "high", recommended_action_type: "breach_commitment", recommended_owner_type: "commitment_owner", due: "48h" },
      },
    ],
  };
}
