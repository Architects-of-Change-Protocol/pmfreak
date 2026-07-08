# Sprint 39R — Decision Support Default-Off Router Guard Shell

## Executive summary

Sprint 39R builds a **Default-Off Router Guard Shell**: an offline, deterministic, no-op router guard shell
(types, definition, feature-flag-state reference, route evaluation, composer guard handoff, rollback-
reference functions) for every Sprint 38R-accepted default-off feature flag implementation shell case. It
never imports or wires the real router, never mutates a live route, never activates a feature flag, never
reads `process.env` or any runtime configuration source, never touches the real composer or endpoint, and
never shows anything to a real user. Every definition, state reference, route evaluation, handoff, and
rollback reference this shell produces is marked `shellOnly: true`, `noOpRouterGuard: true`,
`generatedForRouterGuardShellOnly: true` — this is a formal shell, not a production routing change.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportDefaultOffRouterGuardShell({ shell, now })` +
`summarizeDecisionSupportDefaultOffRouterGuardShell()`, where `shell` is the Sprint 38R
`runDecisionSupportDefaultOffFeatureFlagImplementationShell({ cases, now })` result):

- profile: `strict_default_off_router_guard_shell`
- mode: `router_guard_shell_only`
- totalCases: `79`
- routerGuardEvaluatedCount: `79`
- routerGuardAcceptedCount: `79`
- routerGuardRejectedCount: `0`
- routerGuardBlockedCount: `0`
- clarificationGateRouterGuardCount: `69`
- routePreservationRouterGuardCount: `10`
- unsupportedBoundaryRouterGuardCount: `0`
- shadowOnlyRouterGuardCount: `0`
- blockedUnsafeRouterGuardCount: `0`
- qaPassCount: `79`
- qaWarningCount / qaFailCount / qaBlockedCount: `0` / `0` / `0`
- every one of the 14 `*PassedCount` fields (`routerGuardDefinitionPassedCount` ...
  `noSideEffectsPassedCount`): `79`
- safeForDefaultOffComposerGuardShellCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- averageRouterGuardDefinitionScore: `95`
- averageRouteEvaluationScore: `93.75`
- averageComposerGuardHandoffScore: `92`
- averageRollbackReferenceScore: `92`
- minRouterGuardDefinitionScore: `95`
- minRouteEvaluationScore: `92`
- minComposerGuardHandoffScore: `92`
- minRollbackReferenceScore: `92`
- violationCount / criticalViolationCount: `0` / `0`
- every `*AllowedNowCount` field: `0`
- routerImportAttemptedCount / routerRuntimeWiringActiveNowCount / routeMutationAttemptedCount /
  decisionSupportRouteActivatedNowCount / featureFlagRuntimeReadNowCount: `0` / `0` / `0` / `0` / `0`
- decision: `ready_for_default_off_composer_guard_shell`
- recommendedNextSprint: `Sprint 40R — Default-Off Composer Guard Shell`

`averageRouteEvaluationScore` (`93.75`) is the only non-constant average, because the route evaluation score
varies by shell kind (94 for clarification-gate cases, 92 for route-preservation cases — the 69/10 split of
the real corpus averages to 93.75). Every other object kind (router guard definition, composer guard handoff,
rollback reference) uses the same template score for every gate-accepted Sprint 38R case, so those three
averages equal their own constant.

## Qué problema resuelve

Sprint 38R's own decision (`ready_for_default_off_router_guard_shell`) named this shell directly. Sprint 39R
answers:

- ¿Puede existir un shell formal de router guard (tipos, definición, referencia de estado del feature flag,
  evaluación de ruta, handoff de composer, rollback reference) sin importar ni tocar el router real?
- ¿Qué forma exacta debe tener la definición del router guard, por tipo de shell (clarification gate, route
  preservation, unsupported boundary, shadow only, blocked unsafe)?
- ¿Cómo se evalúa una decisión de ruta "no-op" que preserve la ruta actual sin mutarla nunca?
- ¿Qué intención de ruta futura debe documentarse para cada tipo de shell?
- ¿Qué debe cumplirse antes de que Sprint 40R pueda construir un composer guard shell?
- ¿Qué referencia de rollback de router debe existir, sin implementarla?
- ¿Qué riesgos (import de router, mutación de ruta, wiring de producción, visibilidad, leakage, side effects)
  bloquean cualquier avance?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No importa el router real, ni lo modifica.
- No conecta `decision_support` a ninguna ruta productiva.
- No muta ninguna ruta en vivo.
- No conecta `decision_support` al composer real.
- No cambia el endpoint.
- No activa ningún feature flag.
- No lee `process.env` ni ninguna otra fuente de configuración en tiempo de ejecución.
- No muestra ningún output al usuario.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste ningún output real.
- No reclama aprobación de gobernanza real.
- No llama a ningún LLM ni API externa.
- No implementa el composer guard shell final — eso es el trabajo de Sprint 40R, una vez este shell confirme
  que la definición del router guard, la referencia del estado del feature flag, la evaluación de ruta, el
  handoff de composer guard, y la rollback reference están todos listos.

## Baseline Sprint 38R

Sprint 38R (`docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md`)
left:

- totalCases: `79`, shellAcceptedCount: `79`, safeForDefaultOffRouterGuardShellCount: `79`
- clarificationGateFlagShellCount: `69`, routePreservationFlagShellCount: `10`
- averageFeatureFlagDefinitionScore: `95`, averageRouterGuardHandoffScore: `92`,
  averageRollbackReferenceScore: `92`
- decision: `ready_for_default_off_router_guard_shell`
- recommendedNextSprint: `Sprint 39R — Default-Off Router Guard Shell`

Sprint 39R reuses this shell result (and, transitively through it, every Sprint 18R-37R evaluation in this
package) rather than re-deriving any of it — `runDecisionSupportDefaultOffRouterGuardShell()` accepts a
pre-built Sprint 38R shell result via `options.shell`, or builds a fresh one from `options.cases`/`now`.

## Why this shell after the feature flag implementation shell

Sprint 38R proved that a formal, no-op feature flag definition, a static default-off state resolution, a
router guard readiness handoff, and a rollback reference could all exist safely, entirely offline. But a
readiness handoff documenting what a router guard shell *should* look like is not the same as that shell
actually existing. Sprint 39R is the first sprint in this tree that constructs real, exported, typed
functions shaped like a router guard (a definition, a feature-flag-state reference, a route evaluation, a
composer guard handoff, a rollback reference) — while keeping every single one of them `shellOnly`,
`noOpRouterGuard`, and `defaultOff`. This is the deliberate middle step between "the feature flag shell is
ready" (Sprint 38R) and "a composer guard can be built against a real, no-op route decision" (Sprint 40R).

## Router guard config

`createDecisionSupportDefaultOffRouterGuardShellConfig()` always returns:

- `profile: "strict_default_off_router_guard_shell"`, `mode: "router_guard_shell_only"` (or a
  caller-selected review mode), `shellOnly: true`, `noOpRouterGuard: true`, `defaultOff: true`,
  `proposedFeatureFlagKey: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter"`.
