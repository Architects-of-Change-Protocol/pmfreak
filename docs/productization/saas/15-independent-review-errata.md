# PMFreak SaaS Productization Phase 1 — Independent Review Errata

## Status

**Canonical corrective addendum.** Authored 2026-07-15 after an independent, read-only validation review of the Phase 1 audit (documents `01`–`14` in this directory, committed at `7dc0d1b`). The review re-inspected migrations, routes, UI wiring, navigation, environment contracts, and the release risk register directly at HEAD, and ran adversarial end-to-end code-path tracing on the audit's two most load-bearing claims (AOC-surface reachability; core-product/AI reality).

## Scope

This document corrects, recalibrates, and extends the Phase 1 audit. It does **not** modify, rewrite, or delete documents `01`–`14`, and it does not alter commit `7dc0d1b`. It changes no production code, tests, CI, migrations, or configuration. It is documentation only.

## Precedence Rule

**Where this errata contradicts any statement in documents `01`–`14`, this errata prevails** for all implementation decisions, severity assignments, launch gates, and prioritization.

- The original 14 documents are preserved unmodified for traceability and historical evidence.
- This errata, together with the portions of `01`–`14` it does not contradict, constitutes the **validated baseline** for Phase 2 (implementation).
- Future tasks, sprints, and PRs that cite a finding from `01`–`14` must also cite this errata's disposition of that finding.
- Nothing in this errata reopens conclusions the review explicitly accepted (listed below).

## Independent Review Summary

- **Overall audit reliability: approximately 77/100.**
- **Accepted conclusions: approximately 75–80%** (accepted outright, or accepted with severity/stage recalibration).
- **Strengths:** genuine factual repository inspection with file:line evidence throughout; strong SaaS shell analysis (auth, workspaces, invites, roles); correct AOC ownership direction (consume externally, do not self-implement); accurate multi-tenancy and billing findings, independently re-verified.
- **Weaknesses:** stale internal documentation accepted as current truth (F-06); severity inflation on findings that block no concrete launch stage (F-02, F-03); confusion between deterministic and LLM-backed surfaces (the "AI chat" claim); insufficient stage-based calibration (pilot vs public vs enterprise requirements mixed); missed the dashboard fallback-labeled-as-live misrepresentation, the most user-visible instance of the audit's own central thesis.

## Accepted Conclusions

The following Phase 1 conclusions were independently verified and remain fully in force:

1. The sellable core is real: projects (server-action insert, workspace-scoped — `src/app/(protected)/projects/actions.ts:38-39`), programs (guarded POST → real insert — `src/app/api/programs/route.ts:34-76`, `src/lib/programs/program-repository.ts:24-25`), execution tasks (project-access-guarded), critical path (computed from `execution_tasks`, `execution_task_dependencies`, `project_milestones` — `src/lib/critical-path/repository.ts:49-58`), upload/vault, Stripe billing.
2. Billing trust boundary is hardened and pilot-usable; entitlements are server-enforced (`src/lib/feature-gates.ts`).
3. Multi-tenancy is B2B-grade with bounded, named gaps (F-12, F-13).
4. F-01 (no legal documents), F-04 (hosted migration unproven), F-05 (backup restore unrehearsed) are genuine blockers at the stages defined below.
5. F-03's core thesis — production-vocabulary scaffolding that is functionally inert — is correct, and per this review, understated (see M-01, M-02). Verified verbatim: hardcoded digital-twin topology (`organizational-digital-twin-topology.ts`), in-memory agent tool execution with `externalSideEffectsEnabled: false` (`agent-tool-adapter-service.ts:1-4`).
6. F-02's ownership analysis is correct; PMFreak must not market local trust/claims/attestation as canonical AOC.
7. The Do-Not-Build list (`13-do-not-build.md`) is confirmed in full.
8. Demo-data hygiene is good: the beta demo migration is schema-only, `fictional_*`-labeled, RLS-scoped, never seeded into real product tables.
9. F-07 (raw Postgres `error.message` returned to authenticated callers on ~10 SDK/governance routes) is real and confirmed at HEAD; the affected routes are authenticated and UI-reachable via the pmo-gated `/governance` surface.
10. F-13 (vault/intake relies on RLS alone for workspace scoping) confirmed at HEAD (`src/app/api/vault/intake/route.ts` — cross-checks project↔workspace when `projectId` is present, but never verifies caller membership in `workspaceId` at the application layer).
11. F-20 (AI cost ceiling fails open on accounting-read failure) confirmed — and confirmed to be a deliberate, documented design decision with a fail-closed request-count backstop. Accepted as documented debt (P3), not a defect requiring immediate action.

