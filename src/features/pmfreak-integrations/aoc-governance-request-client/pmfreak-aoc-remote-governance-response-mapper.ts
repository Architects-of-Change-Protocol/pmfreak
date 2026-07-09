import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { buildPMFreakAocGovernanceResponseId } from "./pmfreak-aoc-local-governance-transport";
import type { PMFreakAocRemoteAocGovernanceResponse } from "./pmfreak-aoc-remote-governance-endpoint-types";
import {
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS,
} from "./pmfreak-aoc-remote-governance-transport-constants";

// Pure, deterministic mapping from the AOC endpoint's response shape into
// PMFreak's existing `PMFreakAocGovernanceResponse` public shape. Does not
// mutate either input.
export function mapAocEndpointResponseToPMFreakAocGovernanceResponse(input: {
  request: PMFreakAocGovernanceRequest;
  endpointResponse: PMFreakAocRemoteAocGovernanceResponse;
}): PMFreakAocGovernanceResponse {
  const { request, endpointResponse } = input;

  return {
    responseId: buildPMFreakAocGovernanceResponseId(request.requestId),
    requestId: endpointResponse.requestId,
    clientId: request.clientId,

    providerId: "pmfreak",
    evaluatedBy: "aoc",

    decision: endpointResponse.decision,
    decisionLabel: endpointResponse.decisionLabel,
    decisionSeverity: endpointResponse.decisionSeverity,

    reasonCodes: [...endpointResponse.reasonCodes],
    safeSummary: endpointResponse.safeSummary,

    requiredEvidenceIds: [...endpointResponse.requiredEvidenceIds],
    requiredApprovalIds: [...endpointResponse.requiredApprovalIds],

    missingEvidenceIds: [...endpointResponse.missingEvidenceIds],
    missingApprovalIds: [...endpointResponse.missingApprovalIds],

    trace: endpointResponse.trace.map((step) => ({ ...step })),

    policyPackIds: [...endpointResponse.policyPackIds],
    jurisdictionPackIds: [...endpointResponse.jurisdictionPackIds],

    safeLabels: Array.from(new Set([...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS, ...endpointResponse.safeLabels])),
    disclaimers: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS, ...endpointResponse.disclaimers],
    warnings: [...endpointResponse.warnings],
    errors: [...endpointResponse.errors],
  };
}
