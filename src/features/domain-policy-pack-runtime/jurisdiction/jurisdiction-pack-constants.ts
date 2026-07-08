// AOC Jurisdiction Pack Runtime v1 — safe vocabulary
//
// Every string this runtime emits (validation errors, resolutions,
// compositions, approval/evidence mappings, exports, Control Plane
// summaries) must be checked against JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES
// via assertNoJurisdictionOverclaim before it leaves the runtime.

export const JURISDICTION_SAFE_LABELS = [
  "not_legal_advice",
  "partial_policy_model",
  "baseline_legal_awareness",
  "requires_customer_validation",
  "requires_counsel_review_when_applicable",
  "not_jurisdiction_specific_compliance",
  "not_compliance_certification",
] as const;

export const JURISDICTION_CONTROL_PLANE_SAFE_LABELS = [
  "Jurisdiction awareness",
  "Not legal advice",
  "Partial policy model",
  "No jurisdiction-specific compliance claimed",
  "Requires customer validation",
  "Requires counsel review when applicable",
  "Missing jurisdiction pack",
  "Jurisdiction unknown",
  "Jurisdiction ambiguous",
  "Jurisdiction conflict detected",
] as const;

// Lowercase, for substring matching in assertNoJurisdictionOverclaim.
export const JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES = [
  "legally compliant",
  "legal compliance passed",
  "complies with costa rica",
  "complies with eu law",
  "complies with us law",
  "complies with panama law",
  "banking compliant",
  "healthcare compliant",
  "labor compliant",
  "commercial compliant",
  "civil compliant",
  "criminal compliant",
  "certified compliant",
  "guaranteed compliant",
  "legal advice",
  "valid under law",
  "jurisdictionally compliant",
  "regulatory approval",
] as const;

export const JURISDICTION_INCORRECT_CONTROL_PLANE_LABELS = [
  "Legal compliance passed",
  "Compliant with law",
  "Costa Rica compliant",
  "EU compliant",
  "US compliant",
  "Fully legal",
  "Regulatory approved",
  "Certified compliant",
] as const;
