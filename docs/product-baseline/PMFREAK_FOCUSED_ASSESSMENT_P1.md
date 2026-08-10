# PMFreak Focused Repository Assessment (P1)

**Assessment date:** 2026-08-10
**Normative target:** `PMFREAK_PRODUCT_BASELINE_V2.md`
**Evidence rule:** code and documentation establish possibility; only a connected path plus persistence, authorization, tests, honest UI, and reproducible runtime establish product behavior.

## Executive Verdict

**Verdict: `INTEGRATION REQUIRED`.**

1. **Closed loop today:** no complete P0 closed loop is demonstrable. A strong, persisted **manual Evidence → deterministic Signal/Risk/Governance Event → Recommendation → Human Decision** sub-flow exists, but it is a parallel “operational flow” bounded path and stops before a canonical governed Action, execution, Outcome Observation, and controlled Learning chain.
2. **First rupture:** at P0 stage `Sources → Raw Inputs → Normalized Events → Evidence`. The commercial entry point (`TextCaptureModal`) posts human text directly as `evidence_items`; `createEvidenceItem()` writes a constant zero hash and there is no raw-input/normalized-event object in this path. It is honest manual capture, but not source normalization with verifiable provenance.
3. **Best reusable fragment:** the transactional operational-flow migration/RPC and service, role-aware route, project inbox, immutable evidence snapshot at decision time, and focused contract tests. It already separates governed recommendations from the legacy H3 path and records a first-class operational decision.
4. **Dominant problem:** **disconnection and competing domain paths**, followed by missing source/provenance semantics and UI fragmentation—not total absence. There are substantial H3–H10, auth, event, AOC, execution, outcome, and learning components, but no single user path connects their authoritative lifecycles.
5. **Honest demo now:** yes, only as a declared **Evidence-to-Decision technical demonstration** using the explicit seed/manual text and an available Supabase instance. It must not be described as the full Operational Command Center loop.
6. **Founder Invite now:** no. The repository cannot demonstrate all 17 steps against live isolated infrastructure in this environment, and the operational Decision has no connected governed Action/Task/Outcome continuation.
7. **Highest-leverage next moves:** (a) ratify and extend the operational-flow domain as the one commercial spine; (b) connect its Decision to AOC-authorized Action → idempotent Task using existing execution components; (c) expose that spine as one project-scoped PM Daily Execution experience with explicit fixtures/degraded states and an executable acceptance harness.

**Allowed aggregate metrics.** Capabilities `EXISTS`: **8 yes / 6 partial / 0 no**; capabilities `WIRED_END_TO_END`: **0 yes / 12 partial / 2 no**. Slices `WIRED_END_TO_END`: **0 yes / 7 partial / 2 no**. Founder Invite: **0 WORKS_NOW / 10 PARTIAL / 1 MOCKED / 2 BROKEN / 4 ABSENT / 0 BLOCKED_BY_ENV**. The environment prevents live proof but does not replace missing connections with `BLOCKED_BY_ENV`.

## Scope, Repository State and Limitations

The assessment began on branch `work`, HEAD `7836d91ec12123b8869bd2a2244c99a753e28a62`, with a clean working tree. The stack is Next.js 16.2.10/React 19/TypeScript, Supabase/PostgreSQL, npm, and in-repository AOC-P/AOC-E packages. The applicable `AGENTS.md` requires reading Next's bundled guide before code changes; no application code was changed, so no Next API was authored. `CLAUDE.md` delegates to `AGENTS.md`; `CONTRIBUTING.md` prohibits unauthorized dependencies and sensitive/proprietary material.

Environment variables describe Supabase, service-role, AI-provider, governance, connector, trial, billing and operational-flow requirements. Values were not printed. Dependencies were already installed. No remote services were activated and no production data was written.

**Limitations:** no isolated Supabase URL/service key was available for `check:operational-flow-db`; therefore migration/RLS/data durability received code-and-contract-test evidence, not a live database replay. No authenticated browser fixture existed, so session refresh and the complete UI path were not manually exercised. Production build and static checks were safe; local smoke with external connectors was omitted to avoid external effects. GitHub required-check configuration is not available from repository files alone.

## Evidence Standard and Commands Executed

Claims use `Target / Observed / Gap / Action` and exact code paths. `high` confidence requires direct code plus focused test/runtime evidence; `medium` means code/tests without live infrastructure; `low` means ambiguous/indirect evidence. Source-scanning tests are explicitly weaker than behavioral integration tests.

| Command | Result / duration | Relevance / limitation |
|---|---|---|
| `git branch --show-current; git rev-parse HEAD; git status --short` | pass, <1s | Repository baseline; clean before audit file |
| `npm run typecheck` | pass, ~79s | Compile-time contract health |
| `npm run lint` | pass, ~130s | Product/AOC boundary lint and ESLint |
| focused `npx tsx --test …` (12 files) | pass: 543 tests, ~35s | Operational flow, H4/H6/H7/H9, auth/invite, AOC fail-closed, outcomes, portfolio; many assertions are source/contract tests |
| `npm run check:aoc-boundaries` | pass, ~19s | Packaging/direction pass, but report-mode consumer audit lists 35 deep/ownership-bypass findings |
| `npm run build` | pass with warning, ~3m | Production compilation; Turbopack warns that runtime-hardening file tracing may trace the whole project |
| `git diff --check` | pass after document creation | Documentation integrity |
| Live DB/RLS operational-flow verifier | omitted | Requires isolated Supabase infrastructure; focused test confirms explicit failure when absent |