- Seventeen `allow*` fields (`allowProductionRouterGuardImplementation`, `allowRouterImport`,
  `allowRouterRuntimeWiring`, `allowRouteMutation`, `allowFeatureFlagRuntimeRead`,
  `allowFeatureFlagActivation`, `allowProductionWiring`, `allowComposerChange`, `allowEndpointChange`,
  `allowUserVisibleOutput`, `allowRealPersistence`, `allowDbWrite`, `allowSupabaseWrite`,
  `allowExternalCalls`, `allowActionExecution`, `allowTaskCreation`, `allowEmailDraftCreation`) forced to
  `false`, regardless of what a caller's override object claims.
- Thirteen `require*` fields forced to `true`.

## Allowed actions

- Implement a default-off composer guard shell.
- Implement a composer guard contract implementation.
- Write composer guard default-off tests.
- Write no-op route-to-composer handoff tests.
- Write user-visible output blocking tests.
- Write a composer rollback no-op plan.
- Conduct an endpoint guard readiness review.

## Prohibited actions

Import the real router; wire router/composer/endpoint to `decision_support`; mutate a live route; activate a
feature flag; read a runtime feature flag or `process.env`; show output to a real user; create a DB,
migration, SQL file, or write Supabase; implement a real repository or storage adapter; execute actions;
create tasks, emails, or drafts; call external services; persist real output.

## Router guard shell definition

`createDecisionSupportDefaultOffRouterGuardShellDefinition()` preserves
`pmfreak.decisionSupport.defaultOffRouteComposerAdapter` as the feature flag key Sprint 38R already resolved
as statically default-off — **never implemented as a real router guard by this sprint**. Every definition is
`shellOnly: true`, `noOpRouterGuard: true`, `productionRouterGuardImplementedNow: false`,
`routerImportAllowedNow: false`, `routerRuntimeWiringActiveNow: false`, `routeMutationAllowedNow: false`,
`featureFlagEnabledNow: false`, `featureFlagRuntimeReadNow: false`. `requiresFeatureFlagDisabled` and
`requiresCurrentRoutePreservation` are always `true`; exactly one of `requiresClarificationGatePreservation`
/ `requiresExistingRoutePreservation` / `requiresUnsupportedBoundaryPreservation` /
`requiresShadowOnlyPreservation` / `requiresUnsafeRouteBlock` is `true`, matching the Sprint 38R shell kind.
`prohibitedRouterSources` includes `real_router`, `route_registry`, `production_handler`, `endpoint_route`,
`runtime_router_context`, `process.env`, `remote_config`, `database_route_config`,
`implicit_route_mutation`, and `default_on_decision_support_route`. `requiredFutureChecks` includes
`composer_guard_shell_ready`, `endpoint_guard_shell_ready`, `router_guard_contract_reviewed`,
`route_preservation_smoke_test_ready`, `clarification_gate_smoke_test_ready`,
`unsupported_boundary_smoke_test_ready`, `rollback_route_fallback_ready`, `governance_approval_obtained`,
and `manual_smoke_test_completed`.

