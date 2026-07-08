# Sprint 31R — Clarification-Gated Decision Support Integration Plan

## Executive summary

Sprint 31R answers how `decision_support` would eventually be integrated **behind a clarification
gate** — without exposing any decision output to a user, without touching the router/composer/endpoint,
and without building any real persistence. It reuses the Sprint 30R controlled shadow replay evaluation
(79 cases, 3 passes, `ready_for_clarification_gated_integration_plan`) and classifies every one of its
79 cases into one of four Sprint 31R integration route kinds, builds a route contract and a set of
clarification gate requirements for each, and assesses whether each case is safe to *plan* for, safe
for a future *user-visible dry run*, and (always) unsafe/blocked for production. It is a **plan**, not
an implementation.

Result:

- profile: `strict_clarification_gated_integration_plan`
- mode: `plan_only`
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
- every production/wiring-attempted count (`productionWiringAttemptedCount`, `routerChangeAttemptedCount`,
  `composerChangeAttemptedCount`, `endpointChangeAttemptedCount`, `userVisibleDecisionSupportAttemptedCount`,
  `realPersistenceAttemptedCount`, `dbWriteAttemptedCount`, `supabaseWriteAttemptedCount`,
  `externalCallAttemptedCount`): `0`
- decision: `ready_for_user_visible_dry_run_plan`
- recommendedNextSprint: `Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan`

These are the *real* numbers computed by
`buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportClarificationGatedIntegrationPlan()` against the Sprint 18R corpus, and they
match Sprint 30R's own 69/10/0/0 route-recommendation breakdown exactly, as expected — Sprint 31R
classifies the same 79 cases Sprint 30R already replayed, it does not re-replay them.

## Qué problema resuelve

Sprint 30R proved the existing shadow pipeline is deterministic, stable, and safe across repeated
replays, and its own decision matrix named exactly one next step: design a clarification-gated
integration plan. Sprint 31R is that plan. Concretely, it answers:

- How would `decision_support` be integrated without exposing decisions directly to the user?
- Which cases must pass through the clarification gate?
- Which cases must preserve their existing production route?
- Which cases must stay unsupported (the Sprint 10R safe fallback)?
- Which conditions would block any integration?
- What contract would a future gated adapter need?
- What route guard should exist before any user-visible output?
- What handoff would exist between the classifier, the clarification strategy, and decision support?
- What must be simulated without touching router/composer/endpoint?
- What tests must pass before any real implementation?
- What should the next sprint be?

## Qué NO resuelve todavía

- No implements a real integration of `decision_support` into production.
- No changes the router, composer, or endpoint.
- No activates `decision_support` in production.
- No shows `decision_support` output to a user.
- No creates a real feature flag, database, migration, SQL file, Supabase write, real repository, or
  real storage adapter.
- No executes any real action.
- No changes anything about the Sprint 29R readiness gaps (tenant isolation, access control, retention,
  audit, observability, rollback, security review, DSR policy) — those remain exactly as documented in
  Sprint 29R.

## Baseline Sprint 30R

Sprint 30R's controlled shadow replay evaluation, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_fake_adapter_controlled_replay`
- mode: `multi_pass_replay`
- replayPasses: `3`
- totalCases: `79`
- totalPassResults: `237`
- deterministicReplayRate / safeReplayRate / fakeWriteAcceptedRate: `100`
- clarificationGatedRecommendationCount: `69`
- existingRouteRecommendationCount: `10`
- unsupportedRecommendationCount: `0`
- shadowOnlyRecommendationCount: `0`
- every real-persistence/DB/Supabase/external-call/user-visible-output/production-wiring count: `0`
- decision: `ready_for_clarification_gated_integration_plan`
- recommendedNextSprint: `Sprint 31R — Clarification-Gated Decision Support Integration Plan`

`buildDecisionSupportClarificationGatedIntegrationPlan()` recomputes this exact evaluation (via
`runDecisionSupportShadowControlledReplayEvaluation()` / `summarizeDecisionSupportShadowControlledReplayEvaluation()`,
reused unchanged) against the same corpus and exposes it as `replayEvaluation`/`replaySummary`, so this
sprint's own test suite can assert the numbers above have not moved.

