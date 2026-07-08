// AOC Jurisdiction Pack Runtime v1 — Approval Runtime mapping
//
// This does not implement a second approval workflow. It adapts a
// JurisdictionPackResolution into the shape the (future) Approval Runtime
// expects: a list of { reviewType, reasonCode } requirements plus a single
// enforcement action. Approval Runtime is expected to consume this shape
// directly and resolve approvalRuntimeRef against its own records.

import { JURISDICTION_DECISION_TO_ENFORCEMENT_ACTION, JURISDICTION_DECISION_TO_REVIEW_TYPE } from "./jurisdiction-pack-reason-codes";
import {
  JURISDICTION_SAFE_METADATA,
  type JurisdictionApprovalMapping,
  type JurisdictionApprovalRequirement,
  type JurisdictionPackResolution,
} from "./jurisdiction-pack-types";

export function mapJurisdictionResolutionToApproval(resolution: JurisdictionPackResolution): JurisdictionApprovalMapping {
  let approvalRequirements: JurisdictionApprovalRequirement[] = resolution.requiredReviews.map((review) => ({
    reviewType: review.reviewType,
    reasonCode: review.reasonCode,
    required: review.required,
    approvalRuntimeRef: review.approvalRuntimeRef,
  }));

  // Fall back to a single decision-derived requirement when the resolution
  // didn't already carry one (e.g. a resolution built by hand for a test).
  if (approvalRequirements.length === 0) {
    const reviewType = JURISDICTION_DECISION_TO_REVIEW_TYPE[resolution.decision];
    if (reviewType) {
      approvalRequirements = [
        {
          reviewType,
          reasonCode: resolution.jurisdictionKnown === false ? "jurisdiction_unknown" : "high_risk_action_requires_review",
          required: true,
        },
      ];
    }
  }

  return {
    actionId: resolution.actionId,
    agentId: resolution.agentId,
    decision: resolution.decision,
    approvalRequirements,
    enforcementAction: JURISDICTION_DECISION_TO_ENFORCEMENT_ACTION[resolution.decision],
    metadata: JURISDICTION_SAFE_METADATA,
  };
}
