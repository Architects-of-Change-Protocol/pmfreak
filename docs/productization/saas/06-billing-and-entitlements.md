# 06 — Billing, Entitlements, and Usage Metering

## A. Billing audit

| Capability | State | Evidence |
|---|---|---|
| Customers | Real (Stripe customer created/mapped to `company_subscriptions`) | `src/lib/billing.ts` |
| Subscriptions | Real, webhook-driven state machine | `src/lib/billing-webhook-lifecycle.ts` |
| Plans/Prices | Real but hardcoded (2 paid Stripe prices, env-var mapped) | `.env.example:120-121`; F-14 |
| Payment methods | Delegated entirely to Stripe-hosted Billing Portal | `src/app/api/billing/create-portal-session/route.ts` |
| Invoices | Delegated to Stripe-hosted portal; no native invoice UI | — |
| Trials | No native Stripe trial period; a separate internal `trial_licenses`/early-access mechanism serves this role today | `src/lib/early-access.ts` (F-15) |
| Coupons | **Absent** | F-15 |
| Taxes | **Absent** (no Stripe Tax config) | F-15 |
| Dunning | Not built; relies on Stripe's own default retry/dunning behavior via webhooks | `billing-webhook-lifecycle.ts` (`invoice.payment_failed` handled) |
| Grace periods | Not explicitly modeled beyond Stripe's subscription status transitions | — |
| Cancellation | Delegated to Stripe portal | — |
| Upgrades/downgrades | Handled via Stripe checkout/portal + webhook sync | `billing-webhook-lifecycle.ts` |
| Prorations | Stripe default behavior; not customized | — |
| Refunds | Not handled in-app | — |
| Webhook handling | **Hardened**: signature verified before any DB client creation, idempotent via `billing_webhook_events` state machine, atomic re-claim of failed events | `src/app/api/billing/webhook/route.ts:50-80`; `src/lib/billing.ts:241-343` |
| Reconciliation | `company_subscriptions.stripe_customer_id`/`stripe_subscription_id` as sole authority; Stripe metadata used only for mismatch logging, never authorization | `src/lib/billing-webhook-lifecycle.ts:120-142` |
| Idempotency | Real, tested (`checkout:${companyId}:${plan}` idempotency key; DB-level idempotent event processing) | `src/app/api/billing/create-checkout-session/route.ts:177-179` |

**Verdict: usable-for-pilots.** The trust boundary, authorization, and idempotency are genuinely production-grade — better than most early-stage SaaS. What's missing is conventional commercial billing surface area (coupons, tax, native trials, invoice/dunning UI), not architecture or security.

## B. Entitlements audit

PMFreak maintains a real three-layer separation:

1. **Subscription state (source of truth):** `getCompanySubscription()` reads `company_subscriptions.plan`/`subscription_status` from Postgres.
2. **Capability mapping:** `PLAN_CAPABILITIES` in `src/lib/feature-gates.ts:16-86` maps `free`/`pro`/`pmo` to concrete capabilities (AI analysis, exports, upload limits, PMO workspaces, seat limits, team-member invites).
3. **Server-side enforcement:** `requireFeatureAccess()`, `requirePMOAccess()`, `requireSeatAvailability()`, `canCreateMoreProjects()`, `canUseAdvancedAi()`, etc. — all query the DB and return structured `402 upgrade_required` denials, invoked from real routes/services, not just UI conditionals.

This is a genuine UI-visibility vs. subscription-state vs. server-enforcement separation — confirmed by an explicit code comment: *"Server must remain the source of truth: clients can hide UI affordances, but only the API can enforce access boundaries."*

**One cleanup item (not a security gap):** `src/lib/plan-access.ts` and `src/lib/usage-limits.ts` duplicate overlapping capability checks already in `feature-gates.ts` — worth consolidating into a single module before scaling the entitlement surface further, to avoid the two implementations drifting apart.

### Feature / entitlement separation table

| Feature | PMFreak entitlement | AOC entitlement | Enforcement point |
|---|---|---|---|
| AI analysis / advanced AI actions | `PLAN_CAPABILITIES.ai_analysis` (plan-gated) | N/A today (no external AOC capability entitlement exists to consume yet) | `src/lib/feature-gates.ts` server-side check |
| Exports | `PLAN_CAPABILITIES.exports` | N/A | `feature-gates.ts` |
| Seats | `PLAN_CAPABILITIES.seat_limit` | N/A | `requireSeatAvailability()` |
| PMO workspaces / team invites | `PLAN_CAPABILITIES.pmo_workspaces`, `pmo_team_members` | N/A | `requirePMOAccess()`, `canInviteTeamMembers()` |
| Upload / storage | `PLAN_CAPABILITIES.file_upload_limit` | N/A | Atomic quota reserve/commit RPCs (`src/lib/quota/upload-quota.ts`) |
| Agent identity / passport | N/A (does not exist) | Would be `AgentIdentityPort`/`AgentPassportPort` entitlement, once an external provider exists | Not yet enforced anywhere — F-02 |
| Assurance tier | N/A | Would be `AssuranceStatusPort` entitlement | Not yet built |

**Do not confuse these two entitlement types when designing the future AOC-consuming enforcement layer** — per the governing brief, PMFreak plan entitlement (what a customer's subscription unlocks in the product) and AOC capability entitlement (what an external provider grants the underlying agent/service identity to do) must stay architecturally distinct, with the latter consumed via `EntitlementPort` (see `07-aoc-consumer-architecture.md`) once it exists.

## C. Usage / metering

| Usage type | Owner | State |
|---|---|---|
| AI tokens / inference cost | PMFreak | Real: `ai_usage_events` table, per-call recording, per-workspace daily request ceiling (fails closed) and cost ceiling (fails open on accounting-read failure, F-20). Pricing table covers only 5 hardcoded OpenAI models. |
| Uploads | PMFreak | Real: `company_usage.upload_count`, atomic reserve/commit/cancel RPCs. |
| Seats | PMFreak | Real: enforced at invite time via `requireSeatAvailability()`. |
| Agent runs / automation runs | PMFreak | **Not metered** — agent tool execution is currently in-memory only (F-11), so there is nothing durable to meter yet. |
| Projects / portfolios | PMFreak | Real count-based limit (`PROJECT_LIMITS` in `feature-gates.ts`). |
| AOC capability calls | AOC Enterprise (external, once it exists) | Not applicable yet — no external AOC provider is being called today. |
| Assurance usage | AOC Assurance (external, once it exists) | Not applicable yet. |

**Consumer-side ledger requirement (forward-looking):** Once PMFreak begins consuming AOC Enterprise's usage reservation/settlement APIs, it must maintain its own consumer-side ledger — sufficient for reconciliation, customer display, cost allocation, and dispute handling — without becoming the source of truth for the AOC-managed ledger itself. No such ledger exists yet because there is nothing external to reconcile against. When it is built, it should follow the same pattern already proven for AI usage accounting (`ai_usage_events`): append-only, service-role-write-only, workspace-scoped.

**Current customer-facing usage visibility: none.** There is no usage dashboard shown to end users beyond the `/api/billing/state` plan/status surface. This is a gap worth closing alongside F-10 (analytics), since usage transparency reduces support burden and billing disputes.