## Why clarification-gated integration plan after controlled replay

Sprint 30R's own decision (`ready_for_clarification_gated_integration_plan`) names this plan directly.
Everything Sprint 30R measured — determinism, stability, per-layer cleanliness — is a prerequisite for
*planning* an integration, not for building one. Sprint 31R stays entirely at the planning layer: it
classifies already-computed replay results into route kinds, builds contracts and gate requirements for
each, and assesses safety — it never re-runs the pipeline differently or touches anything Sprint 24R-30R
did not already touch.

## Integration config

```ts
type DecisionSupportClarificationGatedIntegrationPlanConfig = {
  profile: "strict_clarification_gated_integration_plan";
  mode: DecisionSupportClarificationGatedIntegrationPlanMode;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowUserVisibleDecisionSupport: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  requireClarificationGate: true;
  requireExistingRoutePreservation: true;
  requireUnsupportedPreservation: true;
  requireShadowReplayClean: true;
  requireSafeResponseDryRunBeforeVisibility: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportClarificationGatedIntegrationPlanConfig()` defaults to `mode: "plan_only"` and
forces all nine `allow*` real-side-effect fields to `false` **regardless of what a caller's overrides
object claims** — mirroring how the Sprint 30R controlled replay's own config never actually loosens its
six `allow*` real-side-effect flags from an override. The five `require*` fields are always `true`. This
is tested explicitly for every one of the nine fields, individually and all-at-once.

## Action policies

`listDecisionSupportClarificationGatedIntegrationActionPolicies()` returns exactly 9 policies:

| actionName | allowedInSprint31 | futureOnly | prohibitedInSprint31 |
| --- | --- | --- | --- |
| classifierDetectsDecisionSupportBoundary | true | false | false |
| routeToClarificationGate | true | false | false |
| generateDecisionSupportCandidate | true | false | false |
| composeUserVisibleDecisionSupportResponse | false | true | true |
| wireRouterToDecisionSupport | false | true | true |
| wireComposerToDecisionSupport | false | true | true |
| enableProductionFeatureFlag | false | true | true |
| persistDecisionSupportShadowOutput | false | true | true |
| executeDecisionSupportAction | false | true | true |

Three actions are allowed in Sprint 31R because they are pure offline classification/routing/candidate
generation with no user-visible output. The other six are future-only and prohibited — every one of them
either shows something to a user, wires production code, or writes something real.

## Allowed actions

`listDecisionSupportClarificationGatedIntegrationAllowedNextActions()`:

- Plan a user-visible dry run for `decision_support` responses (Sprint 32R).
- Design a Decision Support Response QA plan for Sprint 32R.
- Review the clarification-gated route contract for every case category.
- Evaluate a safe response draft before any user-visible output.
- Review route preservation for `existing_route_preserved` and `unsupported_preserved` cases.
- Continue controlled shadow replay if any gate or route contract gap is found.

## Prohibited actions

`listDecisionSupportClarificationGatedIntegrationProhibitedActions()`:

- Production wiring, router change, composer change, endpoint change.
- Show user-visible decision support output to any user.
- Real persistence, a real DB write, a real Supabase write.
- A migration file, a SQL file.
- A production feature flag.
- A real repository, a real storage adapter.
- Action execution.
- Email/task/draft creation.

## Route contracts

`createDecisionSupportClarificationGatedRouteContract(routeKind)` builds one of four contracts. Every
contract carries `allowsDirectDecisionOutput: false` and `allowsProductionWiring: false` — no route kind
may ever show a decision answer directly or wire anything into production.

| routeKind | preservesExistingRoute | preservesUnsupportedBehavior | requiresClarificationGate | allowsUserVisibleDryRun | requiredGateTypes | expectedNextStage |
| --- | --- | --- | --- | --- | --- | --- |
| `clarification_gated_decision_support` | false | false | true | true | 4 | `user_visible_dry_run_plan` |
| `existing_route_preserved` | true | false | false | false | 2 | `preserve_existing_behavior` |
| `unsupported_preserved` | false | true | false | false | 2 | `preserve_unsupported_behavior` |
| `shadow_only` | false | false | false | false | 2 | `continue_shadow_only` |

