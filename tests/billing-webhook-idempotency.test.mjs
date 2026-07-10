// Perilla 6 — Stripe Webhook / Billing Lifecycle Trust Boundary.
//
// Direct, behavioral tests of the real idempotency lifecycle functions in
// src/lib/billing.ts (beginBillingWebhookEventProcessing,
// markBillingWebhookEventProcessed/Ignored/Failed) against an in-memory fake
// Supabase client — no mocking of the functions under test themselves.

import test from "node:test";
import assert from "node:assert/strict";
import {
  beginBillingWebhookEventProcessing,
  markBillingWebhookEventFailed,
  markBillingWebhookEventIgnored,
  markBillingWebhookEventProcessed,
} from "../src/lib/billing.ts";
import { createFakeBillingSupabase } from "./stripe-webhook-test-helpers.ts";

// ── 8. new event is claimed ──────────────────────────────────────────────

test("8. a never-seen event id is claimed as 'new'", async () => {
  const supabase = createFakeBillingSupabase();
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_new", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(result, { status: "new" });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_new");
  assert.equal(row.processing_status, "processing");
});

// ── 9. already-processed event does not reprocess ───────────────────────

test("9. an already-processed event returns 'already_processed' and is not re-claimed", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_done", event_type: "invoice.paid", processing_status: "processed" }],
  });
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_done", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(result, { status: "already_processed" });
});

test("an ignored event also returns 'already_processed' (duplicate no-op, not reprocessed)", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_ignored", event_type: "unknown.event", processing_status: "ignored" }],
  });
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_ignored", eventType: "unknown.event", livemode: false });
  assert.deepEqual(result, { status: "already_processed" });
});

// ── 10. concurrent/duplicate insert does not double-process ─────────────

test("10. a duplicate insert while another request owns the event ('processing') is a safe no-op", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_racing", event_type: "invoice.paid", processing_status: "processing" }],
  });
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_racing", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(result, { status: "already_processing" });
});

// ── retry policy for a previously-failed event ───────────────────────────

test("a previously-failed event is atomically re-claimed for exactly one retry", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_retry", event_type: "invoice.paid", processing_status: "failed", error_reason: "transient db error" }],
  });
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_retry", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(result, { status: "retry_failed" });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_retry");
  assert.equal(row.processing_status, "processing");
});

test("a second concurrent claim of the same failed event loses the race and gets 'already_processing'", async () => {
  // Simulate: request A already flipped the row to "processing" in the same
  // instant request B reads it. B's conditional UPDATE (WHERE
  // processing_status = 'failed') then matches zero rows.
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_race2", event_type: "invoice.paid", processing_status: "processing" }],
  });
  const result = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_race2", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(result, { status: "already_processing" });
});

// ── mark processed / ignored / failed ────────────────────────────────────

test("markBillingWebhookEventProcessed sets processing_status to 'processed' and clears error_reason", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_ok", event_type: "invoice.paid", processing_status: "processing" }],
  });
  await markBillingWebhookEventProcessed({ supabase, eventId: "evt_ok" });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_ok");
  assert.equal(row.processing_status, "processed");
  assert.equal(row.error_reason, null);
  assert.ok(row.processed_at);
});

test("markBillingWebhookEventIgnored records a sanitized reason and does not touch other rows", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [
      { event_id: "evt_ignore_me", event_type: "customer.tax_id.updated", processing_status: "processing" },
      { event_id: "evt_untouched", event_type: "invoice.paid", processing_status: "processed" },
    ],
  });
  await markBillingWebhookEventIgnored({ supabase, eventId: "evt_ignore_me", reason: "unsupported_event_type:customer.tax_id.updated" });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_ignore_me");
  assert.equal(row.processing_status, "ignored");
  assert.equal(row.error_reason, "unsupported_event_type:customer.tax_id.updated");
  const other = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_untouched");
  assert.equal(other.processing_status, "processed");
});

test("markBillingWebhookEventIgnored/Failed sanitize newlines and cap length so nothing multi-line or oversized is persisted", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_long", event_type: "invoice.paid", processing_status: "processing" }],
  });
  const longReason = `first line\nsecond line\r\nthird line ${"x".repeat(1000)}`;
  await markBillingWebhookEventFailed({ supabase, eventId: "evt_long", reason: longReason });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_long");
  assert.equal(row.processing_status, "failed");
  assert.ok(!row.error_reason.includes("\n"));
  assert.ok(!row.error_reason.includes("\r"));
  assert.ok(row.error_reason.length <= 500);
});

test("markBillingWebhookEventFailed leaves the row retryable (status 'failed', not 'processed')", async () => {
  const supabase = createFakeBillingSupabase({
    billingWebhookEvents: [{ event_id: "evt_crash", event_type: "invoice.paid", processing_status: "processing" }],
  });
  await markBillingWebhookEventFailed({ supabase, eventId: "evt_crash", reason: "Unable to persist company subscription: db unavailable" });
  const row = supabase.tables.billing_webhook_events.find((r) => r.event_id === "evt_crash");
  assert.equal(row.processing_status, "failed");

  const retry = await beginBillingWebhookEventProcessing({ supabase, eventId: "evt_crash", eventType: "invoice.paid", livemode: false });
  assert.deepEqual(retry, { status: "retry_failed" });
});
