# 12 — First 30 Actions

Ordered per the priority order in the brief (security → tenant isolation → authorization → data integrity → SaaS lifecycle → billing/entitlements → observability → supportability → AOC consumer ports → AOC adapter → usage reconciliation → B2C onboarding → B2B collaboration → admin tooling → compliance → enterprise → growth). Each is sized: S (< 1 day), M (1–3 days), L (1–2 weeks), XL (multi-week).

| # | Objective | Path/module | Dependency | Owner | Size | Risk | Acceptance criteria | Stage |
|---|---|---|---|---|---|---|---|---|
| 1 | Fix raw-error-message leakage on SDK/governance routes (F-07) | `src/app/api/{governance,sdk,v1}/**` | None | Eng | M | Low | All 10 identified routes use `safeErrorMessage()`; test added | Before pilots |
| 2 | Fix `governance_delegations` RLS policy typo (F-06) | New migration | None | Eng | S | Low | Live-DB test confirms scoped reads work for members, deny for non-members | Before pilots |
| 3 | Add app-layer membership check to `vault/intake` (F-13) | `src/app/api/vault/intake/route.ts` | None | Eng | S | Low | Route denies non-members before any DB call, independent of RLS state | Before pilots |
| 4 | Migrate `onboarding_analyses`/`governance_audit_events` to workspace-native RLS (F-12) | New migration | None | Eng | M | Low | Both tables pass the same live two-workspace RLS smoke test as the rest of schema | Before B2B |
| 5 | Execute hosted-Supabase migration proof, close RR-MIGRATE (F-04) | `docs/release/database-bootstrap-runbook.md` §10 | Hosted Supabase project + credentials | Founder/Eng | M | Medium | All migrations apply clean on hosted project; report closes RR-MIGRATE | Before pilots |
| 5b | Run and document backup/restore drill, close RR-BACKUP (F-05) | Ops | Hosted Supabase project | Founder/Eng | M | Medium | Documented drill with RPO/RTO numbers | Before pilots |
| 6 | Add live-DB regression test for the RLS fix in #2 | `tests/` | #2 | Eng | S | Low | Test runs against a real/local Postgres, not a static scan | Before pilots |
| 7 | Correct false CI-coverage claim in `pm-registry-operationalization.test.mjs` | `tests/pm-registry-operationalization.test.mjs:9-12` | None | Eng | S | Low | Docstring accurately reflects actual test coverage | Before pilots |
| 8 | Draft and publish Terms of Service + Privacy Policy (F-01) | `src/app/{terms,privacy}` | Legal review (external or template) | Founder | M | Low | Routes live, footer links enabled, signup requires acceptance | Before charging |
| 9 | Add account deletion (self-service or support-mediated) (F-09) | New module | #8 (policy should state the commitment first) | Eng | L | Medium | User/support can trigger deletion with documented cascade behavior and audit trail | Before public B2C |
| 10 | Add full-account data export (F-09) | New module | None | Eng | M | Low | User can request and receive a full export | Before public B2C |
| 11 | Consolidate `plan-access.ts`/`usage-limits.ts` into `feature-gates.ts` | `src/lib/{plan-access,usage-limits,feature-gates}.ts` | None | Eng | M | Low | Single entitlement module, no duplicated logic | Before B2B scale |
| 12 | Fix AI cost-ceiling fail-open behavior (F-20) | `src/lib/ai/usage-accounting.ts` | None | Eng | S | Low | Cost-ceiling accounting-read failure now falls back to request-count ceiling as hard backstop | Before public launch |
| 13 | Add Stripe Tax + at least one coupon path (F-15) | `src/app/api/billing/*` | None | Eng | M | Low | Tax enabled on checkout; coupon path tested | Before public launch |
| 14 | Add native Stripe trial period option per plan (F-15) | `src/lib/billing.ts`, checkout route | None | Eng | M | Low | Trial period configurable and tested end-to-end | Before public B2C |
| 15 | Integrate external error tracking/alerting (F-17) | New (e.g. Sentry) | Vendor selection | Eng | M | Low | A production error triggers an alert within minutes | Before public launch |
| 16 | Un-orphan PMO Command Center / PM Registry from navigation (F-21) | `src/lib/workspace/navigation-hierarchy.ts`, `route-policy-registry.ts` | Product decision on readiness per module | Founder/Eng | M | Low | Reachable modules appear in nav with passing smoke test; deferred ones documented with owner/date | Before B2B demos |
| 17 | Build a founder-extended "support operator" role for customer/org lookup (F-16, phase 1) | New | Reuses `isFounderOrInternalUser` pattern | Eng | L | Medium | Distinct role exists; every admin action attributed/audit-logged | Before B2B scale |
| 18 | Define the PMFreak-owned AOC ports as TypeScript interfaces (conceptual only, no implementation) | `src/aoc/runtime-consumer` or new `ports/` dir | `07-aoc-consumer-architecture.md` | Eng | M | Low | 10 ports defined as interfaces matching the audit's spec; no behavior change | Before AOC adapter work |
| 19 | Build the transactional outbox table + retry/DLQ infra pattern (generalizing the proven billing-webhook idempotency pattern) | New | #18 | Eng | L | Low | Outbox pattern reusable for evidence/usage-commit/health-reporting once needed | Before AOC adapter work |
| 20 | Document (not implement) the AOC adapter binding plan against `runtime-consumer` once an external provider is selected | `docs/architecture/aoc-*` | External AOC provider must exist | Founder | S | Low | Clear "when X exists, do Y" plan recorded | When external AOC provider exists |
| 21 | Design consumer-side AOC usage ledger schema (dormant until AOC Enterprise consumption begins) | New migration (design only, don't apply until needed) | #18, external provider | Eng | M | Low | Schema reviewed, not yet applied | When AOC usage is first billed |
| 22 | Fix the "AI first insight" onboarding moment — either wire to a real model call or relabel honestly | `src/components/pmfreak/onboarding/AIActivationTransition.tsx`, `operational-governance-brief-engine.ts` | None | Eng | M | Medium (commercial/trust risk if left mislabeled) | Either genuinely LLM-backed, or UI copy no longer implies live AI analysis | Before public B2C |
| 23 | Add at least one OAuth provider (Google) (F-08) | `src/app/{login,signup}` | OAuth app registration | Eng | M | Low | Working OAuth sign-in, covered by test | Before public B2C |
| 24 | Add TOTP MFA enrollment/challenge (F-08) | `src/app/(protected)/settings` (new) | None | Eng | L | Low | Working MFA flow, covered by test | Before B2B scale |
| 25 | Integrate basic product analytics for the activation funnel (F-10) | App-wide instrumentation | Vendor selection | Eng | L | Low | Signup→first-project→first-AI-interaction→first-invite funnel visible outside founder dashboard | Before public launch |
| 26 | Build workspace owner-transfer flow (F-20 in scorecard / roadmap) | `src/lib/workspace-access.ts` | None | Eng | M | Low | An owner can transfer ownership without a last-owner-demotion bug | Before B2B scale |
| 27 | Produce the internal "scaffolding register" separating real from speculative modules (F-03) | New internal doc, not customer-facing | This audit | Founder | S | Low | Every `docs/architecture` doc describing a speculative module is labeled non-production | Immediately |
| 28 | Audit and correct any customer- or investor-facing material that describes scaffolding-layer capability as live (F-03) | Marketing/pitch materials (outside this repo) | #27 | Founder | S | Medium | No external material overstates AI-agent autonomy or governance maturity | Immediately |
| 29 | Commission a third-party penetration test (F-18) | External vendor | Budget | Founder | L | Medium | Report received, critical/high findings remediated | Before opening beyond closed pilot |
| 30 | Draft a DPA + subprocessor list template for the first B2B/enterprise contract (extension of F-01) | `docs/legal` (new) | #8 | Founder | M | Low | Template ready to execute with first B2B design partner | Before first B2B contract |

**Explicit gating, per the brief's requirement:**
- **Before pilots:** 1–7.
- **Before charging:** 8 (plus everything before pilots).
- **Before B2B:** 4, 11, 16, 17, 24, 26 (plus everything before charging).
- **Before public launch:** 9, 10, 12–15, 22, 23, 25 (plus everything before B2B).
- **Before enterprise:** 18–21, 29, 30 fully resolved, plus SSO/SCIM (tracked in `11-roadmap.md` Scenario C, not itemized here since it depends on an external AOC provider existing first).
