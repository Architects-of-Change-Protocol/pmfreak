// AOC Jurisdiction Pack Runtime v1 — Control Plane-safe summary
//
// createJurisdictionControlPlaneSummary produces display state for the
// Control Plane UI using only the safe label vocabulary in
// jurisdiction-pack-constants.ts. It never emits a compliance verdict.

import type { JurisdictionControlPlaneLabel, JurisdictionControlPlaneSummary, JurisdictionPackResolution } from "./jurisdiction-pack-types";

function jurisdictionStatusLabel(resolution: JurisdictionPackResolution): JurisdictionControlPlaneSummary["jurisdictionStatusLabel"] {
  if (resolution.jurisdictionConflictDetected) return "conflict_detected";
  if (resolution.jurisdictionAmbiguous) return "ambiguous";
  if (!resolution.jurisdictionKnown) return "unknown";
  return "known";
}

function packStatusLabel(resolution: JurisdictionPackResolution): JurisdictionControlPlaneSummary["packStatusLabel"] {
  if (resolution.requiredReviews.some((review) => review.reasonCode === "jurisdiction_pack_demo_only")) return "demo_only";
  if (resolution.requiredReviews.some((review) => review.reasonCode === "jurisdiction_pack_expired")) return "expired";
  if (resolution.selectedPackIds.length > 0) return "selected";
  return "missing";
}

export function createJurisdictionControlPlaneSummary(resolution: JurisdictionPackResolution): JurisdictionControlPlaneSummary {
  const jurisdictionLabel = jurisdictionStatusLabel(resolution);
  const packLabel = packStatusLabel(resolution);

  const reviewStatusLabels = [
    ...new Set(
      resolution.requiredReviews.map((review) => `${review.reviewType}_required`)
    ),
  ];

  const safeLabels: JurisdictionControlPlaneLabel[] = [
    "Jurisdiction awareness",
    "Not legal advice",
    "Partial policy model",
    "No jurisdiction-specific compliance claimed",
  ];

  if (jurisdictionLabel === "unknown") safeLabels.push("Jurisdiction unknown");
  if (jurisdictionLabel === "ambiguous") safeLabels.push("Jurisdiction ambiguous");
  if (jurisdictionLabel === "conflict_detected") safeLabels.push("Jurisdiction conflict detected");
  if (packLabel === "missing") safeLabels.push("Missing jurisdiction pack");

  if (resolution.requiredReviews.some((review) => review.reviewType === "customer_validation")) {
    safeLabels.push("Requires customer validation");
  }
  if (resolution.requiredReviews.some((review) => review.reviewType === "counsel_review")) {
    safeLabels.push("Requires counsel review when applicable");
  }

  return {
    jurisdictionStatusLabel: jurisdictionLabel,
    packStatusLabel: packLabel,
    reviewStatusLabels,
    safeLabels: [...new Set(safeLabels)],
  };
}
