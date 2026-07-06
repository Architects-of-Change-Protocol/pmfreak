import type {
  Actor,
  ActionRequest,
  Passport,
  RecognitionCapabilityToken,
  RecognitionOutcome,
  RecognitionRequirementRule,
  PolicyEvaluationResult,
  TrustDomain,
} from "../domain";

// Everything a policy might need, pre-resolved by RecognitionVerifier before
// evaluation starts. Policies never look anything up themselves — they only
// reason over what has already been resolved, which is what keeps
// evaluation deterministic and total (never throws).
export type PolicyContext = {
  actionRequest: ActionRequest;
  now: string;

  trustDomain: TrustDomain | undefined;
  actor: Actor | undefined;
  passport: Passport | undefined;
  capabilityToken: RecognitionCapabilityToken | undefined;
  requirementRule: RecognitionRequirementRule | undefined;
};

export type PolicyOutcome = {
  result: PolicyEvaluationResult;
  // Present only when the policy fails and verification must stop here.
  outcome?: RecognitionOutcome;
};

export type RecognitionPolicy = (ctx: PolicyContext) => PolicyOutcome;

export const pass = (policyName: string, reasonCode: string, reason: string): PolicyOutcome => ({
  result: { policyName, passed: true, reasonCode, reason },
});

export const fail = (
  policyName: string,
  outcome: RecognitionOutcome,
  reasonCode: string,
  reason: string
): PolicyOutcome => ({
  result: { policyName, passed: false, reasonCode, reason },
  outcome,
});
