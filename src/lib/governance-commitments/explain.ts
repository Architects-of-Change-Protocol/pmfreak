// ─────────────────────────────────────────────────────────────────────────────
// Governance Commitment Engine — Explain Capability
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceCommitmentExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  lifecycleModel: object;
  accountabilityModel: object;
  delegationModel: object;
  healthModel: object;
  forecastModel: object;
  breachDetectionModel: object;
  lineageChain: string[];
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  commitmentStatuses: string[];
  commitmentPriorities: string[];
  commitmentOutcomes: string[];
  useCases: string[];
};

export function explainGovernanceCommitments(): GovernanceCommitmentExplanation {
  return {
    concept:
      "The Governance Commitment Engine transforms PMFreak from intelligent intervention into " +
      "operational accountability. It converts governance actions into verifiable commitments " +
      "with explicit human ownership — enabling PMFreak to answer: Who accepted the action? " +
      "Who is responsible? When did they accept? Did they execute? Did they breach? Is it overdue? " +
      "Was it delegated? Commitments are human obligations, never automatic executions.",

    principles: [
      { number: 1, statement: "Every action can generate a commitment." },
      { number: 2, statement: "Every commitment must have a responsible owner." },
      { number: 3, statement: "Every commitment must have a status." },
      { number: 4, statement: "Every commitment must be traceable." },
      { number: 5, statement: "Every commitment must be auditable." },
      { number: 6, statement: "Commitments are human obligations." },
      { number: 7, statement: "Commitments generate accountability." },
    ],

    lifecycleModel: {
      description:
        "Commitment lifecycle is a deterministic state machine. Terminal states are irreversible.",
      states: {
        pending_acceptance: "Initial state. Waiting for owner to accept or reject.",
        accepted:           "Owner has formally accepted. Timestamp recorded.",
        rejected:           "Owner has rejected. Terminal.",
        active:             "Execution in progress.",
        completed:          "Fulfilled. Outcome recorded. Terminal.",
        breached:           "Not fulfilled by due date. Terminal.",
        cancelled:          "Cancelled before completion. Terminal.",
        delegated:          "Transferred to another actor.",
        expired:            "Passed due date without acceptance. Terminal.",
      },
      transitions: {
        pending_acceptance: ["accepted", "rejected", "expired"],
        accepted:           ["active", "cancelled", "delegated"],
        active:             ["completed", "breached", "cancelled", "expired", "delegated"],
        delegated:          ["accepted", "active", "cancelled"],
      },
    },

    accountabilityModel: {
      description:
        "Accountability is calculated per commitment, answering: is the owner on time, overdue, or in breach?",
      fields: {
        commitmentId: "Unique identifier of the commitment.",
        owner:        "The actor responsible for fulfillment.",
        accepted:     "Whether the owner formally accepted.",
        completed:    "Whether the commitment was fulfilled.",
        overdue:      "Whether due_date has passed without completion.",
        daysLate:     "Days elapsed past due_date (if overdue).",
        status:       "Current lifecycle status.",
      },
    },

    delegationModel: {
      description:
        "Delegation transfers ownership from one actor to another. It is validated for authority, " +
        "ownership rights, and absence of active delegations.",
      validationRules: [
        "Only the current owner may delegate.",
        "Cannot delegate to yourself.",
        "Cannot delegate a commitment in a terminal state.",
        "Cannot delegate if an active delegation already exists.",
      ],
    },

    healthModel: {
      description:
        "Commitment health is a 0–100 score based on outcomes across all workspace commitments.",
      formula:
        "score = completionRate × 100 − (breachRate × 40) − (overdueRate × 30), clamped to [0, 100]",
      factors: {
        completed:         "Completed commitments (positive).",
        breached:          "Breached commitments (−40 per percentage point).",
        overdue:           "Overdue active commitments (−30 per percentage point).",
        delegated:         "Delegated commitments (tracked, neutral).",
        active:            "In-progress commitments (tracked, neutral).",
        pendingAcceptance: "Awaiting owner response (tracked, neutral).",
      },
    },

    forecastModel: {
      description:
        "Forecast estimates probability of completion and risk of breach using priority, " +
        "status, time remaining, signal severity, and historical effectiveness.",
      formula:
        "p_completion = base(priority) + statusMod + timeMod + severityMod + historicalMod, clamped to [0, 1]",
      example: {
        commitmentId:            "GOV-COM-31",
        probabilityOfCompletion: 0.82,
        riskOfBreach:            0.18,
      },
    },

    breachDetectionModel: {
      description:
        "Breach detection scans commitments where due_date < now AND status ∉ {completed, cancelled, rejected, breached, expired}.",
      output: {
        commitmentId: "UUID of the overdue commitment.",
        title:        "Human-readable title.",
        ownerId:      "UUID of the responsible actor.",
        dueDate:      "Original due date.",
        status:       "Current lifecycle status.",
        daysOverdue:  "Calendar days past due date.",
      },
    },

    lineageChain: [
      "Artifact",
      "Memory",
      "Digest",
      "Learning Pattern",
      "Recommendation",
      "Signal",
      "Action",
      "Commitment",
    ],

    auditEvents: [
      "GOVERNANCE_COMMITMENT_CREATED",
      "GOVERNANCE_COMMITMENT_ACCEPTED",
      "GOVERNANCE_COMMITMENT_REJECTED",
      "GOVERNANCE_COMMITMENT_ACTIVATED",
      "GOVERNANCE_COMMITMENT_COMPLETED",
      "GOVERNANCE_COMMITMENT_CANCELLED",
      "GOVERNANCE_COMMITMENT_BREACHED",
      "GOVERNANCE_COMMITMENT_EXPIRED",
      "GOVERNANCE_COMMITMENT_DELEGATED",
      "GOVERNANCE_COMMITMENT_FORECAST_GENERATED",
      "GOVERNANCE_COMMITMENT_HEALTH_CALCULATED",
      "GOVERNANCE_COMMITMENT_LINEAGE_GENERATED",
    ],

    businessRules: [
      { number: 1,  statement: "Every commitment must originate from an action." },
      { number: 2,  statement: "Every commitment must have a responsible owner." },
      { number: 3,  statement: "Every acceptance must record a timestamp." },
      { number: 4,  statement: "Every breach must be recorded." },
      { number: 5,  statement: "Every delegation must be validated." },
      { number: 6,  statement: "Workspace isolation is mandatory." },
      { number: 7,  statement: "No orphan commitments — every commitment has a traceable action." },
      { number: 8,  statement: "Terminal states are irreversible." },
      { number: 9,  statement: "Every transition must generate an audit history record." },
      { number: 10, statement: "Every commitment must maintain complete lineage." },
    ],

    commitmentStatuses: [
      "pending_acceptance",
      "accepted",
      "rejected",
      "active",
      "completed",
      "breached",
      "cancelled",
      "delegated",
      "expired",
    ],

    commitmentPriorities: ["low", "medium", "high", "critical"],

    commitmentOutcomes: ["successful", "partial", "failed", "unknown"],

    useCases: [
      "Transform a request_ratification action into a commitment assigned to the sponsor.",
      "Record that the sponsor accepted the commitment on 2026-07-10 at 09:00 UTC.",
      "Detect that the commitment is 11 days overdue and breach it automatically.",
      "Delegate a commitment from the sponsor to the project manager with a reason.",
      "Calculate health score across all workspace commitments to surface accountability gaps.",
      "Forecast that a critical commitment has 0.55 probability of completion.",
      "Retrieve the full lineage from artifact to commitment for audit purposes.",
      "List all active commitments overdue by more than 3 days for governance review.",
    ],
  };
}