## Clarification gate requirements

`createDecisionSupportClarificationGateRequirements(routeKind)`:

- `clarification_gated_decision_support` → 4 gates: `must_clarify_before_decision`,
  `must_confirm_context`, and `must_confirm_missing_slots` (all `satisfied_by_existing_clarification_strategy`,
  `blocking` — backed by the existing Sprint 22R clarification response strategy), plus
  `must_not_show_decision_output` (`required`, `critical` — no route guard exists yet).
- `existing_route_preserved` → `must_preserve_existing_route` + `must_not_show_decision_output`.
- `unsupported_preserved` → `must_keep_unsupported` + `must_not_show_decision_output`.
- `shadow_only` → `must_remain_shadow_only` + `must_not_show_decision_output`.

Every gate requirement, for every route kind, carries `blocksDirectDecisionOutput: true`.

## Case assessment logic

`assessDecisionSupportClarificationGatedIntegrationCase()` classifies a Sprint 30R replay aggregate's
`routeRecommendation` into one of the four route kinds
(`classifyDecisionSupportClarificationGatedRouteKind()`: `clarification_gated_decision_support` ->
`clarification_gated_decision_support`; `keep_existing_route` -> `existing_route_preserved`;
`keep_unsupported` -> `unsupported_preserved`; anything else, including `shadow_only`/`needs_more_replay`,
-> `shadow_only`, the safe fallback), builds its route contract and gate requirements, and decides:

- **`clarification_gated_decision_support`**: `gateReady` true only if all 4 required gate types are
  present and none is `missing`/`blocked`; `safeForIntegrationPlan`/`safeForUserVisibleDryRun` true.
- **`existing_route_preserved`**: `gateReady` false (no clarification gate applies);
  `safeForIntegrationPlan`/`safeForUserVisibleDryRun` true; `shouldPreserveExistingRoute` true.
- **`unsupported_preserved`**: `gateReady` false; `safeForIntegrationPlan` true, `safeForUserVisibleDryRun`
  false (`decision_support` is never a candidate for this case — nothing to show);
  `shouldPreserveUnsupported` true.
- **`shadow_only`**: `gateReady` false; `safeForIntegrationPlan` true (as *shadow-only-safe*, i.e. safe
  to plan for, not to expose), `safeForUserVisibleDryRun` false; `shouldRemainShadowOnly` true.

Every assessment carries `safeForProduction: false` and `directDecisionOutputBlocked: true` as literal
types — no case, of any route kind, is ever safe for production or exempt from the direct-output block.

## Plan summary metrics

Against the real Sprint 18R corpus (79 cases), computed once via
`buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportClarificationGatedIntegrationPlan()`:

```json
{
  "totalCases": 79,
  "clarificationGatedCaseCount": 69,
  "existingRoutePreservedCaseCount": 10,
  "unsupportedPreservedCaseCount": 0,
  "shadowOnlyCaseCount": 0,
  "gateReadyCaseCount": 69,
  "gateMissingCaseCount": 0,
  "safeForIntegrationPlanCount": 79,
  "safeForUserVisibleDryRunCount": 79,
  "safeForProductionCount": 0,
  "directDecisionOutputBlockedCount": 79,
  "productionWiringAttemptedCount": 0,
  "routerChangeAttemptedCount": 0,
  "composerChangeAttemptedCount": 0,
  "endpointChangeAttemptedCount": 0,
  "userVisibleDecisionSupportAttemptedCount": 0,
  "realPersistenceAttemptedCount": 0,
  "dbWriteAttemptedCount": 0,
  "supabaseWriteAttemptedCount": 0,
  "externalCallAttemptedCount": 0,
  "decision": "ready_for_user_visible_dry_run_plan",
  "recommendedNextSprint": "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan"
}
```

`gateReadyCaseCount` equals `clarificationGatedCaseCount` (69) because `gateReady` is only meaningfully
`true` for `clarification_gated_decision_support` cases — the other three route kinds do not pass through
a clarification gate at all, so `gateReady` is `false` for them by construction, not because anything is
missing. `safeForUserVisibleDryRunCount` (79) equals `clarificationGatedCaseCount + existingRoutePreservedCaseCount`
(69 + 10) because those are the only two route kinds where a future dry run has anything to review.

