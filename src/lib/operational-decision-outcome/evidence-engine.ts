import type {
  EvidenceValidationResult,
  OperationalOutcomeObservationRow,
  OperationalOutcomeEffectRow,
  OperationalLearningFeedbackRow,
} from "./types";

// ─── validateOutcomeEvidence ──────────────────────────────────────────────────
// Verifies that an outcome has sufficient observations, effects, and learning
// to be considered well-evidenced.

export function validateOutcomeEvidence(params: {
  outcomeId: string;
  observations: OperationalOutcomeObservationRow[];
  effects: OperationalOutcomeEffectRow[];
  learning: OperationalLearningFeedbackRow[];
}): EvidenceValidationResult {
  const { outcomeId, observations, effects, learning } = params;

  const missing: string[] = [];

  if (observations.length === 0) {
    missing.push("At least one observation is required.");
  }

  if (effects.length === 0) {
    missing.push("At least one outcome effect is required.");
  }

  if (learning.length === 0) {
    missing.push("At least one learning feedback record is required.");
  }

  let validationStatus: EvidenceValidationResult["validationStatus"];
  if (observations.length === 0) {
    validationStatus = "insufficient_observations";
  } else if (effects.length === 0) {
    validationStatus = "insufficient_effects";
  } else if (learning.length === 0) {
    validationStatus = "no_learning";
  } else {
    validationStatus = "valid";
  }

  return {
    outcomeId,
    observationCount: observations.length,
    effectCount: effects.length,
    learningCount: learning.length,
    isValid: missing.length === 0,
    validationStatus,
    missingRequirements: missing,
  };
}
