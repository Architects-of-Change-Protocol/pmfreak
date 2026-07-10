import type Stripe from "stripe";

export type StripeWebhookVerificationResult =
  | { ok: true; event: Stripe.Event }
  | {
      ok: false;
      reason: "missing_signature" | "missing_secret" | "invalid_signature" | "invalid_payload";
    };

/**
 * Sole gate between an untrusted inbound request and treating its body as a
 * real Stripe event. Every field consulted by billing lifecycle logic must
 * pass through here first — see docs/security/stripe-webhook-billing-lifecycle-boundary.md.
 *
 * `rawBody` must be the unparsed request body (Stripe signs the exact bytes);
 * this function never calls JSON.parse itself, and callers must not either
 * before invoking it.
 */
export function verifyStripeWebhookEvent(input: {
  rawBody: string;
  signature: string | null;
  webhookSecret: string | undefined;
  stripeClient: Stripe;
}): StripeWebhookVerificationResult {
  if (!input.webhookSecret) {
    return { ok: false, reason: "missing_secret" };
  }

  if (!input.signature) {
    return { ok: false, reason: "missing_signature" };
  }

  try {
    const event = input.stripeClient.webhooks.constructEvent(input.rawBody, input.signature, input.webhookSecret);
    return { ok: true, event };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}
