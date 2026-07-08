# Sprint 35R — Decision Support User-Visible Dry Run Evaluation Harness

## Executive summary

Sprint 35R builds a **User-Visible Dry Run Evaluation Harness**: an offline, deterministic harness that
renders a synthetic, internal-only *preview* of how every Sprint 34R-evaluated draft would eventually look
if a future composer ever showed it to a user, validates each preview against a display contract keyed by
preview kind, and consolidates a decision on whether the corpus is ready for a Sprint 36R default-off
route/composer integration adapter. It never shows anything to a real user, never persists anything real,
never touches the router, composer, or endpoint, and never calls an LLM — preview content is generated
from fixed, deterministic templates.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportUserVisibleDryRunEvaluationHarness()`):

- profile: `strict_user_visible_dry_run_evaluation_harness`
- mode: `dry_run_harness_only`
- totalCases: `79`
- previewRenderedCount: `79`
- previewAcceptedCount: `79`
- previewRejectedCount: `0`
- previewBlockedCount: `0`
- clarificationFirstPreviewCount: `69`
- routePreservationPreviewCount: `10`
- unsupportedBoundaryPreviewCount: `0`
- shadowOnlyInternalPreviewCount: `0`
- blockedUnsafePreviewCount: `0`
- qaPassCount: `79`
- qaWarningCount / qaFailCount / qaBlockedCount: `0` / `0` / `0`
- safeForDefaultOffRouteComposerAdapterCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- averagePreviewQualityScore: `91.88`
- averageDisplayContractScore: `94.62`
- minPreviewQualityScore: `88.43`
- minDisplayContractScore: `92`
- every gate-pass count (`internalDryRunNoticePassedCount` ... `noSideEffectsPassedCount`): `79`
  (`clarificationFirstPassedCount`: `69`, `routePreservationPassedCount`: `10`,
  `unsupportedPreservationPassedCount`: `0`)
- violationCount / criticalViolationCount: `0` / `0`
- every attempted count (`userVisibleOutputAttemptedCount` ... `externalCallAttemptedCount`): `0`
- decision: `ready_for_default_off_route_composer_integration_adapter`
- recommendedNextSprint: `Sprint 36R — Default-Off Route/Composer Integration Adapter`

`averagePreviewQualityScore`/`minPreviewQualityScore` are read straight from Sprint 34R's own
`overallScore` per case, so they match Sprint 34R's `averageOverallScore` (`91.88`) and `minOverallScore`
(`88.43`) exactly — this harness does not re-score quality, only renders and validates the display shape.

## Qué problema resuelve

Sprint 34R's own decision (`ready_for_user_visible_dry_run_evaluation_harness`) named this harness
directly. Sprint 35R answers:

- ¿Podemos renderizar previews sintéticos seguros para los 79 drafts?
- ¿La estructura de preview es apta para una futura UI o composer?
- ¿Los previews mantienen `userVisibleNow: false`?
- ¿Los previews dejan claro que son dry-run internal previews?
- ¿Los previews evitan decisión final sin aclaración?
- ¿Los previews preservan clarification-first, rutas existentes, y unsupported/shadow-only cuando
  corresponde?
- ¿Los previews bloquean ejecución, tasks, emails, drafts y persistencia?
- ¿Los previews evitan raw input, full candidates, PII y projectName raw?
- ¿Los previews son suficientemente claros para diseñar un adapter default-off?
- ¿Qué formato de display contract debería usar un futuro composer?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No muestra previews reales al usuario.
- No conecta `decision_support` al router.
- No conecta `decision_support` al composer.
- No cambia el endpoint.
- No activa un feature flag real.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste output real.
- No llama a ningún LLM — el contenido del preview es generado por templates fijos y determinísticos.
- No implementa el adapter de integración default-off — eso es el trabajo de Sprint 36R.

## Baseline Sprint 34R

Sprint 34R's response draft quality evaluation, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_response_draft_quality_evaluation`
- totalCases: `79`
- passCount: `79` / warningCount, failCount, blockedCount: `0` each
- excellentCount: `69` / acceptableCount: `10`
- averageOverallScore: `91.88` / averageSafetyScore: `100` / averageClarificationScore: `93.3`
- minOverallScore: `88.43` / minSafetyScore: `100` / minClarificationScore: `92.33`
- safeForUserVisibleDryRunHarnessCount: `79`
- criticalIssueCount / leakageIssueCount / sideEffectIssueCount: `0` each
- decision: `ready_for_user_visible_dry_run_evaluation_harness`
- recommendedNextSprint: `Sprint 35R — User-Visible Dry Run Evaluation Harness`

