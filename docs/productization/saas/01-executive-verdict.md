# 01 — Executive Verdict

**Audit date:** 2026-07-15
**Branch audited:** `claude/pmfreak-saas-audit-abimtq` (HEAD `52da0f2`, working tree clean at audit start)
**Scope:** Current-state SaaS productization audit of PMFreak. No code shipped except this documentation set. No commits, no pushes, no PRs (per governing instructions).

## A. The one-paragraph verdict

PMFreak is **not one repository — it is two, entangled.** Repository A is a real, sellable B2C/small-team PM/PMO product: workspaces, projects, programs, portfolio, critical path, RAID, execution tasks, an AI chat surface wired to real inference, Stripe billing with unusually well-hardened webhook/authorization boundaries, and an RLS-isolated multi-tenant Postgres schema that has caught and fixed a real cross-tenant bug. Repository B, layered on top of and mixed into the same `src/lib` and `docs/architecture` trees, is a much larger body of "constitutional / sovereign / governance / digital-twin / predictive-intelligence" scaffolding that uses the vocabulary of production maturity while being, on inspection, functionally inert: hardcoded topology data, in-memory-only agent execution with `externalSideEffectsEnabled: false`, and self-authored tests that assert on source-code text rather than executing it. **The single highest-value action in this audit is not a feature gap — it is separating A from B before anyone prices, sells, or diligences this product**, because B actively misrepresents capability in a way that would fail investor or enterprise-buyer diligence if presented undifferentiated from A.

The second highest-value finding is structural to the AOC mandate this audit was scoped against: **PMFreak today *is* the canonical issuer, signer, verifier, and revoker of capability claims, trust domains, and agent attestations** — it owns the HMAC/Ed25519 signing secret (`PMFREAK_CAPABILITY_CLAIM_SECRET`), the revocation registry, and the trust-domain lifecycle in its own Postgres tables. This is the exact ownership the governing brief says must belong to an external AOC Protocol/Enterprise/Assurance provider. A real internal refactor (ports, adapters, dependency-direction linting) has prepared the ground for extraction, but the "external" authority-provider code paths are unimplemented stubs — the only thing that works today is `in_process`. **PMFreak cannot honestly claim to "consume AOC externally" yet; it currently reimplements AOC.**

Everything else — auth (no OAuth/MFA), billing (no coupons/tax/native trials), legal (no ToS/Privacy Policy exist at all, only disabled footer links), analytics (none), admin/support tooling (founder-only, narrow), and the two still-open pilot-blocking release risks (no hosted-Supabase migration proof, no rehearsed backup restore) — is real, bounded, and addressable in the timeframes laid out in `11-roadmap.md`.

## B. Can PMFreak launch today?

**No — not for revenue, and not publicly.** It could run a closed, founder-supervised, unpaid or manually-invoiced pilot with a handful of design partners today, which is exactly the conclusion the repository's own prior "Perilla" hardening series already reached (`docs/release/residual-risk-register.md`: CONDITIONAL GO, closed pilot only). This audit independently corroborates that verdict rather than overturning it, and adds two findings the prior series had not surfaced: the scaffolding/reality gap in the product domain layer, and the AOC-ownership-vs-consumption gap.

## C. What actually blocks each stage

| Stage | Primary blocker | Secondary blockers |
|---|---|---|
| Charging any customer | No Terms of Service / Privacy Policy exist (`04-critical-findings.md` F-01) | No native trial/coupon/tax in Stripe; hardcoded plan catalog |
| Public B2C launch | No product analytics (zero funnel visibility); "AI first insight" is a scripted animation + heuristic scorer, not a real model call | No account deletion/export (GDPR); no OAuth |
| B2B sale | No SSO/MFA; no admin/support console beyond founder-only tooling; known unfixed RLS policy typo bug (`governance_delegations`) | Legacy `company_id`-based RLS on 2 tables; no owner-transfer flow |
| Enterprise sale | AOC ownership gap (identity/passport/trust/assurance not externally sourced); no SCIM; no SLA/retention/assurance tier | No pentest; no external alerting/monitoring |
| Any launch tier | Two open release-risk items: `RR-MIGRATE` (no hosted-DB migration proof) and `RR-BACKUP` (no rehearsed restore) | Raw Postgres error messages leak to authenticated callers on ~10 SDK/governance routes |

## D. What must remain in PMFreak vs. what must come from AOC

This is answered in full in `07-aoc-consumer-architecture.md`. In short: PMFreak keeps product, UI, users, workspaces, projects/programs/portfolio, billing, entitlements-for-product-features, and its own AI operational concerns (cost/routing/guardrails). PMFreak must stop being the source of truth for agent identity, passports, claims, attestations, revocation, and trust domains — those need to become consumed capabilities behind the ports defined in `07-aoc-consumer-architecture.md`, once an external AOC provider exists to consume.

## E. Confidence and method

This verdict is built from: (1) direct repository reconnaissance (git state, package manifest, directory structure), (2) seven parallel deep-read investigations across SaaS shell/auth, billing/entitlements, product domain inventory, AI/agent runtime + embedded AOC code, security/reliability, CI/CD/testing quality, and product UX/analytics/legal, each producing file:line evidence, and (3) targeted cross-checks against the repository's own extensive prior self-audit corpus (~35 `docs/security/*` files, ~30 `docs/release/*` files, ~94 `docs/architecture/*` files). Where this audit's independent spot-checks corroborated prior claims, that is noted; where they diverged (the scaffolding/reality gap, the AOC ownership gap, the raw-error-message leak), that is flagged as new. No destructive or state-changing commands were run against the repository or any external system.
