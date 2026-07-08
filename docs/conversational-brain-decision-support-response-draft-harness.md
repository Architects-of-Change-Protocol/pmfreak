# Sprint 33R — Decision Support Response Draft Harness

## Executive summary

Sprint 33R builds a **Response Draft Harness**: an offline, deterministic harness that generates a
synthetic draft of a `decision_support` response for every case the Sprint 32R response QA plan already
assessed as safe for this harness, validates each draft against its own contract, and consolidates a
decision on whether the corpus is ready for a Sprint 34R response draft quality evaluation. It never
shows anything to a real user, never persists anything real, and never touches the router, composer, or
endpoint.

Result:

- profile: `strict_response_draft_harness`
- mode: `harness_only`
- totalCases: `79`
- draftGeneratedCount: `79`
- draftAcceptedCount: `79`
- draftRejectedCount: `0`
- draftBlockedCount: `0`
- clarificationFirstDraftCount: `69`
- routePreservationDraftCount: `10`
- unsupportedBoundaryDraftCount: `0`
- shadowOnlyInternalDraftCount: `0`
- blockedUnsafeDraftCount: `0`
- qaPassCount: `79`
- qaWarningCount: `0`
- qaFailCount: `0`
- qaBlockedCount: `0`
- safeForQualityEvaluationCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- contractMatchedCount: `79`
- clarificationFirstPassedCount: `69`
- routePreservationPassedCount: `10`
- unsupportedPreservationPassedCount: `0`
- nonExecutionNoticePassedCount: `79`
- safeNextStepPassedCount: `79`
- noLeaksPassedCount: `79`
- noSideEffectsPassedCount: `79`
- violationCount: `0`
- criticalViolationCount: `0`
- every attempted count (`userVisibleOutputAttemptedCount`, `productionWiringAttemptedCount`,
  `realPersistenceAttemptedCount`, `dbWriteAttemptedCount`, `supabaseWriteAttemptedCount`,
  `externalCallAttemptedCount`): `0`
- every leak/payload count (`rawInputIncludedCount`, `fullCandidateIncludedCount`, `piiIncludedCount`,
  `projectNameIncludedCount`, `taskPayloadIncludedCount`, `emailDraftPayloadIncludedCount`,
  `dbPayloadIncludedCount`, `supabasePayloadIncludedCount`, `externalCallPayloadIncludedCount`): `0`
- decision: `ready_for_response_draft_quality_evaluation`
- recommendedNextSprint: `Sprint 34R — Decision Support Response Draft Quality Evaluation`

These are the *real* numbers computed by
`runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportResponseDraftHarness()` against the Sprint 18R corpus, and they match Sprint
32R's own 69/10/0/0 response-kind breakdown exactly — draft kinds map 1:1 from Sprint 32R response
kinds, so this sprint drafts the same 79 cases Sprint 32R already assessed, it does not re-assess them.

## Qué problema resuelve

Sprint 32R's own decision (`ready_for_response_draft_harness`) named this harness directly. Sprint 33R
answers:

- ¿Podemos generar drafts sintéticos seguros para los 79 casos?
- ¿Los drafts cumplen el contrato definido en Sprint 32R?
- ¿Los drafts mantienen clarification-first cuando corresponde?
- ¿Los drafts preservan rutas existentes cuando corresponde?
- ¿Los drafts preservan unsupported/shadow-only cuando corresponde?
- ¿Los drafts bloquean decisión directa sin aclaración?
- ¿Los drafts bloquean ejecución, tasks, emails, drafts y persistencia?
- ¿Los drafts evitan raw input, full candidates, PII y projectName raw?
- ¿Los drafts son aptos para una futura evaluación user-visible dry run?
- ¿Qué casos no deberían avanzar?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No muestra drafts reales al usuario.
- No conecta `decision_support` al router.
- No conecta `decision_support` al composer.
- No cambia el endpoint.
- No activa un feature flag real.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste output real.
- No implementa una evaluación de calidad de los drafts — eso es el trabajo de Sprint 34R.

## Baseline Sprint 32R

Sprint 32R's response QA / user-visible dry run plan, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_response_qa_user_visible_dry_run_plan`
- totalCases: `79`
- clarificationQuestionCaseCount: `69`
- advisoryCaseCount: `0`
- routePreservationCaseCount: `10`
- unsupportedBoundaryCaseCount: `0`
- shadowOnlyCaseCount: `0`
- unsafeBlockedCaseCount: `0`
- qaPassCaseCount: `79`
- safeForResponseDraftHarnessCount: `79`
- safeForUserVisibleDryRunNowCount: `0`
- safeForProductionCount: `0`
- every attempted/leak count: `0`
- decision: `ready_for_response_draft_harness`
- recommendedNextSprint: `Sprint 33R — Decision Support Response Draft Harness`

