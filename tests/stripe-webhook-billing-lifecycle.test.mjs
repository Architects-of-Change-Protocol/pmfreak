// Perilla 6 — Stripe Webhook / Billing Lifecycle Trust Boundary.
//
// Direct, behavioral tests of resolveStripeBillingLifecycleDecision() and
// applyStripeBillingLifecycleDecision() (src/lib/billing-webhook-lifecycle.ts)
// against an in-memory fake Supabase client. These run the real mapping,
// metadata-is-not-authorization, and price-catalog logic unmodified.

import test from "node:test";
import assert from "node:assert/strict";
import { applyStripeBillingLifecycleDecision, resolveStripeBillingLifecycleDecision } from "../src/lib/billing-webhook-lifecycle.ts";
import { getCompanySubscription } from "../src/lib/billing.ts";
import { companyRow, createFakeBillingSupabase } from "./stripe-webhook-test-helpers.ts";

test.beforeEach(() => {
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  process.env.STRIPE_PMO_PRICE_ID = "price_pmo";
});

function subscriptionEvent(type, subscription, overrides = {}) {
  return { id: "evt_1", type, livemode: false, data: { object: subscription }, ...overrides };
}

function fakeSubscription(overrides = {}) {
  return {
    id: "sub_1",
    customer: "cus_safe",
    status: "active",
    metadata: {},
    items: { data: [{ price: { id: "price_pro" }, current_period_end: 1893456000 }] },
    ...overrides,
  };
}

function fakeStripeClient(subscriptionsById = {}) {
  return {
    subscriptions: {
      retrieve: async (id) => {
        const sub = subscriptionsById[id];
        if (!sub) throw new Error(`no such subscription: ${id}`);
        return sub;
      },
    },
  };
}

// ── 11. unknown event type is ignored ────────────────────────────────────

test("11. an unrecognized event type resolves to ignore with no mutation", async () => {
  const supabase = createFakeBillingSupabase();
  const event = { id: "evt_x", type: "customer.tax_id.updated", livemode: false, data: { object: {} } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.match(decision.reason, /^unsupported_event_type:/);
  await applyStripeBillingLifecycleDecision({ decision, supabase });
  assert.equal(supabase.tables.company_subscriptions.length, 0);
});

// ── 12. metadata.companyId (attacker) does not activate the wrong company ─

test("12. metadata.companyId pointing at an attacker-chosen company does not activate that company when the real mapping is different", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ customer: "cus_safe", metadata: { companyId: "workspace.attacker" } });
  const event = subscriptionEvent("customer.subscription.updated", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "update_subscription_status");
  assert.equal(decision.companyId, "workspace.safe");
  assert.notEqual(decision.companyId, "workspace.attacker");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const attacker = await getCompanySubscription("workspace.attacker", { client: supabase });
  assert.equal(attacker.plan, "free");
  assert.equal(attacker.subscriptionStatus, "inactive");
});

test("12b. metadata.companyId with no corresponding server-side mapping at all does not activate anything", async () => {
  const supabase = createFakeBillingSupabase();
  const subscription = fakeSubscription({ customer: "cus_unmapped", metadata: { companyId: "workspace.attacker" } });
  const event = subscriptionEvent("customer.subscription.created", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unmapped_customer");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  assert.equal(supabase.tables.company_subscriptions.length, 0);
});

// ── 13. arbitrary/extra metadata fields never influence the decision ─────

test("13. metadata fields beyond companyId (e.g. a spoofed userId) have no effect on the resolved decision", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ customer: "cus_safe", metadata: { companyId: "workspace.safe", userId: "victim.user", role: "owner" } });
  const event = subscriptionEvent("customer.subscription.updated", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "update_subscription_status");
  assert.equal(decision.companyId, "workspace.safe");
  assert.ok(!("userId" in decision));
});

// ── 14. metadata.plan does not change the activated plan ─────────────────

test("14a. metadata.plan=enterprise is ignored — plan is derived only from the subscription's actual price id", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ customer: "cus_safe", metadata: { companyId: "workspace.safe", plan: "enterprise" } });
  const event = subscriptionEvent("customer.subscription.updated", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "update_subscription_status");
  assert.equal(decision.planKey, "pro");
  assert.notEqual(decision.planKey, "enterprise");
});

test("14b. metadata.plan=enterprise with an unknown price id still does not activate anything", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({
    customer: "cus_safe",
    metadata: { companyId: "workspace.safe", plan: "enterprise" },
    items: { data: [{ price: { id: "price_unknown_legacy" }, current_period_end: 1893456000 }] },
  });
  const event = subscriptionEvent("customer.subscription.updated", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unknown_price_id");
});

// ── 15/16. checkout.session.completed ─────────────────────────────────────

