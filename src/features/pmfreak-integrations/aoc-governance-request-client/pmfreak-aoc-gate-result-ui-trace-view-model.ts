import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

export type PMFreakAocGateTraceStepViewModel = {
  stepId: string;
  label: string;
  status: "passed" | "warning" | "blocked" | "not_applicable";
  summary: string;
};

export type PMFreakAocGateTraceViewModel = {
  kind: "gate_trace";
  steps: PMFreakAocGateTraceStepViewModel[];
  presentationOnly: true;
};

// The gate result's own trace steps are already deterministic and free of
// timestamps and private metadata, so this is a pure pass-through
// projection — no new fields are invented and nothing is mutated.
export function createPMFreakAocGateTraceViewModel(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateTraceViewModel {
  return {
    kind: "gate_trace",
    steps: result.trace.map((step) => ({
      stepId: step.stepId,
      label: step.label,
      status: step.status,
      summary: step.summary,
    })),
    presentationOnly: true,
  };
}
