// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Language Helpers
// Sprint 0: Birth of the Project Brain
//
// Renders the constitution's voice into UI copy. Nothing here invents new
// phrasing conventions — it reads them from constitution.ts so voice stays
// centrally governed instead of drifting per component.
// ─────────────────────────────────────────────────────────────────────────────

import { EPISTEMIC_TYPE_DEFINITIONS } from "./constitution";
import type { EpistemicType, ProjectBrainConfidence } from "./types";

const EPISTEMIC_TYPE_DEFINITION_BY_TYPE = new Map(
  EPISTEMIC_TYPE_DEFINITIONS.map((def) => [def.type, def]),
);

export function labelForEpistemicType(type: EpistemicType): string {
  return EPISTEMIC_TYPE_DEFINITION_BY_TYPE.get(type)?.label ?? type;
}

export function descriptionForEpistemicType(type: EpistemicType): string {
  return EPISTEMIC_TYPE_DEFINITION_BY_TYPE.get(type)?.description ?? "";
}

const CONFIDENCE_LEVEL_LABEL: Record<ProjectBrainConfidence["level"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  unknown: "Confidence unknown",
};

/**
 * A confidence caption for UI display. Never a bare number — a "scored"
 * confidence always shows the qualitative level plus the method and actor
 * that produced the score (constitution.ts CONFIDENCE_LANGUAGE_LADDER,
 * "no artificial numerical precision unless derived from a documented
 * method").
 */
export function formatConfidenceCaption(confidence: ProjectBrainConfidence): string {
  const levelLabel = CONFIDENCE_LEVEL_LABEL[confidence.level];
  if (confidence.kind === "scored") {
    return `${levelLabel} (${confidence.score}/100, scored by ${confidence.method} via ${confidence.scoredBy})`;
  }
  return levelLabel;
}