## Corrected Conclusions

### ERR-01 — F-06 is already resolved (remove from all active backlogs)

The audit reported an open RLS bug: `governance_delegations` SELECT policy referencing a non-existent table `public.workspace_members`. **This was fixed before the audit was written**, by migration:

- **Migration path:** `supabase/migrations/20260515100000_rls_governance_fixes.sql` — its own header states: *"governance_delegations — fix broken SELECT policy that referenced public.workspace_members (does not exist; correct table is public.workspace_memberships; also drop non-existent wm.status filter)."* The same migration also re-granted and RLS-scoped `governance_execution_grants` UPDATE and enabled RLS + SELECT policies on `workspace_memberships`.
- **Current policy behavior at HEAD:** `delegations_owner_admin_read` correctly references `public.workspace_memberships` with an `owner|admin` role check; delegator/delegatee self-read policies exist; client writes are denied (`delegations_no_client_writes`). The base migration `20260512233000_governance_delegations.sql` as present at HEAD also shows the corrected reference.
- **Original severity:** P1. **Validated status:** **Already resolved.**
- **Root cause of the audit error:** the audit trusted `docs/security/service-role-risk-register.md:94-95` (stale) without checking migrations at HEAD — see process rule M-04.
- **Decision:** remove from the immediate sprint (it was item #2 in `12-first-30-actions.md` and item 1 of `14-next-sprint.md`); mark as already resolved; preserve in `04-critical-findings.md` as historical evidence only. **F-06 must not appear as an active task in any implementation backlog.**

### ERR-02 — The Command Center chat is deterministic, not LLM-backed

`01-executive-verdict.md` and `02/03` describe "an AI chat surface wired to real inference (`playbook-engine` → `/api/command-center/chat`)". **This is incorrect.**

- The route's own docstring states it is *"deliberately thin — no LLM calls, no persistence, no RAG — the gateway itself is a deterministic, rule-based domain function"* (`src/app/api/command-center/chat/route.ts:14-18`).
- The gateway confirms: *"Deterministic end to end — no external LLM calls"* (`src/lib/playbook-engine/conversation/gateway/conversationalBrainGateway.ts:50-55`); it classifies intent and routes to ~10 hard-coded handlers composing templated responses.
- Absence of `OPENAI_API_KEY` has **no effect** on this surface — it is a permanent deterministic path, not a fallback.
- **Real LLM inference does exist** and is genuine: `src/lib/ai/providers/router.ts:90-258` (`runInference`, with guardrails, circuit breaker, cost accounting) → `src/lib/ai/providers/openai-provider.ts:58-140` (real fetch to the OpenAI API; hard-fails without the key). The routes that use it are **`/api/copilot`**, **`/api/ai/meta-intelligence`**, and **`/api/analyze-ai`** — and `/api/copilot` is UI-reachable from the workspace conversation shell.
- **Nature of the finding:** this is a representation and product-clarity issue, not an absence of AI in the product. The copilot path is the real AI surface. The deterministic chat must not be labeled or marketed as AI (see M-02), and any pilot deployment relying on copilot must verify `OPENAI_API_KEY` is configured (the inference path fails hard, with no canned fallback).

### ERR-03 — New finding M-01 / F-NEW-01: Dashboard presents fallback data under "live" labeling

**New finding, missed by the audit** (and more material than the onboarding animation the audit did catch, because it is persistent UI, not a 4.5-second transition):

- `/dashboard` (`src/app/(protected)/dashboard/page.tsx:26-28`) calls `runDashboardApiRuntime({...})` with no preloaded source data and without awaiting it; the source-data resolver receives an empty object and every report resolves `undefined`, producing a **fallback DTO** (`src/lib/dashboard/.../source-data-resolver.ts` emits "returning fallback dashboard DTO" warnings).
- The page renders those fallback values under the heading **"Workspace-Derived Portfolio Snapshot"** (healthScore, risksCount, decisionsCount, interventionsCount — `page.tsx:105-129`) and a hardcoded header **"Operational State: Live"** (`page.tsx:64-69`). The only real DB query on the page is a `projects` existence check (`page.tsx:48-53`).
- **Risk:** users (and design partners in demos) are induced to believe the metrics derive from their real workspace data.
- **Classification: P1 before any external demo or pilot.** Required fix before design-partner exposure. Not a deep architecture issue; low-cost remediation (labels) with an optional larger follow-up (real queries).
- **Acceptance criteria:** fallback state clearly labeled as such, **or** real DB-backed metrics implemented; no "Live"/"Workspace-Derived" claim rendered while fallback data is shown; a test covering the fallback-labeling behavior.

### ERR-04 — F-02 severity recalibration: P0 → P2 architectural boundary / enterprise blocker

The finding stands factually — and the review **strengthened** it in one respect: the self-implemented AOC surface is not dormant. Governance-core policy evaluation is load-bearing on real product flows — document upload (`src/app/api/upload/route.ts:214` → `enforceRuntimeAuthorization` → `evaluateGovernanceAction`, `src/aoc/enterprise/runtime/governance-core.ts:42`), copilot, and operational memory — and capability-claim signing (`createCapabilityClaim`, HMAC/Ed25519) is reachable from the authenticated approvals UI (`src/components/governance/ApprovalCard.tsx:143` → `/api/governance/approvals/[id]/approve` → `issueExecutionGrant` → `createCapabilityClaim`).

However, the severity was miscalibrated. Validated position:

- It is an **architectural ownership violation**, not an active security vulnerability.
- It does **not** block internal use, closed free pilot, closed paid pilot, or first revenue.
- It **does** block honest claims of canonical AOC interoperability, and it **does** block enterprise readiness.
- It must be externalized before enterprise integration and before any public AOC-interoperability claims.
- Enforcement coverage is **selective** (see M-05): "canonical across the whole product" overstates it.
- **Validated severity: P2 — architectural boundary / enterprise blocker. Not P0.** The only immediate (and zero-cost) obligation is behavioral: stop presenting local capabilities as canonical AOC, and add no new local-authority surface area.

### ERR-05 — F-03 severity recalibration: stage-calibrated, not a general technical P0

The scaffolding finding stands: functionally inert code exists at scale, described with production-maturity vocabulary, and it represents genuine diligence, maintenance, and credibility risk.

Validated position:

- It does **not** technically block a pilot — none of the inert modules sit on the pilot's critical path.
- It **does** obligate, immediately and at near-zero cost: hiding non-productive modules from any exposed capability set; not commercializing them; not describing them as active capabilities in any external material; and creating a scaffolding inventory/register.
- **Validated severity: P1 for external claims and demos (behavioral); P2 as technical cleanup. Not a general technical P0.**

### ERR-06 — "Zero product analytics" corrected

The precise statement is:

- **Limited activation telemetry exists**: `src/lib/first-user-telemetry.ts` defines a real, DB-backed funnel (`first_user_telemetry_events`) covering onboarding started/completed, invite activation, first workspace loaded, first copilot interaction, first operational-memory write, first follow-up created — surfaced in the founder early-access dashboard.
- **AI usage events exist**: `ai_usage_events` records every inference call with cost estimation.
- **What is missing** is a product analytics platform: funnels beyond activation, retention, cohorting, feature adoption, session analytics.
- **Classification:** not a closed-pilot blocker (existing telemetry plus direct founder contact is adequate for a handful of design partners); required before public launch; useful before scaling beyond a handful of design partners.

### ERR-07 — Packaging simplification

The 9-plan proposal in `09-product-packaging.md` is oversized. **Validated launch baseline** — matching the three tiers already wired in `src/lib/feature-gates.ts`, requiring zero new architecture:

- **Founder Invite / Free**
- **Pro Individual**
- **Team / PMO**
- **Enterprise later** (existing contact-sales mailto)

Consultant, Agency, and Consulting Firm can be **marketing aliases** initially; they do not need separate product architecture at launch (note: true multi-client consultant access would eventually need an external-access role that does not exist — that is deferred design work, not launch packaging). Do not build 8–9 plans before validating willingness to pay.

### ERR-08 — AOC ports staging correction

`07-aoc-consumer-architecture.md`'s port designs remain valid as target architecture, but their timing was miscalibrated. **Zero of the ten ports are required before pilot, paid launch, B2C, or B2B.**

**Not immediate (design before enterprise integration; do not implement in the pilot sprint):**
AgentIdentityPort · AgentPassportPort · RevocationStatusPort · PolicyEvaluationPort · EvidencePublisherPort · AocUsagePort · AssuranceStatusPort · TenantStatusPort · HealthReportingPort.

**Possible overlap:** EntitlementPort may be partially represented by PMFreak's existing product entitlement layer (`feature-gates.ts`), but must remain **conceptually distinct** from future AOC capability entitlements — do not conflate the two (this distinction in `06-billing-and-entitlements.md` remains correct).

Additional staging notes from the review:

- PMFreak already has an internal `RuntimeAuthorityPort` carrying production traffic in-process; PolicyEvaluationPort should be designed as the externalization of that existing port, not a parallel abstraction.
- TenantStatusPort and HealthReportingPort are candidates for merging into a single enterprise-lifecycle port; AgentPassportPort may merge into AgentIdentityPort. Decide when real external contracts exist.
- Do not implement external AOC ports in the immediate pilot sprint. Design them before enterprise integration. And **do not allow PMFreak to keep calling local capabilities "canonical AOC"** in the interim.

### ERR-09 — F-04 and F-05 remain P0

Confirmed against the repository's own risk register at HEAD (`docs/release/residual-risk-register.md`, updated through Perilla 13B): **RR-MIGRATE remains OPEN** (local Postgres 16 proof done, 26 defects found/fixed; hosted execution never run — templates explicitly marked NOT EXECUTED) and **RR-BACKUP remains OPEN** (restore never rehearsed, PITR unconfirmed). Both rows are marked "Before pilot start: **Yes**."

- They block a closed free pilot **with real external data**; they block a paid pilot; they must close before any external onboarding.
- They are the principal real technical launch blockers. **Severity: P0, unchanged.**

### ERR-10 — F-01 stage calibration

The finding is real and confirmed at HEAD: no `/terms`, `/privacy`, or `/legal` routes exist; the landing footer links remain `disabled: true` (`src/app/page.tsx:158-159`); no ToS/Privacy/DPA/subprocessor content exists anywhere in the repo or public assets.

Calibration:

- Does **not** block internal use.
- **May not block a closed free pilot** if a direct, signed pilot agreement with each design partner covers terms and data handling (an offline substitute for published documents).
- **Blocks a paid pilot** (charging without published terms).
- **Blocks public launch.**
- Must be resolved with appropriate legal review. This errata does not constitute legal advice.

## Removed Findings

| ID | Disposition |
|---|---|
| F-06 (`governance_delegations` RLS policy typo) | **Removed from all active backlogs — already resolved** by `supabase/migrations/20260515100000_rls_governance_fixes.sql`. Preserved in `04-critical-findings.md` as historical record only. |

No other finding is removed. All other original findings remain, as accepted or as recalibrated above.

## New Findings

### M-01 / F-NEW-01 — Dashboard fallback presented as live

See ERR-03 for full description, classification (P1 before external demo/pilot), and acceptance criteria.

### M-02 / F-NEW-02 — Deterministic chat may be perceived as AI

- **Surface:** the Command Center conversational surface (`/command-center`, default-visible "Execution" lens in `navigation-hierarchy.ts:17`; `src/features/command-center/conversation-data.ts:18` POSTs to `/api/command-center/chat`).
- **Actual behavior:** deterministic, rule-based intent classification and templated responses; no LLM, no RAG, no chat persistence (ERR-02).
- **Risk:** in an AI-marketed product, users and design partners will reasonably assume the conversational surface is AI-driven; discovering otherwise damages trust, and any diligence reviewer will flag it.
- **Required correction:** UI copy and any marketing language must not describe this surface as AI/inference-driven, **or** the surface should be re-pointed at the real inference path (the copilot pipeline) — a founder decision (see Pilot Gate Sprint task 6).
- **Acceptance criteria:** no user-visible copy on the command-center chat implies live AI analysis while it is deterministic; if re-pointed at real inference, `OPENAI_API_KEY` presence is verified in the pilot deployment and failure modes are handled; a test asserting the chosen labeling/behavior.

### M-03 / F-NEW-03 — Optional capability secret can cause runtime failure in governance flows

- `PMFREAK_CAPABILITY_CLAIM_SECRET` is **optional at boot** (grouped under "optional" in `.env.example:129-131`; not in the required-vars list of `src/lib/security/environment.ts`), but `src/lib/aoc/adapters/trust-domain.ts:51-53` **throws** (`capability_claim_secret_missing`) when it is absent.
- Consequence: in a default deployment with the secret unset, any UI approval that reaches `issueExecutionGrant`/`createCapabilityClaim` fails at runtime. Fail-closed (good), but an operational/user-experience trap on a UI-reachable path (`ApprovalCard.tsx` approve flow).
- **Required behavior:** if the governance capability is enabled for a workspace/plan, the secret must be required (fail at startup/readiness, not mid-flow); if governance is not enabled, the flows must degrade gracefully (feature hidden/disabled, not throwing).
- **Classification: P2 — required before exposing governance capabilities to any pilot participant.**

### M-04 / process rule — Carried-forward findings must be re-verified at HEAD

- Do **not** use security registers, prior audit docs, or any internal self-documentation as source of truth without checking migrations and code at HEAD (this is exactly how the F-06 error happened, and why `04-critical-findings.md` scheduled an already-fixed bug).
- Every sprint must re-validate carried-forward findings before working on them.
- Acceptance evidence for any finding fix must cite current code (path + line at the fixing commit), not documentation.

### M-05 / F-NEW-04 — Governance enforcement is selective

- Flows that pass through the self-implemented governance pipeline: document upload (`/api/upload`), copilot (`/api/copilot`), operational memory (`/api/operational-memory`), plus the approvals/capabilities governance UI actions.
- Flows that do **not**: `/api/projects`, `/api/billing/*`, `/api/command-center/chat`, `/api/getting-started` (verified — they do not invoke the governance pipeline; some import only an error type).
- Implications: (a) nobody should assume governance-core provides uniform authorization coverage — the workspace-membership/RLS layer remains the primary boundary; (b) **externalization cost is higher than an adapter swap**, because extraction touches live product paths; (c) an explicit coverage decision (enforce everywhere / enforce nowhere / documented subset) is required before enterprise extraction.
- **Does not block a pilot.** Classification: P2 architectural decision, pre-enterprise.

## Revised Severity Register

Stages: S0 internal · S1 closed free pilot · S2 closed paid pilot · S3 private beta · S4 public B2C · S5 public B2B · S6 enterprise.

| ID | Original | Validated | First blocked stage | Decision |
|---|---|---|---|---|
| F-01 legal docs | P0 | **P0 before S2**; S1 viable with signed offline pilot agreement | S2 (S1 with offline substitute) | Accept, stage-scoped |
| F-02 AOC self-implementation | P0 | **P2 architectural / enterprise blocker** + immediate zero-cost honesty rule | S6 (honesty: immediate) | Accept with lower severity |
| F-03 scaffolding gap | P0 | **P1 behavioral (claims/demos) / P2 technical** | None hard; honesty immediate | Accept with lower severity, wider scope (M-01, M-02) |
| F-04 hosted migration proof | P0 | **P0** | S1 (real data) | Accept |
| F-05 backup restore | P0 | **P0** | S1 (real data) | Accept |
| F-06 RLS policy typo | P1 | — | — | **Removed — already resolved** |
| F-07 error-message leakage | P1 | **P2** (authenticated-only disclosure; trivially cheap fix — `safeErrorMessage` exists at `src/lib/security/redaction.ts:69`) | S4/S5 formally | Accept lower; fix in Pilot Gate Sprint anyway |
| F-08 OAuth / MFA | P1/P2 | OAuth **P2 → S4**; MFA **P2 → S5** | S4 / S5 | Accept, stage-clarified |
| F-09 deletion/export | P1 | **P1 → S3**; manual operator export acceptable S1–S2 (matches documented pilot commitment RR-EXPORT) | S3 | Accept |
| F-10 analytics | P1 | **P1 → S3** (see ERR-06) | S3 | Accept with correction |
| F-11 agent execution in-memory | P1/P2 | **P2**; blocks nothing unless marketed — marketing rule immediate | When sold | Accept |
| F-12 legacy `company_id` RLS ×2 | P2 | **P2 → S5** | S5 | Accept |
| F-13 vault/intake RLS-only | P2 | **P2**; trivial fix | S5 formally | Accept; fix in Pilot Gate Sprint |
| F-14 hardcoded plan catalog | P2 | **P3 → first custom deal** | S6 | Accept, deferred |
| F-15 coupons/tax/native trials | P2 | **P2 → S4**; not needed for first revenue | S4 | Accept with lower urgency |
| F-16 support console | P2 | **P2**; manual support adequate ≤5 partners; lookup console by ~50 customers | S3/S5 | Accept |
| F-17 external alerting | P2 | **P2 → S3** | S3 | Accept |
| F-18 pentest | P1 | **P1 → before S3/S4** ("before open beta" per risk register) | S3 | Accept |
| F-19 test reimplementation drift | P2 | **P2**; the false CI-coverage docstring fix is trivial-now | — | Accept; split |
| F-20 AI cost fail-open | P3 | **P3 — accepted documented debt** | — | Accept as-is |
| F-21 orphaned modules | P2 | **P2, corrected scope**: PMO Command Center / PM Registry / Performance / Capacity confirmed absent from nav; the governance family is **not** orphaned (nav-gated advanced entries at `navigation-hierarchy.ts:31-35`, hidden by default, capability-gated) | S5 (PMO demos: S1) | Accept with correction |
| M-01 dashboard fallback as live | — (new) | **P1 before external demo/pilot** | S1 (demos) | Add to Pilot Gate Sprint |
| M-02 deterministic chat perceived as AI | — (new) | **P1 labeling before external exposure** | S1 (demos) | Add to Pilot Gate Sprint |
| M-03 optional capability secret | — (new) | **P2 before exposing governance capabilities** | S1 if governance enabled for partners | Add to Pilot Gate Sprint |
| M-04 re-verify at HEAD | — (new) | Process rule, permanent | — | Adopt |
| M-05 selective governance enforcement | — (new) | **P2 pre-enterprise architectural decision** | S6 | Backlog |

## Revised Readiness Scorecard

| Dimension | Original | Revised | Reason |
|---|---:|---:|---|
| Core product readiness | 3 | 3 | CRUD/critical-path/billing confirmed (+); AI-chat claim corrected and dashboard fallback found (−); net unchanged |
| Closed pilot readiness | — | 3 | New dimension: only RR-MIGRATE/RR-BACKUP + honest-UI + pilot agreement stand between current state and S1 |
| Paid pilot readiness | — | 2 | New dimension: adds published legal + Stripe live-mode verification |
| B2C readiness | 2 | 2 | Unchanged |
| B2B readiness | 2 | 2 | Unchanged |
| Enterprise readiness | 1 | 1 | Unchanged |
| Multi-tenancy | 4 | 4 | F-06 already fixed reinforces the score |
| Auth | 3 | 3 | Unchanged |
| Authorization | 4 | 4 | Confirmed |
| Billing | 3 | 3 | Confirmed |
| Metering/usage | 2 | 2 | Unchanged |
| Security | 3 | 3 | Confirmed (F-07 real but authenticated-only) |
| Observability | 2 | 2 | Confirmed |
| Reliability | 2 | 2 | RR-MIGRATE/RR-BACKUP still open |
| Compliance | 0 | 0 | Confirmed — nothing exists |
| Product analytics | — | 1 | New dimension: narrow real activation funnel exists; no platform (ERR-06) |
| AI governance | 2 | 2 | Unchanged; real guardrails on the real inference path confirmed |
| AOC consumer readiness | 1 | 2 | Port/adapter machinery is real and load-bearing in-process (`RuntimeAuthorityPort`, consumer client); external transport still stubbed |
| Supportability | 1 | 2 | Founder tooling more real than credited: trial extend/revoke, invite ops, telemetry view — adequate ≤5 partners |
| Transferability | 2 | 2 | Unchanged |
| Valuation defensibility | 2 | 2 | Chat/dashboard misrepresentation findings offset the F-06 correction |

Dimensions not listed above: **unchanged** from `03-saas-readiness-scorecard.md`.

## Revised Stage-Based Launch Gates

### Stage 0 — Internal use: **GO**
Conditions: controlled data; founder-supervised; no external claims of canonical AOC.

### Stage 1 — Closed free pilot: **CONDITIONAL GO** only after:
- F-04 closed (hosted migration proof);
- F-05 closed (restore drill);
- dashboard fallback/live copy corrected (M-01);
- deterministic chat and heuristic first-insight copy honest (M-02, ERR-02);
- critical leaks fixed (F-07 sweep, F-13 membership check);
- signed pilot agreement in place per design partner;
- pilot capability set curated (which advanced/governance capabilities partners see; M-03 handled).

Accepted debt at S1: no OAuth; no full product analytics; no AOC externalization; no full admin console; manual support.

### Stage 2 — Closed paid pilot. Requires Stage 1 plus:
- legal minimum published (ToS/Privacy);
- billing flow validated in live mode;
- support and incident path documented;
- refund/cancellation process agreed (manual acceptable);
- data-handling clarity communicated to paying customers.

### Stage 3 — Private beta. Requires Stage 2 plus:
- product analytics platform (activation → retention);
- account deletion/export (support-mediated minimum);
- stronger support tooling (customer/org lookup);
- monitoring and alerting (Sentry-class);
- onboarding reliability;
- pentest scheduled or complete (F-18).

### Stage 4 — Public B2C. Requires Stage 3 plus:
- self-service legal acceptance; self-service billing incl. trials/coupons/tax per go-to-market (F-15);
- self-service deletion/export;
- OAuth (F-08a);
- production monitoring; support workflow;
- security review (pentest remediated).

### Stage 5 — Public B2B. Requires Stage 4 plus:
- team administration; seat/billing administration;
- PMO navigation un-orphaned (F-21);
- scalable support (console incl. audited impersonation);
- stronger auth (MFA — F-08b);
- auditability for customer admins;
- F-12 legacy-RLS closure; F-19 reachable-module test fixes.

### Stage 6 — Enterprise. Requires Stage 5 plus:
- external AOC provider integration (F-02 resolution; ports per ERR-08);
- SSO; SCIM; Assurance (externally sourced only); SLA; retention enforcement; advanced audit; enterprise contracting (DPA, subprocessors).

## Revised AOC Consumer Timing

See ERR-08. Summary: the target architecture in `07-aoc-consumer-architecture.md` stands; the timing does not. No port is implemented in the pilot sprint; ports are designed against real external AOC contract drafts before enterprise integration; PolicyEvaluationPort externalizes the existing internal `RuntimeAuthorityPort` rather than duplicating it; TenantStatus+HealthReporting and AgentIdentity+AgentPassport are merge candidates; EntitlementPort stays conceptually distinct from the product entitlement layer. Immediate obligations are behavioral only: no canonical-AOC claims, no new local-authority surface, M-03 handled.

## Revised Product Packaging

See ERR-07: Founder Invite/Free · Pro Individual · Team/PMO · Enterprise later. Consultant/Agency/Consulting-Firm as marketing aliases at most. No new plan architecture before willingness-to-pay is validated.

## Revised First 30 Actions

### Immediate (max 10) — Pilot Gate Sprint 01 (detailed in the next section)
1. Close RR-MIGRATE with hosted proof.
2. Close RR-BACKUP with restore drill.
3. Fix raw Postgres error leakage on reachable routes (F-07).
4. Fix vault/intake membership authorization gap (F-13) — confirmed at HEAD.
5. Correct dashboard fallback/live labeling (M-01).
6. Correct deterministic chat and heuristic insight copy (M-02, ERR-02).
7. Define enabled capability set for pilot partners.
8. Require or gracefully disable the capability secret (M-03).
9. Produce pilot agreement and legal minimum plan (F-01, stage-calibrated per ERR-10).
10. Create scaffolding disclosure register (F-03 behavioral component) — includes correcting the false CI-coverage docstring (F-19a).

### Next (max 10) — after S1, toward S2/S3
1. Product analytics platform (activation funnel first) — ERR-06.
2. Account deletion/export (support-mediated first) — F-09.
3. OAuth (Google) — F-08a.
4. Support tooling (customer/org lookup) — F-16 phase 1.
5. Pentest procurement and execution — F-18.
6. PMO navigation un-orphaning after demo triage — F-21.
7. Plan catalog kept simple per ERR-07 (resist expansion).
8. Monitoring/alerting (Sentry-class) — F-17.
9. Self-service lifecycle polish (published legal acceptance at signup, cancellation clarity).
10. Billing completeness as GTM requires (native trials/coupons; tax as revenue scales) — F-15.

### Deferred (max 10)
1. AOC externalization (F-02) — gated on external provider existence.
2. AOC ports design/implementation — ERR-08.
3. Assurance integration — external provider only.
4. SSO.
5. SCIM.
6. Marketplace.
7. Public API.
8. Wallet UI / visible token.
9. Multi-region.
10. Reseller program.

## Pilot Gate Sprint 01 — Trustworthy External Pilot Readiness

**Objective:** prepare PMFreak for an honest, safe, verifiable closed free pilot. (Definition only — not implemented in this iteration.)

**Excluded from scope:** AOC externalization; AOC ports implementation; enterprise features; OAuth; SCIM; product analytics platform; admin console; pricing expansion; new governance modules.

| # | Task | Objective | Affected path | Owner | Size | Dependency | Rollback | Acceptance criteria / evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Close RR-MIGRATE | Prove full migration set on hosted Supabase | `scripts/check-fresh-db-migrations.mjs`, `docs/release/database-bootstrap-runbook.md` §10, hosted evidence docs | Founder/Eng | M | Hosted credentials (`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`) | N/A (isolated scratch project) | RR-MIGRATE row moved to Closed with real hosted-run artifacts; hosted-* evidence docs populated |
| 2 | Close RR-BACKUP | Rehearse restore; record RPO/RTO | Ops runbook §8 | Founder/Eng | M | Task 1's hosted project | N/A (scratch restore target) | RR-BACKUP row Closed; documented drill with timings |
| 3 | Error-leak sweep (F-07) | Stop returning raw driver `error.message` | `src/app/api/{governance,sdk,v1}/**` (~10 routes) | Eng | S–M | None (`safeErrorMessage` exists, `redaction.ts:69`) | Revert commit | All identified routes return generic client errors; server logs keep detail; regression test added |
| 4 | vault/intake membership check (F-13) | App-layer scoping, defense-in-depth | `src/app/api/vault/intake/route.ts` | Eng | S | None | Revert commit | Non-member `workspaceId` denied with 403 before any DB call; test independent of RLS state |
| 5 | Dashboard honest labeling (M-01) | No fallback data presented as live | `src/app/(protected)/dashboard/page.tsx`, dashboard runtime labels | Eng | S–M | Product copy decision | Revert commit | Fallback clearly labeled; no "Live"/"Workspace-Derived" over fallback DTO; labeling test |
| 6 | Chat/insight honest copy (M-02) | No deterministic surface implies live AI | `AIActivationTransition.tsx`, command-center chat UI copy (or re-point to copilot inference — founder decision) | Founder+Eng | S–M | Founder decision (relabel vs re-point) | Revert commit | No user-visible copy implies AI analysis on deterministic paths; if re-pointed, key-presence verified and failure modes handled; test asserts chosen behavior |
| 7 | Pilot capability set | Curate what partners see | Workspace capability config; `navigation-hierarchy.ts` gating | Founder | S | None | Config change | Written decision: enabled capabilities per partner; hidden modules verified unreachable in a pilot account |
| 8 | Capability secret handling (M-03) | No mid-flow throw in default deployments | `src/lib/security/environment.ts` (readiness), `src/lib/aoc/adapters/trust-domain.ts` callers | Eng | S | Task 7 (is governance enabled for pilot?) | Revert commit | If governance enabled: secret required at readiness; if disabled: flows degrade gracefully; test for both |
| 9 | Pilot agreement + legal minimum plan (F-01) | Lawful S1; path to S2 | New offline template + draft ToS/Privacy plan | Founder (+legal review) | M | External legal review | N/A (documents) | Signable pilot agreement template; written plan/timeline for published ToS/Privacy before S2 |
| 10 | Scaffolding disclosure register (F-03) | Honest internal/external capability inventory | New internal doc; audit of external materials; fix `tests/pm-registry-operationalization.test.mjs:9-12` false CI claim | Founder+Eng | S | None | N/A (doc) | Register lists inert families with status; no external material overstates capability; docstring corrected |

**Sprint evidence bundle:** RR rows closed with hosted artifacts; tests for tasks 3–6/8; before/after copy diffs; signed-ready pilot agreement template; written capability-set decision; scaffolding register.

## Do-Not-Build Confirmation

`13-do-not-build.md` is confirmed in full (SCIM, marketplace, public API, wallet UI, visible token, Kubernetes, multi-region, microservices, partner portal, agent economy, advanced Assurance UI, reseller program — plus its addenda). This errata adds: no 8–9-plan catalog (ERR-07); no AOC port implementations before external contracts exist (ERR-08); no new local trust/claims/attestation surface (ERR-04); no further investment in inert scaffolding families without a customer signal (ERR-05). The single preserved exception: SSO pull-forward only for a signed enterprise-adjacent deal that demands it.

## Branch and PR Recommendation

- **Preserve commit `7dc0d1b`** as the historical Phase 1 record. **Do not amend it.** Do not rebase or rewrite history.
- **Add this errata as a second local commit** on the same branch. Suggested commit message: `docs(productization): add independent review errata`.
- **Push only after manual review** of the diff by the repository owner.
- **Open a documentation-only PR** containing both commits (audit + errata together — the audit must not enter `main` without its corrections attached). Suggested PR title: `docs(productization): establish validated PMFreak SaaS readiness baseline`.
- **Merge the documentation PR before starting implementation.**
- **Create the implementation branch from updated `main`**: `feat/pilot-gate-sprint-01`.
- No commit or push is performed during this iteration; both remain manual, post-review actions.

## Final Validated Verdict

The Phase 1 audit is a reliable map (77/100) and, with this errata applied, a usable baseline. PMFreak is **GO for internal use today**, and **CONDITIONAL GO for a closed free pilot** upon completing Pilot Gate Sprint 01 (hosted migration proof, restore drill, honest-UI corrections, leak fixes, pilot agreement, curated capability set). A **closed paid pilot** follows shortly after with published legal minimum and live-mode billing verification. Private beta, public B2C/B2B, and enterprise remain NO-GO pending their stage gates above. AOC externalization is real, correctly diagnosed, and deliberately deferred: it blocks enterprise and honest canonical-AOC claims — not the pilot, not first revenue. The immediate obligations that cost nothing are behavioral: demo only what is real, label what is deterministic, claim externally only what is externally provided.
