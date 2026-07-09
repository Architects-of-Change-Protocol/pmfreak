// Where an evidence requirement item / handoff package was built from.
// Mirrors the shape of PMFreakAocGovernedActionGateSource, but scoped to
// the four upstream models this feature is allowed to consume.
export type PMFreakAocEvidenceRequirementSource =
  | "governance_response"
  | "decision_inbox_item"
  | "gate_result"
  | "gate_result_ui_display_model";
