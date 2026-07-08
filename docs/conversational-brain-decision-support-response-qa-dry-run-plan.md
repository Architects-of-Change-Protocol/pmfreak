# Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan

## Executive summary

Sprint 32R answers what a **safe `decision_support` response** would look like if it were eventually
shown to a user — without ever showing anything to a real user. It reuses the Sprint 31R
clarification-gated integration plan (79 cases, `ready_for_user_visible_dry_run_plan`), derives a
response kind for every one of its 79 cases, builds a response contract and a synthetic QA-only
response draft for each, evaluates every required QA gate, and consolidates a decision. It is a
**response QA plan**, not a user-visible dry run itself — every draft it produces is
`userVisibleNow: false` and `persistedNow: false`.

Result:

- profile: `strict_response_qa_user_visible_dry_run_plan`
- mode: `plan_only`
- totalCases: `79`
- clarificationQuestionCaseCount: `69`
- advisoryCaseCount: `0`
- routePreservationCaseCount: `10`
- unsupportedBoundaryCaseCount: `0`
- shadowOnlyCaseCount: `0`
- unsafeBlockedCaseCount: `0`
- qaPassCaseCount: `79`
- qaWarningCaseCount: `0`
- qaFailCaseCount: `0`
- qaBlockedCaseCount: `0`
- safeForResponseDraftHarnessCount: `79`
- safeForUserVisibleDryRunNowCount: `0`
- safeForProductionCount: `0`
- directDecisionBlockedCount / actionExecutionBlockedCount / taskCreationBlockedCount /
  emailDraftCreationBlockedCount / persistenceBlockedCount / externalCallsBlockedCount: `79`
- every attempted count (`userVisibleOutputAttemptedCount`, `productionWiringAttemptedCount`,
  `realPersistenceAttemptedCount`, `dbWriteAttemptedCount`, `supabaseWriteAttemptedCount`,
  `externalCallAttemptedCount`): `0`
- every leak count (`rawInputLeakCount`, `fullCandidateLeakCount`, `piiLeakCount`,
  `projectNameLeakCount`): `0`
- violationCount: `0`
- criticalViolationCount: `0`
- decision: `ready_for_response_draft_harness`
- recommendedNextSprint: `Sprint 33R — Decision Support Response Draft Harness`

These are the *real* numbers computed by
`buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportResponseQaDryRunPlan()` against the Sprint 18R corpus, and they match Sprint
31R's own 69/10/0/0 route-kind breakdown exactly — response kinds map 1:1 from Sprint 31R route kinds,
so this sprint classifies the same 79 cases Sprint 31R already assessed, it does not re-assess them.

## Qué problema resuelve

Sprint 31R's own decision (`ready_for_user_visible_dry_run_plan`) named this plan directly. Sprint 32R
answers:

- ¿Cómo debería verse una respuesta segura de `decision_support` si eventualmente se mostrara al
  usuario?
- ¿Qué formato de respuesta es aceptable?
- ¿Qué formato de respuesta es riesgoso?
- ¿Qué contenido debe bloquearse?
- ¿Qué contenido debe mantenerse como clarification request?
- ¿Qué contenido debe mantenerse como advisory / non-executing guidance?
- ¿Qué contenido nunca debe ejecutar acciones, crear tareas/emails/drafts, o persistirse?
- ¿Qué contenido nunca debe mostrarse sin aclaración previa?
- ¿Qué checks debe pasar una respuesta antes de poder ser visible en dry run?
- ¿Qué QA gates deben existir antes de cualquier integración productiva?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No muestra respuestas reales al usuario.
- No conecta `decision_support` al router.
- No conecta `decision_support` al composer.
- No cambia el endpoint.
- No activa un feature flag real.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste output real.
- No implementa el response draft harness en sí — eso es el trabajo de Sprint 33R.

## Baseline Sprint 31R

Sprint 31R's clarification-gated integration plan, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_clarification_gated_integration_plan`
- totalCases: `79`
- clarificationGatedCaseCount: `69`
- existingRoutePreservedCaseCount: `10`
- unsupportedPreservedCaseCount: `0`
- shadowOnlyCaseCount: `0`
- gateReadyCaseCount: `69`
- gateMissingCaseCount: `0`
- safeForIntegrationPlanCount: `79`
- safeForUserVisibleDryRunCount: `79`
- safeForProductionCount: `0`
- directDecisionOutputBlockedCount: `79`
- every production/wiring-attempted count: `0`
- decision: `ready_for_user_visible_dry_run_plan`
- recommendedNextSprint: `Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan`

