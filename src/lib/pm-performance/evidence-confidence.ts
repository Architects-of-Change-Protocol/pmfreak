// ─── Evidence Confidence ─────────────────────────────────────────────────────
//
// Computes how much real evidence backs a PM Performance score.
// Scoring domains that have no evidence fall back to a neutral baseline (75),
// which is acceptable but should be explicit for PMO consumers.
//
// Total source count is fixed at 5:
//   1. project_os_snapshots  (backs governance, execution, portfolio domains)
//   2. execution_tasks        (enhances execution domain)
//   3. execution_realities    (backs prediction_accuracy domain)
//   4. decision_outcomes      (backs decision_effectiveness domain)
//   5. capacity_context       (backs contextual risk interpretation)
// ─────────────────────────────────────────────────────────────────────────────

export const EVIDENCE_TOTAL_SOURCE_COUNT = 5;

export type EvidenceSourceAvailability = {
  project_os_snapshots: boolean;
  execution_tasks:      boolean;
  execution_realities:  boolean;
  decision_outcomes:    boolean;
  capacity_context:     boolean;
};

export type ConfidenceLevel = "high" | "medium" | "low" | "very_low";
export type ScoreInterpretation = "evidence_backed" | "partially_evidence_backed" | "low_confidence_provisional";

export type EvidenceConfidence = {
  evidence_completeness:    number;
  confidence_level:         ConfidenceLevel;
  available_source_count:   number;
  missing_source_count:     number;
  total_source_count:       number;
  available_sources:        string[];
  missing_sources:          string[];
  neutral_baseline_domains: string[];
  missing_source_policy:    "neutral_baseline_75";
  score_interpretation:     ScoreInterpretation;
};

export function calculateEvidenceConfidence(
  availability: EvidenceSourceAvailability
): EvidenceConfidence {
  const sourceEntries: [keyof EvidenceSourceAvailability, string][] = [
    ["project_os_snapshots", "project_os_snapshots"],
    ["execution_tasks",      "execution_tasks"],
    ["execution_realities",  "execution_realities"],
    ["decision_outcomes",    "decision_outcomes"],
    ["capacity_context",     "capacity_context"],
  ];

  const available: string[] = [];
  const missing:   string[] = [];

  for (const [key, label] of sourceEntries) {
    if (availability[key]) {
      available.push(label);
    } else {
      missing.push(label);
    }
  }

  const availableCount = available.length;
  const missingCount   = missing.length;
  const completeness   = availableCount / EVIDENCE_TOTAL_SOURCE_COUNT;

  const confidenceLevel: ConfidenceLevel =
    completeness >= 0.80 ? "high"    :
    completeness >= 0.50 ? "medium"  :
    completeness >= 0.25 ? "low"     :
    "very_low";

  const scoreInterpretation: ScoreInterpretation =
    completeness >= 0.80 ? "evidence_backed"            :
    completeness >= 0.50 ? "partially_evidence_backed"  :
    "low_confidence_provisional";

  // Domains that use neutral baseline because their source was missing
  const neutralBaselineDomains: string[] = [];
  if (!availability.project_os_snapshots) {
    neutralBaselineDomains.push("governance", "execution", "portfolio");
  }
  if (!availability.execution_realities) {
    neutralBaselineDomains.push("prediction_accuracy");
  }
  if (!availability.decision_outcomes) {
    neutralBaselineDomains.push("decision_effectiveness");
  }

  return {
    evidence_completeness:    Math.round(completeness * 100) / 100,
    confidence_level:         confidenceLevel,
    available_source_count:   availableCount,
    missing_source_count:     missingCount,
    total_source_count:       EVIDENCE_TOTAL_SOURCE_COUNT,
    available_sources:        available,
    missing_sources:          missing,
    neutral_baseline_domains: neutralBaselineDomains,
    missing_source_policy:    "neutral_baseline_75",
    score_interpretation:     scoreInterpretation,
  };
}

export function deriveConfidenceRecommendations(
  ec: EvidenceConfidence
): Array<{ type: string; severity: string; message: string }> {
  if (ec.evidence_completeness < 0.25) {
    return [{
      type:     "insufficient_performance_evidence",
      severity: "high",
      message:  "PM performance score is highly provisional due to limited evidence. Improve data coverage before using this score for executive action.",
    }];
  }
  if (ec.evidence_completeness < 0.50) {
    return [{
      type:     "increase_evidence_coverage",
      severity: "medium",
      message:  "PM performance score has limited evidence coverage. Generate or connect more execution, decision and project evidence before making major decisions.",
    }];
  }
  return [];
}
