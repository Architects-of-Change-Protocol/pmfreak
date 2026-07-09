import {
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGateNeedsReviewResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "./pmfreak-aoc-governed-action-gate-fixtures";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocEvidenceRequirementChecklistViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-checklist-view-model";
import { createPMFreakAocEvidenceRequirementHandoffDetailViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-detail-view-model";
import type { PMFreakAocEvidenceRequirementHandoffDetailViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-detail-view-model";
import { createPMFreakAocEvidenceRequirementHandoffEmptyState } from "./pmfreak-aoc-evidence-requirement-handoff-empty-state";
import type { PMFreakAocEvidenceRequirementHandoffEmptyState } from "./pmfreak-aoc-evidence-requirement-handoff-empty-state";
import { createPMFreakAocEvidenceRequirementHandoffErrorState } from "./pmfreak-aoc-evidence-requirement-handoff-error-state";
import type { PMFreakAocEvidenceRequirementHandoffErrorState } from "./pmfreak-aoc-evidence-requirement-handoff-error-state";
import { extractPMFreakAocEvidenceRequirementReferences } from "./pmfreak-aoc-evidence-requirement-handoff-extractor";
import { createPMFreakAocEvidenceRequirementHandoffFromGateResult } from "./pmfreak-aoc-evidence-requirement-handoff-from-gate-result";
import type { PMFreakAocEvidenceRequirementItem } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import type { PMFreakAocEvidenceRequirementHandoffPackage } from "./pmfreak-aoc-evidence-requirement-handoff-package";
import { createPMFreakAocEvidenceRequirementReviewPacket } from "./pmfreak-aoc-evidence-requirement-handoff-review-packet";
import type { PMFreakAocEvidenceRequirementReviewPacket } from "./pmfreak-aoc-evidence-requirement-handoff-review-packet";
import { normalizePMFreakAocEvidenceRequirementHandoffContext } from "./pmfreak-aoc-evidence-requirement-handoff-context";
import { summarizePMFreakAocEvidenceRequirementHandoffs } from "./pmfreak-aoc-evidence-requirement-handoff-summary";
import type { PMFreakAocEvidenceRequirementHandoffSummary } from "./pmfreak-aoc-evidence-requirement-handoff-summary";

// All identifiers below reuse existing fake/demo-only fixtures from
// pmfreak-aoc-governed-action-gate-fixtures.ts (which itself reuses
// pmfreak-aoc-fixtures.ts / pmfreak-aoc-decision-inbox-fixtures.ts), plus
// the fixed fake-ID list from this feature's spec: no real customer
// names, Datasys project IDs, real emails, contract/invoice numbers or
// secrets.

// Some requirement types (contract review, security review, executive
// approval) have no existing upstream fixture that directly produces
// that exact type from its natural reference IDs. For those, this file
// takes an existing gate-result fixture for its context (project/action/
// agent/etc.) and overrides only its evidence/approval reference ID
// arrays with a synthetic-but-realistic fake ID from the fixed fake-ID
// list, then re-runs the same builder used everywhere else
// (createPMFreakAocEvidenceRequirementHandoffFromGateResult) — never
// mutating the base fixture's own result object.
function withOverriddenReferenceIds(
  base: PMFreakAocGovernedActionGateResult,
  overrides: Partial<
    Pick<PMFreakAocGovernedActionGateResult, "requiredEvidenceIds" | "missingEvidenceIds" | "requiredApprovalIds" | "missingApprovalIds">
  >,
): PMFreakAocGovernedActionGateResult {
  return {
    ...base,
    requiredEvidenceIds: overrides.requiredEvidenceIds ?? [],
    missingEvidenceIds: overrides.missingEvidenceIds ?? [],
    requiredApprovalIds: overrides.requiredApprovalIds ?? [],
    missingApprovalIds: overrides.missingApprovalIds ?? [],
  };
}

export async function demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffBillingReview(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffContractReview(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const base = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  const gateResult = withOverriddenReferenceIds(base, {
    requiredEvidenceIds: ["evidence.demo.contract-review.required"],
    missingEvidenceIds: ["evidence.demo.contract-review.required"],
  });
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffSecurityReview(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const base = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  const gateResult = withOverriddenReferenceIds(base, {
    requiredEvidenceIds: ["evidence.demo.security-review.required"],
    missingEvidenceIds: ["evidence.demo.security-review.required"],
  });
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffPmApproval(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsApprovalResult();
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffExecutiveApproval(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const base = await demoPMFreakAocGovernedActionGateNeedsApprovalResult();
  const gateResult = withOverriddenReferenceIds(base, {
    requiredApprovalIds: ["approval.demo.executive.required"],
    missingApprovalIds: ["approval.demo.executive.required"],
  });
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export async function demoPMFreakAocEvidenceRequirementHandoffNoEvidenceRequired(): Promise<PMFreakAocEvidenceRequirementHandoffPackage> {
  const gateResult = await demoPMFreakAocGovernedActionGatePassedResult();
  return createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
}

export function demoPMFreakAocEvidenceRequirementHandoffError(): PMFreakAocEvidenceRequirementHandoffErrorState {
  return createPMFreakAocEvidenceRequirementHandoffErrorState();
}

export function demoPMFreakAocEvidenceRequirementCustomerAcceptanceMissingItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    source: "gate_result",
  });
  return item;
}

export function demoPMFreakAocEvidenceRequirementBillingReviewRequiredItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.billing-review.required"],
    source: "gate_result",
  });
  return item;
}

export function demoPMFreakAocEvidenceRequirementContractReviewRequiredItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.contract-review.required"],
    source: "gate_result",
  });
  return item;
}

