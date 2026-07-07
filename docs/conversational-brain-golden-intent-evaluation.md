# Golden Intent Evaluation Set — Quick Reference (Sprint 11R, calibrated in Sprint 12R/13R/14R/15R/16R)

> Full context, rationale, and the current baseline numbers live in the Sprint 11R (§11),
> Sprint 12R (§12), Sprint 13R (§13), Sprint 14R (§14), Sprint 15R (§15), Sprint 16R (§16), Sprint
> 17R (§17), Sprint 18R (§18), Sprint 19R (§19), and Sprint 20R (§20) sections of
> `docs/conversational-brain-pipeline-reconciliation.md`. This file is a short, standalone
> quick-reference for running and interpreting the evaluation.

## What this is

An offline measurement of how compatible the production conversation classifier
(`src/lib/playbook-engine/conversation/classifier/intentClassifier.ts`) and the enriched classifier
(`src/lib/conversational-brain/`) actually are, over a corpus of 102 realistic PMFreak PM phrases
(`tests/fixtures/conversational-brain-golden-intents.ts`). It does not call the router, composer, any
handler, a database, Supabase, or any external service, and it does not activate the enriched
classifier anywhere — there is still no feature flag wired to production.

## Running it

```bash
npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs
```

Or programmatically:

```ts
import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "@/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation";
import { GOLDEN_INTENT_CASES } from "../tests/fixtures/conversational-brain-golden-intents";

const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
const report = summarizeGoldenIntentEvaluation(evaluation);

console.log(report.overall); // totalCases, compatibilityRate, thresholdBand, recommendation
console.log(report.byCategory); // per-category breakdown
console.log(report.topDifferences); // where production and mapped-enriched disagree
```

## Reading the output

- **`compatible`** (per case): production's own intent for that message already equals what the
  Sprint 10R adapter maps the enriched classification to. A `compatible: true` case is evidence
  that flipping the router to the enriched classifier (behind a future feature flag) would not
  change the observable answer for that message.
- **`compatibilityRate`**: percentage of the corpus that is `compatible`. Threshold bands (soft,
  non-blocking):
  - `>= 85%` → `staging_candidate` — reasonable to start a staging shadow-mode capture.
  - `70%-84%` → `needs_adjustment` — mapping table or classifier patterns need work first.
  - `< 70%` → `not_ready` — do not integrate yet.
