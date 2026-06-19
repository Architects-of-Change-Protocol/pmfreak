// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Confidence Engine
// Calculates digest quality score on a 0.0–1.0 scale.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfidenceBreakdown, DigestPayload } from "./types";

// ─── Weights ──────────────────────────────────────────────────────────────────
// completeness:          payload fields filled
// classificationCoverage: industry + project_type present
// patternCoverage:       at least one pattern category has entries
// traceability:          memory record linked to artifact

const WEIGHT_COMPLETENESS = 0.3;
const WEIGHT_CLASSIFICATION = 0.3;
const WEIGHT_PATTERNS = 0.3;
const WEIGHT_TRACEABILITY = 0.1;

export function calculateDigestConfidence(input: {
  payload: DigestPayload;
  classificationCount: number;
  hasArtifactLink: boolean;
}): ConfidenceBreakdown {
  const { payload, classificationCount, hasArtifactLink } = input;

  // Completeness: how many of the 6 top-level payload fields are populated
  const PAYLOAD_FIELDS = [
    "project_type",
    "industry",
    "decision_patterns",
    "risk_patterns",
    "governance_patterns",
    "outcome_patterns",
  ] as const;
  const filledFields = PAYLOAD_FIELDS.filter((f) => {
    const v = payload[f];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;
  const completeness = round(filledFields / PAYLOAD_FIELDS.length);

  // Classification coverage: expect at least 2 classifications (industry + project_type)
  const classificationCoverage = round(Math.min(classificationCount / 2, 1));

  // Pattern coverage: count non-empty pattern arrays
  const patternArrays = [
    payload.decision_patterns ?? [],
    payload.risk_patterns ?? [],
    payload.governance_patterns ?? [],
    payload.outcome_patterns ?? [],
  ];
  const nonEmptyPatterns = patternArrays.filter((a) => a.length > 0).length;
  const patternCoverage = round(nonEmptyPatterns / 4);

  // Traceability: binary
  const traceability = hasArtifactLink ? 1.0 : 0.0;

  const overall = round(
    completeness * WEIGHT_COMPLETENESS +
    classificationCoverage * WEIGHT_CLASSIFICATION +
    patternCoverage * WEIGHT_PATTERNS +
    traceability * WEIGHT_TRACEABILITY,
  );

  return {
    completeness,
    classificationCoverage,
    patternCoverage,
    traceability,
    overall,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
