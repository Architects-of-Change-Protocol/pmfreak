import { redactPMFreakAocDecisionInboxValue } from "./pmfreak-aoc-decision-inbox-redaction";

export type PMFreakAocDecisionInboxErrorState = {
  kind: "error";
  title: string;
  message: string;
  safe: true;
  displayOnly: true;
};

const DEFAULT_ERROR_MESSAGE = "The AOC decision inbox could not be displayed right now.";

// Redacts the supplied message (safe_demo mode) before surfacing it, so a
// caller-supplied error string can never leak an email/token/secret into
// the display layer.
export function createPMFreakAocDecisionInboxErrorState(message?: string): PMFreakAocDecisionInboxErrorState {
  const safeMessage = message ? (redactPMFreakAocDecisionInboxValue(message, "safe_demo") as string) : DEFAULT_ERROR_MESSAGE;

  return {
    kind: "error",
    title: "Unable to display decisions",
    message: safeMessage,
    safe: true,
    displayOnly: true,
  };
}