## Observed Architecture Map

| Component | Entry points / responsibility | Authority/data/consumer | Status | Evidence |
|---|---|---|---|---|
| Protected application shell | `(protected)/layout.tsx`; auth continuity, workspace/onboarding resolution | Supabase auth/session; service-role only for blocked-trial evidence; all protected pages | active, complex | `src/app/(protected)/layout.tsx`; `src/lib/auth/runtime-auth-continuity.ts` |
| Project execution page | `/projects/[id]`; project/task access and upload/analyze links | Supabase project/task rows; capability runtime | active, partial product model | `src/app/(protected)/projects/[id]/page.tsx`; `ProjectTaskList` |
| Project Intelligence Inbox | `/command-center`; operational summary, manual capture, review | `operational-flow` API and Supabase flow tables | active, narrow vertical | `project-intelligence-inbox.tsx`; `text-capture-modal.tsx` |
| Operational flow | Evidence creation, deterministic chain, recommendation/decision | role-aware API; RPC-owned persistence; inbox | active, first-half spine | `operational-flow-service.ts`; `20260611000000_operational_evidence_decision_loop.sql` |
| Legacy H3/H5 | RAID-derived recommendations, decision status, task drafts | Supabase tables and project authorization; operational shell | active legacy/parallel | `recommended-actions/*`; `task-drafts/*` |
| H6/H7 execution model | execution tasks and dependency graph routes/services | Supabase, server authorization; dashboard/project consumers | active, disconnected from operational Decision | `api/execution-tasks/*`; `api/execution-task-dependencies/*` |
| H8/H9 schedule | critical-path compute/materialization/query | project access; schedule tables; operational shell panel | active, specialized | `lib/critical-path/*`; `api/critical-path/*` |
| Portfolio/PMO | portfolio APIs/pages and personal portfolio engines | mixed persisted membership and caller-supplied metrics | partial/experimental | `api/portfolio/*`; `api/personal-portfolio/*`; `/portfolio`, `/pmo-command-center` |
| Outcome/learning systems | agent execution reconciliation and several learning engines | dedicated agent execution tables/routes, mostly separate from PM flow | partial/parallel | `api/agents/execution/outcomes/*`; `lib/decision-effectiveness/*`; `lib/constitutional-learning/*` |
| AOC runtime consumer | server-side authorization, audit, delegation, grants | in-process AOC-E package by default; protocol ports | active local package, remote subsets partial | `src/aoc/runtime-consumer/*`; `src/aoc/enterprise/runtime/*` |
| External sources/providers | vault/upload/analyze/connectors | provider-dependent; manual/fallback paths | mixed | `api/vault/intake`; `upload/page.tsx`; connector runtime |
| CI/delivery | governance, IP, release, package workflows | GitHub Actions | active definitions; remote status unverified | `.github/workflows/*.yml` |

```mermaid
flowchart LR
  UI[Command Center / Text capture] --> API[/api/operational-flow]
  API --> AUTH[Auth + project/workspace role]
  API --> E[(evidence_items)]
  E --> RPC[materialize_operational_chain RPC]
  RPC --> S[(signals / risks / governance events)] --> R[(governed recommended_actions)]
  R --> D[(operational_decision_records + evidence snapshot)]
  D -. no canonical connection .-> A[Governed Action]
  L[Legacy recommendation] --> TD[Task draft] --> ET[Execution task]
  AOC[AOC-E in-process / remote advisory paths] --> AUTH
  ET -. separate agent reconciliation .-> O[Outcome / learning subsystems]
```

## Commercial Closed-Loop Trace

| Stage | Target | Observed | Concrete gap / action | Evidence |
|---|---|---|---|---|
| Project State | Typed, temporal control model | Real Workspace/Project/Task/RAID/schedule/decision tables and UI; model is spread across legacy and newer aggregates | No one snapshot owns objectives/outcomes, deliverables, changes, commitments and full history. Reuse project/task spine; define commercial projection | `projects/[id]/page.tsx`; `operational-shell.tsx`; migrations |
| Source/Raw/Normalized | Authorized source → raw → event | Manual text and vault/upload/connectors exist; commercial inbox starts at manual evidence | **First rupture:** preserve raw content/hash, normalized event and provenance before evidence | `text-capture-modal.tsx`; `createEvidenceItem()` |
| Evidence | Classified, verifiable evidence | `evidence_items`, evidence links, decision-time snapshot; project/workspace checks | Constant zero `evidence_hash`; no fact/assumption/inference classification in entry path | `operational-flow-service.ts`; flow migration |
| Finding | Temporal explainable intelligence | Deterministic SQL detector creates signals/risk/governance event; detector key recorded | Narrow keyword/demo detector; no general `dataHorizon`, missing-information or confidence calibration | `materialize_operational_chain`; `SIGNAL_DETECTOR_KEY` |
| Recommendation | Evidence/options/tradeoffs/confidence/authority | Governed recommendation persists with confidence/urgency/authority context and decision controls | Alternatives and quantified tradeoffs/expected impact are incomplete; two recommendation models coexist | flow migration; inbox; `recommended-actions` legacy route |
| Human Decision | Separate, authorized, evidence-at-time | `record_operational_decision` RPC records actor/rationale/status and immutable evidence snapshot | Business Decision is not connected to AOC policy decision or next Action. `allowDecisionWriteback` is deliberately forced `false` across v1 remote client/gate/UI configs | flow migration; AOC governance client configs |
| Governed Action | Separate intent, current grant/obligation | Strong AOC local authorization and separate execution/grant subsystems exist | No adapter maps operational Decision to canonical Action/capability request. Legacy H5 converts Recommendation directly to task draft and can mark it `converted_to_task` | `server-authorization.ts`; `task-drafts/materialize-task-draft.ts` |
| Task/Execution | Idempotent task/provider lifecycle | H6 tasks/dependencies, dashboard adapters and agent execution runtime have lifecycle/idempotency pieces | Disconnected from governed operational Decision; provider execution is not the default commercial continuation | `api/execution-tasks/*`; agent execution routes |
| Outcome Observation | Expected vs observed, evidence-linked | Agent execution outcome/review routes and decision-outcome engines exist | No PM-facing Outcome linked from operational Decision/Action/Task; this is where the observable commercial loop ends | `api/agents/execution/outcomes/*`; decision outcome tests |
| Learning | Candidate → controlled ratification | Multiple candidate/pattern/ratification foundations | No connected elevation from this commercial lineage and no unified PM admin UI | constitutional/institutional/agent learning modules |