test("15. checkout.session.completed with valid mapping and a valid price activates the subscription", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ id: "sub_new", customer: "cus_safe" });
  const stripeClient = fakeStripeClient({ sub_new: subscription });
  const session = { mode: "subscription", customer: "cus_safe", subscription: "sub_new", payment_status: "paid", metadata: { companyId: "workspace.safe" } };
  const event = { id: "evt_checkout", type: "checkout.session.completed", livemode: false, data: { object: session } };

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient });
  assert.equal(decision.action, "activate_subscription");
  assert.equal(decision.companyId, "workspace.safe");
  assert.equal(decision.planKey, "pro");
  assert.equal(decision.status, "active");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.plan, "pro");
  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.stripeSubscriptionId, "sub_new");
});

test("16. checkout.session.completed with metadata but no server-side mapping does not activate", async () => {
  const supabase = createFakeBillingSupabase();
  const subscription = fakeSubscription({ id: "sub_orphan", customer: "cus_orphan" });
  const stripeClient = fakeStripeClient({ sub_orphan: subscription });
  const session = { mode: "subscription", customer: "cus_orphan", subscription: "sub_orphan", payment_status: "paid", metadata: { companyId: "workspace.attacker" } };
  const event = { id: "evt_checkout_orphan", type: "checkout.session.completed", livemode: false, data: { object: session } };

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unmapped_customer");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  assert.equal(supabase.tables.company_subscriptions.length, 0);
});

test("checkout.session.completed with mode != subscription is ignored", async () => {
  const supabase = createFakeBillingSupabase();
  const session = { mode: "payment", customer: "cus_safe", subscription: null };
  const event = { id: "evt_pay", type: "checkout.session.completed", livemode: false, data: { object: session } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "checkout_session_not_subscription");
});

test("checkout.session.completed with payment_status=unpaid is ignored", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const session = { mode: "subscription", customer: "cus_safe", subscription: "sub_new", payment_status: "unpaid" };
  const event = { id: "evt_unpaid", type: "checkout.session.completed", livemode: false, data: { object: session } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "checkout_session_unpaid");
});

// ── 17. subscription.updated with customer mismatch fails closed ─────────

test("17. subscription.updated where the event's customer disagrees with the customer already on record fails closed", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_owner", stripe_subscription_id: "sub_1", plan: "pro", subscription_status: "active" })],
  });
  const subscription = fakeSubscription({ id: "sub_1", customer: "cus_attacker" });
  const event = subscriptionEvent("customer.subscription.updated", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "customer_mismatch");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.plan, "pro");
  assert.equal(state.stripeCustomerId, "cus_owner");
});

// ── 18. subscription.deleted with valid mapping cancels ──────────────────

test("18. subscription.deleted with a valid mapping cancels the subscription and downgrades to free", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe", stripe_subscription_id: "sub_1", plan: "pro", subscription_status: "active" })],
  });
  const subscription = fakeSubscription({ id: "sub_1", customer: "cus_safe", status: "canceled" });
  const event = subscriptionEvent("customer.subscription.deleted", subscription);

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "cancel_subscription");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.plan, "free");
  assert.equal(state.subscriptionStatus, "canceled");
});

test("subscription.deleted for an unmapped customer is ignored", async () => {
  const supabase = createFakeBillingSupabase();
  const subscription = fakeSubscription({ id: "sub_ghost", customer: "cus_ghost", status: "canceled" });
  const event = subscriptionEvent("customer.subscription.deleted", subscription);
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unmapped_customer");
});

// ── 19/20. invoice.paid / invoice.payment_failed ──────────────────────────

test("19. invoice.paid with a valid mapping marks the subscription current/active", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe", stripe_subscription_id: "sub_1", plan: "pro", subscription_status: "past_due" })],
  });
  const invoice = { id: "in_1", customer: "cus_safe", subscription: "sub_1", period_end: 1893456000 };
  const event = { id: "evt_invoice_paid", type: "invoice.paid", livemode: false, data: { object: invoice } };

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "mark_payment_current");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.plan, "pro");
});

test("20. invoice.payment_failed with a valid mapping marks the subscription past_due", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe", stripe_subscription_id: "sub_1", plan: "pro", subscription_status: "active" })],
  });
  const invoice = { id: "in_2", customer: "cus_safe", subscription: "sub_1" };
  const event = { id: "evt_invoice_failed", type: "invoice.payment_failed", livemode: false, data: { object: invoice } };

  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "mark_payment_failed");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.subscriptionStatus, "past_due");
  assert.equal(state.plan, "pro", "plan is not touched by a payment-failed event");
});

test("invoice events with no subscription are ignored", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const invoice = { id: "in_3", customer: "cus_safe", subscription: null };
  const event = { id: "evt_invoice_no_sub", type: "invoice.paid", livemode: false, data: { object: invoice } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "invoice_without_subscription");
});

// ── 21. unknown price id fails closed for activation ──────────────────────

test("21a. an unknown price id on customer.subscription.created does not activate any plan", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ items: { data: [{ price: { id: "price_not_in_catalog" }, current_period_end: 1893456000 }] } });
  const event = subscriptionEvent("customer.subscription.created", subscription);
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unknown_price_id");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.plan, "free");
  assert.equal(state.subscriptionStatus, "inactive");
});