`runDecisionSupportUserVisibleDryRunEvaluationHarness()` reuses this exact evaluation result (or builds
one from the same corpus when not supplied) via `runDecisionSupportResponseDraftQualityEvaluation()` /
`summarizeDecisionSupportResponseDraftQualityEvaluation()`, unchanged, and exposes it as
`evaluation`/`evaluationSummary`, so this sprint's own test suite can assert the numbers above have not
moved.

## Why User-Visible Dry Run Evaluation Harness after Response Draft Quality Evaluation

Sprint 34R proved every case in the corpus scores high quality along fourteen dimensions and named this
harness as its next step. Sprint 35R stays entirely at the *display shape* layer: it takes each
already-scored quality case evaluation and asks *how it would render* if a future composer ever showed it
— it never re-scores quality, never re-derives a draft, and never shows anything to a real user.

## Harness config

```ts
type DecisionSupportUserVisibleDryRunEvaluationHarnessConfig = {
  profile: "strict_user_visible_dry_run_evaluation_harness";
  mode: DecisionSupportUserVisibleDryRunEvaluationHarnessMode;
  minPreviewQualityScore: number;   // default 85
  minDisplayContractScore: number;  // default 85
  allowUserVisibleOutput: false;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowFeatureFlag: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireQualityEvaluationPass: true;
  requireInternalDryRunNotice: true;
  requireDisplayContractCompatibility: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig()` defaults to `mode:
"dry_run_harness_only"` and forces all thirteen `allow*` real-side-effect fields to `false` **regardless
of what a caller's overrides object claims** — mirroring how the Sprint 34R response draft quality
evaluation's own config never actually loosens its thirteen `allow*` real-side-effect flags from an
override. The seven `require*` fields are always `true`. This is tested explicitly for every one of the
thirteen fields, individually and all-at-once.

## Allowed actions

`listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions()`:

- Build a default-off route/composer integration adapter (Sprint 36R).
- Design a dry-run adapter contract implementation.
- Build a no-op production integration shell.
- Write route guard contract tests.
- Write composer guard contract tests.
- Run a feature flag contract review.
- Run an integration rollback contract review.

## Prohibited actions

`listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions()`:

- Show preview to real user.
- Wire router, composer, or endpoint directly to live `decision_support`.
- Enable production feature flag.
- Create DB, migration, or SQL file.
- Write Supabase.
- Implement real repository or real storage adapter.
- Execute actions, create tasks, create emails, create drafts, or call external services.
- Persist output real.

## Preview kinds

Each Sprint 33R/34R draft kind maps to exactly one preview kind:

| Draft kind (Sprint 33R/34R) | Preview kind |
| --- | --- |
| `clarification_first_draft` | `clarification_first_preview` |
| `route_preservation_draft` | `route_preservation_preview` |
| `unsupported_boundary_draft` | `unsupported_boundary_preview` |
| `shadow_only_internal_draft` | `shadow_only_internal_preview` |
| `blocked_unsafe_draft` | `blocked_unsafe_preview` (also the safe fallback for any other draft kind) |

The real Sprint 18R corpus only produces `clarification_first_draft` (69) and `route_preservation_draft`
(10) — the other three preview kinds are exercised only by this sprint's own fixtures.

## Display sections

Eleven display section kinds: `internal_dry_run_notice`, `acknowledgement`, `clarifying_question`,
`assumptions`, `safe_options`, `recommended_next_step`, `non_execution_notice`,
`route_preservation_notice`, `unsupported_boundary_notice`, `shadow_only_notice`, `blocked_notice`. Every
section carries `userVisibleNow: false`, `containsRawInput: false`, `containsFullCandidate: false`,
`containsPii: false`, `containsProjectNameRaw: false`, `containsExecutableInstruction: false`,
`containsPersistenceInstruction: false` — content is generated from fixed, non-LLM templates, never from
raw input, a full candidate object, PII, or a raw project name.

## Display contract model

`createDecisionSupportUserVisibleDryRunDisplayContract()` builds a contract keyed by preview kind:

| Preview kind | Required sections | Score |
| --- | --- | --- |
| `clarification_first_preview` | `internal_dry_run_notice`, `acknowledgement`, `clarifying_question`, `assumptions`, `recommended_next_step`, `non_execution_notice` | 95 |
| `route_preservation_preview` | `internal_dry_run_notice`, `acknowledgement`, `route_preservation_notice`, `recommended_next_step`, `non_execution_notice` | 92 |
| `unsupported_boundary_preview` | `internal_dry_run_notice`, `acknowledgement`, `unsupported_boundary_notice`, `recommended_next_step`, `non_execution_notice` | 90 |
| `shadow_only_internal_preview` | `internal_dry_run_notice`, `shadow_only_notice`, `non_execution_notice` | 88 |
| `blocked_unsafe_preview` | `internal_dry_run_notice`, `blocked_notice`, `non_execution_notice` | 85 |

