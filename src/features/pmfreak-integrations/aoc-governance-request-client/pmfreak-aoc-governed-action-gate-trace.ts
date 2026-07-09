import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateTraceStep, PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocGovernedActionGateTraceInput = {
  verdict: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;
  response?: PMFreakAocGovernanceResponse;
  mismatchedRequestId?: boolean;
  mismatchedClientId?: boolean;
  errors?: string[];
};

// Deterministic, offline trace steps. No timestamps, no random IDs, no
// private metadata — every field is derived from the verdict/decision/
// mismatch flags already computed by the caller.
export function createPMFreakAocGovernedActionGateTrace(
  input: PMFreakAocGovernedActionGateTraceInput,
): PMFreakAocGovernedActionGateTraceStep[] {
  const { verdict, decision, mismatchedRequestId = false, mismatchedClientId = false, errors = [] } = input;

  return [
    {
      stepId: "gate_input_received",
      label: "Gate input received",
      status: errors.length > 0 ? "warning" : "passed",
      summary: "The gate received a governance response or decision inbox item for evaluation.",
    },
    {
      stepId: "aoc_decision_detected",
      label: "AOC decision detected",
      status: decision ? "passed" : "blocked",
      summary: decision ? `An AOC decision ("${decision}") was detected on the gate input.` : "No AOC decision was found on the provided gate input.",
    },
    {
      stepId: "request_id_check",
      label: "Request ID check",
      status: mismatchedRequestId ? "blocked" : "passed",
      summary: mismatchedRequestId
        ? "The expected request ID did not match the governance response or decision inbox item."
        : "The request ID matched the expected value or was not checked.",
    },
    {
      stepId: "client_id_check",
      label: "Client ID check",
      status: mismatchedClientId ? "blocked" : "passed",
      summary: mismatchedClientId
        ? "The expected client ID did not match the governance response or decision inbox item."
        : "The client ID matched the expected value or was not checked.",
    },
    {
      stepId: "gate_verdict_mapped",
      label: "Gate verdict mapped",
      status: verdict === "error" ? "blocked" : "passed",
      summary: `The AOC decision was mapped to gate verdict "${verdict}".`,
    },
    {
      stepId: "side_effects_blocked",
      label: "Side effects blocked",
      status: "not_applicable",
      summary: "This gate does not execute actions, mutate PMFreak data, or write decisions back.",
    },
    {
      stepId: "safe_next_step_created",
      label: "Safe next step created",
      status: "passed",
      summary: "A safe, deterministic next step was created for this gate result.",
    },
  ];
}