`buildDecisionSupportResponseQaDryRunPlan()` reuses this exact plan (via
`buildDecisionSupportClarificationGatedIntegrationPlan()` /
`summarizeDecisionSupportClarificationGatedIntegrationPlan()`, unchanged) against the same corpus and
exposes it as `integrationPlan`/`integrationSummary`, so this sprint's own test suite can assert the
numbers above have not moved.

## Why Response QA / User-Visible Dry Run Plan after clarification-gated integration plan

Sprint 31R proved every case in the corpus can be classified into a safe route kind, with a
clarification gate satisfied for every `clarification_gated_decision_support` case, and named this
sprint as its next step. Sprint 32R stays entirely at the QA-planning layer: it derives a response kind
from each already-classified route kind, builds a synthetic QA-only draft, and evaluates it against a
fixed set of gates — it never re-classifies a case's route kind, never re-runs the underlying replay,
and never shows anything to a real user.

## Response QA config

```ts
type DecisionSupportResponseQaDryRunPlanConfig = {
  profile: "strict_response_qa_user_visible_dry_run_plan";
  mode: DecisionSupportResponseQaDryRunPlanMode;
  allowUserVisibleDryRun: false;
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
  requireClarificationGate: true;
  requireResponseContract: true;
  requireAssumptionDisclosure: true;
  requireNonExecutionGuarantee: true;
  requireNoRawInputLeak: true;
  requireNoFullCandidateLeak: true;
  requireNoPiiLeak: true;
  requireSafeNextStep: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportResponseQaDryRunPlanConfig()` defaults to `mode: "plan_only"` and forces all
thirteen `allow*` real-side-effect fields to `false` **regardless of what a caller's overrides object
claims** — mirroring how the Sprint 31R integration plan's own config never actually loosens its nine
`allow*` real-side-effect flags from an override. The eight `require*` fields are always `true`. This is
tested explicitly for every one of the thirteen fields, individually and all-at-once.

## Allowed actions

`listDecisionSupportResponseQaDryRunAllowedNextActions()`:

- Build a response draft harness (Sprint 33R).
- Evaluate synthetic response drafts against every QA gate.
- Validate response contracts for every response kind.
- Test the clarification-first answer shape.
- Test the route preservation answer shape.
- Test the unsupported boundary answer shape.
- Test non-execution guarantees for every response kind.
- Test no-leak guarantees (raw input, full candidate, PII) for every response kind.

## Prohibited actions

`listDecisionSupportResponseQaDryRunProhibitedActions()`:

- Show `decision_support` output to a user.
- Wire the router, composer, or endpoint.
- Enable a production feature flag.
- Create a database, migration, or SQL file.
- Write to Supabase.
- Implement a real repository or real storage adapter.
- Execute actions, create tasks, create emails, create drafts, or call external services for real.
- Persist output for real.

## Response contracts

`createDecisionSupportResponseQaDryRunResponseContract(responseKind)` builds one of six contracts.
Every contract carries `allowsDirectDecision`/`allowsActionExecution`/`allowsTaskCreation`/
`allowsEmailDraftCreation`/`allowsRealPersistence`/`allowsExternalCalls`/`allowsProductionWiring: false`
— no response kind may ever do any of these things.

| responseKind | allowedInSprint32 | futureOnly | prohibitedInSprint32 | requiresClarificationGate | requiredGates |
| --- | --- | --- | --- | --- | --- |
| `clarification_question` | true | false | false | true | 11 |
| `decision_support_advisory` | false | true | true | true | 11 |
| `route_preservation_notice` | true | false | false | false | 7 |
| `unsupported_boundary_notice` | true | false | false | false | 7 |
| `shadow_only_internal` | true | false | false | false | 2 |
| `unsafe_response_blocked` | true | false | false | false | 6 |

`clarification_question` is the only response kind a `clarification_gated_decision_support` (Sprint 31R
route kind) case ever maps to, and it is the only response kind this sprint generates a draft for that
carries assumptions and a clarifying question. `decision_support_advisory` is future-only and
prohibited in Sprint 32R — a user-visible advisory answer requires a Sprint 33R response draft harness
first.

