import { matchesPattern } from "../services/pattern-matching";
import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "capability_scope";

export const capabilityScopePolicy: RecognitionPolicy = (ctx) => {
  const token = ctx.capabilityToken;
  if (!token) return pass(POLICY_NAME, "SCOPE_CHECK_SKIPPED", "Capability validity already failed");

  if (!matchesPattern(token.capability, ctx.actionRequest.action)) {
    return fail(
      POLICY_NAME,
      "deny_out_of_scope",
      "CAPABILITY_ACTION_MISMATCH",
      `Capability token ${token.id} grants "${token.capability}", not "${ctx.actionRequest.action}"`
    );
  }

  if (!matchesPattern(token.resourceScope, ctx.actionRequest.resourceScope)) {
    return fail(
      POLICY_NAME,
      "deny_out_of_scope",
      "RESOURCE_SCOPE_MISMATCH",
      `Capability token ${token.id} is scoped to "${token.resourceScope}", not "${ctx.actionRequest.resourceScope}"`
    );
  }

  return pass(POLICY_NAME, "SCOPE_VALID", "Capability token covers the requested action and resource scope");
};
