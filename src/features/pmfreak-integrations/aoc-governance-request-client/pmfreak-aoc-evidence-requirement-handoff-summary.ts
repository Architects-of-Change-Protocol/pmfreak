import type { PMFreakAocEvidenceRequirementHandoffPackage } from "./pmfreak-aoc-evidence-requirement-handoff-package";

export type PMFreakAocEvidenceRequirementHandoffSummary = {
  totalHandoffs: number;
  totalRequirementItems: number;
  requiredEvidenceCount: number;
  missingEvidenceCount: number;
  requiredApprovalCount: number;
  missingApprovalCount: number;

  byRequirementType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  bySource: Record<string, number>;

  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;

  handoffOnly: true;
};

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

// Pure aggregation over already-computed handoff packages. Does not
// mutate `handoffs` or any handoff's own arrays.
export function summarizePMFreakAocEvidenceRequirementHandoffs(
  handoffs: PMFreakAocEvidenceRequirementHandoffPackage[],
): PMFreakAocEvidenceRequirementHandoffSummary {
  const byRequirementType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  let totalRequirementItems = 0;
  let requiredEvidenceCount = 0;
  let missingEvidenceCount = 0;
  let requiredApprovalCount = 0;
  let missingApprovalCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const handoff of handoffs) {
    increment(bySource, handoff.source);
    requiredEvidenceCount += handoff.requiredEvidenceIds.length;
    missingEvidenceCount += handoff.missingEvidenceIds.length;
    requiredApprovalCount += handoff.requiredApprovalIds.length;
    missingApprovalCount += handoff.missingApprovalIds.length;

    for (const item of handoff.requirementItems) {
      totalRequirementItems += 1;
      increment(byRequirementType, item.requirementType);
      increment(byStatus, item.status);
      increment(byPriority, item.priority);

      switch (item.priority) {
        case "critical":
          criticalCount += 1;
          break;
        case "high":
          highCount += 1;
          break;
        case "medium":
          mediumCount += 1;
          break;
        case "low":
          lowCount += 1;
          break;
      }
    }
  }

  return {
    totalHandoffs: handoffs.length,
    totalRequirementItems,
    requiredEvidenceCount,
    missingEvidenceCount,
    requiredApprovalCount,
    missingApprovalCount,

    byRequirementType,
    byStatus,
    byPriority,
    bySource,

    criticalCount,
    highCount,
    mediumCount,
    lowCount,

    handoffOnly: true,
  };
}