Every contract also carries: `requiresInternalDryRunNotice: true`, `blocksDirectDecision: true`,
`blocksExecution: true`, `blocksPersistence: true`, `blocksExternalCalls: true`,
`blocksProductionEligibility: true`, and starts `displayContractStatus: "compatible"` — this harness never
emits an incompatible contract for a known preview kind. Each preview kind also declares a
`prohibitedSections` list — e.g. `clarification_first_preview` must never carry
`unsupported_boundary_notice`, `shadow_only_notice`, or `blocked_notice`.

## Preview rendering rules

`renderDecisionSupportUserVisibleDryRunPreview()` builds a preview from a Sprint 34R
`DecisionSupportResponseDraftQualityCaseEvaluation`:

- Every preview is `generatedForDryRunOnly: true`, `internalPreviewOnly: true`, `userVisibleNow: false`,
  `persistedNow: false`, `executableNow: false`, `externalSideEffectsAllowed: false`,
  `productionEligibleNow: false`.
- Preview content is generated from fixed, non-LLM templates keyed by preview kind.
- A `clarification_first_preview` never contains a direct decision or advisory conclusion — only an
  internal dry-run notice, an acknowledgement, a clarifying question, assumptions, a safe next step, and a
  non-execution notice.
- `previewQualityScore` is read directly from the source case evaluation's `overallScore` — this harness
  does not re-score quality.
- `displayContractScore` mirrors the contract's fixed per-kind score.

## Preview validation rules

`validateDecisionSupportUserVisibleDryRunPreview()` checks ten gates:

1. `internalDryRunNoticePassed` — the `internal_dry_run_notice` section is present and
   `internalPreviewOnly`/`generatedForDryRunOnly` are both `true`.
2. `displayContractPassed` — every required section is present, no prohibited section is present, and the
   contract is `compatible` with a score at or above `minDisplayContractScore`.
3. `clarificationFirstPassed` — only applies to `clarification_first_preview`: has a clarifying question,
   has assumptions, and carries no other preview kind's decision notice. Trivially `true` otherwise.
4. `routePreservationPassed` — only applies to `route_preservation_preview`: has a route preservation
   notice and no clarifying question. Trivially `true` otherwise.
5. `unsupportedPreservationPassed` — only applies to `unsupported_boundary_preview`: has an unsupported
   boundary notice and no clarifying question. Trivially `true` otherwise.
6. `nonExecutionNoticePassed` — every preview kind must carry a `non_execution_notice` section.
7. `noVisibilityAttemptPassed` — `userVisibleNow` is `false` on the preview and on every display section.
8. `noProductionEligibilityPassed` — `productionEligibleNow` is `false` and the contract's
   `blocksProductionEligibility` is `true`.
9. `noLeaksPassed` — no section flags raw input/full candidate/PII/raw project name, and no section body
   matches an email- or phone-like pattern.
10. `noSideEffectsPassed` — `persistedNow`/`executableNow`/`externalSideEffectsAllowed` are all `false`,
    and no section flags an executable or persistence instruction.

`qaStatus` is `blocked` if any leak/side-effect/visibility violation is present, else `fail` if any other
violation is present, else `pass`. Every `*Attempted` field on the validation result is always the literal
`false` — this harness never attempts a real side effect, so there is nothing to detect beyond the
preview's own declared fields.

## Harness run logic

`runDecisionSupportUserVisibleDryRunEvaluationHarness()`:

1. Reuses (or builds) the Sprint 34R response draft quality evaluation against the same corpus.
2. Renders exactly one preview per Sprint 34R case evaluation via `renderDecisionSupportUserVisibleDryRunPreview()`.
3. Validates every preview via `validateDecisionSupportUserVisibleDryRunPreview()`.
4. Builds one case result per case, carrying `previewRendered`/`previewAccepted`/`previewRejected`/
   `previewBlocked`/`safeForDefaultOffRouteComposerAdapter` — mirroring `pass` from validation.
   `safeForUserVisibleOutputNow` and `safeForProduction` are always `false`.
5. Consolidates the Sprint 35R allowed/prohibited actions and warns if the Sprint 34R evaluation is not
   `ready_for_user_visible_dry_run_evaluation_harness`, or if not every case is `pass`/
   `safeForUserVisibleDryRunHarness`.

Never shows output to a user, never persists output, and never touches the router/composer/endpoint.

## Summary metrics

See the Executive Summary above for the real Sprint 18R corpus numbers. `clarificationFirstPreviewCount`
(`69`) matches Sprint 33R/34R's `clarificationFirstDraftCount`/`excellentCount` exactly, and
`routePreservationPreviewCount` (`10`) matches `routePreservationDraftCount`/`acceptableCount` exactly —
this harness's preview-kind split is inherited directly from the upstream draft kind, not recomputed.

