// AOC Jurisdiction Pack Runtime v1 — shared reason-code lookup tables
//
// These tables are the single source of truth for how a review reason
// code maps to an Approval Runtime review type and to Evidence Runtime
// evidence types. The resolver, approval mapping, and evidence mapping
// modules all read from here so the three stay in lockstep.

import type {
  JurisdictionEvidenceType,
  JurisdictionReviewReasonCode,
  JurisdictionReviewType,
  JurisdictionRuntimeDecision,
} from "./jurisdiction-pack-types";

export const JURISDICTION_REASON_CODE_TO_EVIDENCE_TYPES: Record<JurisdictionReviewReasonCode, JurisdictionEvidenceType[]> = {
  jurisdiction_unknown: ["jurisdiction_basis_source"],
  jurisdiction_ambiguous: ["jurisdiction_basis_source"],
  jurisdiction_conflict: ["jurisdiction_basis_source"],
  jurisdiction_pack_missing: ["customer_policy_source", "counsel_attestation_source"],
  jurisdiction_pack_expired: ["authority_source"],
  jurisdiction_pack_demo_only: ["counsel_attestation_source"],
  counsel_review_missing: ["counsel_review_record"],
  customer_validation_missing: ["customer_validation_record"],
  regulated_action_pattern_detected: ["regulatory_reference_source"],
  high_risk_action_requires_review: ["regulatory_reference_source"],
};

export const JURISDICTION_DECISION_TO_REVIEW_TYPE: Partial<Record<JurisdictionRuntimeDecision, JurisdictionReviewType>> = {
  require_legal_review: "legal_review",
  require_counsel_review: "counsel_review",
  require_customer_validation: "customer_validation",
  require_compliance_review: "compliance_review",
  require_approval: "operator_review",
  require_review: "operator_review",
  hold: "operator_review",
};

export const JURISDICTION_DECISION_TO_ENFORCEMENT_ACTION: Record<
  JurisdictionRuntimeDecision,
  "allow" | "hold" | "deny" | "require_approval"
> = {
  allow: "allow",
  hold: "hold",
  deny: "deny",
  require_approval: "require_approval",
  require_review: "require_approval",
  require_legal_review: "require_approval",
  require_compliance_review: "require_approval",
  require_customer_validation: "require_approval",
  require_counsel_review: "require_approval",
};
