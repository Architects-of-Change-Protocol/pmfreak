import { getAuthUser } from "@/lib/auth";
import { getCompanySubscription } from "@/lib/billing";
import { denyResponse } from "@/lib/security/deny-response";
import { requireBillingManageMembership, WorkspaceMembershipError } from "@/lib/workspace-access";
import { getStripeServerClient } from "@/lib/stripe";

const ROUTE_ID = "/api/billing/create-portal-session";

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
  }

  const workspaceId = request.headers.get("x-pmf-workspace-id");
  if (!workspaceId) {
    return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", eventType: "billing_governance_denied", actorUserId: user.id });
  }

  // See docs/security/billing-authorization-boundary.md — billing.manage is
  // resolved exclusively from server-side workspace membership.
  try {
    await requireBillingManageMembership({ userId: user.id, workspaceId });
  } catch (error) {
    const reason = error instanceof WorkspaceMembershipError ? error.reason : "workspace_missing";
    return denyResponse({
      status: 403,
      routeId: ROUTE_ID,
      message: "You do not have permission to manage billing for this workspace.",
      reason,
      eventType: "billing_governance_denied",
      actorUserId: user.id,
      workspaceId,
    });
  }

  const subscription = await getCompanySubscription(user.companyId);

  if (!subscription.stripeCustomerId) {
    return Response.json({ error: "No Stripe customer found for this company." }, { status: 400 });
  }

  try {
    const stripe = getStripeServerClient();
    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    return Response.json({ url: session.url });
  } catch {
    return Response.json({ error: "Unable to create Stripe billing portal session." }, { status: 502 });
  }
}