## Decisión

```
any leak/side-effect violation, or any attempted count nonzero        -> blocked_by_leakage_or_side_effect_risk
any visibility violation, or safeForUserVisibleOutputNow/safeForProduction nonzero -> blocked_by_visibility_risk
any preview rejected/blocked, any QA fail/blocked, or any contract gate failing    -> blocked_by_preview_contract_gap
averagePreviewQualityScore or averageDisplayContractScore below its floor          -> blocked_by_low_preview_quality

allClean =
  totalCases > 0 &&
  previewRenderedCount === totalCases && previewAcceptedCount === totalCases &&
  previewRejectedCount === 0 && previewBlockedCount === 0 &&
  qaPassCount === totalCases && qaWarningCount === 0 && qaFailCount === 0 && qaBlockedCount === 0 &&
  safeForDefaultOffRouteComposerAdapterCount === totalCases &&
  safeForUserVisibleOutputNowCount === 0 && safeForProductionCount === 0 &&
  averagePreviewQualityScore >= 90 && averageDisplayContractScore >= 90 &&
  every minimum score at or above its floor &&
  every gate-pass count === totalCases &&
  violationCount === 0 && criticalViolationCount === 0 &&
  every leak/side-effect/visibility/attempted count at zero &&
  Sprint 34R response draft quality evaluation decision === ready_for_user_visible_dry_run_evaluation_harness

if (allClean) -> ready_for_default_off_route_composer_integration_adapter
else           -> continue_dry_run_harness_only
```

Against the Sprint 18R corpus: `decision: ready_for_default_off_route_composer_integration_adapter`.

## Siguiente sprint recomendado

`Sprint 36R — Default-Off Route/Composer Integration Adapter`.

## Por qué no se mostró output al usuario

Every preview carries `userVisibleNow: false` and every case result carries
`safeForUserVisibleOutputNow: false` — a future default-off route/composer integration adapter must
review this harness's output before it could ever reach a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This harness only renders synthetic internal-only previews offline —
it never imports or modifies the router.

## Por qué no se cambió composer

`responseComposer.ts` is production code. This harness never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This harness never imports or modifies the endpoint
or any of its handlers.

## Por qué no se creó feature flag

No production feature flag exists for `decision_support`, and none is created by this harness — flipping
one on is a production activation decision, not a harness decision. `allowFeatureFlag` stays `false`
regardless of any override.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 34R/33R/32R plans) still
resolves to `do_not_build_real_persistence_yet` when recomputed against the same corpus — tenant
isolation, access control, retention, audit, observability, rollback, security review, and DSR policy
remain missing. Nothing about rendering synthetic previews changes that.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by rendering synthetic
previews.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and every preview stays `persistedNow:
false`, `productionEligibleNow: false` — nothing this sprint produces is ever written anywhere real.

## Por qué no se creó storage adapter real

This harness reuses the Sprint 28R fake adapter's evaluation summary (via the Sprint 34R/33R/32R/31R
plans) as evidence that the underlying layer is still clean — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this harness does not build.

## Criterio para pasar a Sprint 36R

Every preview must stay `qaStatus: pass`, `safeForDefaultOffRouteComposerAdapter: true`, every leak/side-
effect/visibility count must stay at zero, `averagePreviewQualityScore` must stay `>= 90`,
`averageDisplayContractScore` must stay `>= 90`, and the Sprint 34R response draft quality evaluation must
stay `ready_for_user_visible_dry_run_evaluation_harness` — which is exactly what this sprint measured
against the Sprint 18R corpus. Sprint 36R can then build a Default-Off Route/Composer Integration Adapter:
still without activating a production feature flag, and still without showing anything to a real user
until that future adapter is explicitly turned on for a real workspace. The Sprint 29R prerequisites for
*real persistence* specifically remain untouched and still block any real persistence — Sprint 35R's scope
is explicitly *dry-run preview rendering and validation*, not persistence or user-visible activation.

## Nota — Sprint 36R

Sprint 36R creó Default-Off Route/Composer Integration Adapter
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts`),
un adapter offline y determinístico, default-off, que conecta cada preview validado por Sprint 35R con un
route guard contract y un composer guard contract sintéticos, simulando cómo se comportaría un futuro
wiring de router/composer sin tocar nunca el router, composer o endpoint reales.

- No cambió producción.
- No cambió routing real.
- No cambió composer real.
- No cambió endpoint.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router real.
- No conectó `decision_support` al composer real.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_production_wiring_readiness_feature_flag_gate`.
- Siguiente sprint recomendado: Sprint 37R — Production Wiring Readiness / Feature Flag Gate.

Ver `docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md` para el
detalle completo.


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

