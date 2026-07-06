// AOC Recognition Runtime — RecognitionDecision domain model

import type { PolicyEvaluationResult } from "./recognition-policy";

export type RecognitionOutcome =
  | "allow"
  | "deny_unrecognized_actor"
  | "deny_rogue_actor"
  | "deny_revoked"
  | "deny_expired"
  | "deny_out_of_scope"
  | "require_more_evidence"
  | "require_human_approval"
  | "policy_violation";

// Outcomes that never permit the action, regardless of any later approval.
export const TERMINAL_DENY_OUTCOMES: readonly RecognitionOutcome[] = [
  "deny_unrecognized_actor",
  "deny_rogue_actor",
  "deny_revoked",
  "deny_expired",
  "deny_out_of_scope",
  "policy_violation",
];

export type RecognitionDecision = {
  id: string;

  actionRequestId: string;
  trustDomainId: string;
  actorId: string;

  outcome: RecognitionOutcome;

  reasonCode: string;
  reason: string;

  evaluatedPolicies: PolicyEvaluationResult[];

  decidedAt: string;

  metadata?: Record<string, unknown>;
};
