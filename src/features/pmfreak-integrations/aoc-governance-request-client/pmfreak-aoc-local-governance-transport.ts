import { PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS, PMFREAK_AOC_GOVERNANCE_SAFE_LABELS } from "./pmfreak-aoc-governance-client-constants";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type {
  PMFreakAocGovernanceDecision,
  PMFreakAocGovernanceDecisionSeverity,
  PMFreakAocGovernanceResponse,
  PMFreakAocGovernanceResponseTraceStep,
} from "./pmfreak-aoc-governance-response";
import { validatePMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-validator";
import type { PMFreakAocGovernanceTransport } from "./pmfreak-aoc-transport";

const DECISION_LABELS: Record<PMFreakAocGovernanceDecision, string> = {
  allow: "Allowed",
  deny: "Denied",
  hold: "On hold",
  require_evidence: "Evidence required",
  require_pm_approval: "PM approval required",
  require_customer_validation: "Customer validation required",
  require_billing_review: "Billing review required",
  require_contract_review: "Contract review required",
  require_security_review: "Security review required",
  require_executive_approval: "Executive approval required",
};

const DECISION_SEVERITY: Record<PMFreakAocGovernanceDecision, PMFreakAocGovernanceDecisionSeverity> = {
  allow: "success",
  deny: "danger",
  hold: "warning",
  require_evidence: "warning",
  require_pm_approval: "warning",
  require_customer_validation: "warning",
  require_billing_review: "warning",
  require_contract_review: "warning",
  require_security_review: "warning",
  require_executive_approval: "warning",
};

function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPMFreakAocGovernanceResponseId(requestId: string): string {
  return `pmfreak.aoc.response.${toSafeIdSegment(requestId)}.v1`;
}

function hasMissingApproval(missingApprovalIds: string[], kind: string): boolean {
  return missingApprovalIds.some((id) => id.toLowerCase().includes(kind));
}

export type PMFreakAocLocalMockGovernanceTransportOptions = {
  forcedDecision?: PMFreakAocGovernanceDecision;
  responseMap?: Record<string, Partial<PMFreakAocGovernanceResponse>>;
};

// Deterministic decision rules, evaluated in order (most specific first):
//  1. Invalid request                                  -> deny
//  2. Cancelled action attempt                          -> deny
//  3. Billing action + missing evidence                 -> require_evidence
//  4. Billing action + missing billing_review approval   -> require_billing_review
//  5. Missing evidence                                  -> require_evidence
//  6. Missing pm_approval approval                       -> require_pm_approval
//  7. Missing customer_validation approval                -> require_customer_validation
//  8. Missing contract_review approval                    -> require_contract_review
//  9. Missing security_review approval                    -> require_security_review
// 10. Missing executive_approval approval                 -> require_executive_approval
// 11. Otherwise                                          -> allow
function computeDecision(request: PMFreakAocGovernanceRequest): { decision: PMFreakAocGovernanceDecision; reasonCodes: string[]; trace: PMFreakAocGovernanceResponseTraceStep[] } {
  const trace: PMFreakAocGovernanceResponseTraceStep[] = [];
  const validation = validatePMFreakAocGovernanceRequest(request);

  trace.push({
    stepId: "request_validity",
    label: "Request validity",
    status: validation.valid ? "passed" : "blocked",
    summary: validation.valid ? "Request passed structural validation." : `Request failed validation: ${validation.errors.join("; ")}`,
  });

  if (!validation.valid) {
    return { decision: "deny", reasonCodes: ["invalid_request"], trace };
  }

  const isCancelled = request.actionAttempt.status === "cancelled";
  trace.push({
    stepId: "action_attempt_status",
    label: "Action attempt status",
    status: isCancelled ? "blocked" : "passed",
    summary: isCancelled ? "Action attempt has been cancelled." : `Action attempt status is "${request.actionAttempt.status}".`,
  });
  if (isCancelled) {
    return { decision: "deny", reasonCodes: ["cancelled_action_attempt"], trace };
  }

  const isBilling = request.actionContext.actionCategory === "billing";
  const missingEvidenceIds = request.evidenceContext.missingEvidenceIds;
  const missingApprovalIds = request.approvalContext.missingApprovalIds;

  const missingBillingReview = hasMissingApproval(missingApprovalIds, "billing_review");

  trace.push({
    stepId: "billing_evidence_check",
    label: "Billing-sensitive evidence check",
    status: isBilling && missingEvidenceIds.length > 0 ? "blocked" : "not_applicable",
    summary:
      isBilling && missingEvidenceIds.length > 0
        ? `Billing action is missing evidence reference(s): ${missingEvidenceIds.join(", ")}.`
        : "No billing-sensitive missing-evidence condition applies.",
  });
  if (isBilling && missingEvidenceIds.length > 0) {
    return { decision: "require_evidence", reasonCodes: ["billing_missing_evidence"], trace };
  }

  trace.push({
    stepId: "billing_review_check",
    label: "Billing review approval check",
    status: isBilling && missingBillingReview ? "blocked" : "not_applicable",
    summary: isBilling && missingBillingReview ? "Billing action is missing a billing_review approval." : "No billing-review condition applies.",
  });
  if (isBilling && missingBillingReview) {
    return { decision: "require_billing_review", reasonCodes: ["billing_missing_billing_review"], trace };
  }

  trace.push({
    stepId: "evidence_check",
    label: "Evidence completeness check",
    status: missingEvidenceIds.length > 0 ? "blocked" : "passed",
    summary:
      missingEvidenceIds.length > 0
        ? `Missing evidence reference(s): ${missingEvidenceIds.join(", ")}.`
        : "All referenced evidence is present.",
  });
  if (missingEvidenceIds.length > 0) {
    return { decision: "require_evidence", reasonCodes: ["missing_evidence"], trace };
  }

  const approvalRules: Array<{ kind: string; decision: PMFreakAocGovernanceDecision; reasonCode: string }> = [
    { kind: "pm_approval", decision: "require_pm_approval", reasonCode: "missing_pm_approval" },
    { kind: "customer_validation", decision: "require_customer_validation", reasonCode: "missing_customer_validation" },
    { kind: "contract_review", decision: "require_contract_review", reasonCode: "missing_contract_review" },
    { kind: "security_review", decision: "require_security_review", reasonCode: "missing_security_review" },
    { kind: "executive_approval", decision: "require_executive_approval", reasonCode: "missing_executive_approval" },
  ];

  for (const rule of approvalRules) {
    const missing = hasMissingApproval(missingApprovalIds, rule.kind);
    trace.push({
      stepId: `approval_check_${rule.kind}`,
      label: `Approval check: ${rule.kind}`,
      status: missing ? "blocked" : "not_applicable",
      summary: missing ? `Missing ${rule.kind} approval.` : `No missing ${rule.kind} approval condition applies.`,
    });
    if (missing) {
      return { decision: rule.decision, reasonCodes: [rule.reasonCode], trace };
    }
  }

  trace.push({
    stepId: "final_decision",
    label: "Final decision",
    status: "passed",
    summary: "No blocking conditions found: request context is allowed.",
  });

  return { decision: "allow", reasonCodes: ["no_blocking_conditions"], trace };
}

function buildSafeSummary(decision: PMFreakAocGovernanceDecision, request: PMFreakAocGovernanceRequest): string {
  const actionTitle = request.actionContext.actionTitle;
  switch (decision) {
    case "allow":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found no blocking conditions in this request context.`;
    case "deny":
      return `AOC governance (local mock) evaluated "${actionTitle}" and this request context is denied.`;
    case "hold":
      return `AOC governance (local mock) evaluated "${actionTitle}" and placed this request context on hold.`;
    case "require_evidence":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found missing evidence references.`;
    case "require_billing_review":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing billing review approval.`;
    case "require_pm_approval":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing PM approval.`;
    case "require_customer_validation":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing customer validation approval.`;
    case "require_contract_review":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing contract review approval.`;
    case "require_security_review":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing security review approval.`;
    case "require_executive_approval":
      return `AOC governance (local mock) evaluated "${actionTitle}" and found a missing executive approval.`;
    default:
      return `AOC governance (local mock) evaluated "${actionTitle}".`;
  }
}

// Explicitly labeled `local_mock_aoc` — this is a deterministic PMFreak-side
// stand-in for AOC Governance, not production AOC.
export function createLocalMockPMFreakAocGovernanceTransport(
  options?: PMFreakAocLocalMockGovernanceTransportOptions,
): PMFreakAocGovernanceTransport {
  return {
    transportKind: "local_mock",
    async evaluateGovernanceRequest(request: PMFreakAocGovernanceRequest): Promise<PMFreakAocGovernanceResponse> {
      const { decision: computedDecision, reasonCodes, trace } = computeDecision(request);
      const decision = options?.forcedDecision ?? computedDecision;

      const responseId = buildPMFreakAocGovernanceResponseId(request.requestId);

      const response: PMFreakAocGovernanceResponse = {
        responseId,
        requestId: request.requestId,
        clientId: request.clientId,
        providerId: "pmfreak",
        evaluatedBy: "local_mock_aoc",
        decision,
        decisionLabel: DECISION_LABELS[decision],
        decisionSeverity: DECISION_SEVERITY[decision],
        reasonCodes,
        safeSummary: buildSafeSummary(decision, request),
        requiredEvidenceIds: [...request.evidenceContext.evidenceReferenceIds],
        requiredApprovalIds: [...request.approvalContext.approvalReferenceIds],
        missingEvidenceIds: [...request.evidenceContext.missingEvidenceIds],
        missingApprovalIds: [...request.approvalContext.missingApprovalIds],
        trace,
        policyPackIds: [...(request.policyContext?.requestedPolicyPackIds ?? [])],
        jurisdictionPackIds: [...(request.policyContext?.requestedJurisdictionPackIds ?? [])],
        safeLabels: [...PMFREAK_AOC_GOVERNANCE_SAFE_LABELS],
        disclaimers: ["This decision was produced by a deterministic local/mock AOC governance transport, not production AOC.", ...PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS],
        warnings: [...request.warnings],
        errors: [...request.errors],
      };

      const override = options?.responseMap?.[request.requestId];
      return override ? { ...response, ...override } : response;
    },
  };
}
