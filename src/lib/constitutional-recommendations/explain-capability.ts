// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Explain Capability
// Self-describing API for the Sovereign Recommendation Engine.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationType, RecommendationScope, RecommendationStatus } from "./types";

export type SovereignRecommendationExplanation = {
  concept: string;
  sovereigntyPrinciples: string[];
  recommendationLifecycle: {
    description: string;
    stages: RecommendationStatus[];
    transitions: string[];
  };
  patternToRecommendationFlow: {
    description: string;
    steps: string[];
  };
  confidenceModel: {
    description: string;
    dimensions: string[];
    scale: string;
  };
  justificationModel: {
    description: string;
    example: {
      recommendation: string;
      because: string;
      evidence: string;
      confidence: number;
    };
  };
  applicabilityModel: {
    description: string;
    levels: string[];
    factors: string[];
  };
  lineage: {
    description: string;
    chain: string[];
  };
  recommendationTypes: RecommendationType[];
  recommendationScopes: RecommendationScope[];
  auditEvents: string[];
};

export function explainSovereignRecommendations(): SovereignRecommendationExplanation {
  return {
    concept:
      "The Sovereign Recommendation Engine transforms Institutional Learning Patterns into " +
      "actionable, auditable, and traceable recommendations. Every recommendation originates " +
      "from verifiable learning — never from opaque inference. The engine enables PMFreak to " +
      "convert institutional memory into operational intelligence without exposing sensitive " +
      "client data. Recommendations guide but never replace human authority.",

    sovereigntyPrinciples: [
      "Principle 1: Every recommendation must originate from verifiable learning.",
      "Principle 2: Every recommendation must be traceable to its supporting patterns.",
      "Principle 3: No opaque recommendations — every recommendation must explain itself.",
      "Principle 4: Every recommendation must justify its origin via pattern evidence.",
      "Principle 5: Recommendations guide decisions — they never replace human authority.",
      "Principle 6: Workspace isolation is mandatory — no cross-workspace data access.",
    ],

    recommendationLifecycle: {
      description:
        "A recommendation passes through a governed lifecycle: draft → generated → validated → " +
        "published → retired. Only published recommendations can be applied. Retirement is " +
        "soft-only — the record is preserved for audit purposes.",
      stages: ["draft", "generated", "validated", "published", "retired"],
      transitions: [
        "draft → generated: via generateRecommendation() after pattern lookup",
        "generated → validated: via validateRecommendation() — requires evidence and confidence > 0",
        "validated → published: via publishRecommendation()",
        "published → retired: via retireRecommendation() — soft retirement only",
      ],
    },

    patternToRecommendationFlow: {
      description:
        "The generation pipeline reads Learning Patterns and maps each to an actionable " +
        "recommendation via the Template Catalog. Templates cover known pattern keys; " +
        "fallbacks handle novel patterns by pattern type.",
      steps: [
        "1. generateRecommendationsFromPatterns(): Read qualifying Learning Patterns for the workspace.",
        "2. getRecommendationTemplate(): Look up the template catalog by patternType::patternKey.",
        "3. Upsert the recommendation: create if new, update recommendation_text if exists.",
        "4. Link evidence: record constitutional_recommendation_evidence row with contribution_weight.",
        "5. calculateRecommendationConfidence(): Compute composite confidence from pattern metrics.",
        "6. validateRecommendation(): Confirm evidence and confidence requirements are met.",
        "7. publishRecommendation(): Make the recommendation available for application.",
        "8. applyRecommendation(): Associate the recommendation with a specific entity.",
        "9. getRecommendationLineage(): Reconstruct Artifact → Memory → Digest → Pattern → Recommendation.",
      ],
    },

    confidenceModel: {
      description:
        "Recommendation confidence is a composite score derived from the strength of the " +
        "underlying learning patterns and the quality of evidence linking them.",
      dimensions: [
        "patternConfidence (40%): inherited confidence score from the supporting Learning Pattern",
        "occurrenceWeight (30%): scales with how many times the pattern appeared across digests",
        "consistencyWeight (20%): average contribution weight from recommendation evidence rows",
        "evidenceWeight (10%): number of distinct learning patterns supporting the recommendation",
      ],
      scale: "0.0 (insufficient evidence) to 1.0 (highly reliable institutional backing)",
    },

    justificationModel: {
      description:
        "generateRecommendationJustification() produces a structured justification for every " +
        "recommendation — stating what is recommended, why (pattern), and how much evidence " +
        "supports it. This fulfills Sovereignty Principles 3 and 4.",
      example: {
        recommendation: "Introducir ratificación temprana y responsables explícitos de aprobación.",
        because: "Risk pattern: approval_delay",
        evidence: "127 digests",
        confidence: 0.81,
      },
    },

    applicabilityModel: {
      description:
        "evaluateRecommendationApplicability() assesses how relevant a recommendation is to a " +
        "specific project context. It considers confidence, active risks, observed patterns, " +
        "scope alignment, and constitutional status.",
      levels: [
        "high (score ≥ 0.65): strong match — the recommendation directly addresses the current context",
        "medium (score ≥ 0.40): partial match — the recommendation is relevant but not critical",
        "low (score < 0.40): weak match — the recommendation may not apply to this context",
      ],
      factors: [
        "Recommendation confidence score (40%)",
        "Risk and pattern overlap with current context (30%)",
        "Scope alignment with project type and status (20%)",
        "Supporting pattern count / evidence breadth (10%)",
      ],
    },

    lineage: {
      description:
        "getRecommendationLineage() reconstructs the complete provenance chain from a " +
        "Recommendation back to the source Artifacts. This is the full sovereign chain.",
      chain: [
        "Artifact — the original document, email, or transcript registered in the Constitutional Vault",
        "Memory Record — structured knowledge extracted from the Artifact",
        "Digest — anonymized, pattern-bearing record produced from the Memory Record",
        "Learning Pattern — aggregated insight discovered across multiple published Digests",
        "Recommendation — actionable guidance derived from the Learning Pattern via template",
      ],
    },

    recommendationTypes: [
      "risk_mitigation",
      "governance_control",
      "decision_guidance",
      "authority_control",
      "delivery_improvement",
      "ratification_control",
      "amendment_guidance",
      "portfolio_guidance",
    ],

    recommendationScopes: [
      "project",
      "decision",
      "risk",
      "governance",
      "amendment",
      "authority",
      "ratification",
      "delivery",
      "portfolio",
    ],

    auditEvents: [
      "CONSTITUTIONAL_RECOMMENDATION_CREATED — a new recommendation was manually created",
      "CONSTITUTIONAL_RECOMMENDATION_GENERATED — a recommendation was derived from a Learning Pattern",
      "CONSTITUTIONAL_RECOMMENDATION_VALIDATED — evidence and confidence requirements were verified",
      "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED — recommendation made available for application",
      "CONSTITUTIONAL_RECOMMENDATION_RETIRED — recommendation soft-retired (record preserved)",
      "CONSTITUTIONAL_RECOMMENDATION_APPLIED — recommendation was associated with a project entity",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED — confidence score was recalculated",
      "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED — full Artifact → Recommendation chain reconstructed",
      "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED — justification was produced for the recommendation",
    ],
  };
}