**Representative signal trace.** `TextCaptureModal` posts `create_evidence`, then `run_chain`. The route rechecks authenticated user, project access, workspace-project match, role, and calls `materialize_operational_chain`. The migration deterministically derives a signal, risk/issue, governance event and governed recommendation in a transaction. Inbox GET retrieves those rows plus decision authority. A human posts `record_decision`; the RPC derives lineage and snapshots exact evidence. There is no returned or emitted Action reference, so reproduction stops there.

**Subsequent ruptures:** incomplete recommendation option semantics; business Decision/AOC policy decision mismatch; absent Decision→Action adapter; legacy Recommendation→Task shortcut; outcome/learning on parallel agent-specific aggregates; no single UI reconstruction of the chain.

**Operational risk:** users may confuse legacy “accepted/converted” status with a first-class Decision or governed execution, and abundant routes/tests may overstate product connectivity. The minimum repair is connection, not rewrite: choose the governed operational Decision as spine and adapt existing AOC/execution/outcome components behind separate commands.

## Capability Assessment Matrix

| Capability | EXISTS | WIRED_END_TO_END | DATA | UI | TESTS | OWNER | CONFIDENCE | ACTION | Primary gap | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Operational Project Model | yes | partial | real | partial | partial | PMFreak/external | medium | connect | Fragmented aggregates; no complete temporal projection | project/task/RAID/schedule services |
| Evidence and Provenance | yes | partial | mixed | partial | partial | PMFreak/AOC-P/external | high | repair | Direct-to-evidence, zero hash, weak classification | operational-flow service/migration |
| Operational Memory | yes | partial | real | partial | partial | PMFreak/AOC-E | medium | connect | Multiple memory systems; commercial retrieval/elevation not unified | operational-memory APIs; memory routes |
| Project Intelligence | yes | partial | mixed | partial | partial | PMFreak | high | repair | Narrow detector and incomplete trust envelope | flow RPC; critical path engines |
| Recommendation Intelligence | yes | partial | real | partial | partial | PMFreak | high | consolidate | Governed and legacy recommendation lifecycles diverge; options incomplete | flow + recommended-actions paths |
| Decision Intelligence | yes | partial | real | partial | partial | PMFreak/AOC-E | high | connect | Decision exists but no Action/AOC correlation; parallel decision types | flow RPC; decision-governance service |
| Execution Control | partial | no | mixed | partial | partial | PMFreak/AOC-E/external | high | connect | No operational Decision→governed Action→Task chain | H5/H6 + agent execution |
| Schedule and Critical Path Intelligence | yes | partial | real | partial | partial | PMFreak/external | high | connect | Strong engine/UI panel, not linked into canonical finding/recommendation flow | critical-path library/routes/tests |
| Portfolio Execution Intelligence | partial | partial | mixed | partial | partial | PMFreak | medium | repair | Caller-supplied metrics and multiple portfolio semantics limit comparability | portfolio/personal-portfolio APIs |
| Organizational Learning | partial | no | mixed | absent | partial | PMFreak/AOC-E | medium | defer | Candidate/ratification modules not fed by commercial lineage | learning modules/routes |
| Agentic Coordination | partial | partial | mixed | partial | partial | PMFreak/AOC-P/AOC-E | medium | consolidate | Many agent workflows/fixtures; no single controlled commercial handoff | agent routes, registry, passports |
| Governance and Auditability | yes | partial | real | partial | partial | PMFreak/AOC-P/AOC-E | high | connect | Local package works; business lineage to grant/AOC evidence missing | runtime-consumer; governance routes |
| Integrations and Work Surfaces | partial | partial | mixed | partial | partial | PMFreak/AOC-E/external | medium | repair | Manual/demo fallbacks and provider readiness vary | vault/connectors/adapters |
| Commercial Product Foundation | partial | partial | real | partial | partial | PMFreak/external | medium | repair | Auth/invite foundation exists; no reproducible full-flow runtime gate | auth/invite/trial/metering code |

