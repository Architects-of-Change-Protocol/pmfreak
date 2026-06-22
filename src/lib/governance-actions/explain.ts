// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Explain Capability
//
// Provides human-readable explanations of every model and concept in
// the Governance Action Engine. Supports transparency and traceability.
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceActionExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  actionGenerationModel: object;
  priorityModel: object;
  confidenceModel: object;
  authorityValidationModel: object;
  deadlineModel: object;
  interventionModel: object;
  lineageChain: string[];
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  actionTypes: string[];
  actionPriorities: string[];
  actionStatuses: string[];
  useCases: string[];
};

export function explainGovernanceActions(): GovernanceActionExplanation {
  return {
    concept:
      "The Governance Action Engine transforms PMFreak from active observation into intelligent " +
      "intervention. It converts detected governance signals into recommended, prioritized, " +
      "justified, and traceable actions — enabling PMFreak to answer: What should we do? " +
      "Who should do it? When must it be done? What happens if it isn't? " +
      "Actions are always suggested, never automatically executed.",

    principles: [
      { number: 1, statement: "Every action must originate from a signal." },
      { number: 2, statement: "Every action must be explainable — its origin, confidence, and priority must be derivable from first principles." },
      { number: 3, statement: "Every action must be traceable — back to the artifact, memory, digest, pattern, recommendation, and signal." },
      { number: 4, statement: "Every action must respect constitutional authority — only authorized actors may execute recommended actions." },
      { number: 5, statement: "Every action must be auditable — every lifecycle event is recorded immutably." },
      { number: 6, statement: "Actions are suggested, not executed automatically — human authority is always preserved." },
    ],

    actionGenerationModel: {
      description:
        "Action generation rules are deterministic mappings from signal type to action candidates. " +
        "No ML or LLM is required. Each signal type produces one or more action candidates.",
      rules: {
        approval_delay:           "→ request_approval (high)",
        authority_gap:            "→ create_delegation (critical), assign_authority (high)",
        escalation_gap:           "→ create_escalation (critical)",
        amendment_backlog:        "→ review_amendment (medium)",
        governance_violation:     "→ initiate_governance_review (critical)",
        recommendation_ignored:   "→ reassess_recommendation (medium)",
        ratification_stall:       "→ request_ratification (high)",
        decision_bottleneck:      "→ review_decision (medium)",
        risk_accumulation:        "→ review_risk (medium)",
        delivery_drift:           "→ review_decision (medium)",
      },
    },

    priorityModel: {
      description:
        "Action priority is derived from signal severity, signal type impact, duration, " +
        "and historical outcome data.",
      formula:
        "priority = base_severity + signal_type_escalation + duration_escalation + historical_escalation",
      escalationRules: [
        "High-impact signal types (governance_violation, authority_gap, escalation_gap): +1 level",
        "Duration >= 8 days: +1 level",
        "Duration >= 15 days: +2 levels",
        "Historical negative outcome: +1 level",
      ],
      deadlines: {
        critical: "24 hours",
        high:     "48 hours",
        medium:   "7 days",
        low:      "14 days",
      },
    },

    confidenceModel: {
      description:
        "Action confidence is a 0.0–1.0 score computed from four weighted factors.",
      formula:
        "confidence = signalConfidence × 0.40 + recommendationConfidence × 0.25 + learningConfidence × 0.20 + historicalEffectiveness × 0.15",
      factors: {
        signalConfidence:        "Confidence of the originating signal.",
        recommendationConfidence: "Confidence of any linked prior recommendation.",
        learningConfidence:      "Confidence derived from matched learning patterns.",
        historicalEffectiveness: "Historical success rate of this action type.",
      },
    },

    authorityValidationModel: {
      description:
        "Each action type maps to a required authority role. " +
        "The engine validates whether the recommended actor holds the required authority.",
      authorityMap: {
        create_escalation:          "project_manager",
        request_ratification:       "sponsor",
        request_approval:           "decision_authority",
        create_delegation:          "sponsor",
        assign_authority:           "sponsor",
        review_amendment:           "project_manager",
        review_decision:            "decision_authority",
        review_risk:                "risk_owner",
        initiate_governance_review: "sponsor",
        close_signal:               "project_manager",
        reassess_recommendation:    "project_manager",
        other:                      "project_manager",
      },
    },

    deadlineModel: {
      description:
        "Recommended due dates are computed deterministically from action priority.",
      deadlines: {
        critical: "now + 24h",
        high:     "now + 48h",
        medium:   "now + 7d",
        low:      "now + 14d",
      },
    },

    interventionModel: {
      description:
        "The intervention engine simulates the expected governance effect of each action " +
        "without executing it. Results are advisory estimates, not guarantees.",
      example: {
        actionType:              "request_ratification",
        expectedEffect:          "reduce_approval_delay",
        confidence:              0.78,
        estimatedResolutionDays: 3,
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
    ],

    auditEvents: [
      "GOVERNANCE_ACTION_GENERATED",
      "GOVERNANCE_ACTION_ASSIGNED",
      "GOVERNANCE_ACTION_APPROVED",
      "GOVERNANCE_ACTION_REJECTED",
      "GOVERNANCE_ACTION_COMPLETED",
      "GOVERNANCE_ACTION_EXPIRED",
      "GOVERNANCE_ACTION_CONFIDENCE_CALCULATED",
      "GOVERNANCE_ACTION_PRIORITY_CALCULATED",
      "GOVERNANCE_ACTION_AUTHORITY_VALIDATED",
      "GOVERNANCE_ACTION_LINEAGE_GENERATED",
    ],

    businessRules: [
      { number: 1,  statement: "Every action must originate from a signal." },
      { number: 2,  statement: "Every action must have a justification." },
      { number: 3,  statement: "Every action must have a recommended owner." },
      { number: 4,  statement: "Every action must have a priority." },
      { number: 5,  statement: "Every action must have a recommended due date." },
      { number: 6,  statement: "Workspace isolation is mandatory." },
      { number: 7,  statement: "Every action must be auditable." },
      { number: 8,  statement: "No orphan actions — every action has a traceable signal." },
      { number: 9,  statement: "Actions cannot be executed automatically." },
      { number: 10, statement: "Every action must maintain complete lineage." },
    ],

    actionTypes: [
      "create_escalation",
      "request_ratification",
      "request_approval",
      "create_delegation",
      "assign_authority",
      "review_amendment",
      "review_decision",
      "review_risk",
      "initiate_governance_review",
      "close_signal",
      "reassess_recommendation",
      "other",
    ],

    actionPriorities: ["low", "medium", "high", "critical"],
    actionStatuses:   ["generated", "reviewed", "approved", "rejected", "expired", "completed"],

    useCases: [
      "Transform an approval_delay signal into a request_approval action assigned to the decision authority.",
      "Transform an authority_gap signal into a create_delegation action assigned to the sponsor.",
      "Transform a governance_violation into an initiate_governance_review action with critical priority.",
      "Simulate the intervention effect of a create_escalation before committing to it.",
      "Trace an action back to its originating artifact for full accountability.",
      "List all critical actions pending in a workspace to prioritize governance interventions.",
      "Expire actions that have passed their recommended due date without resolution.",
    ],
  };
}
