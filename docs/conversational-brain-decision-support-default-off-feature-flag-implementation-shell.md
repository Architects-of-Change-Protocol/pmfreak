# Sprint 38R — Decision Support Default-Off Feature Flag Implementation Shell

## Executive summary

Sprint 38R builds a **Default-Off Feature Flag Implementation Shell**: an offline, deterministic, no-op
feature flag shell (types, resolver, handoff, rollback-reference functions) for every Sprint 37R-accepted
production wiring readiness gate case. It never implements a real production feature flag, never activates a
feature flag, never reads `process.env` or any runtime configuration source, never touches the real router,
composer, or endpoint, and never shows anything to a real user. Every definition, state, handoff, and
reference this shell produces is marked `shellOnly: true`, `noOpShell: true`,
`generatedForFeatureFlagShellOnly: true` — this is a formal shell, not a production wiring change.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportDefaultOffFeatureFlagImplementationShell({ gate, now })` +
`summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell()`, where `gate` is the Sprint 37R
`runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter, now })` result):

- profile: `strict_default_off_feature_flag_implementation_shell`
- mode: `feature_flag_shell_only`
- totalCases: `79`
- shellEvaluatedCount: `79`
- shellAcceptedCount: `79`
- shellRejectedCount: `0`
- shellBlockedCount: `0`
- clarificationGateFlagShellCount: `69`
- routePreservationFlagShellCount: `10`
- unsupportedBoundaryFlagShellCount: `0`
- shadowOnlyFlagShellCount: `0`
- blockedUnsafeFlagShellCount: `0`
- qaPassCount: `79`
- qaWarningCount / qaFailCount / qaBlockedCount: `0` / `0` / `0`
- every one of the 13 `*PassedCount` fields (`featureFlagDefinitionPassedCount` ...
  `noSideEffectsPassedCount`): `79`
- safeForDefaultOffRouterGuardShellCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- averageFeatureFlagDefinitionScore: `95`
- averageRouterGuardHandoffScore: `92`
- averageRollbackReferenceScore: `92`
- minFeatureFlagDefinitionScore: `95`
- minRouterGuardHandoffScore: `92`
- minRollbackReferenceScore: `92`
- violationCount / criticalViolationCount: `0` / `0`
- every `*AllowedNowCount` field: `0`
- runtimeReadAttemptedCount / activationAttemptedCount / productionFeatureFlagImplementedNowCount: `0` / `0` / `0`
- decision: `ready_for_default_off_router_guard_shell`
- recommendedNextSprint: `Sprint 39R — Default-Off Router Guard Shell`

Every score lands at a single constant per object kind (`95`/`92`/`92`) because this shell's definition,
handoff, and rollback reference do not vary by shell kind — every gate-accepted Sprint 37R case gets the same
feature flag shell definition, router guard readiness handoff, and rollback reference template.

## Qué problema resuelve

Sprint 37R's own decision (`ready_for_default_off_feature_flag_implementation_shell`) named this shell
directly. Sprint 38R answers:

- ¿Puede existir un shell formal de feature flag (tipos, resolver, handoff, rollback reference) sin activar
  nada real?
- ¿Qué forma exacta debe tener la definición del feature flag?
- ¿Cómo se resuelve el estado default-off de forma estática, sin leer runtime alguno?
- ¿Qué debe cumplirse antes de que Sprint 39R pueda construir un router guard shell?
- ¿Qué contrato de rollback debe existir como referencia, sin implementarlo?
- ¿Qué riesgos (activación, runtime read, wiring, visibilidad, leakage, side effects) bloquean cualquier
  avance?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No conecta `decision_support` al router real.
- No conecta `decision_support` al composer real.
- No cambia el endpoint.
- No implementa un feature flag de producción real.
- No activa ningún feature flag.
- No lee `process.env` ni ninguna otra fuente de configuración en tiempo de ejecución.
- No muestra ningún output al usuario.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste ningún output real.
- No reclama aprobación de gobernanza real.
- No llama a ningún LLM ni API externa.
- No implementa el router guard shell final — eso es el trabajo de Sprint 39R, una vez este shell confirme
  que la definición del feature flag, la resolución default-off, el router guard handoff, y la rollback
  reference están todos listos.

## Baseline Sprint 37R

Sprint 37R
(`docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md`) left:

- totalCases: `79`, gateAcceptedCount: `79`, safeForDefaultOffFeatureFlagImplementationShellCount: `79`
- clarificationGateReadinessCount: `69`, routePreservationReadinessCount: `10`
- averageFeatureFlagContractScore: `95`, averageProductionWiringContractScore: `94`
- decision: `ready_for_default_off_feature_flag_implementation_shell`
- recommendedNextSprint: `Sprint 38R — Default-Off Feature Flag Implementation Shell`

Sprint 38R reuses this gate result (and, transitively through it, every Sprint 18R-36R evaluation in this
package) rather than re-deriving any of it —
`runDecisionSupportDefaultOffFeatureFlagImplementationShell()` accepts a pre-built gate result via
`options.gate`, a pre-built adapter via `options.adapter`, a pre-built harness via `options.harness`, or
builds a fresh gate from `options.cases`/`now`.

## Why this shell after the readiness gate

Sprint 37R proved that a future feature flag contract, production wiring contract, rollback contract, and
governance checklist could all be reviewed safely, entirely offline. But a contract passing review is not
the same as a formal shell existing that a future sprint can extend. Sprint 38R is the first sprint in this
tree that constructs real, exported, typed functions shaped like a feature flag implementation (a
definition, a state resolver, a handoff, a rollback reference) — while keeping every single one of them
`shellOnly`, `noOpShell`, and `defaultOff`. This is the deliberate middle step between "the contract is
ready" (Sprint 37R) and "a router guard can be built against a real static flag state" (Sprint 39R).

## Shell config

`createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig()` always returns:

- `profile: "strict_default_off_feature_flag_implementation_shell"`, `mode: "feature_flag_shell_only"` (or a
  caller-selected review mode), `shellOnly: true`, `noOpShell: true`, `defaultOff: true`,
  `proposedFeatureFlagKey: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter"`.