`runDecisionSupportResponseDraftHarness()` reuses this exact plan (via
`buildDecisionSupportResponseQaDryRunPlan()` / `summarizeDecisionSupportResponseQaDryRunPlan()`,
unchanged) against the same corpus and exposes it as `qaPlan`/`qaSummary`, so this sprint's own test
suite can assert the numbers above have not moved.

## Why Response Draft Harness after Response QA / User-Visible Dry Run Plan

Sprint 32R proved every case in the corpus can be QA-planned into a safe response kind, with every gate
passing and every response contract respected, and named this harness as its next step. Sprint 33R stays
entirely at the draft-generation layer: it derives a draft kind from each already-assessed response kind,
builds a synthetic harness-only draft, and validates it against a fixed set of checks — it never
re-derives a case's response kind, never re-runs the underlying QA plan, and never shows anything to a
real user.

## Harness config

```ts
type DecisionSupportResponseDraftHarnessConfig = {
  profile: "strict_response_draft_harness";
  mode: DecisionSupportResponseDraftHarnessMode;
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
  requireQaPlanPass: true;
  requireContractMatch: true;
  requireClarificationFirstForDecisionSupport: true;
  requireRoutePreservationForExistingRoutes: true;
  requireUnsupportedPreservation: true;
  requireNonExecutionNotice: true;
  requireSafeNextStep: true;
  requireNoLeaks: true;
  requireNoSideEffects: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportResponseDraftHarnessConfig()` defaults to `mode: "harness_only"` and forces all
thirteen `allow*` real-side-effect fields to `false` **regardless of what a caller's overrides object
claims** — mirroring how the Sprint 32R response QA plan's own config never actually loosens its
thirteen `allow*` real-side-effect flags from an override. The nine `require*` fields are always `true`.
This is tested explicitly for every one of the thirteen fields, individually and all-at-once.

## Allowed actions

`listDecisionSupportResponseDraftHarnessAllowedNextActions()`:

- Build a response draft quality evaluation (Sprint 34R).
- Evaluate draft tone and structure evaluation for every draft kind.
- Run a clarification-first response evaluation for every `clarification_first_draft`.
- Run a non-execution safety review for every draft.
- Run a route preservation response evaluation for every `route_preservation_draft`.
- Run an unsupported boundary response evaluation for every `unsupported_boundary_draft`.
- Run a no-leak validation across every draft.

## Prohibited actions

`listDecisionSupportResponseDraftHarnessProhibitedActions()`:

- Show draft to user.
- Wire router, composer, or endpoint.
- Enable production feature flag.
- Create DB, migration, or SQL file.
- Write Supabase.
- Implement real repository or real storage adapter.
- Execute actions, create tasks, create emails, create drafts, or call external services for real.
- Persist output real.

## Draft kinds

`createDecisionSupportResponseDraftFromQaCase()` maps one of five draft kinds from a Sprint 32R response
kind:

| Sprint 32R responseKind | draftKind |
| --- | --- |
| `clarification_question` | `clarification_first_draft` |
| `route_preservation_notice` | `route_preservation_draft` |
| `unsupported_boundary_notice` | `unsupported_boundary_draft` |
| `shadow_only_internal` | `shadow_only_internal_draft` |
| `unsafe_response_blocked` / `decision_support_advisory` | `blocked_unsafe_draft` (safe fallback) |

## Draft creation rules

| draftKind | sections included |
| --- | --- |
| `clarification_first_draft` | acknowledgement, clarificationQuestion, assumptions, recommendedNextStep, nonExecutionNotice |
| `route_preservation_draft` | acknowledgement, routePreservationNotice, recommendedNextStep, nonExecutionNotice |
| `unsupported_boundary_draft` | acknowledgement, unsupportedBoundaryNotice, recommendedNextStep, nonExecutionNotice |
| `shadow_only_internal_draft` | shadowOnlyNotice, nonExecutionNotice only |
| `blocked_unsafe_draft` | blockedNotice, nonExecutionNotice only |

Every draft is `generatedForHarnessOnly: true`, `userVisibleNow: false`, `persistedNow: false`,
`executableNow: false`, `externalSideEffectsAllowed: false`. No draft ever contains raw input, a full
candidate object, a raw project name, an email, a phone number, executable output, a task-creation
instruction, email/draft content, a persisted payload, or DB/Supabase content — verified by both
content-pattern tests and a JSON-stringify scan over every generated draft's content sections.

## Draft validation rules

`validateDecisionSupportResponseDraft()` checks eight dimensions:

- **contractMatched**: the draft kind matches its source response kind, and every `blocks*` contract
  field (`blocksDirectDecision`/`blocksExecution`/`blocksPersistence`/`blocksExternalCalls`) is `true`.
