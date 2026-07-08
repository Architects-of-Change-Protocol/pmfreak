# Sprint 36R — Decision Support Default-Off Route/Composer Integration Adapter

## Executive summary

Sprint 36R builds a **Default-Off Route/Composer Integration Adapter**: an offline, deterministic adapter
that connects every Sprint 35R-validated preview to a synthetic *route guard contract* and a synthetic
*composer guard contract*, simulating how a future route/composer wiring would behave — without ever
touching the real router, composer, endpoint, feature flag, or persistence layer, and without ever showing
anything to a real user. Every contract, simulation result, and payload this adapter produces is marked
`defaultOff: true`, `adapterEnabledNow: false`, `isolatedNoOpAdapter: true` — this is a design/simulation
artifact, not a wiring change.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness, now })` +
`summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter()`, where `harness` is the Sprint 35R
`runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now })`
result):

- profile: `strict_default_off_route_composer_integration_adapter`
- mode: `default_off_adapter_only`
- totalCases: `79`
- adapterEvaluatedCount: `79`
- adapterAcceptedCount: `79`
- adapterRejectedCount: `0`
- adapterBlockedCount: `0`
- clarificationGateAdapterCount: `69`
- routePreservationAdapterCount: `10`
- unsupportedBoundaryAdapterCount: `0`
- shadowOnlyAdapterCount: `0`
- blockedUnsafeAdapterCount: `0`
- qaPassCount: `79`
- qaWarningCount / qaFailCount / qaBlockedCount: `0` / `0` / `0`
- safeForProductionWiringReadinessReviewCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- routeGuardPassedCount / composerGuardPassedCount: `79` / `79`
- defaultOffPassedCount / isolatedNoOpPassedCount: `79` / `79`
- noVisibilityAttemptPassedCount / noProductionEligibilityPassedCount: `79` / `79`
- noLeaksPassedCount / noSideEffectsPassedCount: `79` / `79`
- averageRouteGuardScore: `94.62`
- averageComposerGuardScore: `94.62`
- minRouteGuardScore: `92`
- minComposerGuardScore: `92`
- violationCount / criticalViolationCount: `0` / `0`
- every attempted count (`routerChangeAttemptedCount` ... `emailDraftCreationAttemptedCount`): `0`
- decision: `ready_for_production_wiring_readiness_feature_flag_gate`
- recommendedNextSprint: `Sprint 37R — Production Wiring Readiness / Feature Flag Gate`

`averageRouteGuardScore`/`averageComposerGuardScore` land at `94.62` because 69 of the 79 cases are
`clarification_gate_adapter` (routeGuardScore/composerGuardScore `95`) and 10 are `route_preservation_adapter`
(routeGuardScore/composerGuardScore `92`) — the weighted average of `(69×95 + 10×92) / 79 = 94.62`.

## Qué problema resuelve

Sprint 35R's own decision (`ready_for_default_off_route_composer_integration_adapter`) named this adapter
directly. Sprint 36R answers:

- ¿Cómo sería un adapter que conecte los previews dry-run con un futuro route/composer contract?
- ¿Cómo se preserva default-off de forma absoluta?
- ¿Cómo se simula route selection sin tocar router real?
- ¿Cómo se simula composer payload sin tocar composer real?
- ¿Cómo se preserva clarification-first para los 69 casos?
- ¿Cómo se preservan rutas existentes para los 10 casos?
- ¿Cómo se mantienen unsupported/shadow-only/blocked si aparecen?
- ¿Cómo se bloquea cualquier output visible al usuario?
- ¿Cómo se bloquea cualquier producción, endpoint, feature flag, DB, Supabase o persistencia real?
- ¿Qué contratos debe exigir Sprint 37R antes de cualquier wiring real?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No conecta `decision_support` al router real.
- No conecta `decision_support` al composer real.
- No cambia el endpoint.
- No activa ni implementa un feature flag real.
- No muestra ningún output al usuario.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste ningún output real.
- No llama a ningún LLM ni API externa, y no lee variables de entorno.
- No define la implementación final del route/composer gate — eso es el trabajo de Sprint 37R, una vez
  exista un contrato de feature flag y de wiring readiness.

## Baseline Sprint 35R

Sprint 35R (`docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md`) left:

- totalCases: `79`, previewAcceptedCount: `79`, safeForDefaultOffRouteComposerAdapterCount: `79`
- clarificationFirstPreviewCount: `69`, routePreservationPreviewCount: `10`
- averagePreviewQualityScore: `91.88`, averageDisplayContractScore: `94.62`
- decision: `ready_for_default_off_route_composer_integration_adapter`
- recommendedNextSprint: `Sprint 36R — Default-Off Route/Composer Integration Adapter`

Sprint 36R reuses this harness result (and, transitively through it, every Sprint 18R-34R evaluation in
this package) rather than re-deriving any of it — `runDecisionSupportDefaultOffRouteComposerIntegrationAdapter()`
accepts a pre-built harness result via `options.harness`, or builds a fresh one from `options.cases`/`now`.

## Why Default-Off Route/Composer Integration Adapter after User-Visible Dry Run Evaluation Harness

Sprint 35R proved every preview *renders* safely and *validates* against a display contract. It did not
answer what a route or composer would need to *do* with that preview — which route decision to simulate,
which composer payload shape to simulate, and what guard contract a future real wiring would need to
satisfy before Sprint 37R could even consider a feature-flag-gated rollout. Sprint 36R is the next
incremental, reversible step: it defines those contracts and simulates them against the full corpus,
entirely offline, with every field proving the simulation never became a real wiring change.

## Adapter config

`createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig()` returns:

- `profile: "strict_default_off_route_composer_integration_adapter"`
- `mode: "default_off_adapter_only"` (also: `isolated_noop_route_simulation`, `isolated_noop_composer_simulation`,
  `route_guard_contract_review`, `composer_guard_contract_review`, `production_wiring_readiness_review`)
- `defaultOff: true`, `adapterEnabledNow: false` — always, regardless of any override
- Fourteen `allow*` fields (`allowProductionWiring`, `allowRouterChange`, `allowComposerChange`,
  `allowEndpointChange`, `allowFeatureFlagImplementation`, `allowFeatureFlagActivation`,
  `allowUserVisibleOutput`, `allowRealPersistence`, `allowDbWrite`, `allowSupabaseWrite`,
  `allowExternalCalls`, `allowActionExecution`, `allowTaskCreation`, `allowEmailDraftCreation`) — all
  always `false`, regardless of any override
- Nine `require*` fields — all always `true`

Passing `{ adapterEnabledNow: true }` or any `{ allow*: true }` override is silently ignored; the returned
config still carries `false` for every one of those fifteen fields. This is covered by 15 dedicated fixture
cases and tests (`adapter-config-block-*`).

## Allowed actions

`listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions()`:

- Run a production wiring readiness review (Sprint 37R).
- Design a default-off feature flag gate contract.
- Write a route guard implementation plan.
- Write a composer guard implementation plan.
- Run an endpoint safety gate review.
- Run a rollback readiness review.
- Complete a governance approval checklist.

## Prohibited actions

`listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions()`:

Wire router/composer/endpoint to live `decision_support`; implement or activate a production feature flag;
show output to a real user; create a DB, migration, SQL file, or write Supabase; implement a real
repository or storage adapter; execute actions; create tasks, emails, or drafts; call external services;
persist real output.

## Default-off principle

Every contract, simulation result, and payload always carries `defaultOff: true` /
`adapterEnabledNow: false` (config), `routeWiringActiveNow: false` / `productionRouteChangeAllowedNow:
false` (route guard contract), `composerWiringActiveNow: false` / `productionComposerChangeAllowedNow:
false` (composer guard contract), and `defaultOff: true` / `adapterEnabledNow: false` (composer payload).
`validateDecisionSupportDefaultOffRouteComposerAdapter()`'s `defaultOffPassed` check reads every one of
these fields directly — there is no path through this module where a real wiring flag could read as `true`.

## No-op isolation principle

`isolatedNoOpAdapter: true` on both guard contracts is checked independently by
`isolatedNoOpPassed` — a contract that ever lost this invariant would fail validation even if every other
field looked safe. The module also never imports the router, composer, endpoint, or any production
handler module (enforced by a source-scanning test), so isolation is structural, not just declared.

## Route guard contract

`createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResult)` maps the Sprint 35R preview kind to
an adapter kind and a simulated route decision:

| Preview kind (Sprint 35R) | Adapter kind | Route decision | routeGuardScore |
|---|---|---|---|
| `clarification_first_preview` | `clarification_gate_adapter` | `simulate_route_to_clarification_gate` | 95 |
| `route_preservation_preview` | `route_preservation_adapter` | `simulate_preserve_existing_route` | 92 |
| `unsupported_boundary_preview` | `unsupported_boundary_adapter` | `simulate_preserve_unsupported` | 90 |
| `shadow_only_internal_preview` | `shadow_only_adapter` | `simulate_shadow_only` | 88 |
| `blocked_unsafe_preview` | `blocked_unsafe_adapter` | `simulate_block_unsafe` | 85 |

Every contract is `defaultOff: true`, `isolatedNoOpAdapter: true`, `routeWiringActiveNow: false`,
`productionRouteChangeAllowedNow: false`, `blocksDirectDecision: true`, `blocksUserVisibleOutput: true`,
`blocksProductionEligibility: true`.

## Composer guard contract

`createDecisionSupportDefaultOffComposerGuardContract(dryRunCaseResult, routeResult?)` maps the adapter
kind (from the route result, or derived directly) to a simulated composer decision:

| Adapter kind | Composer decision | composerGuardScore |
|---|---|---|
| `clarification_gate_adapter` | `simulate_composer_internal_preview_payload` | 95 |
| `route_preservation_adapter` | `simulate_composer_route_preservation_payload` | 92 |
| `unsupported_boundary_adapter` | `simulate_composer_unsupported_boundary_payload` | 90 |
| `shadow_only_adapter` | `simulate_composer_shadow_only_payload` | 88 |
| `blocked_unsafe_adapter` | `simulate_composer_blocked_payload` | 85 |

Every contract is `defaultOff: true`, `isolatedNoOpAdapter: true`, `composerWiringActiveNow: false`,
`productionComposerChangeAllowedNow: false`, `internalPayloadOnly: true`, `userVisibleNow: false`,
`persistedNow: false`, `executableNow: false`, `blocksDirectDecision: true`, `blocksExecution: true`,
`blocksPersistence: true`, `blocksExternalCalls: true`, `blocksProductionEligibility: true`.

## Route adapter simulation

`simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult)` builds the route guard contract,
confirms `routeGuardPassed`/`defaultOffPassed`/`isolatedNoOpPassed`/`safeForComposerAdapterSimulation`, and
always returns `routeWiringActiveNow: false`, `routerChangeAttempted: false`,
`productionWiringAttempted: false`, `userVisibleOutputAttempted: false` — there is no code path in this
function that could ever attempt a real route change.

## Composer adapter simulation

`simulateDecisionSupportDefaultOffComposerAdapter(dryRunCaseResult, routeResult)` builds the composer
guard contract and an internal-only payload from the Sprint 35R preview's `displaySections` — every
section is copied across with `internalOnly: true`, `userVisibleNow: false`, and every leak/side-effect
flag forced `false`. It confirms `composerGuardPassed`/`defaultOffPassed`/`isolatedNoOpPassed`/
`safeForDefaultOffAdapter`, and always returns every `*Attempted` field as `false`.

## Adapter validation rules

`validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, composerResult)` checks, independently:

- **routeGuardPassed** / **composerGuardPassed** — every contract invariant plus the score floor (≥ 85).
- **defaultOffPassed** — config, both results, and the payload all stay `defaultOff: true` /
  `adapterEnabledNow: false`.
- **isolatedNoOpPassed** — both guard contracts stay `isolatedNoOpAdapter: true`.
- **noVisibilityAttemptPassed** — no `userVisibleNow`/`userVisibleOutputAttempted` anywhere.
- **noProductionEligibilityPassed** — payload `productionEligibleNow: false` and both contracts block
  production eligibility.
- **noLeaksPassed** — no payload section carries a raw-input/full-candidate/PII/project-name flag.
- **noSideEffectsPassed** — no persistence/execution/external-call flag or attempted-count is set.

`qaStatus` is `blocked` if any leak/side-effect/wiring/visibility violation is present, `fail` if any other
violation is present (e.g. an isolated contract gap with no leak), else `pass`.

## Summary metrics

See the Executive summary above for the full computed metrics against the 79-case Sprint 18R corpus.

## Decision

`ready_for_production_wiring_readiness_feature_flag_gate` — every adapter simulation accepted, every gate
passed, every score at or above its floor, zero violations, zero attempted real side effects, and the
Sprint 35R harness decision confirmed `ready_for_default_off_route_composer_integration_adapter`.

## Recommended next sprint

**Sprint 37R — Production Wiring Readiness / Feature Flag Gate.**

## Por qué no se mostró output al usuario

Every composer payload carries `userVisibleNow: false` and every case result carries
`safeForUserVisibleOutputNow: false`. A future production wiring readiness review must explicitly review
and approve this adapter's output before it could ever reach a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This adapter only simulates a route guard contract offline — it never
imports or modifies the router (enforced by a source-scanning test).

## Por qué no se cambió composer

`responseComposer.ts` is production code. This adapter never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This adapter never imports or modifies the endpoint or
its handlers.

## Por qué no se creó feature flag

No production feature flag exists for `decision_support`, and none is created by this adapter — flipping
one on is a production activation decision reserved for Sprint 37R, not an adapter decision.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 35R/34R/33R/32R/31R plans)
still resolves to `do_not_build_real_persistence_yet` — tenant isolation, access control, retention, audit,
observability, rollback, security review, and DSR policy remain missing.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by simulating
route/composer guard contracts.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

This adapter never writes anything real — every payload stays `persistedNow: false`,
`productionEligibleNow: false`.

## Por qué no se creó storage adapter real

This adapter reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 35R/34R/33R/32R/31R
plans) as evidence — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this adapter does not build.

## Criterio para pasar a Sprint 37R

Every adapter simulation must stay `qaStatus: pass`, `safeForProductionWiringReadinessReview: true`; every
violation/attempted count must stay at zero; `averageRouteGuardScore`/`averageComposerGuardScore` must
stay ≥ 90; and the Sprint 35R user-visible dry run evaluation harness decision must stay
`ready_for_default_off_route_composer_integration_adapter`. If all of that holds, Sprint 37R can design a
production wiring readiness review and a default-off feature flag gate contract — still without activating
a production feature flag, and still without showing anything to a real user until that future gate is
explicitly turned on for a real workspace.


## Nota Sprint 37R

Sprint 37R creó el **Production Wiring Readiness / Feature Flag Gate**
(`docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md`). No cambió
producción. No cambió routing real. No cambió composer real. No cambió endpoint. No implementó feature flag
real. No activó feature flag. No leyó `process.env`. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó persistent clarification loop. No conectó
`decision_support` al router real. No conectó `decision_support` al composer real. No mostró output de
`decision_support` al usuario. No creó emails/drafts/tasks. No ejecutó acciones. No reclamó aprobación real.
Decisión explícita: `ready_for_default_off_feature_flag_implementation_shell`. Siguiente sprint
recomendado: Sprint 38R — Default-Off Feature Flag Implementation Shell.


## Sprint 38R note

- Sprint 38R (`docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md`) built a **Default-Off Feature Flag Implementation Shell** directly on top of Sprint 37R's production wiring readiness / feature flag gate.
- It builds a formal, no-op feature flag shell (types, resolver, handoff, rollback-reference functions) — never a real production feature flag, never activated, never reading `process.env` or any runtime configuration source.
- It never wires the router, composer, or endpoint to `decision_support`, never shows output to a real user, and never persists anything real.
- Running it against the real Sprint 18R corpus (79 cases) reused this module's own evaluation transitively and stayed clean: `shellAcceptedCount: 79`, `violationCount: 0`, decision `ready_for_default_off_router_guard_shell`.
- Recommended next sprint: **Sprint 39R — Default-Off Router Guard Shell**.
- This module and its findings do not change anything documented in this file — this note exists only to point forward to Sprint 38R's own doc for readers following the sprint chain.

## Sprint 39R note

- Sprint 39R (`docs/conversational-brain-decision-support-default-off-router-guard-shell.md`) built a **Default-Off Router Guard Shell** directly on top of Sprint 38R's default-off feature flag implementation shell.
- It did not change production, real routing, the real router, or a real route; it did not import the real router or mutate a real route. It did not change the real composer or the endpoint, did not activate the feature flag, and did not read `process.env`. It did not implement a real production router guard.
- It did not create a DB, migrations, tables, or SQL files, a real storage adapter, or a real repository, and it did not implement a persistent clarification loop. It did not connect `decision_support` to the real router or the real composer, and it did not show `decision_support` output to the user.
- It did not create emails, drafts, or tasks, did not execute actions, and did not claim real approval.
- Running it against the real Sprint 18R corpus (79 cases) reused this module's own evaluation transitively and stayed clean: `routerGuardAcceptedCount: 79`, `violationCount: 0`, decision `ready_for_default_off_composer_guard_shell`.
- Recommended next sprint: **Sprint 40R — Default-Off Composer Guard Shell**.
- This module and its findings do not change anything documented in this file — this note exists only to point forward to Sprint 39R's own doc for readers following the sprint chain.