- Fifteen `allow*` fields (`allowProductionFeatureFlagImplementation`, `allowFeatureFlagActivation`,
  `allowFeatureFlagRuntimeRead`, `allowProductionWiring`, `allowRouterChange`, `allowComposerChange`,
  `allowEndpointChange`, `allowUserVisibleOutput`, `allowRealPersistence`, `allowDbWrite`,
  `allowSupabaseWrite`, `allowExternalCalls`, `allowActionExecution`, `allowTaskCreation`,
  `allowEmailDraftCreation`) forced to `false`, regardless of what a caller's override object claims.
- Twelve `require*` fields forced to `true`.

## Allowed actions

- Implement a default-off router guard shell.
- Implement a router guard contract implementation.
- Write router guard default-off tests.
- Write existing route preservation guard tests.
- Write clarification gate route guard tests.
- Write unsupported boundary route guard tests.
- Write a router rollback no-op plan.

## Prohibited actions

Activate a feature flag; read a runtime feature flag or `process.env`; wire router/composer/endpoint to
`decision_support`; show output to a real user; create a DB, migration, SQL file, or write Supabase;
implement a real repository or storage adapter; execute actions; create tasks, emails, or drafts; call
external services; persist real output.

## Feature flag shell definition

`createDecisionSupportDefaultOffFeatureFlagShellDefinition()` preserves
`pmfreak.decisionSupport.defaultOffRouteComposerAdapter` as the feature flag key Sprint 37R proposed — **never
implemented as a real production feature flag by this sprint**. Every definition is `shellOnly: true`,
`noOpShell: true`, `productionFeatureFlagImplementedNow: false`, `featureFlagActiveNow: false`,
`featureFlagRuntimeReadNow: false`, `defaultValue: false`, `resolvedState: "disabled"`,
`resolvedSource: "static_default_off"`, `activationAllowedNow: false`. Every `activationRequires*` field is
`true`: activation needs an explicit future sprint, governance approval, a rollback contract, a
router/composer/endpoint guard, a monitoring contract, and a manual smoke test.
`prohibitedRuntimeSources` includes `process.env`, `remote_config`, `database_flag`, `supabase_flag`,
`local_storage`, `query_param`, `cookie`, `header`, and `implicit_default_on`. `requiredFutureChecks`
includes `router_guard_shell_ready`, `composer_guard_shell_ready`, `endpoint_guard_shell_ready`,
`rollback_smoke_test_ready`, `monitoring_contract_ready`, `governance_approval_obtained`,
`manual_smoke_test_completed`, and `default_off_flag_runtime_read_reviewed`.

