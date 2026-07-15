# Pilot Readiness Checklist — Closed Free Pilot (Pilot Gate Sprint 01)

Two sections: the **design-partner journey** (what a partner can actually
do, with the code path that serves it) and the **gate conditions** (what
must be true before the first partner's real data enters).

## A. Can a design partner…

| # | Question | Answer | Evidence / path |
| --- | --- | --- | --- |
| 1 | …create an account? | **YES** — email/password signup, or founder-issued early-access invite with email delivery | `src/app/signup`, `src/lib/early-access.ts`; hardened auth (rate limits, generic errors) |
| 2 | …create a workspace? | **YES** — auto-provisioned on first login; invites for teammates (hashed tokens, one-time) | `src/lib/workspaces`, `ensureUserWorkspace`, invite flow |
| 3 | …create a project? | **YES** — server-action insert, workspace-scoped, RLS-enforced | `src/app/(protected)/projects/actions.ts` |
| 4 | …use AI? | **YES (real)** — copilot chat runs real LLM inference with guardrails, cost ceilings, usage accounting. Deterministic surfaces (Command Center chat, First Insight) are explicitly labeled as rule-based in the UI | `/api/copilot`, `src/lib/ai/providers/router.ts`; M-02 disclosures + `tests/honest-ai-copy.test.mjs` |
| 5 | …obtain recommendations? | **YES** — First Insight operational brief (deterministic, generated at project creation), recommended actions, follow-up conversion | `src/lib/projects/first-insight`, `src/lib/recommended-actions` |
| 6 | …collaborate? | **YES** — workspace invites, roles (owner/admin/pm/viewer), shared projects/tasks, RLS tenant isolation live-tested 10/10 | invite flow; `scripts/fresh-db-rls-smoke-test.sql` results |
| 7 | …exit without encountering fake functionality? | **YES, after this sprint** — dashboard fallback is labeled (never "Live" on placeholder data); deterministic chat is disclosed; onboarding animation claims setup, not analysis; scaffolding surfaces (agent execution, governance, constitutional, digital twin) are hidden by the pilot capability profile and/or unreachable | M-01/M-02 fixes + tests; `pilot-capability-set.ts`; `scaffolding-register.md` |

## B. Gate conditions before first partner data

| # | Condition | Status | Blocking? |
| --- | --- | --- | --- |
| 1 | RR-MIGRATE: hosted fresh-apply executed (runbook §10) | **OPEN** — everything achievable without hosted credentials is done (147/147 local real-Postgres proof ×3, RLS 10/10, new grants defect fixed); hosted run pending credentials | **YES — blocks real data** |
| 2 | RR-BACKUP: hosted tier/PITR confirmed + one hosted restore rehearsal | **OPEN** — logical drill rehearsed with full evidence; hosted step ~15 min once project exists | **YES — blocks real data** |
| 3 | Error-leak sweep (F-07) | **CLOSED** — ~290 route catch-alls now return generic messages; regression-guarded (`tests/error-leakage-boundary.test.mjs`) | — |
| 4 | vault/intake membership check (F-13) | **CLOSED** — 403 before any DB call; tested independent of RLS | — |
| 5 | Honest dashboard (M-01) | **CLOSED** — fallback labeled; tests | — |
| 6 | Honest AI copy (M-02) | **CLOSED** — copy corrected on all three surfaces; tests | — |
| 7 | Pilot capability set curated (Task 7) | **CLOSED** — written decision + enforced profile + tests | — |
| 8 | Capability secret handling (M-03) | **CLOSED** — readiness check + graceful degradation + tests | — |
| 9 | Signed pilot agreement per partner | **TECHNICAL PLUMBING DONE** — versioned template shell, acceptance records, offline-signed path; legal text pending counsel | **YES — per partner, before their data** |
| 10 | Scaffolding register | **CLOSED** — `docs/release/scaffolding-register.md` | — |
| 11 | `OPENAI_API_KEY` verified in pilot deployment | Operator step (runbook §2) | YES (for AI value) |
| 12 | Stripe live-mode confirmation | N/A for FREE pilot (no billing exposure) | — |

## C. Go/No-Go

**CONDITIONAL GO.** All engineering gates for S1 are closed. The pilot may
onboard partners **the moment** conditions B1, B2 (one operator session
with hosted credentials) and B9 (counsel-approved agreement, signed per
partner) are satisfied. No partner real data before B1+B2+B9.
