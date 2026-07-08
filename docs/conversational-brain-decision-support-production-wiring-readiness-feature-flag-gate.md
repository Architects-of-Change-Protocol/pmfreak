# Sprint 37R — Decision Support Production Wiring Readiness / Feature Flag Gate

## Executive summary

Sprint 37R builds a **Production Wiring Readiness / Feature Flag Gate**: an offline, deterministic,
readiness-only gate that reviews every Sprint 36R-accepted default-off adapter simulation against a future
*feature flag gate contract*, a future *production wiring readiness contract*, a future *rollback readiness
contract*, and a *governance approval checklist*. It never implements or activates a real feature flag,
never touches the real router, composer, or endpoint, and never shows anything to a real user. Every
contract and checklist this gate produces is marked `readinessOnly: true`,
`generatedForReadinessGateOnly: true` — this is a governance/contract artifact, not a wiring change.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter, now })` +
`summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate()`, where `adapter` is the Sprint 36R
`runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness, now })` result):

- profile: `strict_production_wiring_readiness_feature_flag_gate`
- mode: `readiness_gate_only`
- totalCases: `79`
- gateEvaluatedCount: `79`
- gateAcceptedCount: `79`
- gateRejectedCount: `0`
- gateBlockedCount: `0`
- clarificationGateReadinessCount: `69`
- routePreservationReadinessCount: `10`
- unsupportedBoundaryReadinessCount: `0`
- shadowOnlyReadinessCount: `0`
- blockedUnsafeReadinessCount: `0`
- qaPassCount: `79`
- qaWarningCount / qaFailCount / qaBlockedCount: `0` / `0` / `0`
- featureFlagContractPassedCount / productionWiringContractPassedCount: `79` / `79`
- rollbackContractPassedCount / governanceChecklistPreparedCount: `79` / `79`
- governanceApprovalGrantedNowCount / approvalOverclaimCount: `0` / `0`
- defaultOffAdapterPassedCount: `79`
- noVisibilityAttemptPassedCount / noProductionEligibilityPassedCount: `79` / `79`
- noLeaksPassedCount / noSideEffectsPassedCount: `79` / `79`
- safeForDefaultOffFeatureFlagImplementationShellCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- averageFeatureFlagContractScore: `95`
- averageProductionWiringContractScore: `94`
- averageRollbackContractScore: `92`
- averageGovernanceChecklistScore: `88`
- minFeatureFlagContractScore: `95`
- minProductionWiringContractScore: `94`
- minRollbackContractScore: `92`
- minGovernanceChecklistScore: `88`
- violationCount / criticalViolationCount: `0` / `0`
- every `*AllowedNow` count (`productionWiringAllowedNowCount` ... `actionExecutionAllowedNowCount`): `0`
- decision: `ready_for_default_off_feature_flag_implementation_shell`
- recommendedNextSprint: `Sprint 38R — Default-Off Feature Flag Implementation Shell`

Every score lands at a single constant per contract kind (`95`/`94`/`92`/`88`) because this gate's four
contracts do not vary by gate kind — every accepted Sprint 36R case gets the same feature flag contract,
production wiring contract, rollback contract, and governance checklist template.

## Qué problema resuelve

Sprint 36R's own decision (`ready_for_production_wiring_readiness_feature_flag_gate`) named this gate
directly. Sprint 37R answers:

- ¿El adapter default-off de Sprint 36R está listo para un futuro feature flag shell?
- ¿Qué contrato exacto debe cumplir un feature flag futuro?
- ¿Qué condiciones deben cumplirse antes de tocar router real?
- ¿Qué condiciones deben cumplirse antes de tocar composer real?
- ¿Qué condiciones deben cumplirse antes de tocar endpoint real?
- ¿Qué condiciones deben cumplirse antes de permitir output visible al usuario?
- ¿Qué rollback contract debe existir antes de cualquier integración?
- ¿Qué governance checklist debe existir antes de cualquier activación?
- ¿Qué evidencia exige PMFreak antes de cualquier production wiring?
- ¿Qué riesgos bloquean cualquier avance?
- ¿Qué debe validar Sprint 38R antes de implementar un feature flag shell default-off?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No conecta `decision_support` al router real.
- No conecta `decision_support` al composer real.
- No cambia el endpoint.
- No implementa ni activa un feature flag real.
- No lee `process.env` ni ninguna variable de entorno.
- No muestra ningún output al usuario.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste ningún output real.
- No reclama aprobación de gobernanza real.
- No llama a ningún LLM ni API externa.
- No implementa el feature flag shell final — eso es el trabajo de Sprint 38R, una vez este gate confirme
  que el contrato de feature flag, el contrato de production wiring, el contrato de rollback y el checklist
  de gobernanza están todos listos.

## Baseline Sprint 36R

Sprint 36R (`docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md`)
left:

- totalCases: `79`, adapterAcceptedCount: `79`, safeForProductionWiringReadinessReviewCount: `79`
- clarificationGateAdapterCount: `69`, routePreservationAdapterCount: `10`
- averageRouteGuardScore: `94.62`, averageComposerGuardScore: `94.62`
- decision: `ready_for_production_wiring_readiness_feature_flag_gate`
- recommendedNextSprint: `Sprint 37R — Production Wiring Readiness / Feature Flag Gate`

Sprint 37R reuses this adapter result (and, transitively through it, every Sprint 18R-35R evaluation in
this package) rather than re-deriving any of it — `runDecisionSupportProductionWiringReadinessFeatureFlagGate()`
accepts a pre-built adapter result via `options.adapter`, a pre-built harness via `options.harness`, or
builds a fresh adapter from `options.cases`/`now`.

## Why Production Wiring Readiness / Feature Flag Gate after Default-Off Route/Composer Integration Adapter

Sprint 36R proved that a route/composer wiring *could* be simulated safely, entirely offline, with zero
leaks and zero attempted side effects. But a simulation passing is not the same as a real feature flag,
real router change, real composer change, or real endpoint change being *safe to build*. Sprint 37R is the
governance layer between "the simulation is clean" and "a feature flag shell may be implemented": it
converts Sprint 36R's adapter-level guarantees into four forward-looking contracts a future sprint must
satisfy, and confirms none of those contracts are prematurely claimed as satisfied today.

## Readiness config

`createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig()` always returns:

- `profile: "strict_production_wiring_readiness_feature_flag_gate"`, `mode: "readiness_gate_only"` (or a
  caller-selected review mode), `readinessOnly: true`
- Fifteen `allow*` fields (`allowProductionWiring`, `allowRouterChange`, `allowComposerChange`,
  `allowEndpointChange`, `allowFeatureFlagImplementation`, `allowFeatureFlagActivation`,
  `allowFeatureFlagRuntimeRead`, `allowUserVisibleOutput`, `allowRealPersistence`, `allowDbWrite`,
  `allowSupabaseWrite`, `allowExternalCalls`, `allowActionExecution`, `allowTaskCreation`,
  `allowEmailDraftCreation`) forced to `false`, regardless of what a caller's override object claims.
- Ten `require*` fields forced to `true`.

## Allowed actions

- Implement a default-off feature flag implementation shell.
- Implement a no-op feature flag contract implementation.
- Write feature flag default-off tests.
- Implement a route guard implementation shell.
- Implement a composer guard implementation shell.
- Implement an endpoint guard implementation shell.
- Write a rollback smoke test plan.

## Prohibited actions

Wire router/composer/endpoint to live `decision_support`; implement or activate a production feature flag;
read a runtime feature flag; show output to a real user; create a DB, migration, SQL file, or write
Supabase; implement a real repository or storage adapter; execute actions; create tasks, emails, or drafts;
call external services; persist real output.

## Feature flag gate contract

`createDecisionSupportFeatureFlagGateContract()` proposes `pmfreak.decisionSupport.defaultOffRouteComposerAdapter`
as the future feature flag key — **never implemented or activated by this sprint**. Every contract is
`readinessOnly: true`, `featureFlagImplementedNow: false`, `featureFlagActiveNow: false`,
`featureFlagRuntimeReadNow: false`, `defaultValueMustBe: false`. Every `activationRequires*` field is
`true`: activation needs an explicit future sprint, governance approval, a rollback plan, a monitoring
plan, manual verification, a user-visible output review, and a production incident rollback owner.
`prohibitedActivationPaths` includes `implicit_activation`, `env_var_runtime_read_in_sprint_37r`,
`router_default_on`, `composer_default_on`, `endpoint_default_on`, `user_visible_output_without_approval`,
and `activation_without_rollback_contract`. `requiredFutureChecks` includes `default_off_flag_exists`,
`flag_defaults_false`, `router_guard_checks_flag`, `composer_guard_checks_flag`,
`endpoint_guard_checks_flag`, `rollback_disables_flag`, `monitoring_contract_exists`, and
`manual_smoke_test_completed`.

## Production wiring readiness contract

`createDecisionSupportProductionWiringReadinessContract()` never touches the real router, composer, or
endpoint. Every contract is `readinessOnly: true`, `productionWiringImplementedNow: false`, and every
`*ChangeAllowedNow`/`*ImportAllowedNow` field is `false`. Every `requires*` field is `true`: a future wiring
needs a default-off flag, a router/composer/endpoint guard, a no-op fallback, and preservation of every
existing route (clarification gate, route preservation, unsupported boundary) plus no user-visible
output/persistence/external calls by default.

## Rollback readiness contract

`createDecisionSupportRollbackReadinessContract()` never implements a real rollback path. Every contract is
`readinessOnly: true`, `rollbackImplementedNow: false`. A rollback must disable the feature flag and fall
back to the existing route/composer/endpoint, require no data migration/cleanup/persistent-state
dependency/external-side-effect cleanup (since nothing real is ever persisted by this gate), and require an
incident owner plus a verification checklist before any future activation.

## Governance approval checklist

`createDecisionSupportGovernanceApprovalChecklist()` never claims real governance approval. Every checklist
is `readinessOnly: true`, `governanceApprovalGrantedNow: false`, `approvalStateOverclaimed: false`,
`status: "prepared"`. Of the ten `requiredApprovalItems`, only three are ever in `completedNowItems`
(`regression_tests_green`, `feature_flag_contract_reviewed`, `rollback_contract_reviewed`) — the other seven
(`router_guard_reviewed`, `composer_guard_reviewed`, `endpoint_guard_reviewed`, `monitoring_contract_reviewed`,
`user_visible_output_reviewed`, `security_review_completed`, `manual_smoke_test_completed`) always stay in
`pendingFutureApprovalItems`, since this offline gate cannot evidence a real human governance review.

## Gate case evaluation rules

`evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase()`:

1. Confirms the source Sprint 36R adapter case was `adapterAccepted` and
   `safeForProductionWiringReadinessReview`.
2. Builds the feature flag contract, production wiring contract, rollback contract, and governance
   checklist.
3. Validates all four together, plus no-approval-overclaim, no-visibility-attempt,
   no-production-eligibility, no-leaks, and no-side-effects (reading the underlying Sprint 36R
   `composerResult`/`routeResult` fields directly, the same fields Sprint 36R itself guarantees stay safe).
4. Maps the Sprint 36R adapter kind to a gate kind: `clarification_gate_adapter` ->
   `clarification_gate_readiness`, `route_preservation_adapter` -> `route_preservation_readiness`,
   `unsupported_boundary_adapter` -> `unsupported_boundary_readiness`, `shadow_only_adapter` ->
   `shadow_only_readiness`, `blocked_unsafe_adapter` -> `blocked_unsafe_readiness`.
5. `qaStatus` is `blocked` if any critical (wiring/activation/visibility/leak/side-effect/overclaim)
   violation is present, `fail` if any other violation is present (a contract-status gap with no critical
   risk), else `pass`.
6. Every `*AllowedNow` field on the result is always the literal `false`.

## Summary metrics

See the Executive summary above for the full computed metrics against the 79-case Sprint 18R corpus.

## Decision

`ready_for_default_off_feature_flag_implementation_shell` — every gate case accepted, every contract/
checklist passed, every score at or above its floor, zero violations, zero `*AllowedNow` fields true, and
the Sprint 36R adapter decision confirmed `ready_for_production_wiring_readiness_feature_flag_gate`.

## Recommended next sprint

**Sprint 38R — Default-Off Feature Flag Implementation Shell.**

## Por qué no se mostró output al usuario

Every case result carries `userVisibleOutputAllowedNow: false` and `safeForUserVisibleOutputNow: false` — a
future feature flag activation must explicitly review and approve output before it could ever reach a real
user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This gate only reviews a synthetic production wiring contract offline
— it never imports or modifies the router (enforced by a source-scanning test).

## Por qué no se cambió composer

`responseComposer.ts` is production code. This gate never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This gate never imports or modifies the endpoint or its
handlers.

## Por qué no se creó feature flag

This gate only proposes a future feature flag key and its activation contract — implementing the flag shell
itself is reserved for Sprint 38R, and activating it is reserved for a later, explicitly governed sprint.
`featureFlagImplementedNow`, `featureFlagActiveNow`, and `featureFlagRuntimeReadNow` are always `false`
(enforced by a source-scanning test that no `true` literal is ever assigned to a feature-flag-shaped
field).

## Por qué no se leyó process.env

This module never reads an environment variable or any runtime configuration — every contract field is a
literal, config-independent value (enforced by a source-scanning test).

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 36R/35R/34R/33R/32R/31R
chain) still resolves to `do_not_build_real_persistence_yet` — tenant isolation, access control, retention,
audit, observability, rollback, security review, and DSR policy remain missing.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by reviewing readiness
contracts.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

This gate never writes anything real — every contract stays `readinessOnly: true`, every `*AllowedNow`
field stays `false`.

## Por qué no se creó storage adapter real

This gate reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 36R/35R/34R/33R/32R/31R
chain) as evidence — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this gate does not build.

## Por qué no se reclamó aprobación real

`governanceApprovalGrantedNow` is always `false` and `approvalStateOverclaimed` is always `false` — only
three checklist items (`regression_tests_green`, `feature_flag_contract_reviewed`,
`rollback_contract_reviewed`) are ever marked `completedNowItems`; every other required approval item stays
`pendingFutureApprovalItems` until a real human governance review completes it.

## Criterio para pasar a Sprint 38R

Every gate case must stay `qaStatus: pass`, `safeForDefaultOffFeatureFlagImplementationShell: true`; every
violation/`*AllowedNow` count must stay at zero; every contract score average/minimum must stay at or above
its floor (`averageFeatureFlagContractScore`/`averageProductionWiringContractScore`/
`averageRollbackContractScore` >= 90, `averageGovernanceChecklistScore` >= 85); and the Sprint 36R adapter
decision must stay `ready_for_production_wiring_readiness_feature_flag_gate`. If all of that holds, Sprint
38R can implement a default-off feature flag implementation shell — still never activated, still never
wired to the real router/composer/endpoint, and still never shown to a real user until a future, explicitly
governed sprint turns it on for a real workspace.

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