## Static default-off resolution

`resolveDecisionSupportDefaultOffFeatureFlagShellState()` always resolves `enabled: false`,
`state: "disabled"`, `source: "static_default_off"` by default. Negative-test knobs (`forceEnabled`,
`forceRuntimeReadAttempted`, `forceActivationAttempted`, `forceSource`, `forceProductionWiringAttempted`,
`forceRouterChangeAttempted`, and further `force*` flags) never actually set `enabled` to `true` — they only
flip the matching `*Attempted` flag (or the source), letting the validation layer register the corresponding
violation without ever enabling anything.

## Runtime read prohibition

`featureFlagDefinition.featureFlagRuntimeReadNow` and `featureFlagState.runtimeReadAttempted` are always
`false` in a clean case — enforced by `noRuntimeReadPassed`. `prohibitedRuntimeSources` documents every
runtime source this shell must never read from.

## Activation prohibition

`featureFlagDefinition.activationAllowedNow` and `featureFlagState.activationAttempted` are always `false` in
a clean case — enforced by `noActivationPassed`. `requiredFutureChecks` documents every check a future
activation sprint must complete before activation is even considered.

## Router guard readiness handoff

`createDecisionSupportDefaultOffRouterGuardReadinessHandoff()` never implements a router guard or wires it at
runtime — `routerGuardImplementationAllowedNow` and `routerRuntimeWiringAllowedNow` are always `false`.
`readyForRouterGuardShell` is `true` whenever the source Sprint 37R gate case is otherwise healthy and the
flag state stays statically default-off. Every `requires*` field is `true`: readiness requires a static
default-off flag state, no router import in Sprint 38R, a router guard shell in Sprint 39R, and preservation
of every existing route (clarification gate, route preservation, unsupported boundary) with no user-visible
output by default.

## Rollback reference

`createDecisionSupportDefaultOffFeatureFlagRollbackReference()` never implements a real rollback path —
`rollbackImplementedNow` is always `false`. A rollback must disable the feature flag and fall back to the
existing route/composer/endpoint, require no data migration or persistent-state cleanup (since nothing real
is ever persisted by this shell), and require an incident owner plus a verification checklist before any
future activation.

## Shell case evaluation rules

`evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase()`:

1. Confirms the source Sprint 37R gate case was `gateAccepted` and
   `safeForDefaultOffFeatureFlagImplementationShell`.
2. Builds the feature flag shell definition, resolves its static default-off state, builds the router guard
   readiness handoff and rollback reference.
3. Validates all four together, plus (propagated from the upstream gate case) no-approval-overclaim,
   no-visibility-attempt, no-production-eligibility, no-leaks, and no-side-effects.
4. Maps the Sprint 37R gate kind to a shell kind: `clarification_gate_readiness` ->
   `clarification_gate_flag_shell`, `route_preservation_readiness` -> `route_preservation_flag_shell`,
   `unsupported_boundary_readiness` -> `unsupported_boundary_flag_shell`, `shadow_only_readiness` ->
   `shadow_only_flag_shell`, `blocked_unsafe_readiness` -> `blocked_unsafe_flag_shell`.
