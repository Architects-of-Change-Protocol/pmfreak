import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "capability_validity";

export const capabilityValidityPolicy: RecognitionPolicy = (ctx) => {
  if (!ctx.actionRequest.capabilityTokenId) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "CAPABILITY_TOKEN_REQUIRED",
      "ActionRequest does not reference a recognition capability token"
    );
  }

  const token = ctx.capabilityToken;
  if (!token) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "CAPABILITY_TOKEN_NOT_FOUND",
      `No capability token found for id: ${ctx.actionRequest.capabilityTokenId}`
    );
  }

  if (token.actorId !== ctx.actionRequest.actorId) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "CAPABILITY_TOKEN_ACTOR_MISMATCH",
      `Capability token ${token.id} does not belong to actor ${ctx.actionRequest.actorId}`
    );
  }

  if (ctx.actionRequest.passportId && token.passportId !== ctx.actionRequest.passportId) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "CAPABILITY_TOKEN_PASSPORT_MISMATCH",
      `Capability token ${token.id} was not issued against passport ${ctx.actionRequest.passportId}`
    );
  }

  if (token.status === "revoked") {
    return fail(POLICY_NAME, "deny_revoked", "CAPABILITY_TOKEN_REVOKED", `Capability token ${token.id} has been revoked`);
  }

  if (token.expiresAt !== undefined && token.expiresAt <= ctx.now) {
    return fail(POLICY_NAME, "deny_expired", "CAPABILITY_TOKEN_EXPIRED", `Capability token ${token.id} expired at ${token.expiresAt}`);
  }

  return pass(POLICY_NAME, "CAPABILITY_TOKEN_VALID", "Capability token is active and unexpired");
};
