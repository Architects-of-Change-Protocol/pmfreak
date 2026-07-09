import { PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS, PMFREAK_AOC_GOVERNANCE_SAFE_LABELS } from "./pmfreak-aoc-governance-client-constants";
import { buildPMFreakAocGovernanceResponseId } from "./pmfreak-aoc-local-governance-transport";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernanceTransport } from "./pmfreak-aoc-transport";

// No stable AOC remote API contract exists in this repository yet. This
// transport intentionally performs no HTTP request or other network I/O and
// handles no credentials or secrets. It always resolves to a safe `hold`
// response labeled `unsupported_remote` — it never fakes a remote AOC API.
export function createUnsupportedRemotePMFreakAocGovernanceTransport(): PMFreakAocGovernanceTransport {
  return {
    transportKind: "unsupported_remote",
    async evaluateGovernanceRequest(request): Promise<PMFreakAocGovernanceResponse> {
      return {
        responseId: buildPMFreakAocGovernanceResponseId(request.requestId),
        requestId: request.requestId,
        clientId: request.clientId,
        providerId: "pmfreak",
        evaluatedBy: "unsupported_remote",
        decision: "hold",
        decisionLabel: "On hold",
        decisionSeverity: "warning",
        reasonCodes: ["unsupported_remote_transport"],
        safeSummary:
          "No stable AOC remote governance transport exists yet in this repository. This request is held pending a future PMFreak AOC Remote Governance Transport implementation.",
        requiredEvidenceIds: [...request.evidenceContext.evidenceReferenceIds],
        requiredApprovalIds: [...request.approvalContext.approvalReferenceIds],
        missingEvidenceIds: [...request.evidenceContext.missingEvidenceIds],
        missingApprovalIds: [...request.approvalContext.missingApprovalIds],
        trace: [
          {
            stepId: "unsupported_remote_transport",
            label: "Remote transport availability",
            status: "blocked",
            summary: "No stable AOC remote API contract exists in this repository; no network call was attempted.",
          },
        ],
        policyPackIds: [...(request.policyContext?.requestedPolicyPackIds ?? [])],
        jurisdictionPackIds: [...(request.policyContext?.requestedJurisdictionPackIds ?? [])],
        safeLabels: [...PMFREAK_AOC_GOVERNANCE_SAFE_LABELS],
        disclaimers: ["This transport does not call a network and is not a production AOC connection.", ...PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS],
        warnings: [...request.warnings],
        errors: ["unsupported_remote_transport"],
      };
    },
  };
}