No capability earns E2E `yes`: the rule requires a reproducible runtime demonstration through UI, durable state, audit, degraded state and critical-risk tests. Operational Flow is closest, but ends at Decision. Schedule is substantial but remains an adjacent panel rather than a closed intervention slice.

**P0/P1 contradictions and apparent completeness.** P0 says Command Center is an experience; runtime still has activation/configuration and historical persisted Command Center semantics. P0 requires Recommendation≠Decision≠Action; governed flow respects Recommendation/Decision, while legacy `decideRecommendedAction` records a recommendation-status audit object and H5 can convert recommendation directly to a task draft. AOC packaging checks pass while their report-mode consumer audit still enumerates 35 deep/ownership-bypass findings—passing is not clean separation.

## Vertical Slice Assessment Matrix

| Slice / entry / persona | EXISTS | WIRED_END_TO_END | DATA | UI | TESTS | OWNER | CONFIDENCE | ACTION | First rupture / evidence |
|---|---|---|---|---|---|---|---|---|---|
| Recommendation — `/command-center`, PM | yes | partial | mixed | partial | partial | PMFreak | high | repair | Raw/normalized provenance absent; options incomplete; flow service/inbox |
| Decision and Approval — operational-flow decision, PM/sponsor | yes | partial | real | partial | partial | PMFreak/AOC-E | high | connect | Business Decision is not correlated to AOC governance decision/approval |
| Governed Execution — governance/agent execution, PM/admin | partial | no | mixed | partial | partial | PMFreak/AOC-E/external | high | connect | No Decision→Action entry point from commercial spine |
| Outcome Observation — agent outcome routes, PM/reviewer | partial | partial | mixed | absent | partial | PMFreak/external | medium | connect | Agent dispatch-specific outcomes, no PM spine lineage/UI |
| Dependency/Milestone Exposure — critical path + shell, PM | yes | partial | real | partial | partial | PMFreak/external | high | connect | Schedule result not normalized into governed finding flow |
| Critical Path Scenario — critical-path APIs/panel, PM | yes | partial | real | partial | partial | PMFreak | high | repair | Materialization works by contract; reproducible authenticated demo not run |
| PM Daily Execution — `/command-center`, PM | partial | partial | mixed | partial | partial | PMFreak | high | consolidate | Inbox, legacy actions/tasks and schedule are separate journeys |
| PMO Portfolio Attention — `/pmo-command-center`, PMO | partial | partial | mixed | partial | partial | PMFreak | medium | repair | Comparability/source coverage and live drill-through incomplete |
| Organizational Learning Candidate — learning APIs, PMO | partial | no | mixed | absent | partial | PMFreak/AOC-E | medium | defer | Not fed by complete lineage; no controlled user journey |

Authorization in the first two slices is server-side and project/workspace-aware. Persistence/events are strongest inside the operational-flow RPC. Degraded/error display exists in the inbox, but no slice has all 14 E2E criteria plus a live reproducible run. Contract fixtures dominate AOC UI modules and are named as fixtures; they must remain explicitly declared until replaced.

## Frontend Reality Check

| Experience | Route/component | Classification | Real contracts/data | Missing behavior | Recommended treatment |
|---|---|---|---|---|---|
| Signup/login/session | `/login`, `/signup`, protected layout | REAL | Supabase auth, continuity resolver, route tests | Live refresh/browser run not performed | preserve |
| Workspace/onboarding/invite | `/workspaces`, `/onboarding`, `/accept-invite` | REAL | memberships, invitations, server checks | Full first-user acceptance demo unavailable | preserve |
| Project create/select | `/projects/new`, `/projects/[id]`, preferred workspace | REAL | projects and workspace resolution | Context is split between query/project resolver and shell selection | repair |
| PM Execution/Command Center | `/command-center`, Intelligence Inbox | MIXED | governed operational flow plus other shell panels | Stops at Decision; duplicate/legacy concepts | consolidate |
| Recommendations | inbox + operational shell | MIXED | governed and legacy rows | Two lifecycles and incomplete canonical option contract | consolidate |
| Decisions/approvals | inbox, `/governance`, dashboard approvals | MIXED | real DB/RPC contracts | No unified business/AOC approval lineage | connect |
| Actions/tasks | `/execution`, project task list, shell | MIXED | real task/task-draft/execution routes | No governed operational Decision continuation | connect |
| Risks/issues | shell/inbox | MIXED | RAID plus operational risk records | Different taxonomies; detector is narrow | consolidate |
| Dependencies/milestones/critical path | shell critical-path panel | REAL | authenticated APIs and persisted materialization | Not a governed intervention slice | connect |
| Portfolio/PMO | `/portfolio`, `/pmo-command-center` | MIXED | persisted portfolio pieces and computed metrics | Some APIs accept caller metrics; confidence/coverage incomplete | repair |
| Operational/project memory | `/operational-memory`, `/project-memory` | MIXED | real endpoints/tables | Tier/elevation/retrieval experiences fragmented | consolidate |
| Governance/control plane | `/governance`, agent governance pages | MIXED | local AOC runtime and DB evidence | Remote status/Decision linkage; fixture-heavy views | hide-until-real |
| Agents/handoffs | trust/agents and agent execution pages | DEMO | contracts plus large explicit fixture suites | Cards do not prove live handoff/tool execution | hide-until-real |
| Settings/integrations | project/settings and connector surfaces | MIXED | provider registries/config | Provider availability and degraded status inconsistent | repair |
| Slash commands | chat/copilot | ORPHAN | conversational handlers exist | No complete mapping was found from every displayed slash affordance to domain command | hide-until-real |

