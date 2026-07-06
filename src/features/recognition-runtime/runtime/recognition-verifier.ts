import type { ActionRequest, RecognitionDecision, RecognitionOutcome, PolicyEvaluationResult, RecognitionRuntimeContext } from "../domain";
import type { TrustDomainService, ActorRegistryService, PassportService, CapabilityTokenService, RequirementRuleService, AuditLedger } from "../services";
import { RECOGNITION_POLICY_ORDER, type PolicyContext } from "../policies";

export type RecognitionVerifierDeps = {
  context: RecognitionRuntimeContext;
  trustDomains: TrustDomainService;
  actorRegistry: ActorRegistryService;
  passports: PassportService;
  capabilityTokens: CapabilityTokenService;
  requirementRules: RequirementRuleService;
  auditLedger: AuditLedger;
};

export type RecognitionVerifier = {
  verify(actionRequest: ActionRequest): RecognitionDecision;
};

export function createRecognitionVerifier(deps: RecognitionVerifierDeps): RecognitionVerifier {
  const { context, trustDomains, actorRegistry, passports, capabilityTokens, requirementRules, auditLedger } = deps;

  return {
    verify(actionRequest) {
      const now = context.clock.now();

      const ctx: PolicyContext = {
        actionRequest,
        now,
        trustDomain: trustDomains.getTrustDomain(actionRequest.trustDomainId),
        actor: actorRegistry.getActor(actionRequest.actorId),
        passport: actionRequest.passportId ? passports.getPassport(actionRequest.passportId) : undefined,
        capabilityToken: actionRequest.capabilityTokenId
          ? capabilityTokens.getCapabilityToken(actionRequest.capabilityTokenId)
          : undefined,
        requirementRule: requirementRules.matchRule(actionRequest.trustDomainId, actionRequest.action, actionRequest.resourceScope),
      };

      const evaluatedPolicies: PolicyEvaluationResult[] = [];
      let outcome: RecognitionOutcome = "allow";
      let reasonCode = "ALLOWED";
      let reason = "All recognition policies passed";

      for (const policy of RECOGNITION_POLICY_ORDER) {
        const policyOutcome = policy(ctx);
        evaluatedPolicies.push(policyOutcome.result);
        if (policyOutcome.outcome) {
          outcome = policyOutcome.outcome;
          reasonCode = policyOutcome.result.reasonCode;
          reason = policyOutcome.result.reason;
          break;
        }
      }

      const decision: RecognitionDecision = {
        id: context.ids.nextId("recognition-decision"),
        actionRequestId: actionRequest.id,
        trustDomainId: actionRequest.trustDomainId,
        actorId: actionRequest.actorId,
        outcome,
        reasonCode,
        reason,
        evaluatedPolicies,
        decidedAt: now,
      };

      auditLedger.recordEvent({
        type: "action_request_verified",
        trustDomainId: actionRequest.trustDomainId,
        actorId: actionRequest.actorId,
        actionRequestId: actionRequest.id,
        recognitionDecisionId: decision.id,
        payload: {
          outcome,
          reasonCode,
          action: actionRequest.action,
          resourceScope: actionRequest.resourceScope,
        },
      });

      return decision;
    },
  };
}