5. `qaStatus` is `blocked` if any critical (activation/runtime-read/wiring/visibility/leak/side-effect/
   overclaim/active-now/production-flag-implemented) violation is present, `fail` if any other violation is
   present (a definitional gap with no critical risk), else `pass`.
6. Every `*AllowedNow` field on the result is always the literal `false`.

## Summary metrics

See the Executive summary above for the full computed metrics against the 79-case Sprint 18R corpus.

## Decision

`ready_for_default_off_router_guard_shell` — every shell case accepted, every definition/handoff/reference
check passed, every score at or above its floor, zero violations, zero `*AllowedNow`/attempted fields true,
and the Sprint 37R gate decision confirmed `ready_for_default_off_feature_flag_implementation_shell`.

## Recommended next sprint

**Sprint 39R — Default-Off Router Guard Shell.**

## Por qué no se mostró output al usuario

Every case result carries `userVisibleOutputAllowedNow: false` and `safeForUserVisibleOutputNow: false` — a
future router guard shell activation must explicitly review and approve output before it could ever reach a
real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This shell only builds a synthetic router guard readiness handoff
offline — it never imports or modifies the router (enforced by a source-scanning test).

## Por qué no se cambió composer

`responseComposer.ts` is production code. This shell never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This shell never imports or modifies the endpoint or its
handlers.

## Por qué no se activó feature flag

`featureFlagActiveNow`, `activationAllowedNow`, and `activationAttempted` are always `false` (enforced by a
source-scanning test that no `true` literal is ever assigned to a feature-flag-shaped field). Activation is
reserved for a later, explicitly governed sprint with a rollback contract, a router/composer/endpoint guard,
a monitoring contract, and a manual smoke test.

## Por qué no se leyó process.env

This module never reads `process.env` or any runtime configuration source — `prohibitedRuntimeSources`
explicitly lists `process.env`, and `featureFlagState.source` is always `static_default_off` (enforced by a
source-scanning test that only allows the literal string to appear as a documentation array entry, never as
an actual property/bracket access).

## Por qué no se implementó production feature flag real

`productionFeatureFlagImplementedNow` is always `false` — this sprint only builds the shell (types, resolver,
handoff, rollback-reference functions), not a real production feature flag implementation. Implementing one
would require the router/composer/endpoint guards Sprint 39R (and later) must still build.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 37R/36R/35R/34R/33R/32R/31R
chain) still resolves to `do_not_build_real_persistence_yet` — tenant isolation, access control, retention,
audit, observability, rollback, security review, and DSR policy remain missing.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by building a feature flag
shell.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

This shell never writes anything real — every definition/state/handoff/reference stays `shellOnly: true`,
every `*AllowedNow` field stays `false`.

## Por qué no se creó storage adapter real

This shell reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 37R/36R/35R/34R/33R/32R/
31R chain) as evidence — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this shell does not build.

## Por qué no se reclamó aprobación real

`noApprovalOverclaimPassed` propagates directly from the upstream Sprint 37R gate case's own
`governanceChecklist` invariants (`governanceApprovalGrantedNow: false`, `approvalStateOverclaimed: false`) —
this shell never claims real governance approval on its own.

## Criterio para pasar a Sprint 39R

Every shell case must stay `qaStatus: pass`, `safeForDefaultOffRouterGuardShell: true`; every
violation/`*AllowedNow`/attempted count must stay at zero; every score average/minimum must stay at or above
its floor (`averageFeatureFlagDefinitionScore`/`averageRouterGuardHandoffScore`/`averageRollbackReferenceScore`
>= 90); and the Sprint 37R gate decision must stay `ready_for_default_off_feature_flag_implementation_shell`.
If all of that holds, Sprint 39R can implement a default-off router guard shell — still never activated,
still never wired to the real router/composer/endpoint, and still never shown to a real user until a future,
explicitly governed sprint turns it on for a real workspace.
