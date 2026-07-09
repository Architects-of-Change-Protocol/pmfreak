// All identifiers below are fake and demo-only: no real customer names,
// Datasys project IDs, emails, contract numbers, invoice numbers, secrets
// or tokens.

import {
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
} from "./pmfreak-aoc-fixtures";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import { createPMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-builder";
import type {
  PMFreakAocRemoteAocGovernanceResponse,
  PMFreakAocRemoteEndpointErrorBody,
  PMFreakAocRemoteEndpointSuccessBody,
  PMFreakAocRemoteGovernanceResponseTraceStep,
} from "./pmfreak-aoc-remote-governance-endpoint-types";
import {
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS,
} from "./pmfreak-aoc-remote-governance-transport-constants";

const DEMO_AOC_REMOTE_GOVERNANCE_ENDPOINT_ID = "aoc.integration.pmfreak.remote_governance_endpoint.v1";

function buildDemoEndpointSuccessBody(input: {
  request: PMFreakAocGovernanceRequest;
  decision: PMFreakAocRemoteAocGovernanceResponse["decision"];
  decisionLabel: string;
  decisionSeverity: PMFreakAocRemoteAocGovernanceResponse["decisionSeverity"];
  reasonCodes: string[];
  safeSummary: string;
  requiredEvidenceIds?: string[];
  requiredApprovalIds?: string[];
  missingEvidenceIds?: string[];
  missingApprovalIds?: string[];
  trace: PMFreakAocRemoteGovernanceResponseTraceStep[];
}): PMFreakAocRemoteEndpointSuccessBody {
  const response: PMFreakAocRemoteAocGovernanceResponse = {
    responseId: `demo.aoc.response.${input.decision}.v1`,
    requestId: input.request.requestId,
    clientId: input.request.clientId,
    providerId: "aoc",
    evaluatedFor: "pmfreak",
    decision: input.decision,
    decisionLabel: input.decisionLabel,
    decisionSeverity: input.decisionSeverity,
    reasonCodes: input.reasonCodes,
    safeSummary: input.safeSummary,
    requiredEvidenceIds: input.requiredEvidenceIds ?? [],
    requiredApprovalIds: input.requiredApprovalIds ?? [],
    missingEvidenceIds: input.missingEvidenceIds ?? [],
    missingApprovalIds: input.missingApprovalIds ?? [],
    trace: input.trace,
    policyPackIds: [],
    jurisdictionPackIds: [],
    safeLabels: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS],
    warnings: [],
    errors: [],
  };

  return {
    ok: true,
    endpointId: DEMO_AOC_REMOTE_GOVERNANCE_ENDPOINT_ID,
    response,
    safeLabels: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS],
    warnings: [],
  };
}

export function demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody(): PMFreakAocRemoteEndpointSuccessBody {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  return buildDemoEndpointSuccessBody({
    request,
    decision: "require_evidence",
    decisionLabel: "Evidence required",
    decisionSeverity: "warning",
    reasonCodes: ["billing_missing_evidence"],
    safeSummary: "AOC governance evaluated the billing readiness action and found missing evidence references.",
    requiredEvidenceIds: [...request.evidenceContext.evidenceReferenceIds],
    missingEvidenceIds: [...request.evidenceContext.missingEvidenceIds],
    trace: [
      {
        stepId: "billing_evidence_check",
        label: "Billing-sensitive evidence check",
        status: "blocked",
        summary: `Billing action is missing evidence reference(s): ${request.evidenceContext.missingEvidenceIds.join(", ")}.`,
      },
    ],
  });
}