- **`expectedMappedIntentFailCount`**: how many cases no longer match their recorded
  `expectedMappedIntent`. This should be `0` — a nonzero value means the corpus has drifted
  relative to a classifier or adapter change (update the corpus deliberately, don't ignore it).
- **No test in this suite fails because of a low `compatibilityRate`.** Only structural problems
  (duplicate ids, an empty input, a crash mid-evaluation, or corpus drift) fail the test suite.

## Sprint 12R — vocabulary calibration result

Sprint 12R adjusted only pattern lists (`intentClassifier.rules.ts`, `intent-patterns.ts`) — no
router, composer, handler, endpoint, or feature-flag changes. Result:

| Metric | Before (Sprint 11R) | After (Sprint 12R) |
|---|---|---|
| Global `compatibilityRate` | 28.4% (29/102) | **43.1% (44/102)** — **+14.7 points** |
| `project_status` | 18.2% (2/11) | **100% (11/11)** |
| `playbook_analysis` | 22.2% (2/9) | **88.9% (8/9)** |
| `thresholdBand` | not_ready | not_ready (still `< 70%`, unchanged band) |

Every other category (`communication_draft`, `closure_billing`, `governance_audit`,
`task_action`, `risk_issue_dependency`, `decision_support`, `ambiguous_or_unknown`,
`general_pm_advice`) is bit-for-bit unchanged from Sprint 11R — verified both by
`tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (which asserts a floor
per category) and by re-running the full existing test suites.

`qué gap ve PMFreak` (pa-04) is the one remaining playbook_analysis miss — a colloquial "gap"
neither classifier recognizes, treated as a real product-vocabulary gap rather than something to
special-case with a one-off pattern (out of scope for this sprint, per its own instructions).

See §12 of the reconciliation doc for the full list of pattern changes and the next-sprint
recommendation.

## Sprint 13R — closure/billing vocabulary calibration result

Sprint 13R adjusted only `intentClassifier.rules.ts` (production) — the enriched classifier's
`closure_billing` family already covered the target vocabulary, so `intent-patterns.ts` and the
adapter's mapping table needed no changes. Result:

| Metric | Before (Sprint 12R) | After (Sprint 13R) |
|---|---|---|
| Global `compatibilityRate` | 43.1% (44/102) | **51% (52/102)** — **+7.9 points** |
| `closure_billing` | 33.3% (4/12) | **100% (12/12)** |
| `communication_draft` | 60% (6/10) | **60% (6/10)** — unchanged (protected) |
| `project_status` | 100% (11/11) | **100% (11/11)** — unchanged (protected) |
| `playbook_analysis` | 88.9% (8/9) | **88.9% (8/9)** — unchanged (protected) |
| `thresholdBand` | not_ready | not_ready (still `< 70%`, unchanged band) |

Every category not targeted this sprint (`governance_audit`, `task_action`, `risk_issue_dependency`,
`decision_support`, `ambiguous_or_unknown`, `general_pm_advice`) is bit-for-bit unchanged from
Sprint 12R — verified both by the `closure_billing` section added to
`tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` and by re-running the
full existing test suites.

See §13 of the reconciliation doc for the full mismatch classification, pattern changes, and
collision-avoidance analysis (in particular why `communication_draft` phrases sharing new
closure/billing vocabulary — "correo para pedir recepción", "correo de cierre" — still classify
correctly).

## Sprint 14R — governance/audit and risk/issue/dependency vocabulary calibration result

Sprint 14R adjusted both pattern lists (`intentClassifier.rules.ts` and `intent-patterns.ts`) — no
adapter, router, composer, handler, endpoint, or feature-flag changes. Result:

| Metric | Before (Sprint 13R) | After (Sprint 14R) |
|---|---|---|
| Global `compatibilityRate` | 51% (52/102) | **62.7% (64/102)** — **+11.7 points** |
| `governance_audit` | 40% (4/10) | **90% (9/10)** |
| `risk_issue_dependency` | 30% (3/10) | **100% (10/10)** |
| `thresholdBand` | not_ready | not_ready (still `< 70%`, unchanged band) |

Every protected category (`project_status`, `closure_billing`, `playbook_analysis`,
`communication_draft`) is bit-for-bit unchanged from Sprint 13R — verified both by the
`governance_audit`/`risk_issue_dependency` sections added to
`tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` and by re-running the
full existing test suites (163 tests).

`qué trazabilidad tiene esta decisión` (ga-09) is the one remaining `governance_audit` miss — a
documented `governance_audit`/`decision_support` vocabulary overlap dating back to Sprint 11R, not
resolvable without first giving `decision_support` a production handler (out of scope for this
sprint, per its own instructions).

See §14 of the reconciliation doc for the full mismatch classification, pattern changes, and
collision-avoidance analysis (in particular why the new "explicit blocker" vocabulary for
`risk_issue_dependency` — "está frenando", "está trabando", "bloquea el avance" — doesn't hijack
`project_status`'s own "atorado/estancado/no avanza"/"avance" vocabulary).

## Sprint 15R — task_action vocabulary calibration result

Sprint 15R adjusted both pattern lists (`intentClassifier.rules.ts` and `intent-patterns.ts`) — no
adapter, router, composer, handler, endpoint, or feature-flag changes. Result:

| Metric | Before (Sprint 14R) | After (Sprint 15R) |
|---|---|---|
| Global `compatibilityRate` | 62.7% (64/102) | **67.6% (69/102)** — **+4.9 points** |
| `task_action` | 50% (5/10) | **100% (10/10)** |
| `thresholdBand` | not_ready | not_ready (still `< 70%`, unchanged band) |

Every protected category (`project_status`, `closure_billing`, `risk_issue_dependency`,
`governance_audit`, `playbook_analysis`, `communication_draft`) is bit-for-bit unchanged from
Sprint 14R — verified both by the `task_action` section added to
`tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` and by re-running the
full existing test suites.

Production gained six new `task_or_action_request` patterns (conversion phrases, a broadened
assignment prefix, status/update phrases requiring an explicit "tarea"/"accion"/"estado" noun, and a
narrow "recordame ... seguimiento" reminder pattern) — all of the target vocabulary was already
present or trivially portable from the enriched classifier's existing `task_action` pattern list, so
this sprint closed every remaining `task_action` mismatch, including the `recordame hacer seguimiento
mañana` (ta-10) case that was previously a true gap in *both* classifiers.

`marcá esta recomendación como vista` (ta-03) remains a deliberately untouched, documented
`task_action`/`playbook_analysis` vocabulary overlap (both classifiers already agree it's
`recommendation_request` via the existing mapping) — none of the new task_action patterns match it,
since each requires an explicit "tarea"/"accion"/"estado" noun that this phrase doesn't have.

See §15 of the reconciliation doc for the full mismatch classification, pattern changes, and
collision-avoidance analysis (in particular why the new bare "asigna(le|me|r)?" and "como pendiente"
patterns don't hijack `governance_audit`'s "aprobaciones pendientes" or `risk_issue_dependency`'s
"pendiente de tercero/proveedor/cliente" patterns).

## Sprint 16R — communication_draft vocabulary calibration result

Sprint 16R adjusted both pattern lists (`intentClassifier.rules.ts` and `intent-patterns.ts`) — no
adapter, router, composer, handler, endpoint, or feature-flag changes. Result:

| Metric | Before (Sprint 15R) | After (Sprint 16R) |
|---|---|---|
| Global `compatibilityRate` | 67.6% (69/102) | **72.5% (74/102)** — **+4.9 points** |
| `communication_draft` | 60% (6/10) | **100% (10/10)** |
| `thresholdBand` | not_ready | **needs_adjustment** (crossed the 70% line) |

Every protected category (`project_status`, `closure_billing`, `risk_issue_dependency`,
`task_action`, `governance_audit`, `playbook_analysis`) is unchanged or improved from Sprint 15R —
verified both by the `communication_draft` section added to
`tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` and by re-running the
full existing test suites.

Production gained ten new `communication_draft` patterns: an explicit "ayudame a
responder/contestar" verb, a "seguimiento formal" follow-up phrase, a bare "minuta(s)" noun, bare
"draft"/"borrador" loanwords, a "prepara/arma/formula + correo/mensaje/minuta/borrador/respuesta/
nota" drafting-verb-plus-noun combination, a widened "pedir/solicitar recepcion/visto bueno/
aceptacion/conformidad" closure-communication phrase, a "como le digo/que le respondo/que le
contesto" stakeholder-communication trigger, an "ayudame a escalar" phrase, and a
"con la recomendacion/explicando la recomendacion" playbook-communication phrase. The enriched
classifier gained the matching subset it was missing: "escribeme/escribime" (production already had
it), the same drafting-verb-plus-noun combination, "ayudame a escalar", "como le digo/que le
respondo/que le contesto", and a widened "pedir/solicitar recepcion/visto bueno/aceptacion/
conformidad" pattern.

Every new pattern is weighted so an explicit drafting request wins over a bare topic word (the
sprint's own "communication_draft must win" collision rule) while leaving every already-protected
phrase's winning pattern untouched — most notably `cb-06`'s "preparame el seguimiento para
recepción" (closure_billing, unaffected because it has no correo/mensaje/minuta/borrador/respuesta/
nota noun for the new drafting-verb pattern to combine with) and every task_action/governance_audit/
risk_issue_dependency/project_status/playbook_analysis phrase that carries a topic word without a
drafting verb.

One golden case outside `communication_draft` genuinely drifted and was updated with a note: `gpa-07`
("cómo le digo al cliente que hay un retraso") now ties the enriched classifier's pre-existing
`general_pm_advice` "como le digo" pattern against the new `communication_draft` one and resolves to
`communication_draft` via `FAMILY_TIE_BREAK_ORDER` — matching the sprint's explicit rule that
"cómo le digo" should win over topic vocabulary (including "atraso"/"retraso"). This is a net
improvement (the case was already-incompatible, now compatible) and `general_pm_advice`'s own
compatibilityRate did not decrease (30% → 40%); the category was intentionally left otherwise
untouched, per this sprint's own scope.

See §16 of the reconciliation doc for the full mismatch classification, pattern changes, and
collision-avoidance analysis.

## Sprint 17R — General PM Advice Boundary & Design Review (no calibration this sprint)

Sprint 17R deliberately did **not** calibrate `general_pm_advice`, `decision_support`, or
`ambiguous_or_unknown` vocabulary — it produced an explicit routing policy, a 70-case boundary
corpus, and a pure evaluator instead, since those three categories' remaining gaps are
architecture/design questions, not missing pattern-list entries. Confirmed via
`tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs`:

| Metric | Value |
|---|---|
| Global `compatibilityRate` (this doc's corpus) | **72.5% — unchanged** |
| `project_status` / `closure_billing` / `risk_issue_dependency` / `task_action` / `communication_draft` | **100% each — unchanged** |
| `governance_audit` | **90% — unchanged** |
| `playbook_analysis` | **88.9% — unchanged** |

New boundary-corpus metrics (from `generalPmAdviceBoundaryReview.ts`, a separate 70-case corpus, not
part of this golden corpus):

| Metric | Value |
|---|---|
| `policyAlignedRate` | 74.3% (52/70) |
| `currentSystemAcceptableRate` | 84.3% (59/70) |
| `architectureGapCount` | 10 (all `decision_support_candidate`) |
| `clarificationGapCount` | 10 (all `ambiguous_clarification_candidate`) |
| `recommendedNextSprint` | "Decision Support + Clarification Architecture Review" |

See `docs/conversational-brain-general-pm-advice-boundary.md` for the full policy, precedence
rules, boundary examples, and architecture/clarification gap analysis, and §17 of the
reconciliation doc for the full sprint write-up.

## Sprint 18R — Decision Support + Clarification Architecture Review (no calibration, no handler)

Sprint 18R did not calibrate any vocabulary and did not build a `decision_support` handler or a real
clarification loop — it produced a dedicated architecture policy, a 79-case corpus, and a pure
evaluator for the two remaining gaps. Confirmed via
`tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs`:

| Metric | Value |
|---|---|
| Global `compatibilityRate` (this doc's corpus) | **72.5% — unchanged** |
| Sprint 17R boundary review's own metrics | **unchanged** (`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount` 10) |

New corpus-specific metrics (from `decisionClarificationArchitectureReview.ts`, a separate 79-case
corpus, not part of this golden corpus):

| Metric | Value |
|---|---|
| `totalCases` | 79 |
| `currentSafeMappingRate` | 64.6% (51/79) |
| `futureRouteAlreadySupportedRate` | 49.4% (39/79) |
| `requiresNewHandlerCount` | 45 |
| `requiresClarificationCount` | 24 |
| `unsafeMappings` | 28/79 |
| `existingRouteRegressions` | 0/10 |
| `recommendedNextSprint` | "Sprint 19R — Decision Support Candidate Handler" |

See `docs/conversational-brain-decision-support-clarification-architecture.md` for the full policy,
precedence rules, boundary examples, and architecture/clarification gap analysis, and §18 of the
reconciliation doc for the full sprint write-up.

## Sprint 19R — Decision Support Candidate Handler (no calibration, no routing change)

Per Sprint 18R's evaluator recommendation, Sprint 19R built a **Decision Support Candidate Handler**
— an isolated, pure, tested capability in
`src/lib/playbook-engine/conversation/decision-support/` — before any further vocabulary calibration.
It does not touch this golden corpus, `intentClassifier.rules.ts`, `intent-patterns.ts`,
`intentCompatibilityAdapter.ts`, the router, the composer, or any production handler, and it is not
connected to `POST /api/command-center/chat`. Confirmed via
`tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs`:

| Metric | Value |
|---|---|
| Global `compatibilityRate` (this doc's corpus) | **72.5% — unchanged** |
| Sprint 17R boundary review's own metrics | **unchanged** (`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount` 10) |
| Sprint 18R architecture review's own metrics | **unchanged** (`currentSafeMappingRate` 64.6%, `futureRouteAlreadySupportedRate` 49.4%, `requiresNewHandlerCount` 45, `requiresClarificationCount` 24, `recommendedNextSprint` "Sprint 19R — Decision Support Candidate Handler") |

The new handler supports 10 `DecisionSupportDecisionType` values, backed by a 50-case fixture corpus
(`tests/fixtures/conversational-brain-decision-support-handler-cases.ts`) and 54 tests. See
`docs/conversational-brain-decision-support-candidate-handler.md` for the full input/output contract,
decision types, safety guarantees, and criteria to pass to Sprint 20R, and §19 of the reconciliation
doc for the full sprint write-up.

## Next steps (Sprint 20R candidate work)

Per `docs/conversational-brain-decision-support-candidate-handler.md`'s own "Criteria to pass to
Sprint 20R", a future integration sprint should (1) re-run this evaluation plus the Sprint 17R/18R
reviews and Sprint 19R's own test suite to confirm none regress, (2) resolve the
`decision_support_vs_playbook` and `decision_support_vs_general_pm` classifier collisions with
explicit tie-break logic, (3) wire real `DecisionDraft` data (from `operational-intelligence-engine.ts`,
Sprint 5) into the candidate handler's analyzer instead of its current deterministic per-type
templates, and only then (4) propose a feature-flagged, default-off router integration. Use
`report.byCategory` and `report.topDifferences` (this evaluation) plus
`decisionClarificationArchitectureReview.ts`'s own `byArchitectureCategory`/`topDecisionSupportGaps`/
`topClarificationGaps` to prioritize which classifier's pattern list
(`intentClassifier.rules.ts` for production, `intent-patterns.ts` for the enriched classifier) or
which row of the adapter's mapping table (`intentCompatibilityAdapter.ts`) needs adjustment once that
integration is scoped. `general_pm_advice` vocabulary calibration and a Clarification Response
Strategy remain the next steps after that, per Sprint 18R's `recommendedImplementationOrder`. See §19
of the reconciliation doc for the full criteria before proposing any router/handler change.

## Sprint 20R — Decision Support Shadow Mapping Evaluation (no calibration, no routing change)

Sprint 20R answered item (1) above with a dedicated offline evaluator
(`decisionSupportShadowMappingEvaluation.ts`) rather than by hand — see
`docs/conversational-brain-decision-support-shadow-mapping.md` for the full results. It does not touch
this golden corpus, `intentClassifier.rules.ts`, `intent-patterns.ts`,
`intentCompatibilityAdapter.ts`, the router, the composer, or any production handler, and it is not
connected to `POST /api/command-center/chat`. Confirmed via
`tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs`:

| Metric | Value |
|---|---|
| Global `compatibilityRate` (this doc's corpus) | **72.5% — unchanged** |
| Sprint 17R boundary review's own metrics | **unchanged** (`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount` 10) |
| Sprint 18R architecture review's own metrics | **unchanged** (`currentSafeMappingRate` 64.6%, `futureRouteAlreadySupportedRate` 49.4%, `requiresNewHandlerCount` 45, `requiresClarificationCount` 24) |
| Sprint 19R candidate handler's own 54-test suite | **unchanged** |
| New: `candidateHandlerCoverageRate` / `candidateHandlerSafeRate` | **100% / 100%** — the handler's eligibility surface exactly matches the architecture boundary, and is structurally/safety sound on every eligible case |
| New: `shadowRoutableRate` | **40%** — held back by live classifier collisions (`general_pm_advice` largest) and low-confidence results from the still-missing `DecisionDraft` context reuse |
| New: `recommendedIntegrationMode` / `recommendedNextSprint` | `do_not_integrate` / **"Sprint 21R — Decision Support Classifier Boundary Calibration"** |

This directly confirms item (2) above (resolve `general_pm_advice`/`playbook_analysis` classifier
collisions) as the correct next step, with live measurements rather than an assumption. See
`docs/conversational-brain-decision-support-shadow-mapping.md`'s own "Criteria to pass to Sprint 21R"
for the full sequencing.

## Sprint 21R — Decision Support Classifier Boundary Calibration (one fixture entry updated)

Sprint 21R calibrated `intent-patterns.ts`'s `decision_support` boundary (see
`docs/conversational-brain-decision-support-classifier-boundary.md`). This golden corpus's global
`compatibilityRate` stayed **72.5%**, and every previously-calibrated category's rate is unchanged
(`project_status`/`closure_billing`/`risk_issue_dependency`/`task_action`/`communication_draft` 100%,
`governance_audit` 90%, `playbook_analysis` 88.9%; `general_pm_advice` also stayed at 40%, though it
is not a protected category). One entry drifted and was updated: `gpa-06` ("qué harías tú en mi
lugar") now records `expectedEnrichedFamily: "decision_support"` and
`expectedMappedIntent: "unsupported"` (was `general_pm_advice`/`general_pm_advice`), with a note
explaining the Sprint 21R calibration and that `shouldBeCompatible` stays `false` either way (the
production classifier still returns `unknown` for this input). This is drift correction, not score
inflation — the case was already incompatible before and after.

## Sprint 22R — Clarification Response Strategy (no calibration, no golden corpus change)

Sprint 22R did not touch this golden corpus, `intentClassifier.rules.ts`, `intent-patterns.ts`,
`intentCompatibilityAdapter.ts`, the router, the composer, or any production handler — it built an
isolated Clarification Response Strategy (`src/lib/playbook-engine/conversation/clarification/`, see
`docs/conversational-brain-clarification-response-strategy.md`) that answers ambiguous messages with
a structured clarifying question instead of a canned advice answer. Confirmed via
`tests/playbook-engine-conversation-clarification-response-strategy.test.mjs`:

| Metric | Value |
|---|---|
| Global `compatibilityRate` (this doc's corpus) | **72.5% — unchanged** |
| Every previously-calibrated category | **unchanged** (`project_status`/`closure_billing`/`risk_issue_dependency`/`task_action`/`communication_draft` 100%, `governance_audit` 90%, `playbook_analysis` 88.9%) |

New corpus-independent metrics (from `clarificationResponseEvaluation.ts`, reusing the Sprint 18R
`clarification_*` cases and the Sprint 17R `ambiguous_clarification_candidate` cases — not part of
this golden corpus):

| Metric | Value |
|---|---|
| `evaluatedClarificationCases` | 34 |
| `acceptableResponseRate` | 100% |
| `safetyPassRate` | 100% |
| `recommendedNextSprint` | "Sprint 23R — Decision Support Adapter Mapping Plan" |

See `docs/conversational-brain-clarification-response-strategy.md` for the full strategy-type
taxonomy, missing-slot inference, route options, response format, and evaluation results.

## Sprint 23R — Decision Support Adapter Mapping Plan

Sprint 23R did not re-run or modify this golden corpus's own evaluator; it re-verified
`compatibilityRate` (72.5%) and every previously-calibrated category rate unchanged as part of its own
regression suite. New corpus-independent metrics this sprint added (from
`decisionSupportAdapterMappingPlan.ts`, simulating eight mapping strategies against the Sprint 18R
corpus):

| Metric | Value |
|---|---|
| `bestStrategy` / `recommendedSprint24Strategy` | `hybrid_shadow_then_clarify` |
| `worstStrategy` | `map_to_general_pm_advice` |
| `recommendedNextSprint` | "Sprint 24R — Decision Support Shadow Mode Prep" |

See `docs/conversational-brain-decision-support-adapter-mapping-plan.md` for the full strategy
comparison table and safety analysis.

## Sprint 24R

Sprint 24R built the `hybrid_shadow_then_clarify` shadow mode prep contract
(`decisionSupportShadowModePrep.ts`) without touching the golden evaluation corpus, the classifier, or
the adapter. Re-running `runGoldenIntentEvaluation()` confirms the global `compatibilityRate` is
unchanged at **72.5%**. See `docs/conversational-brain-decision-support-shadow-mode-prep.md` for the
full contract and results.

## Sprint 25R

Sprint 25R built an offline/test-only shadow capture harness on top of the Sprint 24R shadow mode prep
contract, without touching the golden evaluation corpus, the classifier, or the adapter. Re-running
`runGoldenIntentEvaluation()` confirms the global `compatibilityRate` is unchanged at **72.5%**. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md` for the full contract and
results.

## Sprint 26R note

Sprint 26R built an offline storage policy on top of the Sprint 25R capture harness, without touching
the golden evaluation corpus, the classifier, or the adapter. Re-running `runGoldenIntentEvaluation()`
confirms the global `compatibilityRate` is unchanged at **72.5%**. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md` for the full policy and results.

## Sprint 27R note

Sprint 27R built an offline storage adapter plan on top of the Sprint 26R storage policy, without
touching the golden evaluation corpus, the classifier, or the adapter. Re-running
`runGoldenIntentEvaluation()` confirms the global `compatibilityRate` is unchanged at **72.5%**. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` for the full plan and
results.
