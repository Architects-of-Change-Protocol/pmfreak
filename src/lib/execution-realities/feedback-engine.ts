import type {
  ProjectionFeedback,
  RecommendationRealityFeedback,
  VarianceResult,
  ExecutionRealityRisk,
} from "./types";
import { identifyMainVariance } from "./accuracy-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Feedback Engine
//
// Generates structured feedback from observed reality back to the learning
// and recommendation layers. This closes the self-calibrating governance loop.
// ─────────────────────────────────────────────────────────────────────────────

export function generateProjectionFeedback(input: {
  projectionId: string;
  accuracy: number;
  variances: VarianceResult[];
  projectedRisk: ExecutionRealityRisk;
  actualRisk: ExecutionRealityRisk;
}): ProjectionFeedback {
  const mainVariance = identifyMainVariance(input.variances);
  const mainVar      = input.variances.find(v => v.varianceType === mainVariance);

  let recommendation = "Projection was sufficiently accurate — no calibration needed.";

  if (mainVar && Math.abs(mainVar.variancePercentage) >= 10) {
    const direction = mainVar.variancePercentage > 0 ? "increase" : "decrease";
    const amount    = Math.round(Math.abs(mainVar.variancePercentage));
    recommendation  = `Consider ${direction} ${mainVariance} estimate by ~${amount}% for similar commitments.`;
  }

  if (input.actualRisk !== input.projectedRisk) {
    recommendation += ` Risk level should be revised from '${input.projectedRisk}' to '${input.actualRisk}'.`;
  }

  return {
    projectionId:  input.projectionId,
    accuracy:      input.accuracy,
    mainVariance,
    recommendation,
  };
}

export function generateRecommendationRealityFeedback(input: {
  projectionId: string;
  realityId: string;
  projectedEffortHours: number;
  actualEffortHours: number;
  projectedDurationDays: number;
  actualDurationDays: number;
}): RecommendationRealityFeedback {
  const effortDelta   = input.actualEffortHours - input.projectedEffortHours;
  const durationDelta = input.actualDurationDays - input.projectedDurationDays;

  const reduced = effortDelta < 0 || durationDelta < 0;
  const stable  = Math.abs(effortDelta) <= input.projectedEffortHours * 0.1 &&
                  Math.abs(durationDelta) <= input.projectedDurationDays * 0.1;

  let effectiveness: "low" | "medium" | "high";
  let actualEffect: string;

  if (stable) {
    effectiveness = "high";
    actualEffect  = "Execution matched projection — governance recommendation was effective.";
  } else if (reduced) {
    effectiveness = "high";
    const effortChange = Math.abs(Math.round((effortDelta / input.projectedEffortHours) * 100));
    actualEffect  = `Execution reduced by ~${effortChange}% versus projection.`;
  } else {
    const overrun = Math.round(((effortDelta) / input.projectedEffortHours) * 100);
    effectiveness = overrun > 50 ? "low" : "medium";
    actualEffect  = `Execution exceeded projection by ~${overrun}%.`;
  }

  return {
    projectionId:    input.projectionId,
    realityId:       input.realityId,
    expectedEffect:  "Execution aligns with projection within acceptable variance.",
    actualEffect,
    effectiveness,
  };
}
