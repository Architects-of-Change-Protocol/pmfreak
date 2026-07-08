// AOC Jurisdiction Pack Runtime v1 — domain model
//
// This module defines the shape of a "jurisdiction pack": a candidate for
// jurisdiction-aware policy metadata. It does not encode any jurisdiction's
// law. A JurisdictionPack is infrastructure metadata, not a legal opinion.
//
// Read src/features/domain-policy-pack-runtime/jurisdiction/../README.md
// before changing any of these types — several fields exist specifically
// to make legal/compliance overclaims structurally impossible (e.g.
// `JurisdictionPackScope.legalAdvice` is typed `false`, not `boolean`).

import type { PolicyPackLifecycleStatus } from "../domain/policy-pack-domain";

export type JurisdictionPackStatus = PolicyPackLifecycleStatus;

// Distinct from JurisdictionPackStatus: a pack can be lifecycle-`active`
// while its underlying validation has gone stale (e.g. a counsel review
// that has itself expired without the pack being superseded yet).
export type JurisdictionValidationStatus =
  | "demo_baseline"
  | "customer_provided"
  | "customer_validated"
  | "counsel_review_requested"
  | "counsel_reviewed"
  | "counsel_attested"
  | "expired"
  | "superseded";

// Rank used only to decide whether one validation status satisfies a
// *requirement* expressed as another validation status (see
// jurisdiction-pack-resolver.ts). Higher is stronger. `expired` and
// `superseded` are intentionally excluded — they never satisfy anything.
export const JURISDICTION_VALIDATION_STATUS_RANK: Record<JurisdictionValidationStatus, number> = {
  demo_baseline: 0,
  customer_provided: 1,
  customer_validated: 2,
  counsel_review_requested: 3,
  counsel_reviewed: 4,
  counsel_attested: 5,
  expired: -1,
  superseded: -1,
};

export type JurisdictionDescriptor = {
  countryCode?: string;
  regionCode?: string;
  subdivisionCode?: string;
  marketCode?: string;
  governingLawLabel?: string;
  venueLabel?: string;

  // `known: false` means the descriptor could not be resolved to a
  // specific jurisdiction — it never means "known but non-compliant".
  known: boolean;
  ambiguous?: boolean;
  conflictDetected?: boolean;

  notes?: string;
};

export type JurisdictionPackScope = {
  globalBaseline: boolean;
  jurisdictionSpecific: boolean;
  domainSpecific: boolean;
  useCaseSpecific: boolean;

  // These three are typed as the literal `false`, not `boolean`, on
  // purpose: system-authored runtime metadata must never be able to flip
  // them to `true`. See jurisdiction-pack-factory.ts.
  legalAdvice: false;
  complianceCertification: false;
  completenessClaimed: false;
};

export type JurisdictionPackMetadata = {
  requiredDisclaimer: "not_legal_advice";
  policyModelStatus: "partial_policy_model";
  complianceClaimed: false;
  jurisdictionalComplianceClaimed: false;

  customerValidationRequired: boolean;
  counselReviewRequiredWhenApplicable: boolean;

  sourceStatus: JurisdictionValidationStatus;

  createdBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  effectiveFrom?: string;
  effectiveUntil?: string;

  supersedesPackId?: string;
  supersededByPackId?: string;

  notes?: string[];
};

export type JurisdictionPackRequirementCategory =
  | "jurisdiction_context"
  | "baseline_dependency"
  | "authority_boundary"
  | "evidence"
  | "approval"
  | "review"
  | "export"
  | "control_plane"
  | "no_overclaim";

export type JurisdictionRuntimeDecision =
  | "allow"
  | "hold"
  | "deny"
  | "require_approval"
  | "require_review"
  | "require_legal_review"
  | "require_compliance_review"
  | "require_customer_validation"
  | "require_counsel_review";

// Deterministic decision priority, most severe first. Used to combine
// multiple simultaneous concerns into a single decision.
export const JURISDICTION_DECISION_PRIORITY: readonly JurisdictionRuntimeDecision[] = [
  "deny",
  "require_counsel_review",
  "require_legal_review",
  "require_compliance_review",
  "require_customer_validation",
  "require_approval",
  "require_review",
  "hold",
  "allow",
];

export function pickMoreSevereDecision(
  a: JurisdictionRuntimeDecision,
  b: JurisdictionRuntimeDecision
): JurisdictionRuntimeDecision {
  const rankA = JURISDICTION_DECISION_PRIORITY.indexOf(a);
  const rankB = JURISDICTION_DECISION_PRIORITY.indexOf(b);
  return rankA <= rankB ? a : b;
}