- **clarificationFirstPassed**: applies only to `clarification_first_draft` — requires a
  `clarificationQuestion`, no `advisoryFrame`, and a non-empty `assumptions` array. Trivially `true` for
  every other draft kind.
- **routePreservationPassed**: applies only to `route_preservation_draft` — requires a
  `routePreservationNotice` and no `clarificationQuestion`/`advisoryFrame`. Trivially `true` otherwise.
- **unsupportedPreservationPassed**: applies only to `unsupported_boundary_draft` — requires an
  `unsupportedBoundaryNotice` and no `clarificationQuestion`/`advisoryFrame`. Trivially `true` otherwise.
- **nonExecutionNoticePassed**: requires a `nonExecutionNotice`, for every draft kind.
- **safeNextStepPassed**: requires `recommendedNextStep` for `clarification_first_draft`/
  `route_preservation_draft`/`unsupported_boundary_draft`; `shadow_only_internal_draft` and
  `blocked_unsafe_draft` can pass with their own notice + `nonExecutionNotice` instead.
- **noLeaksPassed**: `rawInputIncluded`/`fullCandidateIncluded`/`piiIncluded`/`projectNameIncluded` are
  all `false`.
- **noSideEffectsPassed**: `userVisibleNow`/`persistedNow`/`executableNow`/`externalSideEffectsAllowed`
  are all `false`, and no task/email/DB/Supabase/external-call payload is present.

`qaStatus` is `blocked` if any leak/side-effect violation is present, else `fail` if any other violation
is present, else `pass`. `riskLevel` follows directly: `critical`/`high`/`low`. Every `*Attempted` field
on the validation result is always the literal `false` — this harness never attempts a real side effect.

## Harness run logic

`runDecisionSupportResponseDraftHarness()`:

1. Builds (or accepts) the Sprint 32R response QA plan against the same corpus (default: the Sprint 31R
   integration plan's own small self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES`
   for the full Sprint 18R corpus).
2. Confirms the Sprint 32R decision is `ready_for_response_draft_harness` (recorded as a warning if not).
3. Confirms `safeForResponseDraftHarnessCount === totalCases` (recorded as a warning if not).
4. Builds one synthetic draft per Sprint 32R case assessment.
5. Validates every draft.
6. Builds one case result per case (draft + validation + derived booleans).
7. Consolidates the Sprint 33R allowed/prohibited actions.

Never shows output to a user, never persists output, and never touches the router/composer/endpoint.

## Summary metrics

Against the real Sprint 18R corpus (79 cases), computed once via
`runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportResponseDraftHarness()`:

```json
{
  "totalCases": 79,
  "draftGeneratedCount": 79,
  "draftAcceptedCount": 79,
  "draftRejectedCount": 0,
  "draftBlockedCount": 0,
  "clarificationFirstDraftCount": 69,
  "routePreservationDraftCount": 10,
  "unsupportedBoundaryDraftCount": 0,
  "shadowOnlyInternalDraftCount": 0,
  "blockedUnsafeDraftCount": 0,
  "qaPassCount": 79,
  "qaWarningCount": 0,
  "qaFailCount": 0,
  "qaBlockedCount": 0,
  "safeForQualityEvaluationCount": 79,
  "safeForUserVisibleOutputNowCount": 0,
  "safeForProductionCount": 0,
  "contractMatchedCount": 79,
  "clarificationFirstPassedCount": 69,
  "routePreservationPassedCount": 10,
  "unsupportedPreservationPassedCount": 0,
  "nonExecutionNoticePassedCount": 79,
  "safeNextStepPassedCount": 79,
  "noLeaksPassedCount": 79,
  "noSideEffectsPassedCount": 79,
  "violationCount": 0,
  "criticalViolationCount": 0,
  "userVisibleOutputAttemptedCount": 0,
  "productionWiringAttemptedCount": 0,
  "realPersistenceAttemptedCount": 0,
  "dbWriteAttemptedCount": 0,
  "supabaseWriteAttemptedCount": 0,
  "externalCallAttemptedCount": 0,
  "rawInputIncludedCount": 0,
  "fullCandidateIncludedCount": 0,
  "piiIncludedCount": 0,
  "projectNameIncludedCount": 0,
  "taskPayloadIncludedCount": 0,
  "emailDraftPayloadIncludedCount": 0,
  "dbPayloadIncludedCount": 0,
  "supabasePayloadIncludedCount": 0,
  "externalCallPayloadIncludedCount": 0,
  "decision": "ready_for_response_draft_quality_evaluation",
  "recommendedNextSprint": "Sprint 34R — Decision Support Response Draft Quality Evaluation"
}
```

## Decisión

