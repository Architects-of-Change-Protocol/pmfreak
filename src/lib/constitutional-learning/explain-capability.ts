// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Explain Capability
// Self-describing API for the Institutional Learning Engine.
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningPatternType } from "./types";

export type InstitutionalLearningExplanation = {
  concept: string;
  sovereigntyRules: string[];
  digestToLearningFlow: {
    description: string;
    steps: string[];
  };
  patternTypes: LearningPatternType[];
  correlations: {
    description: string;
    example: {
      patternKey: string;
      observedWith: string;
      frequency: string;
      confidence: number;
    };
  };
  confidenceModel: {
    description: string;
    dimensions: string[];
    scale: string;
  };
  recommendations: {
    description: string;
    example: {
      risk: string;
      recommendation: string;
      confidence: number;
    };
  };
  lineage: {
    description: string;
    chain: string[];
  };
  auditEvents: string[];
};

export function explainInstitutionalLearning(): InstitutionalLearningExplanation {
  return {
    concept:
      "The Institutional Learning Engine transforms anonymized Constitutional Digests into " +
      "reusable Learning Patterns. These patterns represent recurring behaviors, risks, " +
      "governance failures, and outcomes discovered across multiple projects — without " +
      "retaining any client-identifiable information. The engine generates actionable " +
      "recommendations tied to each pattern, enabling sovereign, auditable institutional memory.",

    sovereigntyRules: [
      "Rule 1: Learning Patterns never contain clients, persons, specific vendors, project IDs, emails, or URLs.",
      "Rule 2: All learning must originate from published Digests — never from raw Memory Records.",
      "Rule 3: No direct learning from Memory. The Digest boundary is mandatory.",
      "Rule 4: Every pattern must be traceable to its contributing Digests, Memory Records, and Artifacts.",
      "Rule 5: Every recommendation must be justifiable via the pattern's evidence chain.",
    ],

    digestToLearningFlow: {
      description:
        "The learning pipeline processes published Digests and aggregates their anonymized patterns " +
        "into workspace-scoped Learning Pattern records with confidence scores and evidence links.",
      steps: [
        "1. aggregateDigests(): Read published Digests and group recurring pattern keys by type.",
        "2. discoverLearningPatterns(): Upsert Learning Patterns and record evidence links to contributing Digests.",
        "3. calculatePatternConfidence(): Compute confidence using frequency, coverage, consistency, and evidence strength.",
        "4. discoverCorrelations(): Identify patterns that co-occur in the same Digest.",
        "5. generateRecommendation(): Produce an actionable recommendation from the pattern's type and key.",
        "6. getLearningLineage(): Reconstruct the full Artifact → Memory → Digest → Learning Pattern chain.",
      ],
    },

    patternTypes: [
      "decision_pattern",
      "risk_pattern",
      "governance_pattern",
      "authority_pattern",
      "amendment_pattern",
      "delivery_pattern",
      "outcome_pattern",
    ],

    correlations: {
      description:
        "The Correlation Engine identifies patterns that co-occur in the same Digest. " +
        "Frequency measures how often the pair appears across all published Digests. " +
        "Confidence measures the Jaccard similarity of their respective occurrence sets.",
      example: {
        patternKey: "third_party_dependency",
        observedWith: "delivery_delay",
        frequency: "71%",
        confidence: 0.84,
      },
    },

    confidenceModel: {
      description:
        "Learning Pattern confidence is a composite score measuring the reliability and " +
        "statistical weight of a discovered pattern.",
      dimensions: [
        "frequency (35%): ratio of pattern occurrences to total published digests",
        "coverage (30%): breadth of evidence — scales logarithmically with occurrence count",
        "consistency (20%): average contribution weight from evidence rows",
        "evidenceStrength (15%): number of distinct co-occurring pattern types",
      ],
      scale: "0.0 (insufficient evidence) to 1.0 (highly reliable)",
    },

    recommendations: {
      description:
        "The Recommendation Engine generates actionable governance recommendations for each " +
        "Learning Pattern. Recommendations are stored and linked to the pattern for traceability.",
      example: {
        risk: "approval_delay",
        recommendation:
          "Introduce early ratification checkpoints. Identify approval authorities before project kickoff and pre-schedule sign-off windows.",
        confidence: 0.79,
      },
    },

    lineage: {
      description:
        "getLearningLineage() reconstructs the full provenance chain from a Learning Pattern " +
        "back to the source Artifacts. This enables complete audit traceability without exposing " +
        "any client-identifiable information beyond what each layer's sovereignty rules permit.",
      chain: [
        "Artifact — the original document, email, or transcript registered in the Constitutional Vault",
        "Memory Record — structured knowledge extracted from the Artifact",
        "Digest — anonymized, pattern-bearing record produced from the Memory Record",
        "Learning Pattern — aggregated insight discovered across multiple published Digests",
      ],
    },

    auditEvents: [
      "CONSTITUTIONAL_LEARNING_PATTERN_CREATED — a new Learning Pattern was manually created",
      "CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED — a pattern was automatically discovered during aggregation",
      "CONSTITUTIONAL_LEARNING_PATTERN_UPDATED — occurrence count or confidence was updated during re-aggregation",
      "CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED — a recommendation was derived from the pattern",
      "CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED — confidence score was recalculated for a pattern",
      "CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED — full Artifact → Learning Pattern chain was reconstructed",
    ],
  };
}