The earlier session-refresh concern has a contemporary remediation in protected layout: one continuity call is reused to avoid double refresh. Context is server-enforced in operational-flow and project routes; nevertheless the visual shell has multiple context mechanisms, so an authenticated browser test remains necessary. Loading/error/empty states are present in key surfaces, but confidence and fixture labels are not consistent across the full frontend.

## PMFreak / AOC Boundary Assessment

| Capability | Owner / package / caller | Projection / remote decision / failure | Status | Duplication / next action |
|---|---|---|---|---|
| Capability verification | AOC-P contract + AOC-E runtime; server authorization | local runtime evaluation; denies on non-allow | ACTIVE_LOCAL_PACKAGE | Preserve; eliminate report-mode deep imports |
| Authority | AOC-E runtime; capability flow/server guards | in-process authority adapter; business role inputs | ACTIVE_LOCAL_PACKAGE | Operational-flow has local role matrix as business authority; explicitly compose with AOC-E |
| Delegation | AOC-E/runtime-consumer and governance APIs | issued/consumed/revoked with DB evidence | PARTIAL | Not connected to operational Decision/Action |
| Execution grants/revocation | AOC-E/runtime-consumer/governance APIs | real local lifecycle, fail-closed tests | PARTIAL | Strong primitive; connect at material Action boundary |
| Policy/obligations | AOC-E policy runtime | local decision; several specialized agent workflows | PARTIAL | No canonical obligation projection in PM commercial flow |
| Agent identity/passport | AOC-P ports/agent attestation and trust UI | local verification/fixtures; remote proof not demonstrated | PARTIAL | Do not present fixture passports as live |
| Trust domains | AOC-P ports + adapters | package-local | ACTIVE_LOCAL_PACKAGE | Remote trust coordination status unverified |
| Provenance/integrity | AOC-P ports plus PM evidence | adapter exists; operational evidence uses zero hash | DISCONNECTED | Connect verified digest/provenance to flow |
| Security/governance audit | AOC ports/adapters + platform/security events | local evidence stores and exports | PARTIAL | Correlate AOC decision/grant with PM Decision/Action IDs |
| Remote governance transport | PMFreak AOC governance client | local mock or remote config, read/advisory only | ADVISORY_ONLY | `allowDecisionWriteback` forced false; keep honest, define production contract |
| Governance intake/writeback | integration feature | normalized inbox/fixtures | DISCONNECTED | No writeback; connect explicit request/result rather than enable implicit writes |
| Learning elevation | PM learning + AOC governance intent | several ratification modules, no commercial chain | DISCONNECTED | Defer until Outcome lineage works |

**Answers.** PMFreak truly consumes the in-process AOC-E authorization runtime and AOC-P ports for capability/access evaluation; local delegation/grant/audit lifecycles are also substantive. Remote governance UI/client, passport examples and inboxes are chiefly partial/advisory/fixture-driven. Shadowing remains in operational-flow's workspace-role decision-authority matrix and legacy local governance data, but current server authorization delegates final access to AOC-E rather than silently falling back. Legacy recommendation-to-task draft and several task writes can occur without a correlated AOC governance Decision because project write authorization is not the same as an execution grant. If AOC authorization fails, canonical server guards fail closed; some read/advisory UIs degrade, while disconnected legacy paths use their own project access. There is no demonstrated correlation spanning operational Decision → AOC policy/grant → Action → task/outcome.

## Auth, Tenancy and Commercial Gate

| Severity | Finding / impact | Evidence / treatment |
|---|---|---|
| P1 FOUNDER INVITE BLOCKER | No reproducible authenticated, database-backed 17-step acceptance run; support cannot distinguish missing infrastructure from broken chain | Add isolated demo harness and runtime evidence; operational-flow test explicitly reports absent DB |
| P1 FOUNDER INVITE BLOCKER | Operational Decision stops before governed Action/Task/Outcome | Connect existing components behind separate commands |
| P1 FOUNDER INVITE BLOCKER | First source step writes direct evidence with placeholder hash, not raw/normalized provenance | Add explicit fixture/manual source capture contract and honest UI |
| P2 PILOT HARDENING | Workspace/session logic is complex and uses service role for selected resolution/evidence paths | Browser refresh/workspace-switch and cross-tenant runtime regression suite |
| P2 PILOT HARDENING | Portfolio comparability and cross-project disclosure require live tenant tests | Add coverage/confidence and restricted-drill tests |
| P2 PILOT HARDENING | AOC package consumer audit passes in report mode despite 35 listed boundary findings | Convert agreed findings to enforced migration gate |
| P3 LATER | Advanced organizational learning/elevation UI absent | Defer until outcome chain is complete |

No contemporary evidence supports a P0 release blocker such as a proven cross-tenant leak or auth bypass. Auth, invitations, server identity, membership/role checks, project access, RLS migrations, trial/founder models, metering and observability components exist. However, a source-scanned or mocked test is not live tenant proof. Service-role usage in the protected layout is registered and limited there to workspace/trial evidence, but its breadth merits the dedicated pilot regression already noted in code.

## Tests, Runtime and Delivery Evidence