```
any attempted count > 0                          -> blocked_by_side_effect_risk
any leak/payload count > 0                       -> blocked_by_leakage
draftBlockedCount > 0 or qaBlockedCount > 0
  or criticalViolationCount > 0                  -> blocked_by_unsafe_draft
contractMatchedCount !== totalCases or
  qaFailCount > 0 or draftRejectedCount > 0       -> blocked_by_contract_gap

allClean =
  totalCases > 0 &&
  draftGeneratedCount === totalCases && draftAcceptedCount === totalCases &&
  draftRejectedCount === 0 && draftBlockedCount === 0 &&
  qaPassCount === totalCases && qaFailCount === 0 && qaBlockedCount === 0 &&
  every safety/leak/attempted count === 0 (as applicable) &&
  Sprint 32R response QA plan decision === ready_for_response_draft_harness

if (allClean) -> ready_for_response_draft_quality_evaluation
else           -> continue_harness_only
```

Against the Sprint 18R corpus: `decision: ready_for_response_draft_quality_evaluation`.

## Siguiente sprint recomendado

`Sprint 34R — Decision Support Response Draft Quality Evaluation`.

## Por qué no se mostró output al usuario

Every draft carries `userVisibleNow: false` and every case result carries
`safeForUserVisibleOutputNow: false`. A future user-visible dry run must review this harness's output
before it could ever reach a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This harness only builds synthetic harness-only drafts offline — it
never imports or modifies the router.

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

The Sprint 29R persistence readiness review (reused via the Sprint 32R/31R plans) still resolves to
`do_not_build_real_persistence_yet` when recomputed against the same corpus — tenant isolation, access
control, retention, audit, observability, rollback, security review, and DSR policy remain missing.
Nothing about drafting synthetic responses changes that.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by drafting synthetic
responses.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and every draft stays `persistedNow: false`
— nothing this sprint produces is ever written anywhere real.

## Por qué no se creó storage adapter real

This harness reuses the Sprint 28R fake adapter's evaluation summary (via the Sprint 32R/31R plans) as
evidence that the underlying layer is still clean — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this harness does not build.

## Criterio para pasar a Sprint 34R

Every draft must stay `qaStatus: pass`, `safeForQualityEvaluation: true`, every leak/payload count must
stay at zero, no attempted count may be nonzero, and the Sprint 32R response QA plan must stay
`ready_for_response_draft_harness` — which is exactly what this sprint measured against the Sprint 18R
corpus. Sprint 34R can then run a Decision Support Response Draft Quality Evaluation: still without
wiring the router, without wiring the composer, without activating a production feature flag, and
without showing anything to a real user until a future user-visible dry run explicitly reviews it. The
Sprint 29R prerequisites for *real persistence* specifically remain untouched and still block any real
persistence — Sprint 33R's scope is explicitly *draft generation and validation*, not persistence or
user-visible activation.

## Nota — Sprint 34R

Sprint 34R creó Decision Support Response Draft Quality Evaluation
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts`),
una evaluación offline, determinística y basada en reglas de la calidad de los drafts sintéticos
generados por el Sprint 33R Response Draft Harness, a través de catorce dimensiones de calidad.

- No cambió producción.
- No cambió routing.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_user_visible_dry_run_evaluation_harness`.
- Siguiente sprint recomendado: Sprint 35R — User-Visible Dry Run Evaluation Harness.

Ver `docs/conversational-brain-decision-support-response-draft-quality-evaluation.md` para el detalle
completo.

## Nota — Sprint 35R

Sprint 35R creó User-Visible Dry Run Evaluation Harness
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts`),
un harness offline y determinístico que renderiza previews sintéticos internos de cómo se verían los
drafts de `decision_support` si eventualmente fueran presentados al usuario, valida cada preview contra un
display contract por preview kind, y recomienda el siguiente sprint.

- No cambió producción.
- No cambió routing.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_default_off_route_composer_integration_adapter`.
- Siguiente sprint recomendado: Sprint 36R — Default-Off Route/Composer Integration Adapter.

Ver `docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md` para el
detalle completo.

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


## Sprint 38R note

- Sprint 38R (`docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md`) built a **Default-Off Feature Flag Implementation Shell** directly on top of Sprint 37R's production wiring readiness / feature flag gate.
- It builds a formal, no-op feature flag shell (types, resolver, handoff, rollback-reference functions) — never a real production feature flag, never activated, never reading `process.env` or any runtime configuration source.
- It never wires the router, composer, or endpoint to `decision_support`, never shows output to a real user, and never persists anything real.
- Running it against the real Sprint 18R corpus (79 cases) reused this module's own evaluation transitively and stayed clean: `shellAcceptedCount: 79`, `violationCount: 0`, decision `ready_for_default_off_router_guard_shell`.
- Recommended next sprint: **Sprint 39R — Default-Off Router Guard Shell**.
- This module and its findings do not change anything documented in this file — this note exists only to point forward to Sprint 38R's own doc for readers following the sprint chain.
