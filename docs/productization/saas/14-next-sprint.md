# 14 — Immediate Next Sprint

Scoped to what a single-founder-led effort can realistically execute in the next 1–2 weeks, pulling directly from `12-first-30-actions.md` items 1–10 plus 27–28 (the cheapest, highest-signal items).

## Sprint goal
Close every P0 finding from `04-critical-findings.md`, and stop any risk of the scaffolding-layer or AOC-ownership gaps being misrepresented externally, before any external pilot user's real data enters the system.

## Sprint backlog (in order)

1. **F-06** — Fix `governance_delegations` RLS policy typo. (S)
2. **F-13** — Add app-layer membership check to `vault/intake`. (S)
3. **F-07** — Fix raw-error-message leakage across ~10 SDK/governance routes. (M)
4. **F-20** — Fix AI cost-ceiling fail-open behavior (fall back to request-count backstop). (S)
5. **Test hygiene** — Correct the false CI-coverage claim in `pm-registry-operationalization.test.mjs`. (S)
6. **F-27/28** — Produce the internal scaffolding register; audit any existing customer/investor-facing material for overstated AI-agent or governance-maturity claims. (S, founder-owned, no engineering dependency — do this in parallel with 1–5)
7. **F-04** — Secure hosted Supabase credentials; kick off the hosted-DB migration proof. (M, blocked on access, start immediately since it's the longest lead-time item)
8. **F-05** — Once hosted access exists, run and document the backup/restore drill. (M, depends on #7)
9. **F-01** — Draft ToS/Privacy Policy (even a competent template reviewed against PMFreak's actual data practices is sufficient to unblock the next stage — final legal polish can follow). (M, founder-owned, can run in parallel with engineering items)
10. **F-12** — Migrate the two legacy-`company_id` tables to workspace-native RLS, if time remains. (M, lowest priority in this sprint — defer to the following sprint if the above isn't done)

## What's explicitly out of scope for this sprint

Everything in `13-do-not-build.md`; OAuth/MFA (item 23/24, next sprint); analytics integration (item 25, next sprint); support console (item 17, next sprint); any AOC port/adapter implementation work (items 18–21 — conceptual design only, no code, and only after this sprint's P0s close).

## Definition of done for this sprint

- No P0 finding remains open in `04-critical-findings.md`.
- `docs/release/residual-risk-register.md` RR-MIGRATE and RR-BACKUP both marked closed with real hosted-environment evidence.
- ToS/Privacy Policy live at real routes, footer links enabled.
- Internal scaffolding register exists and has been checked against any material currently being shown to prospects or investors.
- All changes covered by the existing `check:beta-release` / `check:governance` gates, still green.

## Explicit non-goal

This sprint does **not** attempt to resolve the AOC ownership gap (F-02) — that requires an external AOC Protocol/Enterprise/Assurance provider to exist first, which is outside PMFreak's control and outside this sprint's scope. The only AOC-related sprint output is the disclosure/labeling hygiene in item 6.