## Synthetic QA-only drafts

`createDecisionSupportResponseQaDryRunSyntheticDraft()` builds one draft per case, mapped from its
Sprint 31R route kind:

| Sprint 31R routeKind | responseKind | responseSections included |
| --- | --- | --- |
| `clarification_gated_decision_support` | `clarification_question` | clarificationQuestion, assumptions, recommendedNextStep, nonExecutionNotice |
| `existing_route_preserved` | `route_preservation_notice` | routePreservationNotice, recommendedNextStep, nonExecutionNotice |
| `unsupported_preserved` | `unsupported_boundary_notice` | unsupportedNotice, recommendedNextStep, nonExecutionNotice |
| `shadow_only` | `shadow_only_internal` | nonExecutionNotice only |

Every draft is `generatedForQaOnly: true`, `userVisibleNow: false`, `persistedNow: false`. No draft ever
contains raw input, a full candidate object, a raw project name, an email, a phone number, executable
output, a task-creation instruction, email/draft content, a persisted payload, or DB/Supabase content —
verified by both content-pattern tests and a JSON-stringify scan over every generated draft.

## Gate evaluation

`evaluateDecisionSupportResponseQaDryRunGate(draft, gateType)` evaluates one of 14 gate types as a pure
content check over the draft's own `responseSections`/`notes`:

- **Structural gates**: `must_be_clarification_first`, `must_state_assumptions`,
  `must_preserve_existing_route`, `must_preserve_unsupported`, `must_remain_shadow_only`,
  `must_be_safe_for_dry_run_only` — check the draft's response kind and required sections match.
- **Forbidden-content gates**: `must_avoid_direct_execution`, `must_not_create_tasks`,
  `must_not_create_emails`, `must_not_persist`, `must_not_call_external_services`,
  `must_not_leak_raw_input`, `must_not_leak_full_candidate`, `must_not_leak_pii` — scan for
  execution/task/email/external-call language, PII patterns, and raw-input/full-candidate markers.

Each gate result carries `status` (`pass`/`warning`/`fail`/`blocked`), a derived `riskLevel`
(`low`/`medium`/`high`/`critical`), `violations`, `evidence`, and a `recommendation`.

## Case assessment logic

`assessDecisionSupportResponseQaDryRunCase()`:

1. Derives the response kind from the case's route kind.
2. Builds the matching response contract.
3. Builds a synthetic QA-only draft.
4. Evaluates every gate the contract requires.
5. Computes `qaStatus`: `blocked` if any required gate is `blocked`, else `fail` if any gate `fail`ed,
   else `warning` if any gate `warning`ed, else `pass`.
6. `safeForResponseDraftHarness` is `true` for `pass`/`warning`, `false` for `fail`/`blocked`.
7. Every real-side-effect field (`safeForUserVisibleDryRunNow`, `safeForProduction`,
   `directDecisionBlocked`, `actionExecutionBlocked`, `taskCreationBlocked`,
   `emailDraftCreationBlocked`, `persistenceBlocked`, `externalCallsBlocked`, and every
   `*Attempted` field) is the literal expected value regardless of `qaStatus` — no case, of any
   response kind, is ever safe for a real user-visible dry run or production.

## Plan summary metrics

Against the real Sprint 18R corpus (79 cases), computed once via
`buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportResponseQaDryRunPlan()`:

```json
{
  "totalCases": 79,
  "clarificationQuestionCaseCount": 69,
  "advisoryCaseCount": 0,
  "routePreservationCaseCount": 10,
  "unsupportedBoundaryCaseCount": 0,
  "shadowOnlyCaseCount": 0,
  "unsafeBlockedCaseCount": 0,
  "qaPassCaseCount": 79,
  "qaWarningCaseCount": 0,
  "qaFailCaseCount": 0,
  "qaBlockedCaseCount": 0,
  "safeForResponseDraftHarnessCount": 79,
  "safeForUserVisibleDryRunNowCount": 0,
  "safeForProductionCount": 0,
  "directDecisionBlockedCount": 79,
  "actionExecutionBlockedCount": 79,
  "taskCreationBlockedCount": 79,
  "emailDraftCreationBlockedCount": 79,
  "persistenceBlockedCount": 79,
  "externalCallsBlockedCount": 79,
  "userVisibleOutputAttemptedCount": 0,
  "productionWiringAttemptedCount": 0,
  "realPersistenceAttemptedCount": 0,
  "dbWriteAttemptedCount": 0,
  "supabaseWriteAttemptedCount": 0,
  "externalCallAttemptedCount": 0,
  "rawInputLeakCount": 0,
  "fullCandidateLeakCount": 0,
  "piiLeakCount": 0,
  "projectNameLeakCount": 0,
  "violationCount": 0,
  "criticalViolationCount": 0,
  "decision": "ready_for_response_draft_harness",
  "recommendedNextSprint": "Sprint 33R — Decision Support Response Draft Harness"
}
```

