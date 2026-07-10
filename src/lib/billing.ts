import type { SupabaseClient } from "@supabase/supabase-js";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubscriptionPlan = "free" | "pro" | "pmo";

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type CompanySubscriptionState = {
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
};

type PrivilegedContext = {
  routeId: string;
  operation: string;
  reason: string;
  actorUserId?: string;
  workspaceId?: string;
  systemActor?: "stripe_webhook" | "background_job" | "system";
};

type ClientOptions = {
  useServiceRole?: boolean;
  privilegedContext?: PrivilegedContext;
  /** Reuse an already-instantiated client (e.g. the single privileged client
   * created once by the Stripe webhook route after signature verification)
   * instead of building a new one per call. Takes priority over useServiceRole. */
  client?: SupabaseClient;
};

const DEFAULT_STATE: CompanySubscriptionState = {
  plan: "free",
  subscriptionStatus: "inactive",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
};

const toPlan = (plan: unknown): SubscriptionPlan => {
  if (plan === "free" || plan === "pro" || plan === "pmo") {
    return plan;
  }

  return DEFAULT_STATE.plan;
};

const toStatus = (status: unknown): SubscriptionStatus => {
  if (
    status === "inactive" ||
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "incomplete" ||
    status === "incomplete_expired" ||
    status === "unpaid" ||
    status === "paused"
  ) {
    return status;
  }

  return DEFAULT_STATE.subscriptionStatus;
};

const normalizeState = (row: {
  plan: unknown;
  subscription_status: unknown;
  stripe_customer_id: unknown;
  stripe_subscription_id: unknown;
  current_period_end: unknown;
}): CompanySubscriptionState => ({
  plan: toPlan(row.plan),
  subscriptionStatus: toStatus(row.subscription_status),
  stripeCustomerId: typeof row.stripe_customer_id === "string" && row.stripe_customer_id.length > 0 ? row.stripe_customer_id : null,
  stripeSubscriptionId:
    typeof row.stripe_subscription_id === "string" && row.stripe_subscription_id.length > 0
      ? row.stripe_subscription_id
      : null,
  currentPeriodEnd: typeof row.current_period_end === "string" && row.current_period_end.length > 0 ? row.current_period_end : null,
});

const getClient = async (options?: ClientOptions): Promise<SupabaseClient> => {
  if (options?.client) {
    return options.client;
  }

  if (options?.useServiceRole) {
    if (!options.privilegedContext) throw new Error("Privileged billing access requires explicit context.");
    return createPrivilegedSupabaseClient(options.privilegedContext);
  }

  return createSupabaseServerClient();
};

export const getCompanySubscription = async (
  companyId: string,
  options?: ClientOptions,
): Promise<CompanySubscriptionState> => {
  const supabase = await getClient(options);

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read company subscription: ${error.message}`);
  }

  if (!data) {
    return DEFAULT_STATE;
  }

  return normalizeState(data);
};

export const setCompanySubscription = async (
  companyId: string,
  value: CompanySubscriptionState,
  options?: ClientOptions,
): Promise<CompanySubscriptionState> => {
  const supabase = await getClient(options);

  const { data, error } = await supabase
    .from("company_subscriptions")
    .upsert(
      {
        company_id: companyId,
        plan: value.plan,
        subscription_status: value.subscriptionStatus,
        stripe_customer_id: value.stripeCustomerId,
        stripe_subscription_id: value.stripeSubscriptionId,
        current_period_end: value.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" },
    )
    .select("plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end")
    .single();

  if (error) {
    throw new Error(`Unable to persist company subscription: ${error.message}`);
  }

  return normalizeState(data);
};

export const updateCompanySubscription = async (
  companyId: string,
  patch: Partial<CompanySubscriptionState>,
  options?: ClientOptions,
): Promise<CompanySubscriptionState> => {
  const current = await getCompanySubscription(companyId, options);
  return setCompanySubscription(companyId, { ...current, ...patch }, options);
};

export const findCompanyIdByStripeCustomerId = async (
  customerId: string,
  options?: ClientOptions,
): Promise<string | null> => {
  const supabase = await getClient(options);

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("company_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to look up company by Stripe customer ID: ${error.message}`);
  }

  return data?.company_id ?? null;
};

/**
 * Companion lookup to findCompanyIdByStripeCustomerId, keyed by subscription
 * id instead of customer id. Used to detect a customer-id mismatch on
 * subscription-level webhook events: if a company already has this
 * subscription id on record, the event's customer id must agree with the
 * company's stored customer id or the event is treated as unmapped.
 */
