# 04 — Critical Findings

Severity: **P0** launch blocker/critical security · **P1** required before charging · **P2** required for B2B scale · **P3** later optimization.

---

### F-01 · Legal/Compliance · No Terms of Service, Privacy Policy, or DPA exist
**Description:** No legal artifacts exist anywhere in the repo or public assets. The landing page footer links to "Privacy Policy" and "Terms of Service" are hardcoded `disabled: true`.
**Evidence:** `src/app/page.tsx:158-159`; repo-wide search for ToS/Privacy/DPA/subprocessor content returns nothing outside one internal design-principle doc (`docs/architecture/customer-owned-organizational-memory-framework.md:12`).
**Current state → Target state:** No legal pages exist → Published ToS, Privacy Policy, and (for B2B) DPA + subprocessor list, linked and enforced at signup.
**Segment affected:** All (B2C, B2B, Enterprise). **Severity:** P0.
**Technical risk:** Low. **Security risk:** Low directly, but no documented data-handling commitments to customers. **Commercial risk:** Cannot legally charge or process customer data without these. **Valuation impact:** High — undisclosed legal gap is a diligence red flag.
**Complexity:** Low (drafting + one route each). **Dependency:** Legal counsel or template review before publishing.
**Recommendation:** Draft and publish ToS/Privacy/Cookie policy before any paid signup is enabled; DPA + subprocessor list before first B2B contract.
**Acceptance criteria:** `/terms`, `/privacy`, `/legal` routes live with real content; footer links enabled; signup flow requires acceptance.

---

### F-02 · AOC Consumer Architecture · PMFreak currently self-implements canonical AOC capabilities
**Description:** PMFreak owns and operates the actual cryptographic issuance/verification of capability claims (`src/aoc/protocol/contracts/capability-claims.ts`, HMAC-SHA256/Ed25519 via Node `crypto`), the revocation registry (`src/lib/security/trust-coordination.ts`), trust-domain key lifecycle (`src/lib/security/trust-domains.ts`), and agent attestation — all backed by PMFreak's own Postgres tables and its own signing secret `PMFREAK_CAPABILITY_CLAIM_SECRET`. This is precisely the ownership the governing brief assigns to an external AOC Protocol/Enterprise/Assurance provider.
**Evidence:** See `07-aoc-consumer-architecture.md` §"Legacy classification" for the full file list; `src/aoc/enterprise/runtime/external-authority-adapter.ts:10-30` — all three external provider modes throw `RuntimeAuthorityUnavailableError` on every method (stub only); `docs/architecture/runtime-authority-port-externalization.md:6-9,22-23` states this outright.
**Current state → Target state:** PMFreak is the canonical authority (in-process only, no external mode functions) → PMFreak consumes an external AOC provider via the ports defined in `07-aoc-consumer-architecture.md`, with local storage limited to references/projections/cache.
**Segment affected:** Enterprise (blocks credible identity/trust story); indirectly all segments (architecture debt). **Severity:** P0 for the mandate this audit was scoped against; not a P0 for near-term pilot revenue since no external AOC provider exists yet to consume.
**Technical risk:** Medium-high — untangling `capability-claims.ts`'s dependency on PMFreak's own trust/telemetry modules is explicitly flagged in `docs/architecture/aoc-multi-repo-extraction-plan.md:88` as inverted and unresolved. **Security risk:** Medium — a single-tenant-owned signing secret for "trust" claims is a concentration-of-authority risk if ever marketed as third-party-verified trust. **Commercial risk:** High for enterprise/regulated buyers who expect independently-audited identity/trust. **Valuation impact:** High if presented as "AOC-compliant" without disclosing the gap.
**Complexity:** High (multi-quarter, depends on an external AOC Protocol/Enterprise repo existing). **Dependency:** External AOC Protocol/Enterprise must exist and publish a real SDK/contract before real consumption can happen.
**Recommendation:** Do not market current claim/trust/attestation code as "AOC-verified" or "externally assured." Treat `src/aoc/*` as the extraction staging area it already is; prioritize finishing the ports/adapters split (already ~60% done per boundary tooling) so that swapping `in_process` for a real external provider is a configuration change, not a rewrite.
**Acceptance criteria:** See `07-aoc-consumer-architecture.md` launch-stage requirements per port.

