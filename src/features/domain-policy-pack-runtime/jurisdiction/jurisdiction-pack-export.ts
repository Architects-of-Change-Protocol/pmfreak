// AOC Jurisdiction Pack Runtime v1 — Verifiable Export Package metadata
//
// createJurisdictionExportMetadata answers the audit questions the
// Verifiable Export Package needs — which jurisdiction context was
// declared, which packs were selected/missing, what decision was reached —
// without ever asserting the underlying action is legally compliant.

import type { JurisdictionExportMetadata, JurisdictionPackResolution } from "./jurisdiction-pack-types";

export function createJurisdictionExportMetadata(resolution: JurisdictionPackResolution): JurisdictionExportMetadata {
  return {
    actionId: resolution.actionId,
    agentId: resolution.agentId,

    selectedPackIds: resolution.selectedPackIds,
    missingPackIds: resolution.missingPackIds,

    jurisdictionKnown: resolution.jurisdictionKnown,
    jurisdictionAmbiguous: resolution.jurisdictionAmbiguous,
    jurisdictionConflictDetected: resolution.jurisdictionConflictDetected,

    validationStatusSatisfied: resolution.validationStatusSatisfied,

    requiredReviewTypes: [...new Set(resolution.requiredReviews.map((review) => review.reviewType))],
    requiredEvidenceTypes: [...new Set(resolution.requiredEvidence.map((evidence) => evidence.evidenceType))],

    decision: resolution.decision,

    evaluatedAt: resolution.evaluatedAt,

    requiredDisclaimer: resolution.metadata.requiredDisclaimer,
    policyModelStatus: resolution.metadata.policyModelStatus,
    complianceClaimed: resolution.metadata.complianceClaimed,
    jurisdictionalComplianceClaimed: resolution.metadata.jurisdictionalComplianceClaimed,
  };
}