## Decisión

```
any production/wiring-attempted count > 0        -> blocked_by_production_wiring_risk
qaBlockedCaseCount > 0 or criticalViolationCount > 0 -> blocked_by_unsafe_response_pattern
missingClarificationGateCount > 0                -> blocked_by_missing_clarification_gate
qaFailCaseCount > 0                              -> blocked_by_response_contract_gap

allClean =
  totalCases > 0 &&
  qaPassCaseCount === totalCases &&
  every blocked/leak/attempted count === 0 (as applicable) &&
  Sprint 31R integration plan decision === ready_for_user_visible_dry_run_plan

if (allClean) -> ready_for_response_draft_harness
else           -> continue_plan_only
```

Against the Sprint 18R corpus: `decision: ready_for_response_draft_harness`.

## Siguiente sprint recomendado

`Sprint 33R — Decision Support Response Draft Harness`.

## Por qué no se mostró output al usuario

Every case assessment carries `safeForUserVisibleDryRunNow: false` and every synthetic draft carries
`userVisibleNow: false`. `decision_support_advisory` (the only response kind that would carry an actual
advisory conclusion) is explicitly `prohibitedInSprint32: true` — a Sprint 33R response draft harness
must exist and be reviewed before any response could ever reach a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This plan only builds synthetic QA-only drafts offline — it never
imports or modifies the router.

## Por qué no se cambió composer

`responseComposer.ts` is production code. This plan never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This plan never imports or modifies the endpoint or
any of its handlers.

## Por qué no se creó feature flag

No production feature flag exists for `decision_support`, and none is created by this plan — flipping
one on is a production activation decision, not a QA-planning decision. `allowFeatureFlag` stays `false`
regardless of any override.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused via the Sprint 31R plan) still resolves to
`do_not_build_real_persistence_yet` when recomputed against the same corpus — tenant isolation, access
control, retention, audit, observability, rollback, security review, and DSR policy remain missing.
Nothing about QA-planning a response format changes that.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by QA-planning a
response format.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and every synthetic draft stays
`persistedNow: false` — nothing this sprint produces is ever written anywhere real.

## Por qué no se creó storage adapter real

This plan reuses the Sprint 28R fake adapter's evaluation summary (via the Sprint 31R plan) as evidence
that the underlying layer is still clean — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this plan does not build.

## Criterio para pasar a Sprint 33R

Every case must stay `qaStatus: pass`, `safeForResponseDraftHarness: true`, every leak count must stay
at zero, no production/wiring action may be attempted, and the Sprint 31R integration plan must stay
`ready_for_user_visible_dry_run_plan` — which is exactly what this sprint measured against the Sprint
18R corpus. Sprint 33R can then build a Decision Support Response Draft Harness: still without wiring
the router, without wiring the composer, without activating a production feature flag, and without
showing anything to a real user until a future user-visible dry run explicitly reviews it. The Sprint
29R prerequisites for *real persistence* specifically remain untouched and still block any real
persistence — Sprint 32R's scope is explicitly *response QA*, not persistence or user-visible
activation.


## Nota — Sprint 33R

Sprint 33R creó el Decision Support Response Draft Harness
(`docs/conversational-brain-decision-support-response-draft-harness.md`). No cambió producción. No
cambió routing. No activó feature flag. No creó DB/migrations/tables/SQL files. No creó storage adapter
real. No creó repository real. No implementó persistent clarification loop. No conectó `decision_support`
al router. No mostró output `decision_support` al usuario. No creó emails/drafts/tasks. No ejecutó
acciones. Decisión explícita: `ready_for_response_draft_quality_evaluation`. Siguiente sprint
recomendado: Sprint 34R — Decision Support Response Draft Quality Evaluation.

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