export type JurisdictionPackRequirement = {
  id: string;
  title: string;
  description: string;

  category: JurisdictionPackRequirementCategory;

  severity: "info" | "warning" | "blocker" | "critical";

  decisionOnFailure: JurisdictionRuntimeDecision;

  requiredEvidenceTypes?: string[];
  requiredValidationStatus?: JurisdictionValidationStatus[];
  requiredPackIds?: string[];
};

// Evidence requirement categories. These are structured signals that
// reference the (future) Evidence / Source / Citation Runtime by ID —
// this runtime does not implement a second evidence system.
export type JurisdictionEvidenceType =
  | "jurisdiction_basis_source"
  | "customer_policy_source"
  | "counsel_attestation_source"
  | "contract_template_source"
  | "authority_source"
  | "regulatory_reference_source"
  | "customer_validation_record"
  | "counsel_review_record";

export type JurisdictionEvidenceRequirement = {
  id: string;
  evidenceType: JurisdictionEvidenceType;

  required: boolean;

  sourceRuntimeRef?: string;
  citationRuntimeRef?: string;
  proofRuntimeRef?: string;
};

export type JurisdictionReviewType =
  | "operator_review"
  | "customer_validation"
  | "legal_review"
  | "counsel_review"
  | "tax_review"
  | "compliance_review";

export type JurisdictionReviewReasonCode =
  | "jurisdiction_unknown"
  | "jurisdiction_ambiguous"
  | "jurisdiction_conflict"
  | "jurisdiction_pack_missing"
  | "jurisdiction_pack_expired"
  | "jurisdiction_pack_demo_only"
  | "counsel_review_missing"
  | "customer_validation_missing"
  | "regulated_action_pattern_detected"
  | "high_risk_action_requires_review";

export type JurisdictionReviewRequirement = {
  id: string;

  reviewType: JurisdictionReviewType;

  required: boolean;

  // References the (future) Approval Runtime by ID — this runtime does
  // not implement a second approval workflow.
  approvalRuntimeRef?: string;

  reasonCode: JurisdictionReviewReasonCode;
};

// Safe label slugs usable in export payloads. See jurisdiction-pack-constants.ts.
export type JurisdictionExportLabel =
  | "not_legal_advice"
  | "partial_policy_model"
  | "baseline_legal_awareness"
  | "requires_customer_validation"
  | "requires_counsel_review_when_applicable"
  | "not_jurisdiction_specific_compliance"
  | "not_compliance_certification";

// Safe display strings usable directly in the Control Plane UI.
export type JurisdictionControlPlaneLabel =
  | "Jurisdiction awareness"
  | "Not legal advice"
  | "Partial policy model"
  | "No jurisdiction-specific compliance claimed"
  | "Requires customer validation"
  | "Requires counsel review when applicable"
  | "Missing jurisdiction pack"
  | "Jurisdiction unknown"
  | "Jurisdiction ambiguous"
  | "Jurisdiction conflict detected";

export type JurisdictionPack = {
  id: string;
  name: string;
  version: string;

  kind: "jurisdiction_pack";

  jurisdiction: JurisdictionDescriptor;

  status: JurisdictionPackStatus;
  validationStatus: JurisdictionValidationStatus;

  scope: JurisdictionPackScope;

  extendsPackIds: string[];
  requiredBaselinePackIds: string[];

  metadata: JurisdictionPackMetadata;

  requirements: JurisdictionPackRequirement[];

  evidenceRequirements: JurisdictionEvidenceRequirement[];

  reviewRequirements: JurisdictionReviewRequirement[];

  exportLabels: JurisdictionExportLabel[];

  controlPlaneLabels: JurisdictionControlPlaneLabel[];
};

export type RegisteredJurisdictionPack = JurisdictionPack;

export type CreateJurisdictionPackInput = {
  id: string;
  name: string;
  version: string;

  jurisdiction: JurisdictionDescriptor;

  status?: JurisdictionPackStatus;
  validationStatus: JurisdictionValidationStatus;

  scope?: Partial<Omit<JurisdictionPackScope, "legalAdvice" | "complianceCertification" | "completenessClaimed">>;

  extendsPackIds?: string[];
  requiredBaselinePackIds?: string[];

  metadata?: Partial<
    Omit<
      JurisdictionPackMetadata,
      "requiredDisclaimer" | "policyModelStatus" | "complianceClaimed" | "jurisdictionalComplianceClaimed" | "sourceStatus"
    >
  >;

  requirements?: JurisdictionPackRequirement[];
  evidenceRequirements?: JurisdictionEvidenceRequirement[];
  reviewRequirements?: JurisdictionReviewRequirement[];

  exportLabels?: JurisdictionExportLabel[];
  controlPlaneLabels?: JurisdictionControlPlaneLabel[];
};

