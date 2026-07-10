// Perilla 6 — Stripe Webhook / Billing Lifecycle Trust Boundary.
//
// Direct, behavioral tests of verifyStripeWebhookEvent() in isolation: no
// network, no real Stripe signing — a fake Stripe client's
// webhooks.constructEvent is controlled per test.

import test from "node:test";
import assert from "node:assert/strict";
import { verifyStripeWebhookEvent } from "../src/lib/stripe-webhook-verification.ts";

function fakeStripeClient({ throws, event } = {}) {
  return {
    webhooks: {
      constructEvent: () => {
        if (throws) {
          throw new Error("No signatures found matching the expected signature for payload");
        }
        return event ?? { id: "evt_1", type: "checkout.session.completed", livemode: false, data: { object: {} } };
      },
    },
  };
}

test("1. missing stripe-signature fails closed", () => {
  const result = verifyStripeWebhookEvent({
    rawBody: "{}",
    signature: null,
    webhookSecret: "whsec_test",
    stripeClient: fakeStripeClient(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_signature");
});

test("2. missing webhook secret fails closed", () => {
  const result = verifyStripeWebhookEvent({
    rawBody: "{}",
    signature: "t=1,v1=abc",
    webhookSecret: undefined,
    stripeClient: fakeStripeClient(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_secret");
});

test("2b. missing webhook secret is checked before missing signature (both fail closed)", () => {
  const result = verifyStripeWebhookEvent({
    rawBody: "{}",
    signature: null,
    webhookSecret: undefined,
    stripeClient: fakeStripeClient(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_secret");
});

test("3. invalid signature (constructEvent throws) fails closed", () => {
  const result = verifyStripeWebhookEvent({
    rawBody: "{}",
    signature: "t=1,v1=bad",
    webhookSecret: "whsec_test",
    stripeClient: fakeStripeClient({ throws: true }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_signature");
});

test("4. valid signature returns the constructed event", () => {
  const event = { id: "evt_valid", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1" } } };
  const result = verifyStripeWebhookEvent({
    rawBody: '{"id":"evt_valid"}',
    signature: "t=1,v1=good",
    webhookSecret: "whsec_test",
    stripeClient: fakeStripeClient({ event }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.id, "evt_valid");
});

test("does not parse rawBody as JSON itself — a non-JSON rawBody is passed through to constructEvent verbatim", () => {
  let receivedRawBody;
  const stripeClient = {
    webhooks: {
      constructEvent: (rawBody) => {
        receivedRawBody = rawBody;
        return { id: "evt_raw", type: "invoice.paid", livemode: false, data: { object: {} } };
      },
    },
  };

  const rawBody = "not-json-but-still-the-exact-signed-bytes";
  const result = verifyStripeWebhookEvent({ rawBody, signature: "t=1,v1=x", webhookSecret: "whsec_test", stripeClient });
  assert.equal(result.ok, true);
  assert.equal(receivedRawBody, rawBody);
});
