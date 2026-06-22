// ─────────────────────────────────────────────────────────────────────────────
// Governance Signal Engine — Explain Capability
//
// Provides human-readable explanations of every model and concept in
// the Governance Signal Engine. Supports transparency (Principle 2)
// and traceability (Principle 3).
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceSignalExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  detectionModel: object;
  confidenceModel: object;
  severityModel: object;
  correlationModel: object;
  governanceHealthModel: object;
  resolutionModel: object;
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  signalCategories: string[];
  signalSeverities: string[];
  signalStatuses: string[];
  signalSources: string[];
  lineageChain: string[];
  useCases: string[];
};

export function explainGovernanceSignals(): GovernanceSignalExplanation {
  return {
    concept:
      "The Governance Signal Engine transforms PMFreak from a retrospective intelligence system " +
      "into an active operational system. It continuously observes the constitutional state of " +
      "active workspaces and generates actionable, time-bound, explainable signals before " +
      "governance problems materialize.",

    principles: [
      { number: 1, statement: "Signals must originate from observable data — no speculation." },
      { number: 2, statement: "Every signal must be explainable — its origin, confidence, and severity must be derivable from first principles." },
      { number: 3, statement: "Every signal must be traceable — back to the artifact, memory, digest, pattern, and recommendation that support it." },
      { number: 4, statement: "Signals do not substitute human judgment — they inform and accelerate it." },
      { number: 5, statement: "Signals are temporal — they are born active and must be resolved, acknowledged, or dismissed." },
      { number: 6, statement: "Signals must be resolvable — every signal type has a defined resolution path." },
    ],

    detectionModel: {
      description:
        "Detection rules are deterministic threshold checks applied to current workspace state. " +
        "No ML or LLM is required. Rules are applied per signal category.",
      rules: {
        approval_delay: {
          condition: "Decision in 'proposed' or 'submitted' status for >= 3 days.",
          source: "constitutional_decisions",
          confidenceBase: 0.90,
        },
        authority_gap: {
          condition: "Authority registration with status 'expired' or 'revoked'.",
          source: "authority_registrations",
          confidenceBase: 0.88,
        },
        escalation_gap: {
          condition: "High/critical severity governance violation with no linked escalation.",
          source: "governance_violations",
          confidenceBase: 0.85,
        },
        amendment_backlog: {
          condition: "3 or more amendments in 'proposed' or 'draft' status simultaneously.",
          source: "constitution_amendments",
          confidenceBase: 0.85,
        },
        ratification_stall: {
          condition: "Signature request pending for >= 7 days.",
          source: "constitutional_signature_requests",
          confidenceBase: 0.88,
        },
        governance_violation: {
          condition: "Any open governance violation.",
          source: "governance_violations",
          confidenceBase: 1.00,
        },
      },
    },

    confidenceModel: {
      description:
        "Confidence is a 0.0–1.0 score computed from four weighted factors.",
      formula:
        "confidence = patternMatch × 0.40 + evidenceStrength × 0.30 + historicalFrequency × 0.20 + currentContext × 0.10",
      factors: {
        patternMatch: "How precisely the observation satisfies the detection rule.",
        evidenceStrength: "Volume and quality of supporting evidence pieces.",
        historicalFrequency: "Prior occurrences of this signal type in the workspace.",
        currentContext: "Duration, entity criticality, and co-active signals.",
      },
    },

    severityModel: {
      description:
        "Severity is derived from signal type baseline escalated by duration and context.",
      baselines: {
        governance_violation: "critical",
        authority_gap: "high",
        escalation_gap: "high",
        approval_delay: "medium",
        ratification_stall: "medium",
        decision_bottleneck: "medium",
        amendment_backlog: "medium",
        risk_accumulation: "medium",
        recommendation_ignored: "low",
        delivery_drift: "low",
      },
      escalationRules: [
        "Duration >= 8 days: +1 severity level",
        "Duration >= 15 days: +2 severity levels",
        "Historical negative outcome: +1 severity level",
        "5+ affected entities: +1 severity level",
      ],
      scale: ["low", "medium", "high", "critical"],
    },

    correlationModel: {
      description:
        "The correlation engine identifies causal relationships between co-existing active signals. " +
        "Correlations are based on known governance causality patterns.",
      correlations: [
        { from: "approval_delay",    to: "delivery_drift",      confidence: 0.80 },
        { from: "authority_gap",     to: "governance_violation", confidence: 0.82 },
        { from: "escalation_gap",    to: "governance_violation", confidence: 0.75 },
        { from: "amendment_backlog", to: "ratification_stall",   confidence: 0.78 },
        { from: "recommendation_ignored", to: "governance_violation", confidence: 0.70 },
        { from: "risk_accumulation", to: "delivery_drift",       confidence: 0.76 },
        { from: "decision_bottleneck", to: "delivery_drift",     confidence: 0.72 },
        { from: "ratification_stall",  to: "delivery_drift",     confidence: 0.74 },
      ],
    },

    governanceHealthModel: {
      description:
        "Governance Health is a 0–100 score reflecting the current signal landscape of a workspace.",
      formula:
        "health = 100 − (critical × 25 + high × 10 + medium × 5 + low × 2) + min(10, resolved × 1)",
      interpretation: {
        "90–100": "Excellent — minimal governance risk",
        "70–89":  "Good — minor signals present",
        "50–69":  "Moderate — attention required",
        "25–49":  "Poor — multiple high-severity signals",
        "0–24":   "Critical — governance failure risk",
      },
    },

    resolutionModel: {
      description: "Every signal follows a defined lifecycle.",
      transitions: {
        active: ["acknowledged", "resolved", "dismissed"],
        acknowledged: ["resolved", "dismissed"],
        resolved: [],
        dismissed: [],
      },
      rules: {
        acknowledged:
          "The responsible party is recorded. Signal transitions to acknowledged to indicate awareness.",
        resolved:
          "The underlying condition has been corrected. The resolver and timestamp are recorded.",
        dismissed:
          "The signal is deemed non-actionable. A reason must be provided. Audit trail is preserved.",
      },
    },

    auditEvents: [
      "GOVERNANCE_SIGNAL_DETECTED",
      "GOVERNANCE_SIGNAL_ACKNOWLEDGED",
      "GOVERNANCE_SIGNAL_RESOLVED",
      "GOVERNANCE_SIGNAL_DISMISSED",
      "GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED",
      "GOVERNANCE_SIGNAL_SEVERITY_CALCULATED",
      "GOVERNANCE_SIGNAL_CORRELATED",
      "GOVERNANCE_HEALTH_CALCULATED",
    ],

    businessRules: [
      { number: 1, statement: "Every signal must have a verifiable origin (source_entity_id)." },
      { number: 2, statement: "Every signal must have at least one piece of evidence." },
      { number: 3, statement: "Every signal must be resolvable via acknowledge, resolve, or dismiss." },
      { number: 4, statement: "Every resolution and dismissal must be auditable." },
      { number: 5, statement: "Workspace isolation is mandatory — no signal crosses workspace boundaries." },
      { number: 6, statement: "Signals are not permanent — they are either resolved or dismissed." },
      { number: 7, statement: "Signals participate in Governance Health calculation." },
      { number: 8, statement: "No orphan signals — a signal without traceable source entity is rejected." },
    ],

    signalCategories: [
      "approval_delay",
      "authority_gap",
      "escalation_gap",
      "decision_bottleneck",
      "amendment_backlog",
      "ratification_stall",
      "risk_accumulation",
      "recommendation_ignored",
      "governance_violation",
      "delivery_drift",
    ],

    signalSeverities: ["low", "medium", "high", "critical"],
    signalStatuses:   ["active", "acknowledged", "resolved", "dismissed"],

    signalSources: [
      "constitution",
      "decision",
      "amendment",
      "ratification",
      "authority",
      "delegation",
      "recommendation",
      "risk",
      "project",
    ],

    lineageChain: [
      "Artifact",
      "Memory",
      "Digest",
      "Learning Pattern",
      "Recommendation",
      "Signal",
    ],

    useCases: [
      "Detect an approval delay before it becomes a delivery blocker.",
      "Surface authority gaps before unauthorized decisions are made.",
      "Identify governance violations and escalate them proactively.",
      "Correlate approval delays with delivery drift patterns.",
      "Calculate workspace governance health to prioritize interventions.",
      "Trace a signal back to its originating artifact for full accountability.",
      "Associate signals with existing recommendations for immediate action.",
    ],
  };
}
