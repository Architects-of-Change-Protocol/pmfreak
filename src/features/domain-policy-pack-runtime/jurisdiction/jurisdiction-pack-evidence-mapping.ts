// AOC Jurisdiction Pack Runtime v1 — Evidence Runtime mapping
//
// This does not implement a second evidence system. It adapts a
// JurisdictionPackResolution into evidence requirement records that
// reference the (future) Evidence / Source / Citation Runtime by ID.

import { JURISDICTION_REASON_CODE_TO_EVIDENCE_TYPES } from "./jurisdiction-pack-reason-codes";
import type { JurisdictionEvidenceRequirement, JurisdictionPackResolution } from "./jurisdiction-pack-types";

export function mapJurisdictionResolutionToEvidenceRequirements(
  resolution: JurisdictionPackResolution
): JurisdictionEvidenceRequirement[] {
  if (resolution.requiredEvidence.length > 0) {
    return resolution.requiredEvidence;
  }

  // Fall back to deriving evidence requirements from the review reason
  // codes when the resolution didn't already carry them.
  const derived: JurisdictionEvidenceRequirement[] = [];
  for (const review of resolution.requiredReviews) {
    for (const evidenceType of JURISDICTION_REASON_CODE_TO_EVIDENCE_TYPES[review.reasonCode]) {
      derived.push({
        id: `evidence-${review.reasonCode}-${evidenceType}`,
        evidenceType,
        required: true,
      });
    }
  }
  return derived;
}
