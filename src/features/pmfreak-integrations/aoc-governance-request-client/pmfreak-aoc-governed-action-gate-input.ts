import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateSource } from "./pmfreak-aoc-governed-action-gate-types";

// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
// Mirrors pmfreak-aoc-request-builder.ts / pmfreak-aoc-decision-inbox-item.ts.
function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPMFreakAocGovernedActionGateInputId(idBasis: string): string {
  return `pmfreak.aoc.gate.input.${toSafeIdSegment(idBasis)}.v1`;
}

export type PMFreakAocGovernedActionGateInput = {
  gateInputId: string;

  actionAttempt?: PMFreakAocAgentActionAttempt;
  governanceRequest?: PMFreakAocGovernanceRequest;
  governanceResponse?: PMFreakAocGovernanceResponse;
  decisionInboxItem?: PMFreakAocDecisionInboxItem;

  source: PMFreakAocGovernedActionGateSource;

  expectedRequestId?: string;
  expectedClientId?: string;

  contextLabels: string[];
  warnings: string[];
  errors: string[];
};

// Pure, deterministic construction: preserves whatever inputs were given
// without mutating them, without evaluating AOC and without executing any
// action. gateInputId is derived from the first available identifier
// (governance response, governance request, inbox item, action attempt).
export function createPMFreakAocGovernedActionGateInput(
  input: Partial<PMFreakAocGovernedActionGateInput>,
): PMFreakAocGovernedActionGateInput {
  const { actionAttempt, governanceRequest, governanceResponse, decisionInboxItem } = input;

  const idBasis =
    governanceResponse?.responseId ?? governanceRequest?.requestId ?? decisionInboxItem?.inboxItemId ?? actionAttempt?.actionAttemptId ?? "unspecified";

  const source: PMFreakAocGovernedActionGateSource =
    input.source ?? (governanceResponse ? "governance_response" : decisionInboxItem ? "decision_inbox_item" : "action_attempt");

  const expectedRequestId = input.expectedRequestId ?? governanceRequest?.requestId ?? governanceResponse?.requestId ?? decisionInboxItem?.requestId;
  const expectedClientId = input.expectedClientId ?? governanceRequest?.clientId ?? governanceResponse?.clientId ?? decisionInboxItem?.clientId;

  return {
    gateInputId: input.gateInputId ?? buildPMFreakAocGovernedActionGateInputId(idBasis),

    actionAttempt: actionAttempt
      ? {
          ...actionAttempt,
          contextFlags: [...actionAttempt.contextFlags],
          evidenceReferenceIds: [...actionAttempt.evidenceReferenceIds],
          approvalReferenceIds: [...actionAttempt.approvalReferenceIds],
          metadata: { ...actionAttempt.metadata },
        }
      : undefined,
    governanceRequest,
    governanceResponse,
    decisionInboxItem,

    source,

    expectedRequestId,
    expectedClientId,

    contextLabels: [...(input.contextLabels ?? [])],
    warnings: [...(input.warnings ?? [])],
    errors: [...(input.errors ?? [])],
  };
}