Typecheck, lint, the focused 543-test selection, AOC boundary checks and production build passed. The focused suite verifies key authorization failure paths, operational-flow transactional/immutable contracts, governed-vs-legacy guards, task/dependency validation, critical-path write authorization, invitation role boundaries, AOC fail-closed behavior, and outcome/portfolio foundations. It also contains many source scans and pure unit tests; the count is not a completeness claim.

The production build compiled and typechecked. Turbopack emitted an NFT warning tracing `next.config.ts → runtime-hardening/degraded-mode.ts → /api/runtime/hardening`, indicating potentially overbroad file tracing, a P2 delivery/supportability concern rather than proof of runtime failure.

CI files contain real jobs: CI Governance runs `check:governance`, IP Compliance has jobs on push/pull request to `main`, Release Governance has a release job, and AOC package workflows have jobs/path logic. The historical “no jobs” concern is not true of current YAML. Remote execution history, branch protection and required-check mapping were not available, so reliability is `partial`; path/branch conditions can still mean a given commit did not execute a workflow.

## Founder Invite Scenario Assessment

| # | Step | State | Evidence / first required change |
|---|---|---|---|
| 1 | Register or accept invite | PARTIAL | Real auth/invite code and tests; no live browser run |
| 2 | Enter correct Workspace | PARTIAL | Resolver/layout/membership tests; no live refresh/switch proof |
| 3 | Create/select real Project | PARTIAL | Real routes/persistence contracts; live DB absent |
| 4 | Receive real signal or explicit fixture | MOCKED | Manual capture/seed is explicit; no chosen commercial connector |
| 5 | Normalize with provenance | BROKEN | Direct evidence insert, zero hash; **first rupture** |
| 6 | Detect dependency/milestone/risk exposure | PARTIAL | Deterministic risk detector and separate schedule engines |
| 7 | Produce temporal explainable finding | PARTIAL | Detector key/context exists; horizon/missing data incomplete |
| 8 | Produce canonical recommendation | PARTIAL | Evidence/confidence/authority present; alternatives/tradeoffs incomplete |
| 9 | PM accept/reject/defer | PARTIAL | Governed decision statuses and UI exist; live run absent |
| 10 | Acceptance creates separate auditable Decision | PARTIAL | RPC first-class Decision/evidence snapshot; acceptance semantics need UX confirmation |
| 11 | Request separate governed Action | ABSENT | No adapter from operational Decision |
| 12 | AOC authorize/deny or honest mode | PARTIAL | In-process authorization exists; not connected to step 11; remote writeback false |
| 13 | Idempotent Task create/update | BROKEN | H5/H6 idempotency pieces exist on parallel legacy path |
| 14 | Execution changes state | PARTIAL | Execution tasks/agent runtime exist, disconnected |
| 15 | Observe Outcome separately | ABSENT | Outcome modules exist but no commercial lineage/UI |
| 16 | PM sees result, why, next | ABSENT | No unified post-decision chain experience |
| 17 | Reconstruct complete audit chain | ABSENT | Evidence→Decision is reconstructable; no Action→Outcome correlation |

**Minimum honest path:** explicitly label manual fixture → add content-addressed Raw Input/Normalized Event references → retain transactional detector and decision → create separate Action command invoking current AOC-E runtime → adapt existing idempotent task service → record expected/observed Outcome and correlated events → render one project inbox timeline → run against isolated Supabase with two tenants and revoked-grant/degraded cases.

## Prioritized Gaps and Blockers

Counts: **P0 0 / P1 3 / P2 4 / P3 1** consolidated gaps. No `P0 RELEASE BLOCKER` was proven. The three P1 blockers are the missing normalized provenance start, missing Decision→governed Action→Task→Outcome continuation, and missing reproducible authenticated acceptance environment. The principal risks are semantic: two recommendation/decision models, a direct legacy recommendation-to-task shortcut, and UI surfaces whose breadth exceeds their connected flow. Preserve the operational-flow transaction, server authorization, task/dependency/critical-path engines, execution grant primitives and session-continuity remediation.

## Recommended Work Packages

