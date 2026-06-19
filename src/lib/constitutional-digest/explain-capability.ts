// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Explain Capability
// Self-describing API for the Digest Engine.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DecisionPattern,
  DigestCategory,
  DigestClassificationType,
  DigestStatus,
  GovernancePattern,
  OutcomePattern,
  RiskPattern,
} from "./types";

export type ConstitutionalDigestExplanation = {
  concept: string;
  principles: string[];
  lifecycle: {
    statuses: DigestStatus[];
    transitions: string[];
  };
  anonymization: {
    description: string;
    removedEntities: string[];
    normalizations: string[];
  };
  classification: {
    description: string;
    types: DigestClassificationType[];
    categories: DigestCategory[];
    confidenceScale: string;
  };
  patternExtraction: {
    description: string;
    decisionPatterns: DecisionPattern[];
    riskPatterns: RiskPattern[];
    governancePatterns: GovernancePattern[];
    outcomePatterns: OutcomePattern[];
  };
  confidenceModel: {
    description: string;
    dimensions: string[];
    scale: string;
  };
  sovereignLearning: string;
  auditEvents: string[];
};

export function explainConstitutionalDigest(): ConstitutionalDigestExplanation {
  return {
    concept:
      "The Constitutional Digest Engine transforms Constitutional Memory — which may contain " +
      "sensitive client information — into anonymized, normalized, portable Digest records. " +
      "Digests preserve institutional learning (patterns, categories, outcomes) while eliminating " +
      "any information that could identify a client, vendor, individual, or project.",

    principles: [
      "A Digest never contains identifiable client information.",
      "A Digest must preserve patterns that enable collective learning.",
      "A Digest eliminates context that is specific to a single engagement.",
      "A Digest is reutilizable across workspaces for pattern matching.",
      "A Digest enables sovereign learning: PMFreak learns from patterns, not from client data.",
      "Every Digest must be traceable back to its originating Memory Record and Artifact.",
      "Every Digest must pass validation before it can be published.",
      "Workspace isolation is mandatory — no cross-workspace data access.",
    ],

    lifecycle: {
      statuses: ["draft", "generated", "validated", "published", "archived"],
      transitions: [
        "draft → generated: generateDigest() extracts patterns and anonymizes content",
        "generated → validated: validateDigest() verifies absence of PII and calculates confidence",
        "validated → published: publishDigest() makes digest available for learning",
        "any → archived: archiveDigest() soft-deletes the digest",
      ],
    },

    anonymization: {
      description:
        "The Anonymization Engine removes or replaces all personally identifiable and " +
        "organizationally identifiable information from memory text before patterns are extracted.",
      removedEntities: [
        "Email addresses",
        "Phone numbers",
        "Specific URLs",
        "Project IDs (e.g. BPD-16483)",
        "Physical addresses",
      ],
      normalizations: [
        "Organization names → industry category (e.g. 'Banco Popular' → 'banking_organization')",
        "Vendor names → 'third_party_vendor'",
        "Exact monetary amounts → budget band (e.g. '$125,000' → 'budget_band_medium')",
      ],
    },

    classification: {
      description:
        "The Classification Engine assigns typed labels to a Digest based on extracted patterns. " +
        "Each classification carries a confidence score on a 0.0–1.0 scale.",
      types: ["industry", "project_type", "risk", "decision", "outcome", "governance", "delivery", "authority"],
      categories: [
        "project_type",
        "industry",
        "decision_type",
        "risk_category",
        "issue_category",
        "amendment_category",
        "governance_category",
        "delivery_pattern",
        "outcome_pattern",
      ],
      confidenceScale: "0.0 (no confidence) to 1.0 (certain) — stored as numeric(4,3)",
    },

    patternExtraction: {
      description:
        "The Pattern Extraction Engine analyzes anonymized text to identify recurring structural " +
        "patterns in decision-making, risk, governance, and outcomes.",
      decisionPatterns: [
        "schedule_change",
        "scope_reduction",
        "vendor_replacement",
        "resource_reallocation",
        "budget_adjustment",
        "priority_change",
        "approval_required",
        "other",
      ],
      riskPatterns: [
        "third_party_dependency",
        "approval_delay",
        "resource_shortage",
        "technical_complexity",
        "regulatory_compliance",
        "budget_overrun",
        "scope_creep",
        "other",
      ],
      governancePatterns: [
        "authority_gap",
        "late_escalation",
        "decision_reversal",
        "approval_bottleneck",
        "delegation_conflict",
        "quorum_failure",
        "other",
      ],
      outcomePatterns: [
        "successful_delivery",
        "delivery_delay",
        "cost_overrun",
        "scope_reduction",
        "cancelled",
        "partial_delivery",
        "other",
      ],
    },

    confidenceModel: {
      description:
        "Digest confidence is a composite score measuring how complete and reliable a Digest is " +
        "for sovereign learning purposes.",
      dimensions: [
        "completeness (30%): fraction of payload fields that are populated",
        "classificationCoverage (30%): presence of industry and project_type classifications",
        "patternCoverage (30%): fraction of pattern categories (decision, risk, governance, outcome) that have entries",
        "traceability (10%): whether the Digest has a traceable artifact link",
      ],
      scale: "0.0 (unusable) to 1.0 (fully characterized)",
    },

    sovereignLearning:
      "Published Digests constitute the PMFreak Sovereign Learning layer. " +
      "They allow the system to accumulate institutional knowledge across all workspaces " +
      "without ever retaining client-identifiable information. " +
      "The boundary between Project Knowledge and Institutional Knowledge is enforced by this engine.",

    auditEvents: [
      "CONSTITUTIONAL_DIGEST_CREATED — empty digest associated with a Memory Record",
      "CONSTITUTIONAL_DIGEST_GENERATED — payload populated from anonymized memory text",
      "CONSTITUTIONAL_DIGEST_VALIDATED — PII absence verified, confidence calculated",
      "CONSTITUTIONAL_DIGEST_PUBLISHED — digest made available for sovereign learning",
      "CONSTITUTIONAL_DIGEST_ARCHIVED — digest soft-deleted",
      "CONSTITUTIONAL_DIGEST_ANONYMIZED — anonymization step completed",
      "CONSTITUTIONAL_DIGEST_CLASSIFIED — classification records written",
      "CONSTITUTIONAL_DIGEST_PATTERN_EXTRACTED — pattern extraction completed",
      "CONSTITUTIONAL_DIGEST_CONFIDENCE_CALCULATED — confidence score computed",
    ],
  };
}
