// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Justification Engine
//
// Generates human-readable, evidence-backed justifications for each action.
// Every action must be explainable from first principles.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceActionType } from "./types";
import type { GovernanceSignalType } from "@/lib/governance-signals/types";

export type JustificationInput = {
  actionType: GovernanceActionType;
  signalType: GovernanceSignalType;
  signalTitle: string;
  supportingPatterns?: string[];
  historicalOccurrences?: number;
  confidenceScore: number;
};

export type JustificationResult = {
  justification: string;
  because: string;
  supportingPatterns: string[];
  historicalOccurrences: number;
  confidence: number;
};

const ACTION_BECAUSE: Record<GovernanceActionType, string> = {
  create_escalation:          "the detected signal requires escalation to unblock governance progress",
  request_ratification:       "the signal indicates a ratification gap that must be formally closed",
  request_approval:           "the signal reveals a pending approval that is stalling progress",
  create_delegation:          "an authority gap has been detected and delegation is required to fill it",
  assign_authority:           "the workspace lacks an assigned authority for a required governance function",
  review_amendment:           "an amendment backlog is accumulating and requires formal review",
  review_decision:            "a decision has been stalled beyond acceptable thresholds",
  review_risk:                "a risk signal indicates that a formal risk review is required",
  initiate_governance_review: "a governance violation requires a formal review to restore constitutional order",
  close_signal:               "the underlying condition has been resolved and the signal can be closed",
  reassess_recommendation:    "a prior recommendation has been ignored and requires reassessment",
  other:                      "the governance signal requires intervention",
};

export function generateActionJustification(
  input: JustificationInput
): JustificationResult {
  const patterns = input.supportingPatterns ?? [input.signalType];
  const occurrences = input.historicalOccurrences ?? 0;
  const because = ACTION_BECAUSE[input.actionType];

  const justification = [
    `Action '${input.actionType}' is recommended because ${because}.`,
    `Triggered by signal '${input.signalTitle}' (type: ${input.signalType}).`,
    patterns.length > 1
      ? `Supporting patterns: ${patterns.join(", ")}.`
      : null,
    occurrences > 0
      ? `This pattern has occurred ${occurrences} time(s) historically.`
      : null,
    `Confidence: ${(input.confidenceScore * 100).toFixed(1)}%.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    justification,
    because,
    supportingPatterns: patterns,
    historicalOccurrences: occurrences,
    confidence: input.confidenceScore,
  };
}
