import { GOVERNANCE_COMPLIANCE_WEIGHTS, GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS } from "./types";

// ─── Explain Type ─────────────────────────────────────────────────────────────

export type PMOGovernanceComplianceExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  complianceDomains: Record<string, { description: string; weight: string; basedOn: string[] }>;
  gapModel: {
    description: string;
    gapTypes: string[];
    severities: Array<{ level: string; meaning: string }>;
  };
  debtModel: {
    description: string;
    formula: string;
  };
  hotspotModel: {
    description: string;
    ranking: string;
  };
  overallCompliance: {
    formula: string;
    weights: Record<string, string>;
    thresholds: Array<{ range: string; status: string }>;
  };
  lineage: string;
  nonPunitiveDesign: string;
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  useCases: string[];
};

// ─── explainPMOGovernanceCompliance ──────────────────────────────────────────

export function explainPMOGovernanceCompliance(): PMOGovernanceComplianceExplanation {
  return {
    concept:
      "The PMO Governance Compliance Engine transforms governance from a set of control " +
      "mechanisms into a measurable organizational capability. It evaluates the degree to " +
      "which Project Managers, projects, and the PMO adhere to the constitutional model " +
      "defined by PMFreak — across six compliance domains — producing historical, " +
      "explainable snapshots of governance adherence backed by traceable evidence.",

    principles: [
      { number: 1, statement: "Governance must be measurable — every domain produces a 0–100 score." },
      { number: 2, statement: "Every measurement must be explainable — scores derive from observable evidence." },
      { number: 3, statement: "Every measurement must originate from evidence — no opinions or inferences." },
      { number: 4, statement: "Governance evaluation must be continuous — snapshots accumulate over time." },
      { number: 5, statement: "Non-compliance must be detected early — gaps are classified and surfaced immediately." },
      { number: 6, statement: "Governance must not be punitive — the model supports, not penalizes." },
      { number: 7, statement: "Workspace isolation is mandatory — no cross-workspace data access." },
    ],

    complianceDomains: {
      constitution: {
        description: "Measures whether projects operate under a valid, complete constitutional framework.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.constitution * 100).toFixed(0)}%`,
        basedOn: [
          "project_constitutions.lifecycle_status",
          "constitutional_amendments presence",
          "constitution completeness indicators",
        ],
      },
      authority: {
        description: "Measures whether authority assignments are valid, current, and properly scoped.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.authority * 100).toFixed(0)}%`,
        basedOn: [
          "authority_assignments.status",
          "authority_assignments.expires_at",
          "authority_assignments.delegation_scope",
          "unauthorized action detection",
        ],
      },
      ratification: {
        description: "Measures whether decisions requiring ratification have been properly ratified.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.ratification * 100).toFixed(0)}%`,
        basedOn: [
          "constitutional_ratifications.status",
          "constitutional_ratifications.expires_at",
          "missing ratification backlog",
        ],
      },
      decision: {
        description: "Measures whether decisions are made with proper lineage, authority, and accountability.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.decision * 100).toFixed(0)}%`,
        basedOn: [
          "operational_decisions.authority_id",
          "operational_decisions.accountability_id",
          "operational_decision_outcomes presence",
          "decision lineage completeness",
        ],
      },
      execution: {
        description: "Measures whether commitments are fulfilled and execution realities are validated.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.execution * 100).toFixed(0)}%`,
        basedOn: [
          "governance_commitments.status",
          "execution_realities.status",
          "execution_tasks overdue count",
          "projection integrity",
        ],
      },
      learning: {
        description: "Measures whether the organization captures operational memory, generates digests, and traces recommendations.",
        weight:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.learning * 100).toFixed(0)}%`,
        basedOn: [
          "operational_memory presence",
          "constitutional_digests count",
          "constitutional_learnings count",
          "sovereign_recommendations.learning_id traceability",
        ],
      },
    },

    gapModel: {
      description:
        "Governance gaps are deviations from the expected constitutional model. Each gap " +
        "is classified by domain, gap type, and severity. Gaps accumulate into governance " +
        "debt and are aggregated into hotspots at the domain level.",
      gapTypes: [
        "missing_constitution",
        "incomplete_constitution",
        "invalid_lifecycle",
        "missing_authority",
        "expired_authority",
        "revoked_authority",
        "invalid_delegation",
        "unauthorized_action",
        "missing_ratification",
        "pending_ratification",
        "expired_ratification",
        "decision_without_authority",
        "decision_without_lineage",
        "decision_without_accountability",
        "execution_drift",
        "projection_integrity_violation",
        "unvalidated_reality",
        "missing_memory",
        "missing_digest",
        "missing_learning",
        "untraced_recommendation",
      ],
      severities: [
        { level: "low",      meaning: "Minor deviation — monitor and address in next review cycle." },
        { level: "medium",   meaning: "Meaningful deviation — plan remediation in current sprint." },
        { level: "high",     meaning: "Significant deviation — address before next governance review." },
        { level: "critical", meaning: "Constitutional violation — requires immediate attention." },
      ],
    },

    debtModel: {
      description:
        "Governance debt is the accumulated count of detected gaps classified by severity. " +
        "It provides a single view of the organization's outstanding governance obligations.",
      formula: "debt = { low: count, medium: count, high: count, critical: count, total: count }",
    },

    hotspotModel: {
      description:
        "Governance hotspots identify which domains have the highest concentration of gaps. " +
        "They are ranked by dominant severity first, then by gap count.",
      ranking: "Domains ranked by: (1) dominant gap severity, (2) total gap count.",
    },

    overallCompliance: {
      formula:
        "overall = constitution * 0.15 + authority * 0.20 + ratification * 0.15 + " +
        "decision * 0.20 + execution * 0.20 + learning * 0.10",
      weights: {
        constitution:  `${(GOVERNANCE_COMPLIANCE_WEIGHTS.constitution * 100).toFixed(0)}%`,
        authority:     `${(GOVERNANCE_COMPLIANCE_WEIGHTS.authority * 100).toFixed(0)}%`,
        ratification:  `${(GOVERNANCE_COMPLIANCE_WEIGHTS.ratification * 100).toFixed(0)}%`,
        decision:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.decision * 100).toFixed(0)}%`,
        execution:     `${(GOVERNANCE_COMPLIANCE_WEIGHTS.execution * 100).toFixed(0)}%`,
        learning:      `${(GOVERNANCE_COMPLIANCE_WEIGHTS.learning * 100).toFixed(0)}%`,
      },
      thresholds: [
        { range: `>= ${GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.compliant}`, status: "compliant" },
        { range: `>= ${GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.warning}`,   status: "warning" },
        { range: `< ${GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.warning}`,    status: "critical" },
      ],
    },

    lineage:
      "getGovernanceComplianceLineage() reconstructs the full traceability chain: " +
      "PM → Assignments → Constitutions → Authorities → Decisions → Ratifications → " +
      "Commitments → Memories → Compliance Snapshot. " +
      "This provides a complete audit trail from the PM registry through all governance layers " +
      "to the final compliance assessment.",

    nonPunitiveDesign:
      "The PMO Governance Compliance Engine is designed to identify and surface governance " +
      "gaps — not to punish Project Managers. Scores are advisory, explainable, and traceable. " +
      "No automatic remediations are executed. No projects, constitutions, or decisions are " +
      "modified by this engine. The intent is to enable early detection and conscious " +
      "organizational improvement.",

    auditEvents: [
      "GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED",
      "GOVERNANCE_CONSTITUTION_SCORE_CALCULATED",
      "GOVERNANCE_AUTHORITY_SCORE_CALCULATED",
      "GOVERNANCE_RATIFICATION_SCORE_CALCULATED",
      "GOVERNANCE_DECISION_SCORE_CALCULATED",
      "GOVERNANCE_EXECUTION_SCORE_CALCULATED",
      "GOVERNANCE_LEARNING_SCORE_CALCULATED",
      "GOVERNANCE_GAP_DETECTED",
      "GOVERNANCE_DEBT_CALCULATED",
      "GOVERNANCE_HOTSPOT_IDENTIFIED",
      "GOVERNANCE_COMPLIANCE_COMPARED",
      "GOVERNANCE_LINEAGE_GENERATED",
    ],

    businessRules: [
      { number: 1,  statement: "Every compliance snapshot must originate from a registered PM." },
      { number: 2,  statement: "Every metric must be traceable to evidence." },
      { number: 3,  statement: "Every gap must have evidence." },
      { number: 4,  statement: "Every debt must be calculable from detected gaps." },
      { number: 5,  statement: "Workspace isolation is mandatory." },
      { number: 6,  statement: "Projects must not be modified by this engine." },
      { number: 7,  statement: "Constitutions must not be modified by this engine." },
      { number: 8,  statement: "Decisions must not be modified by this engine." },
      { number: 9,  statement: "No automatic remediations may be executed." },
      { number: 10, statement: "Every evaluation must be explainable from evidence." },
    ],

    useCases: [
      "Generate a governance compliance snapshot for a PM to assess constitutional adherence.",
      "Generate a governance scorecard for a PMO review meeting.",
      "List historical compliance snapshots filtered by status, score, or date range.",
      "Compare two PMs by governance compliance to identify organizational patterns.",
      "Generate a PMO compliance summary showing organization-wide adherence and hotspots.",
      "Detect governance gaps early to prevent constitutional drift.",
      "Calculate governance debt to prioritize remediation efforts.",
      "Identify governance hotspots across domains for targeted improvement.",
      "Reconstruct the full governance lineage from PM through compliance snapshot.",
      "Explain the governance compliance engine to PMO stakeholders.",
    ],
  };
}
