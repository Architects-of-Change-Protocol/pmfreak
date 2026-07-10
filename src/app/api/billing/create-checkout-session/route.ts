import { getAuthUser } from "@/lib/auth";
import { getCompanySubscription, updateCompanySubscription } from "@/lib/billing";
import { denyResponse } from "@/lib/security/deny-response";
import { requireBillingManageMembership, WorkspaceMembershipError } from "@/lib/workspace-access";
import { getStripeServerClient } from "@/lib/stripe";

type CheckoutPayload = {
  plan?: "pro" | "pmo";
};

const ROUTE_ID = "/api/billing/create-checkout-session";

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
  }

  const workspaceId = request.headers.get("x-pmf-workspace-id");
  if (!workspaceId) {
    return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", eventType: "billing_governance_denied", actorUserId: user.id });
  }

  // Authorization for billing.manage is resolved exclusively from server-side
  // workspace membership (workspace_memberships.role). Display role,
  // user_metadata.role, and any client-supplied role/actorRole/billingRole
  // fields on the request body are never consulted — see
  // docs/security/billing-authorization-boundary.md.
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

  let payload: CheckoutPayload;

  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const plan = payload.plan ?? "pro";

  if (plan !== "pro" && plan !== "pmo") {
    return Response.json({ error: "Unsupported plan." }, { status: 400 });
  }

  const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

  if (!stripeEnabled) {
    return Response.json({ error: "Billing is not configured yet. Please contact support to upgrade." }, { status: 503 });
  }

  const priceId = plan === "pmo" ? process.env.STRIPE_PMO_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    return Response.json({ error: `Missing price ID for ${plan} plan on the server.` }, { status: 500 });
  }

  try {
    const stripe = getStripeServerClient();
    const subscription = await getCompanySubscription(user.companyId);

    const customerId = subscription.stripeCustomerId
      ? subscription.stripeCustomerId
      : (
          await stripe.customers.create({
            email: user.email,
            name: user.companyName,
            metadata: {
              companyId: user.companyId,
              companyName: user.companyName,
              requestedByUserId: user.id,
            },
          })
        ).id;

    if (!subscription.stripeCustomerId) {
      await updateCompanySubscription(user.companyId, { stripeCustomerId: customerId });
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: {
        companyId: user.companyId,
        plan,
      },
      subscription_data: {
        metadata: {
          companyId: user.companyId,
          plan,
        },
      },
    }, {
      idempotencyKey: `checkout:${user.companyId}:${plan}`,
    });

    console.info("[billing] checkout session created", { companyId: user.companyId, customerId, plan, sessionId: session.id });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[billing] checkout session creation failed", { companyId: user.companyId, plan, error });
    return Response.json({ error: "Unable to create Stripe checkout session." }, { status: 502 });
  }
}
