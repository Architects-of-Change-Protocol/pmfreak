// Perilla 6 — Stripe Webhook / Billing Lifecycle Trust Boundary.
//
// Full route-level behavioral tests for POST /api/billing/webhook. Stripe and
// Supabase are mocked at the dependency boundary (same pattern as
// tests/billing-checkout-session-route.test.mjs) — the real route handler
// (handleStripeWebhook) runs unmodified, so these assert real order of
// operations: signature verification strictly before any service-role call,
// idempotency strictly before any mutation, and no secret leakage on error.

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleStripeWebhook } from "../src/app/api/billing/webhook/route.ts";

const state = {
  calls: [],
  constructEventBehavior: () => ({ id: "evt_1", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1" } } }),
  beginResult: { status: "new" },
  decision: { action: "update_subscription_status", companyId: "workspace.safe", stripeCustomerId: "cus_safe", stripeSubscriptionId: "sub_1", priceId: "price_pro", planKey: "pro", status: "active", currentPeriodEnd: null },
  applyThrows: null,
};

function record(name, args) {
  state.calls.push({ name, args });
}

function fakeStripeClient() {
  return {
    webhooks: {
      constructEvent: (rawBody, signature, secret) => {
        record("constructEvent", { rawBody, signature, secret });
        return state.constructEventBehavior();
      },
    },
  };
}

const FAKE_SUPABASE_MARKER = { __fake: "privileged-client" };

const deps = {
  getStripeServerClient: () => {
    record("getStripeServerClient", {});
    return fakeStripeClient();
  },
  createPrivilegedSupabaseClient: (context) => {
    record("createPrivilegedSupabaseClient", context);
    return FAKE_SUPABASE_MARKER;
  },
  beginBillingWebhookEventProcessing: async (input) => {
    record("beginBillingWebhookEventProcessing", input);
    return state.beginResult;
  },
  markBillingWebhookEventProcessed: async (input) => {
    record("markBillingWebhookEventProcessed", input);
  },
  markBillingWebhookEventIgnored: async (input) => {
    record("markBillingWebhookEventIgnored", input);
  },
  markBillingWebhookEventFailed: async (input) => {
    record("markBillingWebhookEventFailed", input);
  },
  resolveStripeBillingLifecycleDecision: async (input) => {
    record("resolveStripeBillingLifecycleDecision", input);
    return state.decision;
  },
  applyStripeBillingLifecycleDecision: async (input) => {
    record("applyStripeBillingLifecycleDecision", input);
    if (state.applyThrows) throw state.applyThrows;
  },
};

function webhookRequest({ signature = "t=1,v1=good", body = '{"id":"evt_1"}', includeSignature = true } = {}) {
  const headers = new Headers();
  if (includeSignature) headers.set("stripe-signature", signature);
  return new Request("https://app.test/api/billing/webhook", { method: "POST", headers, body });
}

function callsNamed(name) {
  return state.calls.filter((c) => c.name === name);
}

test.beforeEach(() => {
  state.calls = [];
  state.constructEventBehavior = () => ({ id: "evt_1", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1" } } });
  state.beginResult = { status: "new" };
  state.decision = { action: "update_subscription_status", companyId: "workspace.safe", stripeCustomerId: "cus_safe", stripeSubscriptionId: "sub_1", priceId: "price_pro", planKey: "pro", status: "active", currentPeriodEnd: null };
  state.applyThrows = null;
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_super_secret_value";
});

const post = (request) => handleStripeWebhook(request, deps);

// ── 1. missing stripe-signature fails closed ──────────────────────────────

test("1. missing stripe-signature returns 400 and never instantiates a service-role client or touches the DB", async () => {
  const response = await post(webhookRequest({ includeSignature: false }));
  assert.equal(response.status, 400);
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 0);
  assert.equal(callsNamed("beginBillingWebhookEventProcessing").length, 0);
  assert.equal(callsNamed("applyStripeBillingLifecycleDecision").length, 0);
});

// ── 2. missing webhook secret fails closed ────────────────────────────────

test("2. missing STRIPE_WEBHOOK_SECRET fails closed with no mutation", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const response = await post(webhookRequest());
  assert.equal(response.status, 400);
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 0);
});

// ── 3. invalid signature fails closed ─────────────────────────────────────

test("3. constructEvent throwing (invalid signature) returns 400 and never reaches the DB", async () => {
  state.constructEventBehavior = () => {
    throw new Error("No signatures found matching the expected signature for payload");
  };
  const response = await post(webhookRequest());
  assert.equal(response.status, 400);
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 0);
  assert.equal(callsNamed("beginBillingWebhookEventProcessing").length, 0);
});

// ── 4. valid signature permits processing to begin ────────────────────────

test("4. a valid signature allows processing to begin", async () => {
  const response = await post(webhookRequest());
  assert.equal(response.status, 200);
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 1);
  assert.equal(callsNamed("beginBillingWebhookEventProcessing").length, 1);
});

// ── 5. raw body used, not request.json(), before verification ────────────

test("5. the route source reads request.text() and does not call request.json() before verifyStripeWebhookEvent", async () => {
  const source = await readFile(new URL("../src/app/api/billing/webhook/route.ts", import.meta.url), "utf8");
  assert.match(source, /request\.text\(\)/);
  const verifyIndex = source.indexOf("verifyStripeWebhookEvent(");
  const jsonIndex = source.indexOf("request.json()");
  assert.ok(verifyIndex > -1, "route must call verifyStripeWebhookEvent");
  assert.ok(jsonIndex === -1 || jsonIndex > verifyIndex, "request.json() must not appear before signature verification");
});

