export type PMFreakAocEvidenceRequirementHandoffEmptyState = {
  kind: "evidence_requirement_handoff_empty";
  title: string;
  message: string;
  handoffOnly: true;
};

export function createPMFreakAocEvidenceRequirementHandoffEmptyState(): PMFreakAocEvidenceRequirementHandoffEmptyState {
  return {
    kind: "evidence_requirement_handoff_empty",
    title: "No evidence requirements yet",
    message: "No AOC evidence requirements to hand off yet.",
    handoffOnly: true,
  };
}
