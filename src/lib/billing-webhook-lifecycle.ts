import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findCompanyIdByStripeCustomerId,
  findCompanyIdByStripeSubscriptionId,
  updateCompanySubscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/lib/billing";

/**
 * What to do with a verified, deduplicated Stripe event. "ignore" is not an
 * error path — it is the correct, expected outcome for unsupported event
 * types, unmapped customers, customer/subscription mismatches, and unknown
 * price ids. See docs/security/stripe-webhook-billing-lifecycle-boundary.md.
 */
export type StripeBillingLifecycleDecision =
  | {
      action: "activate_subscription" | "update_subscription_status";
      companyId: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      priceId: string;
      planKey: SubscriptionPlan;
      status: SubscriptionStatus;
      currentPeriodEnd: string | null;
    }
  | {
      action: "cancel_subscription";
      companyId: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      currentPeriodEnd: string | null;
    }
  | {
      action: "mark_payment_failed";
      companyId: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    }
  | {
      action: "mark_payment_current";
      companyId: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      currentPeriodEnd: string | null;
    }
  | { action: "ignore"; reason: string };

const DOWNGRADE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["canceled", "unpaid", "incomplete_expired"]);

const BILLING_STATUS_BY_STRIPE_STATUS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  paused: "paused",
};

const toIsoDate = (timestampSeconds?: number | null): string | null => {
  if (!timestampSeconds) {
    return null;
  }

  return new Date(timestampSeconds * 1000).toISOString();
};

const idOf = (value: string | { id: string } | null | undefined): string | null => {
  if (!value) return null;
  return typeof value === "string" ? value : (value.id ?? null);
};

/**
 * Validates a Stripe price id against the server-side plan catalog
 * (STRIPE_PRO_PRICE_ID / STRIPE_PMO_PRICE_ID). Stripe metadata is never
 * consulted here — the plan is derived exclusively from the price id
 * actually attached to the subscription line item.
 */
export const resolvePlanFromStripePriceId = (priceId: string | null | undefined): { planKey: SubscriptionPlan; priceId: string } | null => {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return { planKey: "pro", priceId };
  if (priceId === process.env.STRIPE_PMO_PRICE_ID) return { planKey: "pmo", priceId };
  return null;
};

const resolvePlanForSubscriptionItems = (items: Stripe.SubscriptionItem[]): { planKey: SubscriptionPlan; priceId: string } | null => {
  for (const item of items) {
    const match = resolvePlanFromStripePriceId(item.price?.id);
    if (match?.planKey === "pro") return match;
  }

  for (const item of items) {
    const match = resolvePlanFromStripePriceId(item.price?.id);
    if (match?.planKey === "pmo") return match;
  }

  return null;
};

type MappedCompany = { companyId: string };
type MappingOutcome = MappedCompany | { mismatch: true } | null;

/**
 * The single trust boundary for "which company does this Stripe object
 * belong to." Stripe metadata (companyId/userId/plan) is never read here —
 * only the server-side company_subscriptions mapping, established
 * synchronously by our own checkout flow (create-checkout-session/route.ts),
 * is authoritative.
 *
 * - If a company is already on record for this subscription id, the event's
 *   customer id must agree with that company's stored customer id, or the
 *   event is treated as a mismatch (not applied).
 * - Otherwise, fall back to the customer id → company mapping (covers
 *   subscription.created firing before any subscription id is on record).
 * - If neither resolves, the event is unmapped and must not mutate billing.
 */
const resolveMappedCompany = async (
  supabase: SupabaseClient,
  params: { subscriptionId?: string | null; customerId: string },
): Promise<MappingOutcome> => {
  if (params.subscriptionId) {
    const bySubscription = await findCompanyIdByStripeSubscriptionId(params.subscriptionId, { client: supabase });
    if (bySubscription) {
      if (bySubscription.stripeCustomerId && bySubscription.stripeCustomerId !== params.customerId) {
        return { mismatch: true };
      }
      return { companyId: bySubscription.companyId };
    }
  }

  const byCustomer = await findCompanyIdByStripeCustomerId(params.customerId, { client: supabase });
  if (byCustomer) {
    return { companyId: byCustomer };
  }

  return null;
};

const warnMetadataMismatch = (eventType: string, metadataCompanyId: string, resolvedCompanyId: string) => {
  if (metadataCompanyId === resolvedCompanyId) return;
  console.warn("[billing-webhook] metadata.companyId disagrees with server-side mapping — metadata ignored", {
    eventType,
    metadataCompanyId,
    resolvedCompanyId,
  });
};