// ── 6/7. service role instantiation order ─────────────────────────────────

test("6. service role client is not instantiated when signature verification fails", async () => {
  state.constructEventBehavior = () => {
    throw new Error("bad signature");
  };
  await post(webhookRequest());
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 0);
});

test("7. service role client is instantiated exactly once, only after signature verification succeeds", async () => {
  await post(webhookRequest());
  const calls = callsNamed("createPrivilegedSupabaseClient");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.systemActor, "stripe_webhook");
});

// ── 8. new event is processed end-to-end ──────────────────────────────────

test("8. a new event resolves a decision, applies it, and is marked processed", async () => {
  const response = await post(webhookRequest());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.received, true);
  assert.equal(callsNamed("resolveStripeBillingLifecycleDecision").length, 1);
  assert.equal(callsNamed("applyStripeBillingLifecycleDecision").length, 1);
  assert.equal(callsNamed("markBillingWebhookEventProcessed").length, 1);
});

// ── 9. already-processed event is a no-op ─────────────────────────────────

test("9. an already-processed event returns 200 duplicate with no mutation", async () => {
  state.beginResult = { status: "already_processed" };
  const response = await post(webhookRequest());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.duplicate, true);
  assert.equal(callsNamed("resolveStripeBillingLifecycleDecision").length, 0);
  assert.equal(callsNamed("applyStripeBillingLifecycleDecision").length, 0);
});

// ── 10. concurrent/already-processing event is a safe no-op ──────────────

test("10. an event already being processed by a concurrent request returns 200 duplicate with no mutation", async () => {
  state.beginResult = { status: "already_processing" };
  const response = await post(webhookRequest());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.duplicate, true);
  assert.equal(callsNamed("applyStripeBillingLifecycleDecision").length, 0);
});

// ── 11. unknown/ignored event does not mutate ─────────────────────────────

test("11. a decision of 'ignore' is marked ignored, returns 200, and never reaches apply", async () => {
  state.decision = { action: "ignore", reason: "unsupported_event_type:customer.tax_id.updated" };
  const response = await post(webhookRequest());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.received, true);
  assert.equal(callsNamed("applyStripeBillingLifecycleDecision").length, 0);
  assert.equal(callsNamed("markBillingWebhookEventIgnored").length, 1);
  assert.equal(callsNamed("markBillingWebhookEventProcessed").length, 0);
});

// ── 22. livemode is threaded through to the idempotency guard ────────────

test("22. event.livemode is passed through to beginBillingWebhookEventProcessing", async () => {
  state.constructEventBehavior = () => ({ id: "evt_live", type: "customer.subscription.updated", livemode: true, data: { object: {} } });
  await post(webhookRequest());
  const call = callsNamed("beginBillingWebhookEventProcessing")[0];
  assert.equal(call.args.livemode, true);
  assert.equal(call.args.eventId, "evt_live");
});

// ── 24. a processing error marks the event failed and returns a safe 500 ─

test("24. an exception during apply marks the event failed and returns a generic 500", async () => {
  state.applyThrows = new Error("db unavailable: connection reset");
  const response = await post(webhookRequest());
  assert.equal(response.status, 500);
  assert.equal(callsNamed("markBillingWebhookEventFailed").length, 1);
  assert.equal(callsNamed("markBillingWebhookEventFailed")[0].args.reason, "db unavailable: connection reset");
  assert.equal(callsNamed("markBillingWebhookEventProcessed").length, 0);
});

// ── 25. error responses never expose secrets ──────────────────────────────

test("25a. invalid-signature response body contains no secret, stack trace, or raw event", async () => {
  state.constructEventBehavior = () => {
    throw new Error("signature mismatch for whsec_test_super_secret_value");
  };
  const response = await post(webhookRequest());
  const text = await response.text();
  assert.ok(!text.includes("whsec_test_super_secret_value"));
  assert.ok(!text.includes("sk_test_123"));
  assert.ok(!text.toLowerCase().includes("at handlestripewebhook"));
});

test("25b. missing-secret response body contains no secret value", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const response = await post(webhookRequest());
  const text = await response.text();
  assert.ok(!text.includes("STRIPE_WEBHOOK_SECRET"));
});

test("25c. a processing-failure response body contains no internal error detail", async () => {
  state.applyThrows = new Error("service_role key rk_live_abcdef leaked in query");
  const response = await post(webhookRequest());
  const text = await response.text();
  assert.ok(!text.includes("rk_live_abcdef"));
  assert.ok(!text.includes("leaked"));
});

// ── missing STRIPE_SECRET_KEY fails closed without exposing why ──────────

test("getStripeServerClient throwing (missing STRIPE_SECRET_KEY) fails closed with a safe 500", async () => {
  const throwingDeps = {
    ...deps,
    getStripeServerClient: () => {
      throw new Error("Missing STRIPE_SECRET_KEY");
    },
  };
  const response = await handleStripeWebhook(webhookRequest(), throwingDeps);
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.ok(!text.includes("STRIPE_SECRET_KEY"));
  assert.equal(callsNamed("createPrivilegedSupabaseClient").length, 0);
});