export const findCompanyIdByStripeSubscriptionId = async (
  subscriptionId: string,
  options?: ClientOptions,
): Promise<{ companyId: string; stripeCustomerId: string | null } | null> => {
  const supabase = await getClient(options);

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("company_id, stripe_customer_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to look up company by Stripe subscription ID: ${error.message}`);
  }

  if (!data?.company_id) {
    return null;
  }

  return {
    companyId: data.company_id,
    stripeCustomerId: typeof data.stripe_customer_id === "string" && data.stripe_customer_id.length > 0 ? data.stripe_customer_id : null,
  };
};

// ── Stripe webhook idempotency lifecycle ────────────────────────────────────
//
// Every Stripe event is claimed exactly once via an insert into
// billing_webhook_events (event_id is the primary key, so a concurrent
// duplicate insert loses the race with a 23505 unique violation, not a
// double-write). The caller passes an already-instantiated privileged
// Supabase client — see docs/security/stripe-webhook-billing-lifecycle-boundary.md
// for why the client is built once, after signature verification, by the
// webhook route rather than by each of these functions.

export type BeginBillingWebhookEventResult =
  | { status: "new" }
  | { status: "already_processed" }
  | { status: "already_processing" }
  | { status: "retry_failed" };

const sanitizeReason = (reason: string): string => reason.replace(/[\r\n]+/g, " ").slice(0, 500);

export const beginBillingWebhookEventProcessing = async (input: {
  supabase: SupabaseClient;
  eventId: string;
  eventType: string;
  livemode: boolean;
}): Promise<BeginBillingWebhookEventResult> => {
  const nowIso = new Date().toISOString();

  const { error: insertError } = await input.supabase.from("billing_webhook_events").insert({
    event_id: input.eventId,
    event_type: input.eventType,
    livemode: input.livemode,
    processing_status: "processing",
    received_at: nowIso,
    updated_at: nowIso,
    processed_at: null,
  });

  if (!insertError) {
    return { status: "new" };
  }

  if (insertError.code !== "23505") {
    throw new Error(`Unable to record Stripe webhook event: ${insertError.message}`);
  }

  const { data: existing, error: readError } = await input.supabase
    .from("billing_webhook_events")
    .select("processing_status")
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (readError || !existing) {
    // Row exists (we just hit a unique violation) but is unreadable for some
    // reason — treat conservatively as already owned so we never double-mutate.
    return { status: "already_processing" };
  }

  if (existing.processing_status === "processed" || existing.processing_status === "ignored") {
    return { status: "already_processed" };
  }

  if (existing.processing_status === "failed") {
    // Explicit retry policy: a previously-failed event may be retried on
    // Stripe's automatic redelivery. Atomically flip it back to "processing"
    // — the .eq("processing_status", "failed") guard means only one
    // concurrent retry can win this claim.
    const { data: claimed, error: claimError } = await input.supabase
      .from("billing_webhook_events")
      .update({ processing_status: "processing", updated_at: new Date().toISOString() })
      .eq("event_id", input.eventId)
      .eq("processing_status", "failed")
      .select("event_id")
      .maybeSingle();

    if (claimError || !claimed) {
      return { status: "already_processing" };
    }

    return { status: "retry_failed" };
  }

  // status === "processing" — another in-flight request currently owns this event.
  return { status: "already_processing" };
};

export const markBillingWebhookEventProcessed = async (input: { supabase: SupabaseClient; eventId: string }): Promise<void> => {
  const { error } = await input.supabase
    .from("billing_webhook_events")
    .update({ processing_status: "processed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error_reason: null })
    .eq("event_id", input.eventId);

  if (error) {
    throw new Error(`Unable to mark Stripe webhook event processed: ${error.message}`);
  }
};

export const markBillingWebhookEventIgnored = async (input: { supabase: SupabaseClient; eventId: string; reason: string }): Promise<void> => {
  const { error } = await input.supabase
    .from("billing_webhook_events")
    .update({
      processing_status: "ignored",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_reason: sanitizeReason(input.reason),
    })
    .eq("event_id", input.eventId);

  if (error) {
    throw new Error(`Unable to mark Stripe webhook event ignored: ${error.message}`);
  }
};

export const markBillingWebhookEventFailed = async (input: { supabase: SupabaseClient; eventId: string; reason: string }): Promise<void> => {
  const { error } = await input.supabase
    .from("billing_webhook_events")
    .update({ processing_status: "failed", updated_at: new Date().toISOString(), error_reason: sanitizeReason(input.reason) })
    .eq("event_id", input.eventId);

  if (error) {
    throw new Error(`Unable to mark Stripe webhook event failed: ${error.message}`);
  }
};
