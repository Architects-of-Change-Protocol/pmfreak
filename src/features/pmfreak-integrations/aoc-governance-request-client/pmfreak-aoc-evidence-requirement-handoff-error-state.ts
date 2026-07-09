import { redactPMFreakAocEvidenceRequirementHandoffValue } from "./pmfreak-aoc-evidence-requirement-handoff-redaction";

export type PMFreakAocEvidenceRequirementHandoffErrorState = {
  kind: "evidence_requirement_handoff_error";
  title: string;
  message: string;
  safe: true;
  handoffOnly: true;
};

const DEFAULT_ERROR_MESSAGE = "This evidence requirement handoff could not be created right now.";

// Redacts the supplied message (safe_demo mode) before surfacing it, so a
// caller-supplied error string can never leak an email/token/secret/
// bearer-token/connection-string/file-path into the display layer.
export function createPMFreakAocEvidenceRequirementHandoffErrorState(message?: string): PMFreakAocEvidenceRequirementHandoffErrorState {
  const safeMessage = message ? (redactPMFreakAocEvidenceRequirementHandoffValue(message, "safe_demo") as string) : DEFAULT_ERROR_MESSAGE;

  return {
    kind: "evidence_requirement_handoff_error",
    title: "Unable to create evidence requirement handoff",
    message: safeMessage,
    safe: true,
    handoffOnly: true,
  };
}