export function demoPMFreakAocRemoteTransportBillingMissingApprovalEndpointBody(): PMFreakAocRemoteEndpointSuccessBody {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  return buildDemoEndpointSuccessBody({
    request,
    decision: "require_billing_review",
    decisionLabel: "Billing review required",
    decisionSeverity: "warning",
    reasonCodes: ["billing_missing_billing_review"],
    safeSummary: "AOC governance evaluated the billing readiness action and found a missing billing review approval.",
    requiredApprovalIds: [...request.approvalContext.approvalReferenceIds],
    missingApprovalIds: [...request.approvalContext.missingApprovalIds],
    trace: [
      {
        stepId: "billing_review_check",
        label: "Billing review approval check",
        status: "blocked",
        summary: "Billing action is missing a billing_review approval.",
      },
    ],
  });
}

export function demoPMFreakAocRemoteTransportBillingAllowedEndpointBody(): PMFreakAocRemoteEndpointSuccessBody {
  const request = demoPMFreakAocBillingAllowedRequest();
  return buildDemoEndpointSuccessBody({
    request,
    decision: "allow",
    decisionLabel: "Allowed",
    decisionSeverity: "success",
    reasonCodes: ["no_blocking_conditions"],
    safeSummary: "AOC governance evaluated the billing readiness action and found no blocking conditions.",
    requiredEvidenceIds: [...request.evidenceContext.evidenceReferenceIds],
    requiredApprovalIds: [...request.approvalContext.approvalReferenceIds],
    trace: [
      {
        stepId: "final_decision",
        label: "Final decision",
        status: "passed",
        summary: "No blocking conditions found: request context is allowed.",
      },
    ],
  });
}

export function demoPMFreakAocRemoteTransportCancelledEndpointBody(): PMFreakAocRemoteEndpointSuccessBody {
  const cancelledAttempt = { ...demoPMFreakAocBillingReadinessActionAttempt(), status: "cancelled" as const };
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: cancelledAttempt });
  return buildDemoEndpointSuccessBody({
    request,
    decision: "deny",
    decisionLabel: "Denied",
    decisionSeverity: "danger",
    reasonCodes: ["cancelled_action_attempt"],
    safeSummary: "AOC governance evaluated the billing readiness action and denied it because the action attempt was cancelled.",
    trace: [
      {
        stepId: "action_attempt_status",
        label: "Action attempt status",
        status: "blocked",
        summary: "Action attempt has been cancelled.",
      },
    ],
  });
}

export function demoPMFreakAocRemoteTransportEndpointErrorBody(): PMFreakAocRemoteEndpointErrorBody {
  return {
    ok: false,
    endpointId: DEMO_AOC_REMOTE_GOVERNANCE_ENDPOINT_ID,
    error: {
      code: "governance_evaluation_failed",
      message: "AOC governance endpoint failed to evaluate the request.",
      safe: true,
    },
    safeLabels: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS],
    warnings: [],
  };
}

export function demoPMFreakAocRemoteTransportMalformedBody(): string {
  return "{not-valid-json";
}

export type PMFreakAocRemoteGovernanceFetchMock = typeof fetch;

export function createSuccessfulAocRemoteGovernanceFetchMock(
  body: PMFreakAocRemoteEndpointSuccessBody,
  init?: { status?: number },
): PMFreakAocRemoteGovernanceFetchMock {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
}

export function createEndpointErrorAocRemoteGovernanceFetchMock(
  body: PMFreakAocRemoteEndpointErrorBody,
  init?: { status?: number },
): PMFreakAocRemoteGovernanceFetchMock {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 400,
      headers: { "content-type": "application/json" },
    });
}

export function createNetworkFailureAocRemoteGovernanceFetchMock(message = "AOC remote governance network request failed."): PMFreakAocRemoteGovernanceFetchMock {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    throw new TypeError(message);
  };
}

export function createMalformedAocRemoteGovernanceFetchMock(): PMFreakAocRemoteGovernanceFetchMock {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    new Response(demoPMFreakAocRemoteTransportMalformedBody(), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

export function createTimeoutAocRemoteGovernanceFetchMock(): PMFreakAocRemoteGovernanceFetchMock {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const error = new Error("AOC remote governance request timed out.");
    error.name = "TimeoutError";
    throw error;
  };
}
