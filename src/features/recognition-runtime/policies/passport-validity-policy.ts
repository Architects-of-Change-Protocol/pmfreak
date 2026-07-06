import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "passport_validity";

export const passportValidityPolicy: RecognitionPolicy = (ctx) => {
  if (!ctx.actionRequest.passportId) {
    return fail(POLICY_NAME, "policy_violation", "PASSPORT_REQUIRED", "ActionRequest does not reference a passport");
  }

  const passport = ctx.passport;
  if (!passport) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "PASSPORT_NOT_FOUND",
      `No passport found for id: ${ctx.actionRequest.passportId}`
    );
  }

  if (passport.actorId !== ctx.actionRequest.actorId) {
    return fail(
      POLICY_NAME,
      "policy_violation",
      "PASSPORT_ACTOR_MISMATCH",
      `Passport ${passport.id} does not belong to actor ${ctx.actionRequest.actorId}`
    );
  }

  if (passport.status === "revoked" || passport.status === "suspended") {
    return fail(
      POLICY_NAME,
      "deny_revoked",
      passport.status === "revoked" ? "PASSPORT_REVOKED" : "PASSPORT_SUSPENDED",
      `Passport ${passport.id} is ${passport.status}`
    );
  }

  if (passport.expiresAt !== undefined && passport.expiresAt <= ctx.now) {
    return fail(POLICY_NAME, "deny_expired", "PASSPORT_EXPIRED", `Passport ${passport.id} expired at ${passport.expiresAt}`);
  }

  return pass(POLICY_NAME, "PASSPORT_VALID", "Passport is active and unexpired");
};
