import type { PMFreakAocEvidenceRequirementItem, PMFreakAocEvidenceRequirementType } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import { toSafeIdSegment } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import type { PMFreakAocEvidenceRequirementPriority } from "./pmfreak-aoc-evidence-requirement-handoff-priority";
import type { PMFreakAocEvidenceRequirementStatus } from "./pmfreak-aoc-evidence-requirement-handoff-status";

export type PMFreakAocEvidenceRequirementChecklistItemViewModel = {
  checklistItemId: string;
  label: string;
  status: PMFreakAocEvidenceRequirementStatus;
  priority: PMFreakAocEvidenceRequirementPriority;
  referenceId: string;
  requirementType: PMFreakAocEvidenceRequirementType;
  done: false;
  actionable: false;
};

export type PMFreakAocEvidenceRequirementChecklistViewModel = {
  kind: "evidence_requirement_checklist";
  title: string;
  items: PMFreakAocEvidenceRequirementChecklistItemViewModel[];
  safeInstructions: string[];
  handoffOnly: true;
};

const SAFE_INSTRUCTIONS = [
  "Review each item below.",
  "This checklist does not create tasks or mark items complete.",
  "Collect or link the referenced evidence outside PMFreak before attempting the action again.",
] as const;

// Pure, deterministic view-model construction: one checklist item per
// requirement item. `done` and `actionable` are structurally `false` —
// this checklist never marks anything complete and never exposes an
// actionable control.
export function createPMFreakAocEvidenceRequirementChecklistViewModel(
  requirementItems: PMFreakAocEvidenceRequirementItem[],
): PMFreakAocEvidenceRequirementChecklistViewModel {
  const items: PMFreakAocEvidenceRequirementChecklistItemViewModel[] = requirementItems.map((item) => ({
    checklistItemId: `pmfreak.aoc.evidence.checklist.${toSafeIdSegment(item.referenceId)}.v1`,
    label: item.label,
    status: item.status,
    priority: item.priority,
    referenceId: item.referenceId,
    requirementType: item.requirementType,
    done: false,
    actionable: false,
  }));

  return {
    kind: "evidence_requirement_checklist",
    title: "Evidence Requirement Checklist",
    items,
    safeInstructions: [...SAFE_INSTRUCTIONS],
    handoffOnly: true,
  };
}
