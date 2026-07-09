import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

export type PMFreakAocGateRequirementListItem = {
  itemId: string;
  type: "evidence" | "approval";
  status: "required" | "missing";
  referenceId: string;
  label: string;
};

export type PMFreakAocGateRequirementListViewModel = {
  kind: "gate_requirement_list";
  requiredEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingEvidenceIds: string[];
  missingApprovalIds: string[];
  items: PMFreakAocGateRequirementListItem[];
  presentationOnly: true;
};

// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

function buildItems(type: "evidence" | "approval", requiredIds: string[], missingIds: string[]): PMFreakAocGateRequirementListItem[] {
  const missingSet = new Set(missingIds);
  const items = requiredIds.map((id) => ({
    itemId: `gate.requirement.${type}.${toSafeIdSegment(id)}`,
    type,
    status: missingSet.has(id) ? ("missing" as const) : ("required" as const),
    referenceId: id,
    label: id,
  }));

  const extraMissing = missingIds.filter((id) => !requiredIds.includes(id));
  for (const id of extraMissing) {
    items.push({
      itemId: `gate.requirement.${type}.${toSafeIdSegment(id)}`,
      type,
      status: "missing",
      referenceId: id,
      label: id,
    });
  }

  return items;
}

// Pure display of the gate result's own required/missing evidence and
// approval identifiers. Does not create evidence, does not create
// approvals — display only.
export function createPMFreakAocGateRequirementListViewModel(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateRequirementListViewModel {
  const evidenceItems = buildItems("evidence", result.requiredEvidenceIds, result.missingEvidenceIds);
  const approvalItems = buildItems("approval", result.requiredApprovalIds, result.missingApprovalIds);

  return {
    kind: "gate_requirement_list",
    requiredEvidenceIds: [...result.requiredEvidenceIds],
    requiredApprovalIds: [...result.requiredApprovalIds],
    missingEvidenceIds: [...result.missingEvidenceIds],
    missingApprovalIds: [...result.missingApprovalIds],
    items: [...evidenceItems, ...approvalItems],
    presentationOnly: true,
  };
}
