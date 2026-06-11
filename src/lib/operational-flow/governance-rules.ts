import type { GovernanceEvaluation, SignalType } from "./types";

const DEFAULT: GovernanceEvaluation = {
  ruleKey: "operational_signal_review_v1",
  authorityRequired: "baseline review",
  evidenceRequired: false,
  governanceStatus: "compliant",
  explanation: "No elevated governance control is required by the v1 deterministic rule set.",
};

export function evaluateGovernance(signalType: SignalType, hasOwner = false, hasDueDate = false): GovernanceEvaluation {
  if (signalType === "missing_approval") return { ruleKey: "approval_required_v1", authorityRequired: "authorized approver", evidenceRequired: true, governanceStatus: "decision_required", explanation: "Formal approval is missing; work must not proceed until a human authority decides and the approval evidence is recorded." };
  if (signalType === "scope_creep") return { ruleKey: "scope_authority_v1", authorityRequired: "sponsor or PMO", evidenceRequired: true, governanceStatus: "decision_required", explanation: "A scope change requires sponsor or PMO authority and a traceable decision before execution." };
  if (signalType === "billing_risk") return { ruleKey: "billing_evidence_v1", authorityRequired: "commercial owner", evidenceRequired: true, governanceStatus: "warning", explanation: "Billing exposure requires formal commercial evidence before the recommendation can be closed." };
  if (signalType === "stakeholder_blocker") return { ruleKey: "stakeholder_escalation_v1", authorityRequired: "PM or sponsor", evidenceRequired: false, governanceStatus: "decision_required", explanation: "The stakeholder blocker requires escalation or an explicit human decision." };
  if (signalType === "delivery_impediment") return { ruleKey: "impediment_accountability_v1", authorityRequired: "delivery owner", evidenceRequired: false, governanceStatus: hasOwner && hasDueDate ? "compliant" : "violation", explanation: hasOwner && hasDueDate ? "The impediment has an accountable owner and target date." : "Delivery impediments require both an accountable owner and a target date." };
  return DEFAULT;
}

export function mapSignalToRiskType(signalType: SignalType): "risk" | "issue" | "impediment" | "change" | "decision_needed" {
  if (signalType === "scope_creep") return "change";
  if (signalType === "missing_approval" || signalType === "decision_needed") return "decision_needed";
  if (signalType === "delivery_impediment" || signalType === "stakeholder_blocker") return "impediment";
  if (signalType === "governance_gap") return "issue";
  return "risk";
}
