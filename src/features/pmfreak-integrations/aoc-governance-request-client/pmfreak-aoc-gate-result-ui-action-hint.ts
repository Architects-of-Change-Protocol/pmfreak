import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocGateResultUIActionHintIntent = "informational" | "review_required" | "evidence_required" | "approval_required" | "retry_possible";

export type PMFreakAocGateResultUIActionHint = {
  hintId: string;
  label: string;
  description: string;
  intent: PMFreakAocGateResultUIActionHintIntent;
  enabled: false;
  executesAction: false;
  mutatesState: false;
  createsInvoice: false;
  sendsCommunication: false;
};

const HINT_BY_VERDICT: Record<PMFreakAocGovernedActionGateVerdict, { label: string; description: string; intent: PMFreakAocGateResultUIActionHintIntent }> = {
  passed: {
    label: "Review next application step",
    description: "The proposed action passed the gate, but this UI does not execute it.",
    intent: "informational",
  },
  needs_evidence: {
    label: "Evidence required",
    description: "Missing evidence must be attached or linked before a future execution attempt.",
    intent: "evidence_required",
  },
  needs_approval: {
    label: "Approval required",
    description: "Required approval references must be collected before a future execution attempt.",
    intent: "approval_required",
  },
  needs_review: {
    label: "Review required",
    description: "Required review must be completed before a future execution attempt.",
    intent: "review_required",
  },
  blocked: {
    label: "Review blocker",
    description: "Review the AOC decision reasons before attempting a new request.",
    intent: "informational",
  },
  held: {
    label: "Review hold",
    description: "Hold this action until the required review or context update is available.",
    intent: "review_required",
  },
  error: {
    label: "Review gate error",
    description: "The gate could not safely evaluate this action.",
    intent: "retry_possible",
  },
};

// All hints are disabled, informational-only view models. No hint
// executes actions, mutates state, creates invoices, or sends
// communications — the disabled/false-typed fields are structural, not
// just a display convention.
export function createPMFreakAocGateResultUIActionHints(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateResultUIActionHint[] {
  const hint = HINT_BY_VERDICT[result.verdict] ?? HINT_BY_VERDICT.error;

  return [
    {
      hintId: `gate.ui.hint.${result.verdict}`,
      label: hint.label,
      description: hint.description,
      intent: hint.intent,
      enabled: false,
      executesAction: false,
      mutatesState: false,
      createsInvoice: false,
      sendsCommunication: false,
    },
  ];
}