export function demoPMFreakAocEvidenceRequirementSecurityReviewRequiredItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.security-review.required"],
    source: "gate_result",
  });
  return item;
}

export function demoPMFreakAocEvidenceRequirementPmApprovalRequiredItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    requiredApprovalIds: ["approval.demo.pm.required"],
    source: "gate_result",
  });
  return item;
}

export function demoPMFreakAocEvidenceRequirementExecutiveApprovalRequiredItem(): PMFreakAocEvidenceRequirementItem {
  const [item] = extractPMFreakAocEvidenceRequirementReferences({
    requiredApprovalIds: ["approval.demo.executive.required"],
    source: "gate_result",
  });
  return item;
}

export async function demoPMFreakAocEvidenceRequirementHandoffMixed(): Promise<PMFreakAocEvidenceRequirementHandoffPackage[]> {
  return Promise.all([
    demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance(),
    demoPMFreakAocEvidenceRequirementHandoffBillingReview(),
    demoPMFreakAocEvidenceRequirementHandoffContractReview(),
    demoPMFreakAocEvidenceRequirementHandoffSecurityReview(),
    demoPMFreakAocEvidenceRequirementHandoffPmApproval(),
    demoPMFreakAocEvidenceRequirementHandoffExecutiveApproval(),
    demoPMFreakAocEvidenceRequirementHandoffNoEvidenceRequired(),
  ]);
}

export async function demoPMFreakAocEvidenceRequirementChecklist(): Promise<PMFreakAocEvidenceRequirementChecklistViewModel> {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  return handoff.checklist;
}

export async function demoPMFreakAocEvidenceRequirementReviewPacket(): Promise<PMFreakAocEvidenceRequirementReviewPacket> {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ gateResult });
  const requirementItems = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: context.requiredEvidenceIds,
    missingEvidenceIds: context.missingEvidenceIds,
    requiredApprovalIds: context.requiredApprovalIds,
    missingApprovalIds: context.missingApprovalIds,
    reasonCodes: context.reasonCodes,
    actionCategory: context.actionCategory,
    verdict: context.verdict,
    decision: context.decision,
    source: "gate_result",
  });
  return createPMFreakAocEvidenceRequirementReviewPacket({ source: "gate_result", context, requirementItems });
}

export async function demoPMFreakAocEvidenceRequirementHandoffDetailViewModel(): Promise<PMFreakAocEvidenceRequirementHandoffDetailViewModel> {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  return createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
}

export async function demoPMFreakAocEvidenceRequirementHandoffSummary(): Promise<PMFreakAocEvidenceRequirementHandoffSummary> {
  const handoffs = await demoPMFreakAocEvidenceRequirementHandoffMixed();
  return summarizePMFreakAocEvidenceRequirementHandoffs(handoffs);
}

export function demoPMFreakAocEvidenceRequirementHandoffEmptyState(): PMFreakAocEvidenceRequirementHandoffEmptyState {
  return createPMFreakAocEvidenceRequirementHandoffEmptyState();
}

export function demoPMFreakAocEvidenceRequirementHandoffErrorState(): PMFreakAocEvidenceRequirementHandoffErrorState {
  return createPMFreakAocEvidenceRequirementHandoffErrorState();
}
