import type {
  GenerateCapacityRecommendationsInput,
  PMCapacityStatus,
  PMBurnRisk,
} from "../types";

export type CapacityRecommendation = {
  action: string;
  reason: string;
};

export function generateCapacityRecommendations(
  input: GenerateCapacityRecommendationsInput
): CapacityRecommendation {
  const { utilizationPercentage, capacityStatus, burnRisk } = input;

  if (capacityStatus === "critical" || utilizationPercentage >= 130) {
    return {
      action: "redistribute_projects",
      reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — critical overload. Immediate redistribution required.`,
    };
  }

  if (capacityStatus === "overloaded" || burnRisk === "high" || burnRisk === "critical") {
    return {
      action: "reduce_load",
      reason: `Utilization at ${utilizationPercentage.toFixed(1)}% with ${burnRisk} burn risk. Reduce assignments or resolve open items.`,
    };
  }

  if (capacityStatus === "busy") {
    return {
      action: "maintain_load",
      reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — operating at capacity. No new projects recommended.`,
    };
  }

  if (capacityStatus === "underutilized") {
    return {
      action: "assign_new_project",
      reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — significant capacity available. Eligible for additional assignments.`,
    };
  }

  // healthy
  return {
    action: "maintain_load",
    reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — healthy. Monitor before adding new projects.`,
  };
}
