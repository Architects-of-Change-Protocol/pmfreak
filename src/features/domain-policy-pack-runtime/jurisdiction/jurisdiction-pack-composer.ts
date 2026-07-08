// AOC Jurisdiction Pack Runtime v1 — composition with a baseline pack
//
// composeJurisdictionWithBaseline proves a *declared* dependency
// relationship (the jurisdiction pack names the baseline pack in
// extendsPackIds/requiredBaselinePackIds) — it does not evaluate whether
// the baseline pack is itself registered/active. Combine with the
// registry (see jurisdiction-pack-registry.ts) when that matters.

import { JURISDICTION_SAFE_METADATA, type JurisdictionPack, type JurisdictionPackComposition } from "./jurisdiction-pack-types";

export function composeJurisdictionWithBaseline(
  jurisdictionPack: JurisdictionPack,
  baselinePackId: string
): JurisdictionPackComposition {
  const composed =
    jurisdictionPack.requiredBaselinePackIds.includes(baselinePackId) ||
    jurisdictionPack.extendsPackIds.includes(baselinePackId);

  return {
    composed,
    baselinePackId,
    jurisdictionPackId: jurisdictionPack.id,
    includedPackIds: composed ? [baselinePackId, jurisdictionPack.id] : [jurisdictionPack.id],
    missingPackIds: composed ? [] : [baselinePackId],

    requiredEvidence: jurisdictionPack.evidenceRequirements,
    requiredReviews: jurisdictionPack.reviewRequirements,

    metadata: JURISDICTION_SAFE_METADATA,
  };
}
