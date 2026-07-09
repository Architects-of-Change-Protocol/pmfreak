import { redactPMFreakAocGateResultUIValue } from "./pmfreak-aoc-gate-result-ui-redaction";

export type PMFreakAocGateResultUIErrorState = {
  kind: "gate_result_error";
  title: string;
  message: string;
  safe: true;
  presentationOnly: true;
};

const DEFAULT_ERROR_MESSAGE = "The AOC gate result could not be displayed right now.";

// Redacts the supplied message (safe_demo mode) before surfacing it, so a
// caller-supplied error string can never leak an email/token/secret into
// the display layer.
export function createPMFreakAocGateResultUIErrorState(message?: string): PMFreakAocGateResultUIErrorState {
  const safeMessage = message ? (redactPMFreakAocGateResultUIValue(message, "safe_demo") as string) : DEFAULT_ERROR_MESSAGE;

  return {
    kind: "gate_result_error",
    title: "Unable to display gate result",
    message: safeMessage,
    safe: true,
    presentationOnly: true,
  };
}
