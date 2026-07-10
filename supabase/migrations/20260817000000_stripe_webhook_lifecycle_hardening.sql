-- Perilla 6 — Stripe Webhook / Billing Lifecycle Trust Boundary.
--
-- Hardens the existing billing_webhook_events idempotency table so it can
-- express the full begin/processed/ignored/failed lifecycle instead of only
-- recording a row at insert time. Previously a row was written immediately
-- when processing began, so a processing failure left the event permanently
-- marked "seen" with no way to distinguish "successfully applied" from
-- "started but crashed" — Stripe's automatic retries were silently absorbed
-- as no-ops instead of being retried. See
-- docs/security/stripe-webhook-billing-lifecycle-boundary.md.

alter table public.billing_webhook_events
  add column if not exists processing_status text not null default 'processed'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed'));

alter table public.billing_webhook_events
  add column if not exists error_reason text;

alter table public.billing_webhook_events
  add column if not exists livemode boolean not null default false;

alter table public.billing_webhook_events
  add column if not exists received_at timestamptz not null default timezone('utc', now());

alter table public.billing_webhook_events
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.billing_webhook_events
  alter column processed_at drop not null;

comment on column public.billing_webhook_events.processing_status is
  'processing = claimed by an in-flight request; processed = applied successfully (or safely ignored); ignored = recognized but intentionally not mutated (unknown event, unmapped customer, unknown price); failed = processing started but raised, eligible for retry on redelivery.';

create index if not exists billing_webhook_events_status_idx
  on public.billing_webhook_events (processing_status);

-- Subscription-id → company mapping reuses the existing
-- company_subscriptions.stripe_subscription_id column (one row per company,
-- already unique-indexed) rather than a new table — see
-- findCompanyIdByStripeSubscriptionId in src/lib/billing.ts.