## Decisión

```
gateMissingCaseCount > 0                    -> blocked_by_missing_clarification_gate
routeContractGapCount > 0                   -> blocked_by_route_contract_gap
any production/wiring-attempted count > 0   -> blocked_by_production_wiring_risk
safeForProductionCount > 0, or Sprint 30R
  decision === blocked_by_safety_regression -> blocked_by_safety_regression

allClean =
  totalCases > 0 &&
  safeForIntegrationPlanCount === totalCases &&
  directDecisionOutputBlockedCount === totalCases &&
  safeForProductionCount === 0 &&
  Sprint 30R replay decision === ready_for_clarification_gated_integration_plan

if (allClean) -> ready_for_user_visible_dry_run_plan
else           -> continue_shadow_only
```

Against the Sprint 18R corpus: `decision: ready_for_user_visible_dry_run_plan`.

## Siguiente sprint recomendado

`Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan`.

## Por qué no se cambió router

`brainRouter.ts` is production code. This plan only simulates a future clarification-gated route
offline — it never imports or modifies the router, and `wireRouterToDecisionSupport` is explicitly
`allowedInSprint31: false`, `prohibitedInSprint31: true`.

## Por qué no se cambió composer

`responseComposer.ts` is production code. This plan never imports or modifies the composer — every
response text stays confined to the Sprint 19R candidate handler and the Sprint 22R clarification
strategy, both already isolated from production.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This plan never imports or modifies the endpoint or
any of its handlers.

## Por qué no se mostró output al usuario

Every case assessment carries `directDecisionOutputBlocked: true` and every route contract carries
`allowsDirectDecisionOutput: false`. `composeUserVisibleDecisionSupportResponse` is explicitly
`prohibitedInSprint31: true` — a Sprint 32R user-visible dry run must review any output before it could
ever reach a real user.

## Por qué no se creó DB

The Sprint 29R persistence readiness review still resolves to `do_not_build_real_persistence_yet` when
recomputed against the same corpus — tenant isolation, access control, retention, audit, observability,
rollback, security review, and DSR policy remain missing. Nothing about planning an integration changes
that.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by planning an
integration.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and no tenant isolation or access control
exists to govern a Supabase write — unchanged from Sprint 26R-30R.

## Por qué no se creó storage adapter real

This plan reuses the Sprint 28R fake adapter's evaluation summary as evidence that the underlying layer
is still clean — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this plan does not build.

## Criterio para pasar a Sprint 32R

Every case must stay `safeForIntegrationPlan`/`directDecisionOutputBlocked`, no clarification gate may
be missing, no route contract may violate its own invariants, no production/wiring action may be
attempted, and the Sprint 30R replay must stay `ready_for_clarification_gated_integration_plan` — which
is exactly what this sprint measured against the Sprint 18R corpus. Sprint 32R can then design a
Decision Support Response QA / User-Visible Dry Run Plan: still without wiring the router, without
wiring the composer, without activating a production feature flag, and without showing anything to a
real user until that dry run explicitly reviews it. The Sprint 29R prerequisites for *real persistence*
specifically remain untouched and still block any real persistence — Sprint 32R's scope is explicitly
*response QA / user-visible dry run readiness*, not persistence.

## Nota Sprint 32R

Sprint 32R creó el Decision Support Response QA / User-Visible Dry Run Plan
(`docs/conversational-brain-decision-support-response-qa-dry-run-plan.md`). No cambió producción, no
cambió routing, no activó ningún feature flag, no creó DB/migrations/tables/SQL files, no creó storage
adapter real ni repository real, no implementó un persistent clarification loop, no conectó
`decision_support` al router, no mostró output de `decision_support` al usuario, no creó
emails/drafts/tasks, y no ejecutó acciones. Decisión explícita: `ready_for_response_draft_harness`.
Siguiente sprint recomendado: Sprint 33R — Decision Support Response Draft Harness.



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