test("21b. an unknown price id does not silently downgrade an already-active subscription either", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe", stripe_subscription_id: "sub_1", plan: "pro", subscription_status: "active" })],
  });
  const subscription = fakeSubscription({ id: "sub_1", items: { data: [{ price: { id: "price_migrated_off_catalog" }, current_period_end: 1893456000 }] } });
  const event = subscriptionEvent("customer.subscription.updated", subscription);
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unknown_price_id");

  await applyStripeBillingLifecycleDecision({ decision, supabase });
  const state = await getCompanySubscription("workspace.safe", { client: supabase });
  assert.equal(state.plan, "pro", "existing plan must not be silently touched on an unrecognized price id");
  assert.equal(state.subscriptionStatus, "active");
});

// ── 23. malformed event objects fail closed ───────────────────────────────

test("23a. a subscription event with no customer field is ignored, not thrown", async () => {
  const supabase = createFakeBillingSupabase();
  const subscription = fakeSubscription({ customer: null });
  const event = subscriptionEvent("customer.subscription.updated", subscription);
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "subscription_missing_customer");
});

test("23b. checkout.session.completed with no customer field is ignored, not thrown", async () => {
  const supabase = createFakeBillingSupabase();
  const session = { mode: "subscription", customer: null, subscription: "sub_1", payment_status: "paid" };
  const event = { id: "evt_no_customer", type: "checkout.session.completed", livemode: false, data: { object: session } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient: fakeStripeClient() });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "checkout_session_missing_customer");
});

// ── customer/subscription id extraction is consistent for string vs object ─

test("customer id is extracted consistently whether Stripe sends a string or an expanded object", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });

  const asString = fakeSubscription({ customer: "cus_safe" });
  const decisionString = await resolveStripeBillingLifecycleDecision({
    event: subscriptionEvent("customer.subscription.updated", asString),
    supabase,
    stripeClient: fakeStripeClient(),
  });
  assert.equal(decisionString.action, "update_subscription_status");

  const asObject = fakeSubscription({ customer: { id: "cus_safe", email: "person@example.com" } });
  const decisionObject = await resolveStripeBillingLifecycleDecision({
    event: subscriptionEvent("customer.subscription.updated", asObject),
    supabase,
    stripeClient: fakeStripeClient(),
  });
  assert.equal(decisionObject.action, "update_subscription_status");
  assert.equal(decisionObject.stripeCustomerId, "cus_safe");
});

test("subscription id is extracted consistently whether Stripe sends a string or an expanded object on checkout session", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });
  const subscription = fakeSubscription({ id: "sub_expanded", customer: "cus_safe" });
  const stripeClient = fakeStripeClient({ sub_expanded: subscription });
  const session = { mode: "subscription", customer: "cus_safe", subscription: { id: "sub_expanded" }, payment_status: "paid" };
  const event = { id: "evt_expanded", type: "checkout.session.completed", livemode: false, data: { object: session } };
  const decision = await resolveStripeBillingLifecycleDecision({ event, supabase, stripeClient });
  assert.equal(decision.action, "activate_subscription");
  assert.equal(decision.stripeSubscriptionId, "sub_expanded");
});

// ── subscription status mapping ───────────────────────────────────────────

test("subscription status mapping covers trialing/past_due/unpaid/incomplete", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe" })],
  });

  const cases = [
    ["trialing", "trialing", "pro"],
    ["past_due", "past_due", "pro"],
    ["unpaid", "unpaid", "free"],
    ["incomplete", "incomplete", "pro"],
  ];

  for (const [stripeStatus, expectedStatus, expectedPlan] of cases) {
    const subscription = fakeSubscription({ status: stripeStatus });
    const decision = await resolveStripeBillingLifecycleDecision({
      event: subscriptionEvent("customer.subscription.updated", subscription),
      supabase,
      stripeClient: fakeStripeClient(),
    });
    assert.equal(decision.action, "update_subscription_status", `status ${stripeStatus}`);
    assert.equal(decision.status, expectedStatus, `status ${stripeStatus}`);
    assert.equal(decision.planKey, expectedPlan, `status ${stripeStatus}`);
  }
});

// ── ignore is a true no-op ────────────────────────────────────────────────

test("applyStripeBillingLifecycleDecision never mutates company_subscriptions for action: ignore", async () => {
  const supabase = createFakeBillingSupabase({
    companySubscriptions: [companyRow({ company_id: "workspace.safe", stripe_customer_id: "cus_safe", plan: "pro", subscription_status: "active" })],
  });
  const before = JSON.stringify(supabase.tables.company_subscriptions);
  await applyStripeBillingLifecycleDecision({ decision: { action: "ignore", reason: "test" }, supabase });
  const after = JSON.stringify(supabase.tables.company_subscriptions);
  assert.equal(before, after);
});
