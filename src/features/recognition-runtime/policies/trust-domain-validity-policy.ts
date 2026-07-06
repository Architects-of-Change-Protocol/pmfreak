import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "trust_domain_validity";

export const trustDomainValidityPolicy: RecognitionPolicy = (ctx) => {
  if (!ctx.trustDomain) {
    return fail(POLICY_NAME, "policy_violation", "TRUST_DOMAIN_UNKNOWN", `Unknown trust domain: ${ctx.actionRequest.trustDomainId}`);
  }
  if (ctx.trustDomain.status !== "active") {
    return fail(POLICY_NAME, "policy_violation", "TRUST_DOMAIN_SUSPENDED", `Trust domain is suspended: ${ctx.trustDomain.id}`);
  }
  return pass(POLICY_NAME, "TRUST_DOMAIN_VALID", "Trust domain exists and is active");
};
