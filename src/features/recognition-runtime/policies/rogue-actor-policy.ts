import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "rogue_actor";

// A "rogue" actor is a known registry entry that is impersonating this
// trust domain: it is registered elsewhere, explicitly flagged as rogue, or
// its passport has been revoked. Unknown-entirely actors are handled by
// actor-recognition-policy instead.
export const rogueActorPolicy: RecognitionPolicy = (ctx) => {
  const actor = ctx.actor;
  if (!actor) return pass(POLICY_NAME, "ROGUE_CHECK_SKIPPED", "Actor recognition already failed");

  if (actor.metadata?.rogue === true) {
    return fail(POLICY_NAME, "deny_rogue_actor", "ACTOR_FLAGGED_ROGUE", `Actor is flagged as rogue: ${actor.id}`);
  }

  if (actor.trustDomainId !== ctx.actionRequest.trustDomainId) {
    return fail(
      POLICY_NAME,
      "deny_rogue_actor",
      "ACTOR_TRUST_DOMAIN_MISMATCH",
      `Actor ${actor.id} belongs to trust domain ${actor.trustDomainId}, not ${ctx.actionRequest.trustDomainId}`
    );
  }

  return pass(POLICY_NAME, "ACTOR_NOT_ROGUE", "Actor is not rogue");
};
