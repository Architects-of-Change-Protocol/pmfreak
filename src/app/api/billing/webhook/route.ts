import type Stripe from "stripe";
import {
  beginBillingWebhookEventProcessing,
  markBillingWebhookEventFailed,
  markBillingWebhookEventIgnored,
  markBillingWebhookEventProcessed,
} from "@/lib/billing";
import { applyStripeBillingLifecycleDecision, resolveStripeBillingLifecycleDecision } from "@/lib/billing-webhook-lifecycle";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { getStripeServerClient } from "@/lib/stripe";
import { verifyStripeWebhookEvent } from "@/lib/stripe-webhook-verification";

const ROUTE_ID = "/api/billing/webhook";

export type StripeWebhookDeps = {
  getStripeServerClient: typeof getStripeServerClient;
  createPrivilegedSupabaseClient: typeof createPrivilegedSupabaseClient;
  beginBillingWebhookEventProcessing: typeof beginBillingWebhookEventProcessing;
  markBillingWebhookEventProcessed: typeof markBillingWebhookEventProcessed;
  markBillingWebhookEventIgnored: typeof markBillingWebhookEventIgnored;
  markBillingWebhookEventFailed: typeof markBillingWebhookEventFailed;
  resolveStripeBillingLifecycleDecision: typeof resolveStripeBillingLifecycleDecision;
  applyStripeBillingLifecycleDecision: typeof applyStripeBillingLifecycleDecision;
};

const defaultDeps: StripeWebhookDeps = {
  getStripeServerClient,
  createPrivilegedSupabaseClient,
  beginBillingWebhookEventProcessing,
  markBillingWebhookEventProcessed,
  markBillingWebhookEventIgnored,
  markBillingWebhookEventFailed,
  resolveStripeBillingLifecycleDecision,
  applyStripeBillingLifecycleDecision,
};

/**
 * Testable core of the route handler. `deps` defaults to the real
 * implementations; tests inject fakes so this runs the real verification,
 * idempotency, mapping, and decision logic end-to-end without a live
 * Supabase/Stripe backend. See
 * docs/security/stripe-webhook-billing-lifecycle-boundary.md for the trust
 * boundary this enforces.
 */
export async function handleStripeWebhook(request: Request, deps: StripeWebhookDeps = defaultDeps): Promise<Response> {
  // 1. Raw body only — never parse the request body as JSON before the
  //    signature is verified. Stripe signs the exact bytes; parsing first
  //    would let an attacker send an unsigned or mis-signed payload that
  //    still "looks valid" to naive JSON handling.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeClient: Stripe;
  try {
    stripeClient = deps.getStripeServerClient();
  } catch {
    // Missing STRIPE_SECRET_KEY — fail closed without exposing why.
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  // 2. Verify signature before trusting anything about the payload. No
  //    service-role client exists yet at this point.
  const verification = verifyStripeWebhookEvent({ rawBody, signature, webhookSecret, stripeClient });

  if (!verification.ok) {
    console.warn("[billing-webhook] rejected", { reason: verification.reason });
    return Response.json({ error: "Invalid Stripe webhook request." }, { status: 400 });
  }

  const event = verification.event;

  // 3. Only now — after a cryptographically verified event — do we touch the
  //    database, and only via a service-role client scoped to this route.
  const supabase = deps.createPrivilegedSupabaseClient({
    routeId: ROUTE_ID,
    operation: "process_stripe_webhook_event",
    reason: "stripe_webhook_processing",
    systemActor: "stripe_webhook",
  });

  let begin: Awaited<ReturnType<typeof deps.beginBillingWebhookEventProcessing>>;
  try {
    begin = await deps.beginBillingWebhookEventProcessing({
      supabase,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    });
  } catch (error) {
    console.error("[billing-webhook] idempotency guard failed", { eventType: event.type, error: error instanceof Error ? error.message : error });
    return Response.json({ error: "Unable to process webhook." }, { status: 500 });
  }

  // 4. Idempotency: an event already processed (or currently being
  //    processed by a concurrent request) never reaches mutation logic again.
  if (begin.status === "already_processed" || begin.status === "already_processing") {
    return Response.json({ received: true, duplicate: true });
  }

  // begin.status is "new" or "retry_failed" — this request now owns the event.
  try {
    // 5. Resolve what to do — mapping and price-catalog validation happen
    //    inside this call; Stripe metadata is never treated as authorization.
    const decision = await deps.resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient });

    if (decision.action === "ignore") {
      await deps.markBillingWebhookEventIgnored({ supabase, eventId: event.id, reason: decision.reason });
      return Response.json({ received: true, ignored: true });
    }

    // 6. Mutate billing state only for a mapped, catalog-validated decision.
    await deps.applyStripeBillingLifecycleDecision({ decision, supabase });
    await deps.markBillingWebhookEventProcessed({ supabase, eventId: event.id });

    return Response.json({ received: true });
  } catch (error) {
    console.error("[billing-webhook] processing failed", { eventId: event.id, eventType: event.type, error: error instanceof Error ? error.message : error });

    try {
      await deps.markBillingWebhookEventFailed({
        supabase,
        eventId: event.id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    } catch (markError) {
      console.error("[billing-webhook] failed to record failure state", { eventId: event.id, error: markError instanceof Error ? markError.message : markError });
    }

    return Response.json({ error: "Unable to process webhook." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