## Feature flag state reference

`createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference()` always resolves
`featureFlagEnabled: false`, `featureFlagState: "disabled"`, `source: "static_default_off"` by default — a
static reference to the Sprint 38R feature flag shell state, never a runtime read. Negative-test knobs
(`forceEnabled`, `forceState`, `forceSource`, `forceRuntimeReadAttempted`, `forceActivationAttempted`) never
actually set `featureFlagEnabled` to `true` — they only flip the matching `*Attempted` flag (or the
state/source), letting the validation layer register the corresponding violation without ever enabling
anything.

## No-op route evaluation

`evaluateDecisionSupportDefaultOffRouterGuardRoute()` always resolves `currentRoutePreserved: true`,
`routeMutationAllowedNow: false`, `decisionSupportRouteActivatedNow: false` by default.
`liveRouteDecision` defaults to `preserve_current_route_noop` for clarification-gate, route-preservation, and
unsupported-boundary shell kinds; `keep_shadow_only_noop` for shadow-only; and `block_unsafe_noop` for
blocked-unsafe. Forcing a route mutation attempt (`forceRouteMutationAttempted`) overrides the live route
decision to `block_route_mutation_default_off` regardless of shell kind — the one negative-test knob that
changes which no-op decision is reported. Negative-test knobs (`forceRouteMutationAttempted`,
`forceRouterImportAttempted`, `forceRouterRuntimeWiringActiveNow`, `forceDecisionSupportRouteActivatedNow`,
`forceUserVisibleNow`, `forceProductionEligibleNow`) never actually mutate a route, import the router, or
show output — they only flip the matching flag.

## Current route preservation

`currentRoutePreservationPassed` requires `routeEvaluation.currentRoutePreserved === true` and
`decisionSupportRouteActivatedNow === false`. Every route evaluation preserves the current live route by
construction — only a direct object mutation (in a test) or a forced route-mutation/activation attempt can
fail this check.

## Future route intent model

- `clarification_gate_router_guard_shell` -> `future_route_to_clarification_gate`.
- `route_preservation_router_guard_shell` -> `future_preserve_existing_route`.
- `unsupported_boundary_router_guard_shell` -> `future_preserve_unsupported_boundary`.
- `shadow_only_router_guard_shell` -> `future_keep_shadow_only`.
- `blocked_unsafe_router_guard_shell` -> `future_block_unsafe`.

Every `futureRouteIntent` is a documented intent for a future, explicitly governed sprint — not an active
route change.

## Composer guard readiness handoff

`createDecisionSupportDefaultOffComposerGuardReadinessHandoff()` never implements a composer guard or wires
it at runtime — `composerGuardImplementationAllowedNow` and `composerRuntimeWiringAllowedNow` are always
`false`. `readyForComposerGuardShell` is `true` whenever the source Sprint 38R shell case is otherwise
healthy and the route evaluation stays a no-op (current route preserved, no mutation/import/wiring/activation
attempted). Every `requires*` field is `true`: readiness requires this router guard shell case be accepted,
the flag stay statically default-off, the current route stay preserved, no composer import in Sprint 39R, a
composer guard shell in Sprint 40R, and no user-visible output, persistence, or action execution by default.

## Router rollback reference

`createDecisionSupportDefaultOffRouterGuardRollbackReference()` never implements a real rollback path —
`rollbackImplementedNow` is always `false`. A rollback must disable the feature flag and fall back to the
current route, require no data migration or persistent-state cleanup (since nothing real is ever persisted
by this shell), and require an incident owner plus a verification checklist before any future activation.

## Router guard case evaluation rules

`evaluateDecisionSupportDefaultOffRouterGuardShellCase()`:

1. Confirms the source Sprint 38R shell case was `shellAccepted` and `safeForDefaultOffRouterGuardShell`.
2. Builds the router guard shell definition, the static feature-flag-state reference, evaluates the no-op
   route decision, and builds the composer guard readiness handoff and router rollback reference.
3. Validates all five together, plus (propagated from the upstream shell case) no-approval-overclaim,
   no-visibility-attempt, no-production-eligibility, no-leaks, and no-side-effects.