---

### F-03 · Product Domain / Valuation · Governance-vocabulary scaffolding is functionally inert
**Description:** Roughly 40+ of ~120 `src/lib` directories and 94 `docs/architecture` files (18 of them self-titled `CURRENT_STATE_*.md`) constitute a "constitutional/sovereign/governance/digital-twin/predictive-intelligence" layer that is, on inspection, not load-bearing: hardcoded topology data (`organizational-digital-twin-topology.ts:5-7`), in-memory-only agent tool execution with side effects hard-disabled (`agent-tool-adapter-service.ts:1-4`, `externalSideEffectsEnabled: false`), and a meaningful fraction of its own tests (at least 133/435 files) asserting on source-code *text* rather than executing the code, or reimplementing the logic from scratch inside the test file rather than importing the shipped module (e.g. `tests/authority-governance.test.mjs`, 1,068 lines, zero imports from `src/`).
**Evidence:** See product-domain-inventory research findings; `CURRENT_STATE_LIVE_FEDERATION_RUNTIME.md:126-133`, `CURRENT_STATE_PRODUCTION_RUNTIME.md:152-160` self-admit no live integration.
**Current state → Target state:** Scaffolding is undifferentiated from the real product in `src/lib`, `docs/architecture`, and marketing/architecture narrative → Clearly labeled as prototype/roadmap in all external-facing material; either built out to real functionality or removed from any "current capability" claim.
**Segment affected:** All — this is a credibility/valuation risk, not a per-segment technical gap. **Severity:** P0 for any fundraising, diligence, or enterprise-sales conversation; not a P0 for the pilot itself since none of this code is reachable in the product's actual navigation.
**Technical risk:** Low (it's inert, so it can't break what customers use). **Security risk:** Low-medium (self-certifying "governance" tests that don't execute code could mask a real regression in the few places this layer *is* wired in, e.g. `playbook-engine`). **Commercial risk:** High if disclosed late in diligence. **Valuation impact:** High — could read as intentional misrepresentation if not proactively disclosed.
**Complexity:** Low to inventory/label; high to make real. **Dependency:** Founder decision on which of these domains (if any) are worth building out vs. archiving.
**Recommendation:** Immediately stop describing this layer with production-maturity language in any customer- or investor-facing material. Produce (as part of this audit's backlog) an explicit "scaffolding register" separate from the real capability inventory. See `13-do-not-build.md`.
**Acceptance criteria:** No `docs/architecture` or marketing document describes an inert module as delivering "no fabricated insights" or similar production-maturity claims without a corresponding real DB/UI wiring citation.

---

### F-04 · Release Readiness · No hosted-Supabase migration proof (RR-MIGRATE, still OPEN)
**Description:** All 146+ migrations have only been proven against a hand-stubbed local Postgres 16, not a real hosted Supabase project (no credentials/Docker were available to prior work). 26 real defects were found and fixed in that local proof, which is a positive signal, but the hosted-environment proof itself remains unexecuted.
**Evidence:** `docs/release/fresh-database-migration-proof.md:1-12,74,131`; `docs/release/existing-database-compatibility-report.md:3,63` ("Status: NOT EXECUTED").
**Current state → Target state:** Local-only proof → Hosted Supabase project runs full migration set clean, with the same live two-workspace RLS smoke test passing.
**Segment affected:** All. **Severity:** P0 (explicit pilot blocker per the repo's own risk register).
**Technical risk:** Medium (hosted Postgres has real extensions/behavior differences from a hand-stubbed local instance). **Security risk:** Low if executed carefully. **Commercial risk:** High — cannot responsibly onboard a real customer's data without this. **Valuation impact:** Medium.
**Complexity:** Low-medium (needs hosted credentials, which is an access problem more than a technical one). **Dependency:** Hosted Supabase project + credentials.
**Recommendation:** Execute `docs/release/database-bootstrap-runbook.md` §10 against a real hosted Supabase project before any pilot customer's data is created.
**Acceptance criteria:** `RR-MIGRATE` closed in `docs/release/residual-risk-register.md` with a hosted-run report.

---

### F-05 · Release Readiness · No rehearsed backup/restore (RR-BACKUP, still OPEN)
**Description:** Backup restore has never been rehearsed; point-in-time-recovery status on any pilot Supabase project is unconfirmed.
**Evidence:** `docs/release/residual-risk-register.md` (RR-BACKUP entry).
**Current state → Target state:** Unrehearsed → A documented, timed restore drill against a real backup, with RPO/RTO numbers recorded.
**Segment affected:** All. **Severity:** P0.
**Technical risk:** Medium. **Security risk:** Low. **Commercial risk:** High (data loss with no proven recovery path). **Valuation impact:** Medium.
**Complexity:** Low-medium. **Dependency:** Hosted Supabase project (same as F-04).
**Recommendation:** Run and document one full restore drill before onboarding real pilot data.
**Acceptance criteria:** `RR-BACKUP` closed with a documented drill result including RPO/RTO.

---

### F-06 · Multi-tenancy / RLS · Known, unfixed RLS policy bug on `governance_delegations`
**Description:** The `governance_delegations` SELECT policy references a non-existent table `public.workspace_members` (should be `workspace_memberships`), which silently fails all scoped reads through that policy.
**Evidence:** `docs/security/service-role-risk-register.md:94-95` (repository's own admission, not yet remediated).
**Current state → Target state:** Broken/silently-failing policy → Corrected policy referencing `workspace_memberships`, verified with a live read test.
**Segment affected:** B2B (governance/delegation features). **Severity:** P1.
**Technical risk:** Low (one-line SQL fix). **Security risk:** Medium (silent failure could read as either over- or under-permissive depending on Postgres policy-evaluation defaults — needs explicit verification, not assumption). **Commercial risk:** Low today (feature not customer-reachable per F-21) but must be fixed before it is. **Valuation impact:** Low.
**Complexity:** Low. **Dependency:** None.
**Recommendation:** Fix as a single, isolated migration; add a regression test that exercises the policy against a live/local Postgres, not just a static scan.
**Acceptance criteria:** New migration corrects the table reference; a live-DB test (not a source-text scan) confirms scoped reads succeed for members and are denied for non-members.

---

### F-07 · Security · Raw Postgres error messages leak to authenticated callers
**Description:** At least 10 API routes (SDK and governance families) return `error.message` from Supabase/Postgres driver errors directly in the JSON response body, rather than the sanitized `safeErrorMessage()` helper used elsewhere (e.g. Stripe webhook, `/api/ready`).
**Evidence:** `src/app/api/governance/delegations/route.ts:13`, `src/app/api/v1/delegations/route.ts:15`, `src/app/api/governance/approvals/route.ts:9`, `src/app/api/governance/trust/events/route.ts:23`, `src/app/api/governance/trust/events/import/route.ts:17`, `src/app/api/sdk/agents/route.ts:21,38`, `src/app/api/sdk/policies/route.ts:20,37`, `src/app/api/sdk/audit/{agents,capabilities,resources}/route.ts`.
**Current state → Target state:** Raw driver error text returned to any authenticated caller who triggers a DB error → Sanitized, generic error responses via `safeErrorMessage()`, matching the pattern already used in the billing webhook route.
**Segment affected:** B2B/enterprise (SDK consumers most likely to trigger these paths). **Severity:** P1 (info disclosure to authenticated users, not exploitable pre-auth — not P0).
**Technical risk:** Low. **Security risk:** Medium (table/column/constraint-name disclosure aids a determined authenticated attacker). **Commercial risk:** Low-medium. **Valuation impact:** Low.
**Complexity:** Low (mechanical find-and-replace across ~10 routes). **Dependency:** None.
**Recommendation:** Apply `safeErrorMessage()` (already built in the Perilla 10 hardening round) across the identified SDK/governance route family; add this route family to the boundary test suite that already covers other route classes.
**Acceptance criteria:** All identified routes return a generic error message to the client; server-side logs retain the full error via the redacting logger.

---

### F-08 · Auth · No OAuth/social login, no MFA
**Description:** Only Supabase email/password auth is implemented. No `signInWithOAuth`, no `signInWithOtp`, no MFA/factors calls exist anywhere in the codebase.
**Evidence:** Repo-wide grep confirms zero matches; `src/app/login/page.tsx`, `src/app/signup/page.tsx` have no social login UI.
**Current state → Target state:** Password-only → At minimum Google/Microsoft OAuth for B2C conversion, MFA (at least TOTP) for B2B/enterprise credibility.
**Segment affected:** B2C conversion (OAuth), B2B/Enterprise trust (MFA). **Severity:** P1 before public B2C launch (OAuth improves conversion materially); P2 for B2B (many B2B buyers will ask about MFA/SSO during evaluation, but a closed pilot can proceed without it).
**Technical risk:** Low-medium (well-trodden Supabase Auth feature). **Security risk:** Low (current password flow is itself reasonably hardened — rate-limited, generic error messages). **Commercial risk:** Medium. **Valuation impact:** Low.
**Complexity:** Low-medium. **Dependency:** None technical; OAuth app registration with each provider.
**Recommendation:** Add Google OAuth before public B2C launch; add TOTP MFA before first B2B contract that requires it; defer full SSO/SCIM to enterprise phase (see `11-roadmap.md` Scenario C).
**Acceptance criteria:** Working OAuth sign-in path; working MFA enrollment/challenge flow, both covered by tests in the existing auth-boundary test pattern.

---

### F-09 · Account Lifecycle · No account deletion or data export
**Description:** No `auth.admin.deleteUser` call or "delete account" route/action exists anywhere in the codebase; no GDPR/CCPA-style data export endpoint exists (only computed-artifact exports like reports/spreadsheets, not a full account export).
**Evidence:** Repo-wide search confirms absence.
**Current state → Target state:** No self-service deletion/export → Self-service (or at minimum support-mediated, documented-SLA) account deletion and full-account data export.
**Segment affected:** B2C (regulatory requirement for any EU/CA users). **Severity:** P1 before public B2C launch; acceptable gap for a small, known, consented pilot cohort in the interim.
**Technical risk:** Medium (deletion must cascade correctly through 400+ RLS-scoped tables — needs careful design given the schema size). **Security risk:** Low if done correctly; medium if done carelessly (partial deletion leaving orphaned PII). **Commercial risk:** Medium-high for any EU/CA user base. **Valuation impact:** Medium.
**Complexity:** Medium-high (schema-wide cascade design). **Dependency:** F-01 (Privacy Policy should state the deletion/export commitment before the feature ships).
**Recommendation:** Design a soft-delete + scheduled hard-delete pattern consistent with the retention policy drafted alongside F-01; ship export before deletion (lower risk, immediate compliance value).
**Acceptance criteria:** A user can request and receive a full data export; a user (or support, in interim) can trigger account/workspace deletion with documented cascade behavior and audit trail.

---

### F-10 · Product Analytics · No product analytics platform
**Description:** No analytics SDK (PostHog/Segment/Amplitude/Mixpanel) is integrated. The only instrumentation is a narrow, custom, DB-backed onboarding funnel logger (`src/lib/first-user-telemetry.ts`, ~12 event types), visible only in the founder's early-access dashboard.
**Evidence:** Repo-wide grep for analytics SDKs returns zero hits; `package.json` has no analytics dependency.
**Current state → Target state:** No feature-adoption/retention visibility → A real analytics platform capturing acquisition, activation, feature-adoption, and retention events, with a naming convention (see `docs/productization/saas/` analytics section of the original brief — recommend adopting one before instrumenting).
**Segment affected:** All (product decisions currently made blind). **Severity:** P1 before public launch of either segment.
**Technical risk:** Low. **Security risk:** Low (choose a vendor with a workspace-scoped/no-PII-by-default posture). **Commercial risk:** Medium (cannot demonstrate traction/retention metrics to investors without this). **Valuation impact:** Medium-high (no usage data to support any valuation narrative).
**Complexity:** Low-medium. **Dependency:** Vendor selection; Privacy Policy (F-01) should disclose the vendor.
**Recommendation:** Integrate a single analytics platform (PostHog is a reasonable self-hostable default given the workspace-data-sensitivity posture already established in `egress-policy.ts`) and instrument the core activation loop first.
**Acceptance criteria:** Signup → first workspace → first project → first AI interaction → first invite funnel is visible in a dashboard outside the founder-only early-access page.

---

### F-11 · AI/Agent Runtime · Agent tool execution is in-memory only; no real side effects
**Description:** `agent-tool-adapter-service.ts` explicitly does not use Supabase and simulates all operations via in-memory Maps; every adapter has `externalSideEffectsEnabled: false`. An AI agent in this system cannot actually send an email, create an external ticket, or persist a tool-execution result past a process restart, despite the surrounding governance/approval scaffolding (tool registry, approval policy, state machine) looking production-grade.
**Evidence:** `src/lib/agents/agent-tool-adapter-service.ts:1-4`; `agent-tool-adapter-registry.ts`.
**Current state → Target state:** In-memory simulation → Real persistence (Supabase-backed execution records) and, where appropriate, real external side effects behind the existing (well-designed) approval-gate/risk-level policy.
**Segment affected:** Any segment being sold on "AI agents that take action." **Severity:** P1 if this capability is marketed as functioning; P2/P3 as pure roadmap if clearly labeled as not-yet-live.
**Technical risk:** Medium (the approval/state-machine/risk-level design is sound and can likely be kept — the gap is the adapter layer's persistence and external-call wiring). **Security risk:** Low today (nothing external can happen accidentally); would become the central security surface once wired live. **Commercial risk:** High if oversold. **Valuation impact:** Medium.
**Complexity:** Medium-high. **Dependency:** F-03 (this is one specific instance of the broader scaffolding-vs-real gap) and, per the AOC mandate, ideally the tool-execution audit trail should ultimately publish evidence via an `EvidencePublisherPort` (see `07-aoc-consumer-architecture.md`).
**Recommendation:** Do not describe agent tool execution as production-capable in any sales or marketing material until persistence and at least one real external side effect are wired and tested end-to-end.
**Acceptance criteria:** At least one tool adapter persists its execution record to Supabase and performs one real, reversible external action end-to-end, covered by an integration test (not a string-contract test).

---

### F-12 · Multi-tenancy · Legacy `company_id`-based RLS on two tables
**Description:** `onboarding_analyses` and `governance_audit_events` still use a legacy `company_id`-based RLS model rather than the newer `workspace_id`-native model used everywhere else.
**Evidence:** `docs/security/rls-gap-inventory-phase-4.3.md:26-39`; carried forward as a documented, non-blocking risk in `docs/release/rls-tenant-isolation-report.md:15-20`.
**Current state → Target state:** Mixed tenant model on 2 tables → Fully workspace-native RLS across the schema.
**Segment affected:** B2B (schema consistency matters more at scale). **Severity:** P2.
**Technical risk:** Low-medium. **Security risk:** Low (documented as non-blocking, i.e. still isolated, just via the older key). **Commercial risk:** Low. **Valuation impact:** Low.
**Complexity:** Low. **Dependency:** None.
**Recommendation:** Migrate both tables to `workspace_id`-native RLS in a normal hardening sprint; not urgent.
**Acceptance criteria:** Both tables pass the same live two-workspace RLS smoke test used for the rest of the schema.

---

### F-13 · Multi-tenancy / IDOR · `vault/intake` route relies on RLS alone, not app-layer + RLS defense-in-depth
**Description:** `src/app/api/vault/intake/route.ts:33-42` accepts a client-supplied `workspaceId` and only cross-checks it against the project's `workspace_id`, without an explicit application-layer membership check — it depends entirely on the underlying RLS policy to reject non-member access.
**Evidence:** As cited; contrast with `src/app/api/pm-registry/[pmId]/route.ts:16-32` and `src/app/api/execution-tasks/route.ts:10-31`, which do resolve workspace/project from server-verified membership before querying.
**Current state → Target state:** RLS-only enforcement → Explicit `requireWorkspaceMember`/`requireProjectAccess` check added at the application layer, matching the pattern already used elsewhere in the codebase.
**Segment affected:** All. **Severity:** P2 (RLS is a real, tested backstop today — this is defense-in-depth hardening, not an open hole).
**Technical risk:** Low. **Security risk:** Low-medium (single point of failure if RLS is ever misconfigured on this table). **Commercial risk:** Low. **Valuation impact:** Low.
**Complexity:** Low. **Dependency:** None.
**Recommendation:** Add the same server-side membership-check pattern already used in `pm-registry`/`execution-tasks` routes.
**Acceptance criteria:** Route explicitly denies with a 403 before any DB call for a non-member-supplied `workspaceId`, verified with a test independent of RLS state.

---

### F-14 · Billing · Plan catalog is hardcoded, not DB-driven
**Description:** Despite a migration named `subscription_plans_pmo.sql`, no `subscription_plans` table exists — it only updates a CHECK constraint. Plan tiers (`free`/`pro`/`pmo`) and their capabilities live entirely in a hardcoded object (`src/lib/feature-gates.ts:62-86`), and Stripe price mapping is two env vars.
**Evidence:** As cited; `src/app/pricing/page.tsx:23-29` (Enterprise tier is `mailto:`-only, not wired to Stripe).
**Current state → Target state:** Hardcoded 3-tier object → DB-driven (or at minimum config-driven) plan catalog supporting custom/negotiated enterprise contracts without a code change.
**Segment affected:** B2B/Enterprise (custom contract terms). **Severity:** P2.
**Technical risk:** Low-medium. **Security risk:** Low. **Commercial risk:** Medium (blocks flexible enterprise pricing). **Valuation impact:** Low.
**Complexity:** Medium. **Dependency:** None.
**Recommendation:** Defer until first enterprise deal requires custom terms; the hardcoded model is adequate for B2C/B2B self-serve tiers today.
**Acceptance criteria:** New plan tiers or per-customer overrides can be added without a code deploy.

---

### F-15 · Billing · No coupons, tax handling, or native Stripe trials
**Description:** No `discounts`/`coupon` field in checkout session creation; no Stripe Tax (`automatic_tax`) configuration anywhere; `subscription_status` schema supports `"trialing"` but no code path ever sets `trial_period_days`.
**Evidence:** As cited in billing research.
**Current state → Target state:** Absent → Present, standard commercial billing surface.
**Segment affected:** B2C (trials drive conversion), B2B (tax compliance required at scale). **Severity:** P2.
**Technical risk:** Low. **Security risk:** Low. **Commercial risk:** Medium (tax non-compliance risk grows with revenue/geography). **Valuation impact:** Low.
**Complexity:** Low-medium. **Dependency:** None.
**Recommendation:** Add Stripe Tax before any meaningful multi-state/multi-country revenue; add native trial periods before public B2C launch to reduce reliance on the separate `early-access`/`trial_licenses` mechanism.
**Acceptance criteria:** Stripe Tax enabled on checkout sessions; at least one coupon/promo code path tested; native trial period configurable per plan.

---

### F-16 · Supportability · No general admin/support console
**Description:** The only admin surface is a founder/internal-only early-access dashboard (invite/trial management). No customer/org lookup, no impersonation, no billing-credit tooling, no suspension/restoration workflow exists.
**Evidence:** As cited in UX/admin research; `docs/security/admin-founder-endpoint-boundary.md`.
**Current state → Target state:** Founder-only, narrow tooling → A proper internal support console (customer lookup, subscription/usage view, impersonation with audit trail, manual credit/suspension tools) once support scales past the founder.
**Segment affected:** B2B (support SLAs expected), scale in general. **Severity:** P2 (acceptable for founder-led pilot; blocks scaling support).
**Technical risk:** Medium. **Security risk:** Medium (impersonation tooling must be built with its own audit trail from day one — do not retrofit). **Commercial risk:** Medium. **Valuation impact:** Low.
**Complexity:** Medium-high. **Dependency:** Should reuse the existing founder-gate pattern (`isFounderOrInternalUser`) and extend it to a real `support_operator` role rather than inventing a new authorization model.
**Recommendation:** Build incrementally: customer/org lookup first (lowest risk), impersonation last (highest risk, needs audit trail design).
**Acceptance criteria:** A support operator role exists distinct from founder; every admin action is attributed and audit-logged.

---

### F-17 · Observability · No external monitoring/alerting platform
**Description:** No Sentry/Datadog/PagerDuty-class integration exists. Monitoring is log/audit-table-based with a manual daily-check cadence, per the repo's own residual risk register.
**Evidence:** `docs/release/residual-risk-register.md` (RR-MONITOR); repo-wide search confirms no such SDK.
**Current state → Target state:** Manual log review → Automated error tracking + alerting on defined SLOs.
**Segment affected:** All, increasingly critical past founder-led pilot. **Severity:** P2.
**Technical risk:** Low. **Security risk:** Low. **Commercial risk:** Medium (incident response time degrades without alerting). **Valuation impact:** Low.
**Complexity:** Low-medium. **Dependency:** None.
**Recommendation:** Add Sentry (or equivalent) for error tracking before public launch; keep the existing redacting logger as the structured-log source feeding it.
**Acceptance criteria:** A production error triggers an alert within minutes, not next-day manual review.

---

### F-18 · Security · No third-party penetration test
**Description:** No independent security review has been performed; all hardening to date is self-authored and self-tested by a single contributor.
**Evidence:** `docs/release/residual-risk-register.md` (RR-PENTEST); git log shows 100% single-author commits.
**Current state → Target state:** No independent review → At least one third-party pentest completed and findings remediated.
**Segment affected:** B2B/Enterprise (buyers will ask); regulatory posture in general. **Severity:** P1 before opening beyond a closed, trusted pilot cohort.
**Technical risk:** N/A. **Security risk:** Medium (self-review has blind spots regardless of quality — the scaffolding-vs-real gap found in this audit is itself evidence that self-certification alone is insufficient). **Commercial risk:** Medium-high for B2B. **Valuation impact:** Medium.
**Complexity:** Low (procurement, not engineering). **Dependency:** Budget.
**Recommendation:** Commission a pentest before expanding beyond the closed pilot cohort or before the first B2B contract requiring a security review.
**Acceptance criteria:** Pentest report received, critical/high findings remediated, summary available for buyer diligence.

---

### F-19 · Testing / Quality · Business-logic tests reimplement instead of import production code
**Description:** At least 21 test files (e.g. `tests/authority-governance.test.mjs`, 1,068 lines) contain a from-scratch in-memory reimplementation of the logic under test, importing nothing from `src/`. These tests validate a parallel spec, not the shipped code, creating real drift risk. One file (`tests/pm-registry-operationalization.test.mjs:9-12`) explicitly claims CI runs a live-DB integration suite that does not actually exist in any GitHub Actions workflow.
**Evidence:** As cited in CI/testing research.
**Current state → Target state:** Parallel-reimplementation tests give false confidence → Tests import and exercise the real production module; false claims about CI coverage corrected.
**Segment affected:** All (quality/regression risk). **Severity:** P2.
**Technical risk:** Medium (regressions in these 21+ modules could ship undetected). **Security risk:** Low-medium (governance-adjacent modules are among the affected files). **Commercial risk:** Low near-term (most of these modules are the orphaned/scaffolding layer). **Valuation impact:** Low.
**Complexity:** Medium (rewriting 21 test files to import real modules). **Dependency:** None.
**Recommendation:** Prioritize rewriting tests for any module that is actually reachable from the product UI first; correct or remove the false CI-coverage claim in `pm-registry-operationalization.test.mjs` immediately (cheap, high-signal fix).
**Acceptance criteria:** No test file's docstring claims CI coverage that doesn't exist; reachable-module tests import real `src/` code.

---

### F-20 · AI/Cost · AI daily cost ceiling fails open on accounting-read failure
**Description:** The per-workspace AI cost ceiling fails open (allows the request) if the underlying cost-accounting read itself fails, per an explicit code comment. The per-workspace *request-count* ceiling, by contrast, fails closed.
**Evidence:** `src/lib/ai/usage-accounting.ts:10-13`; `src/lib/ai/providers/router.ts:112-131`.
**Current state → Target state:** Cost ceiling fails open → Fails closed, or at minimum falls back to the request-count ceiling as a hard backstop when cost accounting is unavailable.
**Segment affected:** All. **Severity:** P3 (mitigated by the request-count ceiling existing as a backstop).
**Technical risk:** Low. **Security risk:** Low. **Commercial risk:** Low (bounded cost-overrun risk, not unbounded). **Valuation impact:** None.
**Complexity:** Low. **Dependency:** None.
**Recommendation:** Fix in a normal hardening sprint; not urgent given the existing request-count backstop.
**Acceptance criteria:** Cost ceiling behavior is explicitly tested for the accounting-read-failure case.

---

### F-21 · Product / Navigation · Real capabilities orphaned from navigation
**Description:** PMO Command Center, PMO Governance/Compliance, PMO Executive Reporting, PM Registry/Performance/Capacity, and the RAID page have real Supabase-backed migrations and API routes but are absent (or only partially present) from `NAVIGATION_HIERARCHY` and `route-policy-registry.ts` — a customer would need to know the exact URL to reach them.
**Evidence:** As cited in product-domain-inventory research.
**Current state → Target state:** Built but unreachable → Either linked into navigation (if ready) or explicitly deferred with a clear internal roadmap note (if not ready for customers yet).
**Segment affected:** B2B/PMO segment specifically (this is exactly the differentiated PMO value proposition). **Severity:** P2 — real lost value, not a launch blocker.
**Technical risk:** Low (routing/nav change, not new engineering). **Security risk:** None. **Commercial risk:** Medium (PMO capability is a stated differentiator and is currently invisible to users). **Valuation impact:** Low-medium (undercounts real, working capability in any demo).
**Complexity:** Low-medium (needs a product decision on readiness, then nav wiring + smoke testing). **Dependency:** None.
**Recommendation:** Triage each orphaned module for demo-readiness; wire the ready ones into navigation before any B2B pilot demo, since this is genuinely differentiated, already-built functionality currently invisible to prospects.
**Acceptance criteria:** Each orphaned module is either reachable from `NAVIGATION_HIERARCHY` with a passing smoke test, or explicitly documented as deferred with an owner and target date.
