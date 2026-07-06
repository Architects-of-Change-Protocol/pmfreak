import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "actor_recognition";

// Fails only when the actor has never been registered anywhere. An actor
// registered under a *different* trust domain than the one it's acting
// against is a rogue-actor case, not an unrecognized one — see
// rogue-actor-policy.
export const actorRecognitionPolicy: RecognitionPolicy = (ctx) => {
  if (!ctx.actor) {
    return fail(
      POLICY_NAME,
      "deny_unrecognized_actor",
      "ACTOR_UNKNOWN",
      `Actor is not registered: ${ctx.actionRequest.actorId}`
    );
  }

  if (ctx.actor.status === "revoked" || ctx.actor.status === "suspended") {
    return fail(
      POLICY_NAME,
      "deny_revoked",
      ctx.actor.status === "revoked" ? "ACTOR_REVOKED" : "ACTOR_SUSPENDED",
      `Actor ${ctx.actor.id} is ${ctx.actor.status}`
    );
  }

  return pass(POLICY_NAME, "ACTOR_RECOGNIZED", "Actor is registered and active");
};
