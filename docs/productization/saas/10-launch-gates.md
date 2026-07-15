# 10 — Launch Gates

## Internal alpha (founder + a handful of trusted internal/friendly users)

- **Requirements:** Working core loop (signup → workspace → project → task/RAID → dashboard), Stripe checkout functional in test mode, existing security hardening in place.
- **Evidence:** Already met — this is effectively the current state of the repository.
- **Tests:** `npm run check:beta-release` passing (real, fail-closed per this audit's CI research).
- **Metrics:** None required yet.
- **Acceptable risks:** Scaffolding layer present but unused by real users; no legal docs yet (internal users only, no external data commitments made).
- **Unacceptable risks:** Any cross-tenant data leakage — none found in this audit.
- **Sign-off:** Founder.

## Private beta B2C (small cohort, invite-only, real external users, no payment required or manual invoicing)

- **Requirements:** F-01 (ToS/Privacy Policy) published; F-04/F-05 (hosted-DB migration proof + backup restore) closed before any real external user's data is created; F-10 (basic analytics) instrumented for at least the activation funnel.
- **Evidence:** Signed legal docs live at real routes; `docs/release/residual-risk-register.md` RR-MIGRATE/RR-BACKUP marked closed with hosted-run reports; analytics dashboard showing signup→activation funnel.
- **Tests:** All existing `check:*` gates green; a fresh hosted-Supabase migration run documented.
- **Metrics:** Activation rate, time-to-first-project tracked.
- **Acceptable risks:** No OAuth/MFA yet (password auth is adequately hardened); founder-only support (small cohort is manageable).
- **Unacceptable risks:** Charging money without legal docs; onboarding real user data without a proven backup/restore path.
- **Sign-off:** Founder + informal legal review of ToS/Privacy Policy.

## Private beta B2B (a few design-partner companies, real workspaces, possibly manual invoicing)

- **Requirements:** All Private beta B2C requirements, plus F-06 (fix known RLS bug) and F-21 (un-orphan PMO/PM-registry navigation if being demoed) closed; F-16 (at minimum a manual support process, doesn't need to be a full console yet) documented.
- **Evidence:** Migration fixing `governance_delegations` policy merged; PMO capability reachable from navigation if sold; a documented (even if manual) support escalation path.
- **Tests:** Live-DB regression test added for the fixed RLS policy (not just a static scan).
- **Metrics:** Per-workspace activation, seat utilization.
- **Acceptable risks:** No SSO/MFA yet if design partners are informed and accept password auth for the pilot; hardcoded plan catalog (design partners are few enough to handle manually).
- **Unacceptable risks:** Selling PMO capability that isn't reachable in the product; any known RLS gap left open on a workspace-governance table for a paying B2B customer.
- **Sign-off:** Founder + design-partner explicit written acceptance of pilot-stage caveats.

## Public B2C

- **Requirements:** F-08 (at least one OAuth provider) shipped for conversion; F-09 (account deletion + export) shipped for GDPR/CCPA; F-10 (full activation-through-retention analytics) instrumented; F-18 (pentest) completed; F-17 (external alerting) live; native Stripe trial or coupon support (F-15) if trials are part of the go-to-market motion.
- **Evidence:** OAuth sign-in tested end-to-end; deletion/export tested with cascade verification; Sentry (or equivalent) receiving real error events; pentest report with critical/high findings remediated.
- **Tests:** New auth-boundary tests for OAuth path; deletion cascade covered by an integration test.
- **Metrics:** Full funnel (signup → activation → retention → conversion → churn) visible.
- **Acceptable risks:** Enterprise-only features (SSO/SCIM) still absent.
- **Unacceptable risks:** Any unresolved P0/P1 finding from `04-critical-findings.md`; scaffolding layer described as production capability anywhere in public marketing.
- **Sign-off:** Founder + (recommended) an external security reviewer sign-off on the pentest remediation.

## Public B2B

- **Requirements:** All Public B2C requirements, plus F-16 (real support console, at minimum customer/org lookup) built; F-12/F-13 (remaining RLS hardening items) closed; F-19 (test-suite reimplementation drift) addressed at least for reachable modules; MFA (F-08 extended) available.
- **Evidence:** Support console demoed; live-DB RLS tests passing for all tables including the two legacy ones; MFA enrollment/challenge tested.
- **Tests:** Full `check:governance` + `check:beta-release` + new live-DB RLS regression suite green.
- **Metrics:** Multi-seat activation, cross-workspace usage patterns, support ticket volume/resolution time.
- **Acceptable risks:** SCIM still absent (documented as Enterprise-later); custom/negotiated plan terms still require a manual process (F-14 not yet DB-driven).
- **Unacceptable risks:** Any B2B customer discovering the scaffolding/reality gap (F-03) undisclosed during their own technical diligence.
- **Sign-off:** Founder + Sales/Success lead (once that role exists) confirming support readiness.

## Enterprise readiness

- **Requirements:** F-02 (AOC consumer architecture actually consuming an external provider, not self-implementing) resolved or explicitly scoped out of the specific enterprise deal; SSO + SCIM shipped; SLA defined; retention policy defined and enforced; assurance tier available via `AssuranceStatusPort` (once AOC Assurance exists externally); DPA + subprocessor list (extension of F-01) available; dedicated support model defined.
- **Evidence:** Signed SSO integration with at least one enterprise IdP; SCIM provisioning tested; SLA document; retention policy enforced in code (not just documented); assurance status genuinely sourced externally, not self-certified.
- **Tests:** New enterprise-specific integration tests (SSO, SCIM) with the same rigor already demonstrated in the billing-boundary test suite.
- **Metrics:** SLA adherence, enterprise-tier NPS/CSAT.
- **Acceptable risks:** None that compromise the "no self-certified trust claims" principle established in F-02 — an enterprise buyer's diligence will specifically probe this.
- **Unacceptable risks:** Selling "AOC assurance" or "verified agent identity" language while PMFreak remains the self-issuing authority.
- **Sign-off:** Founder + external security review + (once it exists) an AOC Enterprise partnership/consumption agreement.
