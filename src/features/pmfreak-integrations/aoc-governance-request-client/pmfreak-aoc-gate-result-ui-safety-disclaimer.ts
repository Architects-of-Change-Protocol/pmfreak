import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

export type PMFreakAocGateSafetyDisclaimerViewModel = {
  kind: "gate_safety_disclaimer";
  title: string;
  messages: string[];
  presentationOnly: true;
};

const BASE_MESSAGES = [
  "This UI does not execute PMFreak actions.",
  "This UI does not mutate PMFreak data.",
  "This UI does not write decisions back.",
  "This UI does not create invoices.",
  "This UI does not send communications.",
] as const;

const PASSED_MESSAGE =
  "Passed means the proposed action passed the AOC governance gate for this request context. It does not mean the action was executed, legally approved, compliance-certified, invoice-valid, or customer-accepted.";

// Fixed, deterministic copy — always includes the base non-execution/
// non-mutation/non-writeback/non-invoice/non-communication disclaimers,
// plus an additional passed-specific clarification when the verdict is
// `passed` so a "passed" gate result is never mistaken for execution,
// legal approval, compliance certification, invoice validity, or
// customer acceptance.
export function createPMFreakAocGateSafetyDisclaimerViewModel(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateSafetyDisclaimerViewModel {
  const messages: string[] = [...BASE_MESSAGES];
  if (result.verdict === "passed") {
    messages.push(PASSED_MESSAGE);
  }

  return {
    kind: "gate_safety_disclaimer",
    title: "Safety",
    messages,
    presentationOnly: true,
  };
}
