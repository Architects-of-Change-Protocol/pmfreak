import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
import type { PMFreakAocGateResultUIDisplayModel } from "./pmfreak-aoc-gate-result-ui-display-model";
import type { PMFreakAocGovernanceDecision, PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocEvidenceRequirementHandoffContextInput = {
  response?: PMFreakAocGovernanceResponse;
  inboxItem?: PMFreakAocDecisionInboxItem;
  gateResult?: PMFreakAocGovernedActionGateResult;
  displayModel?: PMFreakAocGateResultUIDisplayModel;
};

export type PMFreakAocEvidenceRequirementHandoffContext = {
  requestId?: string;
  responseId?: string;
  gateResultId?: string;
  inboxItemId?: string;
  displayModelId?: string;
  clientId?: string;

  projectId?: string;
  workspaceId?: string;
  tenantId?: string;
  customerId?: string;

  agentId?: string;
  agentRole?: string;
  actionId?: string;
  actionCategory?: string;
  actionTitle?: string;

  verdict?: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;

  requiredEvidenceIds: string[];
  missingEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingApprovalIds: string[];

  reasonCodes: string[];
  warnings: string[];
  errors: string[];
  safeLabels: string[];
};

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

// Pure, deterministic normalization. Field precedence for every scalar
// field is gateResult, then inboxItem, then response, then displayModel.
// displayModel only ever contributes its own displayModelId/resultId and
// the required/missing evidence+approval ID arrays via
// displayModel.requirementList, since it carries no project/action
// context. Never mutates any input object; only copies whitelisted
// fields, never raw metadata/secrets.
export function normalizePMFreakAocEvidenceRequirementHandoffContext(
  input: PMFreakAocEvidenceRequirementHandoffContextInput,
): PMFreakAocEvidenceRequirementHandoffContext {
  const { response, inboxItem, gateResult, displayModel } = input;

  const requiredEvidenceIds = dedupe([
    ...(gateResult?.requiredEvidenceIds ?? []),
    ...(inboxItem?.requiredEvidenceIds ?? []),
    ...(response?.requiredEvidenceIds ?? []),
    ...(displayModel?.requirementList.requiredEvidenceIds ?? []),
  ]);
  const missingEvidenceIds = dedupe([
    ...(gateResult?.missingEvidenceIds ?? []),
    ...(inboxItem?.missingEvidenceIds ?? []),
    ...(response?.missingEvidenceIds ?? []),
    ...(displayModel?.requirementList.missingEvidenceIds ?? []),
  ]);
  const requiredApprovalIds = dedupe([
    ...(gateResult?.requiredApprovalIds ?? []),
    ...(inboxItem?.requiredApprovalIds ?? []),
    ...(response?.requiredApprovalIds ?? []),
    ...(displayModel?.requirementList.requiredApprovalIds ?? []),
  ]);
  const missingApprovalIds = dedupe([
    ...(gateResult?.missingApprovalIds ?? []),
    ...(inboxItem?.missingApprovalIds ?? []),
    ...(response?.missingApprovalIds ?? []),
    ...(displayModel?.requirementList.missingApprovalIds ?? []),
  ]);

  const reasonCodes = dedupe([
    ...(gateResult?.reasonCodes ?? []),
    ...(gateResult?.decisionReasonCodes ?? []),
    ...(inboxItem?.reasonCodes ?? []),
    ...(response?.reasonCodes ?? []),
  ]);

  const warnings = dedupe([...(gateResult?.warnings ?? []), ...(inboxItem?.warnings ?? []), ...(response?.warnings ?? []), ...(displayModel?.warnings ?? [])]);
  const errors = dedupe([...(gateResult?.errors ?? []), ...(inboxItem?.errors ?? []), ...(response?.errors ?? []), ...(displayModel?.errors ?? [])]);
  const safeLabels = dedupe([
    ...(gateResult?.safeLabels ?? []),
    ...(inboxItem?.safeLabels ?? []),
    ...(response?.safeLabels ?? []),
    ...(displayModel?.safeLabels ?? []),
  ]);

  return {
    requestId: firstDefined(gateResult?.requestId, inboxItem?.requestId, response?.requestId),
    responseId: firstDefined(gateResult?.responseId, inboxItem?.responseId, response?.responseId),
    gateResultId: firstDefined(gateResult?.gateResultId, displayModel?.resultId),
    inboxItemId: firstDefined(gateResult?.inboxItemId, inboxItem?.inboxItemId),
    displayModelId: displayModel?.displayModelId,
    clientId: firstDefined(gateResult?.clientId, inboxItem?.clientId, response?.clientId),

    projectId: firstDefined(gateResult?.projectId, inboxItem?.projectId),
    workspaceId: firstDefined(gateResult?.workspaceId, inboxItem?.workspaceId),
    tenantId: firstDefined(gateResult?.tenantId, inboxItem?.tenantId),
    customerId: firstDefined(gateResult?.customerId, inboxItem?.customerId),

    agentId: firstDefined(gateResult?.agentId, inboxItem?.agentId),
    agentRole: firstDefined(gateResult?.agentRole, inboxItem?.agentRole),
    actionId: firstDefined(gateResult?.actionId, inboxItem?.actionId),
    actionCategory: firstDefined(gateResult?.actionCategory, inboxItem?.actionCategory),
    actionTitle: firstDefined(gateResult?.actionTitle, inboxItem?.actionTitle),

    verdict: firstDefined(gateResult?.verdict, displayModel?.verdict),
    decision: firstDefined(gateResult?.aocDecision, inboxItem?.decision, response?.decision),

    requiredEvidenceIds,
    missingEvidenceIds,
    requiredApprovalIds,
    missingApprovalIds,

    reasonCodes,
    warnings,
    errors,
    safeLabels,
  };
}