4. Maps the Sprint 38R shell kind to a router guard shell kind: `clarification_gate_flag_shell` ->
   `clarification_gate_router_guard_shell`, `route_preservation_flag_shell` ->
   `route_preservation_router_guard_shell`, `unsupported_boundary_flag_shell` ->
   `unsupported_boundary_router_guard_shell`, `shadow_only_flag_shell` -> `shadow_only_router_guard_shell`,
   `blocked_unsafe_flag_shell` -> `blocked_unsafe_router_guard_shell`.
5. `qaStatus` is `blocked` if any critical (import/wiring/mutation/preservation/visibility/leak/side-effect/
   overclaim/enabled-now) violation is present, `fail` if any other violation is present (a definitional gap
   with no critical risk — e.g. a router guard definition key mismatch, or an upstream production-wiring-only
   flag), else `pass`.
6. Every `*AllowedNow` field on the result is always the literal `false`.

## Summary metrics

See the Executive summary above for the full computed metrics against the 79-case Sprint 18R corpus.

## Decision

`ready_for_default_off_composer_guard_shell` — every router guard case accepted, every definition/reference/
evaluation/handoff check passed, every score at or above its floor, zero violations, zero
`*AllowedNow`/attempted fields true, and the Sprint 38R shell decision confirmed
`ready_for_default_off_router_guard_shell`.

## Recommended next sprint

**Sprint 40R — Default-Off Composer Guard Shell.**

## Por qué no se mostró output al usuario

Every case result carries `userVisibleOutputAllowedNow: false` and `safeForUserVisibleOutputNow: false` — a
future composer guard shell activation must explicitly review and approve output before it could ever reach
a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This shell only builds a synthetic router guard definition and route
evaluation offline — it never imports or modifies the router.

## Por qué no se importó router

`routerImportAllowedNow` and `routerImportAttempted` are always `false` in a clean case, enforced by a
source-scanning test confirming this module never imports the real router, route registry, or any production
handler.

## Por qué no se cambió composer

`responseComposer.ts` is production code. This shell never imports or modifies the composer — it only
documents a composer guard readiness handoff for Sprint 40R.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This shell never imports or modifies the endpoint or its
handlers.

## Por qué no se activó feature flag

`featureFlagEnabledNow`, `featureFlagEnabled`, and `activationAttempted` are always `false` (enforced by a
source-scanning test that no `true` literal is ever assigned to a router-guard-shaped or feature-flag-shaped
field). Activation is reserved for a later, explicitly governed sprint with a rollback contract, a
composer/endpoint guard, a monitoring contract, and a manual smoke test.

## Por qué no se leyó process.env

This module never reads `process.env` or any runtime configuration source — `prohibitedRouterSources`
explicitly lists `process.env`, and `featureFlagStateReference.source` is always `static_default_off`
(enforced by a source-scanning test that only allows the literal string to appear as a documentation array
entry, never as an actual property/bracket access).

## Por qué no se implementó router guard de producción real

`productionRouterGuardImplementedNow` is always `false` — this sprint only builds the shell (types,
definition, route evaluation, handoff, rollback-reference functions), not a real production router guard
implementation. Implementing one would require the composer/endpoint guards Sprint 40R (and later) must
still build.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 38R/37R/36R/35R/34R/33R/32R/
31R chain) still resolves to `do_not_build_real_persistence_yet` — tenant isolation, access control,
retention, audit, observability, rollback, security review, and DSR policy remain missing.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by building a router guard
shell.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

This shell never writes anything real — every definition/state reference/route evaluation/handoff/reference
stays `shellOnly: true`, every `*AllowedNow` field stays `false`.

## Por qué no se creó storage adapter real

This shell reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 38R/37R/36R/35R/34R/33R/
32R/31R chain) as evidence — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this shell does not build.

## Por qué no se reclamó aprobación real

`noApprovalOverclaimPassed` propagates directly from the upstream Sprint 38R shell case's own governance
invariants (propagated in turn from the Sprint 37R gate's `governanceChecklist`:
`governanceApprovalGrantedNow: false`, `approvalStateOverclaimed: false`) — this shell never claims real
governance approval on its own.

## Criterio para pasar a Sprint 40R

Every router guard case must stay `qaStatus: pass`, `safeForDefaultOffComposerGuardShell: true`; every
violation/`*AllowedNow`/attempted count must stay at zero; every score average/minimum must stay at or above
its floor (`averageRouterGuardDefinitionScore`/`averageRouteEvaluationScore`/`averageComposerGuardHandoffScore`/
`averageRollbackReferenceScore` >= 90); and the Sprint 38R shell decision must stay
`ready_for_default_off_router_guard_shell`. If all of that holds, Sprint 40R can implement a default-off
composer guard shell — still never activated, still never wired to the real router/composer/endpoint, and
still never shown to a real user until a future, explicitly governed sprint turns it on for a real workspace.
