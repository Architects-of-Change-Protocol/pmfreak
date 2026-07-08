// AOC Jurisdiction Pack Runtime v1 — pack construction
//
// createJurisdictionPack is the only supported way to build a
// JurisdictionPack from scratch. It forces every safety field regardless
// of what the caller passes in — CreateJurisdictionPackInput's type
// already excludes those fields from the input shape, and this function
// never reads them from anywhere else.

import type {
  CreateJurisdictionPackInput,
  JurisdictionControlPlaneLabel,
  JurisdictionExportLabel,
  JurisdictionPack,
  JurisdictionPackMetadata,
  JurisdictionPackScope,
} from "./jurisdiction-pack-types";

const DEFAULT_EXPORT_LABELS: JurisdictionExportLabel[] = [
  "not_legal_advice",
  "partial_policy_model",
  "not_jurisdiction_specific_compliance",
  "not_compliance_certification",
];

const DEFAULT_CONTROL_PLANE_LABELS: JurisdictionControlPlaneLabel[] = [
  "Jurisdiction awareness",
  "Not legal advice",
  "Partial policy model",
  "No jurisdiction-specific compliance claimed",
];

export function createJurisdictionPack(input: CreateJurisdictionPackInput): JurisdictionPack {
  const scope: JurisdictionPackScope = {
    globalBaseline: input.scope?.globalBaseline ?? false,
    jurisdictionSpecific: input.scope?.jurisdictionSpecific ?? true,
    domainSpecific: input.scope?.domainSpecific ?? false,
    useCaseSpecific: input.scope?.useCaseSpecific ?? false,
    // Forced. Never derived from input.
    legalAdvice: false,
    complianceCertification: false,
    completenessClaimed: false,
  };

  const metadata: JurisdictionPackMetadata = {
    // Forced. Never derived from input.
    requiredDisclaimer: "not_legal_advice",
    policyModelStatus: "partial_policy_model",
    complianceClaimed: false,
    jurisdictionalComplianceClaimed: false,

    customerValidationRequired: input.metadata?.customerValidationRequired ?? true,
    counselReviewRequiredWhenApplicable: input.metadata?.counselReviewRequiredWhenApplicable ?? true,

    // Always mirrors validationStatus at creation time so the two fields
    // can never be constructed out of sync.
    sourceStatus: input.validationStatus,

    createdBy: input.metadata?.createdBy,
    reviewedBy: input.metadata?.reviewedBy,
    reviewedAt: input.metadata?.reviewedAt,
    effectiveFrom: input.metadata?.effectiveFrom,
    effectiveUntil: input.metadata?.effectiveUntil,
    supersedesPackId: input.metadata?.supersedesPackId,
    supersededByPackId: input.metadata?.supersededByPackId,
    notes: input.metadata?.notes,
  };

  return {
    id: input.id,
    name: input.name,
    version: input.version,

    kind: "jurisdiction_pack",

    jurisdiction: input.jurisdiction,

    status: input.status ?? "draft",
    validationStatus: input.validationStatus,

    scope,

    extendsPackIds: input.extendsPackIds ?? [],
    requiredBaselinePackIds: input.requiredBaselinePackIds ?? [],

    metadata,

    requirements: input.requirements ?? [],
    evidenceRequirements: input.evidenceRequirements ?? [],
    reviewRequirements: input.reviewRequirements ?? [],

    exportLabels: input.exportLabels ?? DEFAULT_EXPORT_LABELS,
    controlPlaneLabels: input.controlPlaneLabels ?? DEFAULT_CONTROL_PLANE_LABELS,
  };
}