const buildSubscriptionDecision = (
  subscription: Stripe.Subscription,
  companyId: string,
  action: "activate_subscription" | "update_subscription_status",
): StripeBillingLifecycleDecision => {
  const customerId = idOf(subscription.customer as string | { id: string } | null);
  if (!customerId) {
    return { action: "ignore", reason: "subscription_missing_customer" };
  }

  const catalogMatch = resolvePlanForSubscriptionItems(subscription.items?.data ?? []);
  if (!catalogMatch) {
    return { action: "ignore", reason: "unknown_price_id" };
  }

  const status = BILLING_STATUS_BY_STRIPE_STATUS[subscription.status] ?? "inactive";
  const shouldDowngrade = DOWNGRADE_STATUSES.has(status);
  const currentPeriodEnd = toIsoDate(
    (subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ?? null,
  );

  return {
    action,
    companyId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    priceId: catalogMatch.priceId,
    planKey: shouldDowngrade ? "free" : catalogMatch.planKey,
    status,
    currentPeriodEnd,
  };
};

const decideForSubscriptionUpsert = async (
  subscription: Stripe.Subscription,
  supabase: SupabaseClient,
  action: "activate_subscription" | "update_subscription_status",
): Promise<StripeBillingLifecycleDecision> => {
  const customerId = idOf(subscription.customer as string | { id: string } | null);
  if (!customerId) {
    return { action: "ignore", reason: "subscription_missing_customer" };
  }

  const mapped = await resolveMappedCompany(supabase, { subscriptionId: subscription.id, customerId });

  if (!mapped) {
    return { action: "ignore", reason: "unmapped_customer" };
  }

  if ("mismatch" in mapped) {
    return { action: "ignore", reason: "customer_mismatch" };
  }

  const metadataCompanyId = subscription.metadata?.companyId;
  if (metadataCompanyId) {
    warnMetadataMismatch("customer.subscription", metadataCompanyId, mapped.companyId);
  }

  return buildSubscriptionDecision(subscription, mapped.companyId, action);
};

const decideForSubscriptionDeleted = async (
  subscription: Stripe.Subscription,
  supabase: SupabaseClient,
): Promise<StripeBillingLifecycleDecision> => {
  const customerId = idOf(subscription.customer as string | { id: string } | null);
  if (!customerId) {
    return { action: "ignore", reason: "subscription_missing_customer" };
  }

  const mapped = await resolveMappedCompany(supabase, { subscriptionId: subscription.id, customerId });

  if (!mapped) {
    return { action: "ignore", reason: "unmapped_customer" };
  }

  if ("mismatch" in mapped) {
    return { action: "ignore", reason: "customer_mismatch" };
  }

  const currentPeriodEnd = toIsoDate(
    (subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ?? null,
  );

  return {
    action: "cancel_subscription",
    companyId: mapped.companyId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd,
  };
};

const decideForCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
  stripeClient: Stripe,
  supabase: SupabaseClient,
): Promise<StripeBillingLifecycleDecision> => {
  if (session.mode !== "subscription" || !session.subscription) {
    return { action: "ignore", reason: "checkout_session_not_subscription" };
  }

  if (session.payment_status === "unpaid") {
    return { action: "ignore", reason: "checkout_session_unpaid" };
  }

  const customerId = idOf(session.customer as string | { id: string } | null);
  if (!customerId) {
    return { action: "ignore", reason: "checkout_session_missing_customer" };
  }

  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  if (!subscriptionId) {
    return { action: "ignore", reason: "checkout_session_missing_subscription" };
  }

  const mapped = await resolveMappedCompany(supabase, { subscriptionId, customerId });

  if (!mapped) {
    return { action: "ignore", reason: "unmapped_customer" };
  }

  if ("mismatch" in mapped) {
    return { action: "ignore", reason: "customer_mismatch" };
  }

  const metadataCompanyId = session.metadata?.companyId;
  if (metadataCompanyId) {
    warnMetadataMismatch("checkout.session.completed", metadataCompanyId, mapped.companyId);
  }

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  return buildSubscriptionDecision(subscription, mapped.companyId, "activate_subscription");
};

const decideForInvoiceEvent = async (
  invoice: Stripe.Invoice,
  supabase: SupabaseClient,
  action: "mark_payment_current" | "mark_payment_failed",
): Promise<StripeBillingLifecycleDecision> => {
  const subscriptionId = idOf((invoice as unknown as { subscription?: string | { id: string } | null }).subscription);
  if (!subscriptionId) {
    return { action: "ignore", reason: "invoice_without_subscription" };
  }

  const customerId = idOf(invoice.customer as string | { id: string } | null);
  if (!customerId) {
    return { action: "ignore", reason: "invoice_missing_customer" };
  }

  const mapped = await resolveMappedCompany(supabase, { subscriptionId, customerId });

  if (!mapped) {
    return { action: "ignore", reason: "unmapped_customer" };
  }

  if ("mismatch" in mapped) {
    return { action: "ignore", reason: "customer_mismatch" };
  }

  if (action === "mark_payment_current") {
    return {
      action,
      companyId: mapped.companyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: toIsoDate((invoice as unknown as { period_end?: number | null }).period_end ?? null),
    };
  }

  return {
    action,
    companyId: mapped.companyId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  };
};

/**
 * Resolves what a verified, deduplicated Stripe event should do to billing
 * state. Unsupported event types fall through to "ignore" with no mutation —
 * see the default case below.
 */
export const resolveStripeBillingLifecycleDecision = async (input: {
  event: Stripe.Event;
  supabase: SupabaseClient;
  stripeClient: Stripe;
}): Promise<StripeBillingLifecycleDecision> => {
  switch (input.event.type) {
    case "checkout.session.completed":
      return decideForCheckoutSessionCompleted(input.event.data.object as Stripe.Checkout.Session, input.stripeClient, input.supabase);
    case "customer.subscription.created":
      return decideForSubscriptionUpsert(input.event.data.object as Stripe.Subscription, input.supabase, "activate_subscription");
    case "customer.subscription.updated":
      return decideForSubscriptionUpsert(input.event.data.object as Stripe.Subscription, input.supabase, "update_subscription_status");
    case "customer.subscription.deleted":
      return decideForSubscriptionDeleted(input.event.data.object as Stripe.Subscription, input.supabase);
    case "invoice.paid":
      return decideForInvoiceEvent(input.event.data.object as Stripe.Invoice, input.supabase, "mark_payment_current");
    case "invoice.payment_failed":
      return decideForInvoiceEvent(input.event.data.object as Stripe.Invoice, input.supabase, "mark_payment_failed");
    default:
      return { action: "ignore", reason: `unsupported_event_type:${input.event.type}` };
  }
};

/**
 * Applies a resolved decision. "ignore" is a no-op by construction — there is
 * no code path here that can mutate company_subscriptions for an ignored
 * event, unmapped customer, or unknown price id.
 */
export const applyStripeBillingLifecycleDecision = async (input: {
  decision: StripeBillingLifecycleDecision;
  supabase: SupabaseClient;
}): Promise<void> => {
  const { decision, supabase } = input;

  switch (decision.action) {
    case "activate_subscription":
    case "update_subscription_status":
      await updateCompanySubscription(
        decision.companyId,
        {
          plan: decision.planKey,
          subscriptionStatus: decision.status,
          stripeCustomerId: decision.stripeCustomerId,
          stripeSubscriptionId: decision.stripeSubscriptionId,
          currentPeriodEnd: decision.currentPeriodEnd,
        },
        { client: supabase },
      );
      return;
    case "cancel_subscription":
      await updateCompanySubscription(
        decision.companyId,
        {
          plan: "free",
          subscriptionStatus: "canceled",
          stripeCustomerId: decision.stripeCustomerId,
          stripeSubscriptionId: decision.stripeSubscriptionId,
          currentPeriodEnd: decision.currentPeriodEnd,
        },
        { client: supabase },
      );
      return;
    case "mark_payment_failed":
      await updateCompanySubscription(
        decision.companyId,
        {
          subscriptionStatus: "past_due",
          stripeCustomerId: decision.stripeCustomerId,
          stripeSubscriptionId: decision.stripeSubscriptionId,
        },
        { client: supabase },
      );
      return;
    case "mark_payment_current":
      await updateCompanySubscription(
        decision.companyId,
        {
          subscriptionStatus: "active",
          stripeCustomerId: decision.stripeCustomerId,
          stripeSubscriptionId: decision.stripeSubscriptionId,
          currentPeriodEnd: decision.currentPeriodEnd,
        },
        { client: supabase },
      );
      return;
    case "ignore":
      return;
  }
};
