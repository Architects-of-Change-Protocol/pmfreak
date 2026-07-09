import { PMFREAK_AOC_DECISION_INBOX_SAFE_LABELS } from "./pmfreak-aoc-decision-inbox-constants";
import { buildPMFreakAocDecisionInboxItemId } from "./pmfreak-aoc-decision-inbox-item";
import { mapPMFreakAocDecisionToInboxCategory } from "./pmfreak-aoc-decision-inbox-category";
import { createPMFreakAocDecisionInboxSafeNextStep } from "./pmfreak-aoc-decision-inbox-next-step";
import { mapPMFreakAocDecisionToInboxSeverity } from "./pmfreak-aoc-decision-inbox-severity";
import { mapPMFreakAocDecisionToInboxStatus } from "./pmfreak-aoc-decision-inbox-status";
import type { PMFreakAocDecisionInboxItem, PMFreakAocDecisionInboxItemSource, PMFreakAocDecisionInboxItemStatus } from "./pmfreak-aoc-decision-inbox-types";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";

function inferSourceFromEvaluatedBy(evaluatedBy: PMFreakAocGovernanceResponse["evaluatedBy"]): PMFreakAocDecisionInboxItemSource {
  switch (evaluatedBy) {
    case "local_mock_aoc":
      return "local_mock";
    case "aoc":
      return "remote_http";
    case "unsupported_remote":
      return "unsupported_remote";
    default:
      return "unknown";
  }
}

export type PMFreakAocDecisionInboxItemFromGovernanceResponseInput = {
  response: PMFreakAocGovernanceResponse;
  request?: PMFreakAocGovernanceRequest;
  source?: PMFreakAocDecisionInboxItemSource;
  inboxStatus?: PMFreakAocDecisionInboxItemStatus;
  createdAtLabel?: string;
  updatedAtLabel?: string;
};

// Pure, deterministic transformation: creates a display-only inbox item
// from an already-received AOC governance response. Does not mutate its
// inputs, does not execute anything, and always forces the display-only
// capability flags to their safe values regardless of what the response
// or request contain.
export function createPMFreakAocDecisionInboxItemFromGovernanceResponse(
  input: PMFreakAocDecisionInboxItemFromGovernanceResponseInput,
): PMFreakAocDecisionInboxItem {
  const { response, request } = input;

  const category = mapPMFreakAocDecisionToInboxCategory({
    decision: response.decision,
    reasonCodes: response.reasonCodes,
    actionCategory: request?.actionContext.actionCategory,
    missingEvidenceIds: response.missingEvidenceIds,
    missingApprovalIds: response.missingApprovalIds,
  });

  const safeLabels = [...new Set([...response.safeLabels, ...PMFREAK_AOC_DECISION_INBOX_SAFE_LABELS])];

  return {
    inboxItemId: buildPMFreakAocDecisionInboxItemId(response.responseId),
    source: input.source ?? inferSourceFromEvaluatedBy(response.evaluatedBy),

    requestId: response.requestId,
    responseId: response.responseId,
    clientId: response.clientId,

    projectId: request?.projectContext.projectId,
    workspaceId: request?.projectContext.workspaceId,
    tenantId: request?.projectContext.tenantId,
    customerId: request?.projectContext.customerId,

    agentId: request?.agentContext.agentId,
    agentRole: request?.agentContext.agentRole,
    actionId: request?.actionContext.actionId,
    actionCategory: request?.actionContext.actionCategory,
    actionTitle: request?.actionContext.actionTitle,

    decision: response.decision,
    decisionLabel: response.decisionLabel,
    decisionStatus: mapPMFreakAocDecisionToInboxStatus(response.decision),
    decisionSeverity: mapPMFreakAocDecisionToInboxSeverity(response.decision, response.decisionSeverity),
    category,

    safeSummary: response.safeSummary,
    safeNextStep: createPMFreakAocDecisionInboxSafeNextStep({
      decision: response.decision,
      requiredEvidenceIds: response.requiredEvidenceIds,
      requiredApprovalIds: response.requiredApprovalIds,
      missingEvidenceIds: response.missingEvidenceIds,
      missingApprovalIds: response.missingApprovalIds,
    }),

    reasonCodes: [...response.reasonCodes],

    requiredEvidenceIds: [...response.requiredEvidenceIds],
    requiredApprovalIds: [...response.requiredApprovalIds],
    missingEvidenceIds: [...response.missingEvidenceIds],
    missingApprovalIds: [...response.missingApprovalIds],

    warnings: [...response.warnings],
    errors: [...response.errors],
    safeLabels,

    inboxStatus: input.inboxStatus ?? "new",

    createdAtLabel: input.createdAtLabel ?? "unspecified",
    updatedAtLabel: input.updatedAtLabel,

    displayOnly: true,
    actionExecutionCapable: false,
    mutationCapable: false,
    writebackCapable: false,
    enforcementCapable: false,
  };
}
