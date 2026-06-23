import type { ExecutionProjectionRow } from "./types";
import type { ProjectionExplanation } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Projection Explainability Engine
//
// Produces a human-readable explanation of why a projection was generated,
// what it estimates, and how confident the system is.
// ─────────────────────────────────────────────────────────────────────────────

export function explainExecutionProjection(
  projection: ExecutionProjectionRow,
  commitmentTitle: string
): ProjectionExplanation {
  return {
    projectionId:    projection.id,
    generatedFrom:   projection.commitment_id,
    because:         commitmentTitle,
    estimatedEffort: `${projection.estimated_effort_hours}h`,
    confidence:      projection.confidence_score,
    risk:            projection.projected_risk as "low" | "medium" | "high" | "critical",
  };
}