| ID | Work package | User-visible outcome | Closed-loop gap | Reuse | Change | Dependencies | Acceptance gate | Priority |
|---|---|---|---|---|---|---|---|---|
| WP1 | Canonical Operational Spine and Vocabulary | One unambiguous project timeline | Parallel recommendation/decision/action concepts | Operational-flow RPC/inbox, H3/H4 | consolidate/connect | Product owner decision | Contract maps every state; legacy route cannot impersonate governed flow | P1 FOUNDER INVITE |
| WP2 | Provenance-First Signal Intake | PM sees source, classification and freshness | Source/raw/normalized first rupture | vault/manual capture, evidence tables | repair/connect | WP1 contracts, AOC integrity port | Fixture/real input preserves digest/event/evidence and degraded status | P1 FOUNDER INVITE |
| WP3 | Governed Decision-to-Action Bridge | PM requests an Action separately | Decision stops | operational Decision, AOC runtime/grants | connect | WP1; AOC action contract | allow/deny/revoke correlated; no Decision side effect | P1 FOUNDER INVITE |
| WP4 | Idempotent Action-to-Task Execution | Authorized Action creates one trackable task | Parallel H5/H6 | task drafts, execution tasks, adapters | connect/repair | WP3 | retry creates no duplicate; provider ambiguity visible | P1 FOUNDER INVITE |
| WP5 | Outcome Observation and Lineage | PM sees expected vs observed result | Execution has no PM Outcome | outcome/reconciliation engines, platform events | connect | WP4 | task done leaves Outcome open; evidence observation closes it | P1 FOUNDER INVITE |
| WP6 | PM Daily Execution Center | One usable attention-to-outcome journey | Fragmented UI | inbox, critical-path panel, task list | consolidate/connect | WP1–WP5 contracts | Authenticated PM completes loop with honest states | P1 FOUNDER INVITE |
| WP7 | Founder Invite Runtime Acceptance Gate | Repeatable tenant-safe demo/support proof | No live E2E proof | seed, DB verifier, auth/invite tests | repair | WP2–WP6 | scripted two-tenant happy/degraded/revoked run | P1 FOUNDER INVITE |
| WP8 | Schedule Exposure Adapter | Dependency/milestone finding drives recommendation | H7–H9 adjacent, not connected | critical-path/schedule engines | connect | WP1/WP2 | deterministic delay becomes evidence-linked finding | P2 PM/PMO PILOT |
| WP9 | PMO Quality-Aware Portfolio Attention | PMO sees comparable deterioration/conflicts | Mixed caller metrics/coverage | portfolio engines/pages | repair/connect | WP8, tenant tests | coverage/confidence and restricted drill-down proven | P2 PM/PMO PILOT |
| WP10 | Controlled Learning Candidate | PMO ratifies/rejects outcome pattern | Learning disconnected | candidate/ratification modules | connect | WP5, AOC elevation contract | single case never elevates; revoke removes retrieval | P3 EXPANSION |

**Recommended sequence:** WP1 → WP2; WP3 can begin contract-first in parallel with WP2; then WP4 → WP5; WP6 integrates incrementally but passes only after WP5; WP7 closes Founder Invite. WP8 may proceed after WP1 contracts and joins before PMO pilot; WP9 follows WP8; WP10 follows outcome evidence.

## Parallelization Map: Product, AOC and Frontend

| WP | Primary track | Cross-dependencies | Parallel? | Contract-first prerequisite | Integration / shared acceptance |
|---|---|---|---|---|---|
| WP1 | A — PMFreak Product/Core | B authority vocabulary; C state names | yes | canonical IDs/lifecycles/events | All tracks use one fixture contract |
| WP2 | A | B integrity/provenance; C source states | yes after WP1 draft | Raw/Normalized/Evidence envelope | UI label matches verified contract |
| WP3 | B — AOC Capability Consumption | A Decision/Action; C allow/deny UX | yes with WP2 | capability request/result/grant/obligation | revoked/denied shared scenario |
| WP4 | A | B grant; C task lifecycle | no, after WP3 | Action→Task idempotency contract | one task under retries |
| WP5 | A | C observation/review; B audit ref | no, after WP4 | Outcome/Observation envelope | done ≠ achieved test |
| WP6 | C — Frontend Vertical Experiences | A WP1–5; B failure states | yes incrementally | versioned real contracts; explicit fixtures expire when corresponding WP passes | full PM journey |
| WP7 | A | B and C all Founder steps | no | stable seeded scenario | two-tenant executable gate |
| WP8 | A | C exposure; optional B evidence integrity | yes after WP1 | Finding adapter contract | deterministic schedule scenario |
| WP9 | A/C | A WP8, tenant authority | no | quality/coverage aggregate contract | restricted drill-down |
| WP10 | A/B | A WP5; B elevation/revocation; C review UI | no | learning candidate/elevation contract | ratify/revoke proof |

Track C may use only explicitly labelled contract fixtures with replacement condition “the corresponding WP acceptance gate passes”; fixture data must never be presented as live. The critical shared gates are WP3 denied/revoked action, WP5 done-versus-outcome, and WP7 complete audit reconstruction.

## Decisions Required from Product Owner

1. Ratify `operational_decision_records`/governed recommendations as the commercial spine, and classify legacy `recommended_action_decisions`, `project_decisions`, task-draft conversions and agent decisions as adapters, retained contexts, or retirement candidates.
2. Choose Founder Invite's first input: explicit manual fixture, vault document, or one real connector; choose the first task provider/System of Record.
3. Define material Action classes that require AOC policy/grant versus ordinary PMFreak business writes.
4. Decide whether Founder Invite uses in-process AOC-E as the declared governed mode; remote governance v1 cannot write back because `allowDecisionWriteback` is forcibly false.
5. Decide the minimum Recommendation option/tradeoff schema and authority mapping for the first schedule/risk exposure.
6. Decide whether persisted/activated Command Center records remain configuration/read models while the experience is canonical.
7. Approve the explicit-fixture replacement rule and the evidence required before agent/governance demo pages become visible.

## Inputs for P2 Sequential Build Plan

P2 should use WP1–WP10, preserve the existing flow transaction and access guards, and avoid horizontal backend/frontend plans. Definition of Done for every prompt must name the user, source/fixture label, workspace/project authorization, canonical IDs, persistence transition, event correlation, UI state, error/degraded case, focused tests and executable acceptance command. Sequence Founder Invite around WP1–WP7; treat WP8–WP10 as separately gated pilot/expansion work.

P2 must not enable `allowDecisionWriteback` as a shortcut. It should first define the explicit Decision→Action request/result contract. It must reconcile—not silently merge—the local operational business-authority matrix with AOC-E effective authority. It should use current H6/H7/H9 engines through adapters and retire nothing until runtime consumers are proven. Each frontend prompt must consume a real contract or an explicitly expiring fixture.

