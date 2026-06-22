// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Effectiveness Engine — Explain Capability
// Self-describing API for the Recommendation Effectiveness Engine (Sprint 5).
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationEffectivenessExplanation = {
  concept: string;
  principles: string[];
  outcomeModel: {
    description: string;
    outcomeTypes: string[];
    outcomeStatuses: string[];
  };
  feedbackModel: {
    description: string;
    feedbackTypes: string[];
    ratingScale: string;
  };
  effectivenessModel: {
    description: string;
    components: string[];
    scale: string;
  };
  adaptationModel: {
    description: string;
    rules: string[];
    example: {
      originalConfidence: number;
      observedEffectiveness: number;
      newConfidence: number;
    };
  };
  benchmarking: {
    description: string;
    sortedBy: string;
  };
  ranking: {
    description: string;
    dimensions: string[];
  };
  deprecation: {
    description: string;
    trigger: string;
    transition: string;
  };
  lineageExtension: {
    description: string;
    chain: string[];
  };
  auditEvents: string[];
  businessRules: string[];
};

export function explainRecommendationEffectiveness(): RecommendationEffectivenessExplanation {
  return {
    concept:
      "The Recommendation Effectiveness Engine closes the institutional learning loop by " +
      "measuring whether recommendations actually produce better outcomes when applied. " +
      "It transforms PMFreak from a system that recommends into a system that continuously " +
      "learns from observed results, preserving sovereignty, traceability, and verifiable evidence.",

    principles: [
      "Principle 1: Every recommendation must be evaluable.",
      "Principle 2: Every evaluation must be traceable.",
      "Principle 3: Effectiveness must be based on evidence.",
      "Principle 4: Learning must adapt.",
      "Principle 5: Recommendations are not absolute truths.",
      "Principle 6: Real evidence takes priority over hypothesis.",
    ],

    outcomeModel: {
      description:
        "An outcome is an observed result recorded after a recommendation application. " +
        "Outcomes are immutable after creation (Rule 6) and must always reference a real " +
        "application (Rules 1 and 2).",
      outcomeTypes: [
        "risk_reduction",
        "schedule_improvement",
        "cost_reduction",
        "quality_improvement",
        "governance_improvement",
        "delivery_improvement",
        "authority_improvement",
        "ratification_improvement",
      ],
      outcomeStatuses: ["successful", "neutral", "failed", "unknown"],
    },

    feedbackModel: {
      description:
        "Explicit user-submitted feedback on a recommendation application. " +
        "Feedback captures subjective assessment alongside objective outcome measurements. " +
        "It contributes 20% to the composite effectiveness score.",
      feedbackTypes: ["positive", "neutral", "negative"],
      ratingScale: "1 (very poor) to 5 (excellent)",
    },

    effectivenessModel: {
      description:
        "calculateEffectivenessScore() computes a composite 0.0–1.0 score from four " +
        "components. Higher scores indicate consistently effective recommendations.",
      components: [
        "Success Rate (40%): proportion of successful outcomes vs total applications",
        "Outcome Quality (30%): average individual effectiveness_score from outcome rows",
        "Feedback Rating (20%): average normalized user rating",
        "Outcome Consistency (10%): (1 - failure_rate) — penalizes high variance",
      ],
      scale: "0.0 (completely ineffective) → 1.0 (fully effective)",
    },

    adaptationModel: {
      description:
        "adaptRecommendationConfidence() adjusts a recommendation's confidence_score " +
        "based on observed effectiveness. Confidence never exceeds 1.0 or falls below 0.0 " +
        "(Rules 7 and 8). The magnitude of adjustment scales with evidence volume.",
      rules: [
        "Rule A (high_effectiveness): effectiveness > 0.80 → increase confidence toward observed effectiveness",
        "Rule B (low_effectiveness): effectiveness < 0.50 → reduce confidence proportionally",
        "Rule C (medium_effectiveness): 0.50–0.80 → minor nudge toward effectiveness",
      ],
      example: {
        originalConfidence: 0.78,
        observedEffectiveness: 0.88,
        newConfidence: 0.82,
      },
    },

    benchmarking: {
      description:
        "benchmarkRecommendationsForWorkspace() compares all recommendations in a workspace " +
        "by average effectiveness, allowing institutional comparison of recommendation quality.",
      sortedBy: "average_effectiveness descending",
    },

    ranking: {
      description:
        "rankRecommendationsForWorkspace() produces an ordered list using a composite rank " +
        "score. Rank 1 is the most recommended recommendation to apply.",
      dimensions: [
        "Effectiveness (40%): average_effectiveness from outcomes",
        "Confidence (30%): current confidence_score",
        "Usage (20%): applications_count (scaled)",
        "Consistency (10%): success_rate",
      ],
    },

    deprecation: {
      description:
        "A published recommendation can be deprecated when its observed effectiveness " +
        "falls below a configurable threshold. Deprecation is a soft lifecycle extension " +
        "— the record is preserved for audit purposes.",
      trigger: "average_effectiveness < threshold (default: 0.30)",
      transition: "published → deprecated",
    },

    lineageExtension: {
      description:
        "getRecommendationLineage() has been extended to include the full outcome trail. " +
        "The complete sovereign chain now spans from artifact creation to observed results.",
      chain: [
        "Artifact — original document registered in the Constitutional Vault",
        "Memory Record — structured knowledge extracted from the Artifact",
        "Digest — anonymized, pattern-bearing record",
        "Learning Pattern — aggregated insight across Digests",
        "Recommendation — actionable guidance from the Learning Pattern",
        "Outcome — observed result after applying the Recommendation",
      ],
    },

    auditEvents: [
      "CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED — an outcome was recorded for an application",
      "CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED — user feedback was submitted for an application",
      "CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED — effectiveness score was aggregated",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED — confidence was adapted using effectiveness",
      "CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED — workspace-level benchmark was produced",
      "CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED — ranked list of recommendations was generated",
      "CONSTITUTIONAL_RECOMMENDATION_DEPRECATED — recommendation was deprecated due to low effectiveness",
    ],

    businessRules: [
      "Rule 1: Every measurement must originate from a real application.",
      "Rule 2: No orphan outcomes — application_id is required and verified.",
      "Rule 3: Every adaptation must be auditable.",
      "Rule 4: Every recommendation must maintain history.",
      "Rule 5: Workspace isolation is mandatory.",
      "Rule 6: Outcomes cannot be modified retroactively.",
      "Rule 7: Adjusted confidence never exceeds 1.0.",
      "Rule 8: Adjusted confidence never falls below 0.0.",
    ],
  };
}