export type JurisdictionPackValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type JurisdictionLegalSensitivity = {
  legallySensitive: boolean;
  categories: string[];
};

export type JurisdictionPackResolutionInput = {
  actionId: string;
  agentId: string;
  principalId?: string;
  capabilityTokenId?: string;

  actionType: string;

  jurisdiction: JurisdictionDescriptor;

  requiredBaselinePackIds?: string[];

  requiredValidationStatus?: JurisdictionValidationStatus[];

  legalSensitivity?: JurisdictionLegalSensitivity;

  evidenceRefs?: {
    evidenceIds: string[];
    sourceIds?: string[];
    citationIds?: string[];
    proofIds?: string[];
  };

  requestedAt: string;
};

// Metadata every jurisdiction-runtime output must carry, verbatim.
export type JurisdictionSafeMetadata = {
  requiredDisclaimer: "not_legal_advice";
  policyModelStatus: "partial_policy_model";
  complianceClaimed: false;
  jurisdictionalComplianceClaimed: false;
};

export const JURISDICTION_SAFE_METADATA: JurisdictionSafeMetadata = {
  requiredDisclaimer: "not_legal_advice",
  policyModelStatus: "partial_policy_model",
  complianceClaimed: false,
  jurisdictionalComplianceClaimed: false,
};

export type JurisdictionPackResolution = {
  actionId: string;
  agentId: string;

  jurisdictionKnown: boolean;
  jurisdictionAmbiguous: boolean;
  jurisdictionConflictDetected: boolean;

  selectedPackIds: string[];
  missingPackIds: string[];

  candidatePackIds: string[];

  validationStatusSatisfied: boolean;

  requiredReviews: JurisdictionReviewRequirement[];

  requiredEvidence: JurisdictionEvidenceRequirement[];

  decision: JurisdictionRuntimeDecision;

  metadata: JurisdictionSafeMetadata;

  evaluatedAt: string;
};

export type JurisdictionPackComposition = {
  composed: boolean;
  baselinePackId: string;
  jurisdictionPackId: string;
  includedPackIds: string[];
  missingPackIds: string[];

  // Carried through from the jurisdiction pack so callers don't need a
  // second lookup — matches the "return required evidence/reviews from
  // jurisdiction pack" responsibility.
  requiredEvidence: JurisdictionEvidenceRequirement[];
  requiredReviews: JurisdictionReviewRequirement[];

  metadata: JurisdictionSafeMetadata;
};

export type JurisdictionApprovalRequirement = {
  reviewType: JurisdictionReviewType;
  reasonCode: JurisdictionReviewReasonCode;
  required: boolean;
  approvalRuntimeRef?: string;
};

export type JurisdictionApprovalMapping = {
  actionId: string;
  agentId: string;
  decision: JurisdictionRuntimeDecision;
  approvalRequirements: JurisdictionApprovalRequirement[];
  enforcementAction: "allow" | "hold" | "deny" | "require_approval";
  metadata: JurisdictionSafeMetadata;
};

export type JurisdictionExportMetadata = {
  actionId: string;
  agentId: string;

  selectedPackIds: string[];
  missingPackIds: string[];

  jurisdictionKnown: boolean;
  jurisdictionAmbiguous: boolean;
  jurisdictionConflictDetected: boolean;

  validationStatusSatisfied: boolean;

  requiredReviewTypes: JurisdictionReviewType[];
  requiredEvidenceTypes: JurisdictionEvidenceType[];

  decision: JurisdictionRuntimeDecision;

  evaluatedAt: string;

  requiredDisclaimer: "not_legal_advice";
  policyModelStatus: "partial_policy_model";
  complianceClaimed: false;
  jurisdictionalComplianceClaimed: false;
};

export type JurisdictionControlPlaneSummary = {
  jurisdictionStatusLabel: "known" | "unknown" | "ambiguous" | "conflict_detected";
  packStatusLabel:
    | "selected"
    | "missing"
    | "expired"
    | "superseded"
    | "demo_only"
    | "customer_provided"
    | "customer_validated"
    | "counsel_reviewed"
    | "counsel_attested";
  reviewStatusLabels: string[];
  safeLabels: JurisdictionControlPlaneLabel[];
};