## Evidence Appendix

### Primary code and symbols

- `src/app/api/operational-flow/route.ts`: `authorize`, `GET`, `POST`; authenticated project/workspace/role gate and three public operations.
- `src/lib/operational-flow/operational-flow-service.ts`: `createEvidenceItem`, `runEvidenceDecisionChain`, `recordHumanDecision`, `getOperationalSummary`; direct evidence write, detector RPC and summary.
- `supabase/migrations/20260611000000_operational_evidence_decision_loop.sql`: `materialize_operational_chain`, `record_operational_decision`, RLS/immutability and assurance contracts.
- `src/components/pmfreak/intelligence-inbox/text-capture-modal.tsx` and `project-intelligence-inbox.tsx`: commercial UI entry/read path.
- `src/lib/recommended-actions/decision-workflow.ts`: legacy status-decision audit and governed-flow guard.
- `src/lib/task-drafts/materialize-task-draft.ts`: H5 direct legacy recommendation→task-draft conversion, idempotent preservation and `converted_to_task` status.
- `src/lib/decision-governance/service.ts`: separate `project_decisions` foundation and audit export.
- `src/app/api/execution-tasks/*`, `src/app/api/execution-task-dependencies/*`: H6/H7 task lifecycle and dependency APIs.
- `src/lib/critical-path/*`, `src/app/api/critical-path/*`, `operational-shell.tsx`: H8/H9 computation, materialization and UI consumption.
- `src/app/api/agents/execution/outcomes/*`: execution-result outcome/review subsystem, not PM spine.
- `src/lib/security/server-authorization.ts`: canonical calls to `authorizeRuntimeAction`; no local allow fallback.
- `src/aoc/runtime-consumer/*`, `src/aoc/enterprise/runtime/*`, `src/aoc/protocol/*`: packaged in-process AOC consumption.
- `src/features/pmfreak-integrations/aoc-governance-request-client/*config.ts`: remote/local-mock governance; `allowDecisionWriteback` forced false.
- `src/app/(protected)/layout.tsx`: single auth-continuity resolution, onboarding/workspace gate and documented refresh-token remediation.
- `.github/workflows/ci-governance.yml`, `ip-compliance.yml`, `release-governance.yml`: current non-empty CI job definitions.

### Historical H3–H10 disposition

| Item | Disposition | Contemporary evidence |
|---|---|---|
| H3 Recommended Actions | alive, duplicated/parallel | governed flow and legacy `recommended-actions` service/API/UI |
| H4 PM Decision Workflow | alive, multiple models | operational decision RPC, legacy action-decision audit, `project_decisions` |
| H5 Action to Task | alive legacy, disconnected from governed flow | `materializeTaskDraftForRecommendedAction` |
| H6 Task Lifecycle | alive | execution-task routes/services/UI and focused tests |
| H7 Dependencies | alive | execution dependency graph/materialization/update routes/tests |
| H8 Milestones/Schedule Health | partial/alive | schedule/critical-path persistence and shell |
| H9 Critical Path | alive specialized | compute/materialize/query code and authorization tests |
| H10 Portfolio Intelligence | partial/experimental | portfolio and personal-portfolio engines/APIs/UI; mixed caller inputs |
| Platform events | alive but fragmented | `platform_events` migration and domain-specific event emitters |
| Evidence-linked decisions | alive in two foundations | operational exact snapshot and decision-governance links |
| Operational memory | alive, fragmented | operational/project/agent memory services and pages |
| Remote AOC/passport/intake/learning | partial/advisory/disconnected | packages/routes/fixtures exist; no commercial lineage runtime proof |

### Directed historical hypotheses

- Session refresh has an explicit contemporary remediation in the protected layout and source-level regression tests; live browser persistence remains unproven.
- Project/workspace context reaches the operational-flow gateway and is checked against the project plus membership. Other broad chat/copilot UI contexts were not proven equivalent, so the earlier gateway-context concern remains partial rather than closed globally.
- No complete mapping was found for every slash-command affordance; this remains an orphan-surface risk, not evidence that all slash commands are broken.
- H7's typed execution dependency graph and H9 graph engine are substantive; separate conversational/heuristic paths still exist, so a text chain must not be presented as canonical dependency intelligence.
- The current deterministic operational detector materializes a narrow risk/issue taxonomy. Conversational `riskHandler` consumes typed `RiskDraft` values, but no end-to-end proof established that every persisted project risk type reaches it; the historical Risk Agent omission is therefore unresolved, not asserted as current failure.
- Preferred/write Workspace, onboarding state, PMO creation and Command Center activation have contemporary resolvers, but their coexistence still creates a browser-regression surface; bootstrap PMO is not treated as proof of Command Center activation.
- Governance Gate and IP Compliance YAML currently contain jobs. Their remote execution/required-check state remains unknown.
- Frontend breadth materially exceeds the one connected operational path; the build route inventory proves routability, not usability or backend connectivity.

### Runtime caveats

The focused operational-flow test itself asserts that the live DB/RLS verifier fails explicitly without isolated Supabase infrastructure; this is correct honesty, not a passing runtime demonstration. The AOC consumer boundary test is report-only and passes while reporting 35 findings. The build warning is retained above. No secret values, customer data, external mutations, database writes or production endpoints were used.
