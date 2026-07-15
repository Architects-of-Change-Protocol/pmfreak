# 08 — Security and Reliability

## A. Security posture summary

This audit independently spot-checked (not merely re-read) the repository's own extensive prior security documentation and found it accurate — every claim independently verified matched: no hardcoded secrets in `src/` (only detection-regex patterns, not leaks), no service-role key exposure to client bundles, real security headers/CSP wired via `next.config.ts:14-31` → `getSecurityHeaders()`, a genuinely wired (not documentation-only) rate-limiting chokepoint (`enforceAbuseLimit()`), and a live `npm audit` re-run matching the documented 0 critical/0 high/4 moderate (all pre-classified as accepted/unreachable).

### OWASP-style findings, classified

| Area | Finding | Severity | Ref |
|---|---|---|---|
| Information disclosure | Raw Postgres error messages returned to authenticated callers on ~10 SDK/governance routes | P1 | F-07 |
| IDOR / access control | `vault/intake` relies on RLS alone, no app-layer membership pre-check | P2 | F-13 |
| RLS / broken access control | `governance_delegations` SELECT policy references non-existent table (silent failure) | P1 | F-06 |
| RLS / broken access control | Two tables on legacy `company_id` tenant model | P2 | F-12 |
| Injection | No SQL injection surface found — all DB access goes through Supabase client/RPCs, no raw string-concatenated queries found in this audit's sampling | — | Confirmed clean in sampled routes |
| XSS | Next.js/React default escaping in use; no `dangerouslySetInnerHTML` misuse found in sampled components | — | Not exhaustively re-audited this pass; carried from prior hardening |
| CSRF | Server Actions origin allowlist enforced, dev-only origins excluded in production | — | `next.config.ts:9-20` |
| SSRF | Not independently re-audited this pass; no obvious user-controlled outbound URL fetch found in sampled AI/webhook code | — | Recommend a dedicated pass before public launch |
| Webhook forgery | Stripe webhook signature verified before any privileged DB client is created | — | Confirmed, `src/app/api/billing/webhook/route.ts:50-80` |
| File uploads | Quota-enforced, workspace-scoped; not independently re-audited for content-type/malware scanning this pass | — | Recommend a dedicated pass before public launch |
| Secret leakage | None found in `src/`; env/secret boundary code fails closed in production for missing/localhost-shaped secrets | — | Confirmed, `src/lib/security/environment.ts:108-139` |
| Dependency risk | 0 critical/0 high; 4 moderate, all pre-classified accepted/unreachable; `xlsx` package hard-blocked from reappearing | — | Confirmed via live `npm audit` re-run |
| Rate limiting / abuse | Real fixed-window rate limiter, fails closed on store errors, SHA-256+peppered identifiers (no raw PII stored) | — | `src/lib/security/abuse-protection.ts` |
| Tenant enumeration | Not independently re-audited; invite/signup error messages are generic per prior hardening docs | — | Carried from prior work |
| Privilege escalation | Explicitly tested against in the billing/role boundary test suite (`user_metadata.role` cannot elevate; client-supplied role fields ignored) | — | `tests/billing-checkout-session-route.test.mjs:138,160` |
| Admin exposure | Founder-only surface correctly gated after a fixed prior vulnerability (page previously had zero founder gate) | — | `docs/security/admin-founder-endpoint-boundary.md` |
| Error leakage | See "Information disclosure" above — the one real gap found net-new by this audit | P1 | F-07 |
| Encryption | TLS via platform (Vercel); at-rest encryption via Supabase/Postgres defaults; no PMFreak-specific field-level encryption found for sensitive data beyond hashed invite tokens | — | Not flagged as a gap for current data sensitivity, revisit if handling regulated data types |
| Key rotation | No automated secret rotation; env-var based only | P2/P3 | Carried from `docs/release/residual-risk-register.md` (RR-SECRETS) |
| Incident response | No formal documented incident-response runbook found beyond the security docs' own "boundary fixed" records | P2 | Recommend drafting before public launch, ties to F-01 (legal disclosure obligations) |

### P0/P1/P2/P3 rollup for security specifically

- **P0:** None net-new from this audit's security pass alone (the release-blocking P0s — RR-MIGRATE, RR-BACKUP — are reliability/operational, listed below and in `04-critical-findings.md`).
- **P1:** Raw error-message leakage (F-07); no pentest yet (F-18).
- **P2:** Legacy `company_id` RLS on 2 tables (F-12); RLS-only enforcement on `vault/intake` (F-13); no secret rotation; no formal incident-response runbook.
- **P3:** `postcss` moderate advisory (accepted, unreachable, build-time only).

## B. Reliability and observability

| Area | State |
|---|---|
| Health/readiness | Real: `/api/health` (liveness), `/api/ready` (config-var presence + live anon-key REST HEAD ping to Supabase, bounded timeout, 503 on failure) |
| Structured logging | Real: `src/lib/observability/logger.ts` — level-gated, every field passed through `redactSecretLikeValues()`, never throws |
| Error tracking / alerting | **Absent** — no Sentry/Datadog/PagerDuty-class integration; monitoring is log/audit-table-based with a manual daily-check cadence (repository's own admission, RR-MONITOR) |
| Job/queue monitoring | Not applicable yet — no dedicated background job queue system found |
| DB monitoring | Not independently verified this pass beyond `/api/ready`'s connectivity check |
| Cost monitoring | Real for AI spend specifically (`ai_usage_events`, per-workspace daily cost ceiling); no broader infra cost monitoring found |
| Tenant health | Not built as a distinct surface |
| Incident response | No formal runbook found |
| Rollback | Deployment is external to this repo (Vercel git-integration auto-deploy); no in-repo rollback tooling/documentation found |
| RPO/RTO | Undefined — ties directly to F-05 (no rehearsed backup restore) |
| Backup restore tests | **Never performed** (F-05, P0) |
| Hosted-DB migration proof | **Never performed against a real hosted Supabase project** (F-04, P0) — only a hand-stubbed local Postgres 16, which did catch and fix 26 real defects |

**Overall reliability verdict:** The application-layer resilience patterns that exist (fail-closed env safety, idempotent webhook processing, atomic quota RPCs) are genuinely solid. The organizational/operational side of reliability — proven backups, proven hosted-environment deployability, external alerting — has not been exercised at all. This is the correct read of the repository's own verdict (`CONDITIONAL GO, closed pilot only`) and this audit found no reason to either upgrade or downgrade that conclusion; if anything, the newly-found scaffolding/reality gap (F-03) argues for continued caution about self-certified "production-ready" claims anywhere in this codebase until independently verified.
