import { evaluatePolicyDecision } from "@/lib/security/policy-engine";
import { getAuthUser } from "@/lib/auth";
import { ensurePmfreakAocAdaptersRegistered } from "@/lib/aoc/bootstrap";
import type { GovernanceActorContext } from "@/lib/governance/authority/actor-model";

// This is a non-authoritative policy simulator (decisionSource:
// "policy-simulation", authoritative: false — see productionAuthority
// below), so a signed-in caller may simulate the decision as an arbitrary
// actor. But authentication itself is never skippable: previously, supplying
// a client-shaped body.actor with actorType !== "user" bypassed
// getAuthUser() entirely, letting a fully anonymous caller reach
// evaluatePolicyDecision (which — for a non-"user" actorType — also skips
// its own membership check). requireAuthUser-equivalent auth now always
// runs first, regardless of what body.actor claims.
export async function POST(request: Request) {
  ensurePmfreakAocAdaptersRegistered();
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const actor: GovernanceActorContext =
    body.actor && body.actor.actorId && body.actor.actorType
      ? (body.actor as GovernanceActorContext)
      : { actorId: user.id, actorType: "user", workspaceId: body.workspaceId };

  const result = await evaluatePolicyDecision({ ...body, actor });
  return Response.json({
    ...result,
    decisionSource: "policy-simulation",
    authoritative: false,
    productionAuthority: "enterprise-runtime",
  });
}
