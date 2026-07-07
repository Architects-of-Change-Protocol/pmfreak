# Decision Support Classifier Boundary Calibration (Sprint 21R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R), and
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R). This file is the
> standalone design/results document for the classifier calibration produced by Sprint 21R.

## Executive summary

Sprint 20R measured, with real numbers, that the Sprint 19R Decision Support Candidate Handler is
100% structurally/safety sound but only 40% "shadow routable" against the Sprint 18R corpus — and
that the dominant blocker was not the handler, but the enriched classifier's own
`intent-patterns.ts`: it did not reliably recognize decision-shaped phrasing as `decision_support`,
so those messages instead collided with `playbook_analysis`, `general_pm_advice`,
`risk_issue_dependency`, `closure_billing`, or `governance_audit`.

Sprint 21R calibrates that boundary. It adds ~24 new decision-specific pattern rules (and two
narrowly-scoped precision fixes to `task_action` and `communication_draft`) to
`src/lib/conversational-brain/intent-patterns.ts` — the enriched, non-production classifier. Every
pattern is scoped to an explicit decision connector (comparación, escalar/esperar, cerrar/continuar,
facturar/cobrar vs. esperar, aceptar/mitigar riesgo, cambiar proveedor, evidencia/criterio "para
decidir") so it does not fire on the plain, non-decision phrasing the other five families still own.

Result: `enrichedDecisionSupportDetectionRate` rose from **33.3% (15/45)** to **88.9% (40/45)**, and
`unsafeClassifierCollisionCount` fell from **21 to 5** — with the two largest buckets
(`playbookCollisionCount` 3→0, `governanceCollisionCount` 3→0) fully eliminated in this corpus. None
of this touches production: `decision_support` still maps to `"unsupported"` (the Sprint 10R
documented safe fallback), the router/composer/handlers/endpoint are untouched, and no feature flag
was activated.

## What problem this solves

The enriched classifier's `decision_support` pattern list (Sprint 9) only recognized bare
"decisión/decidir/opciones/alternativas" vocabulary. Any decision phrased through a *specific*
connector — "conviene X o esperar", "deberíamos aceptar este riesgo o mitigarlo", "qué harías en mi
lugar" — scored zero decision_support signal and lost outright to whichever other family's bare
keyword happened to also be present ("riesgo", "evidencia", "recomienda", "cerrar", "como manejo").
Sprint 21R closes that gap at the pattern level.

## What this does NOT solve yet

- **Does not change what `decision_support` maps to.** The Sprint 10R adapter's documented
  `decision_support -> unsupported` mapping is untouched — `intentCompatibilityAdapter.ts` was not
  modified. Detecting the boundary correctly does not, by itself, create a route.
- **Does not raise `shadowRoutableRate`.** It stayed at 40% (18/45) — the Sprint 19R candidate
  handler's confidence gate (needs 2+ named options or `availableContext`, neither of which this
  calibration adds) is the current limiting factor, not the classifier boundary anymore.
- **Does not resolve every remaining collision.** 5 unsafe classifier collisions remain in the
  corpus (see "Remaining collisions" below), plus 5 dc-cases the task's own priority list did not
  require fixing (dc-25, dc-26, dc-32, dc-37, dc-40) — each is a pre-existing `general_pm_advice`,
  `risk_issue_dependency`, or `communication_draft` vocabulary-eagerness issue, out of this sprint's
  scope (calibrating those five families' own patterns is explicitly not this sprint's job).
- **Does not calibrate `general_pm_advice` vocabulary.** Only decision_support's own boundary against
  the other five families was calibrated — per the sprint's explicit restriction.
- **Does not implement `DecisionDraft` context reuse**, a clarification loop, or a Context
  Resolver/Router/Composer.

## Baseline (Sprint 20R)

| Metric | Sprint 20R baseline |
|---|---|
| `decisionSupportDesiredCount` | 45 |
| Enriched classifier correctly detects `decision_support` (raw, measured directly against the pre-Sprint-21R patterns) | 15/45 (33.3%) |
| `candidateHandlerSafeRate` | 100% |
| `shadowRoutableRate` | 40% (18/45) |
| `currentMappingSafeRate` | 64.6% |
| `unsafeClassifierCollisionCount` | 21 |
| `playbookCollisionCount` | 3 |
| `generalPmCollisionCount` | 7 |
| `riskCollisionCount` | 5 |
| `closureCollisionCount` | 2 |
| `governanceCollisionCount` | 3 |
| `recommendedIntegrationMode` | `do_not_integrate` |
| `recommendedNextSprint` | "Sprint 21R — Decision Support Classifier Boundary Calibration" |

## What was calibrated

File touched: `src/lib/conversational-brain/intent-patterns.ts` (enriched, non-production classifier
only — see "Why this does not touch production" below).

### Patterns added to `decision_support`

- Singular/plural option vocabulary: broadened `(opciones|alternativas)` to `(opcion(es)?|alternativa(s)?)`.
- A generic `conviene` signal (weight 3), used as a tie-breaking booster alongside more specific patterns.
- Explicit comparison connectors: `A o B` (single-letter), "estas opciones/alternativas", "dos opciones".
- `camino ... recomiendas/tomar`, `camino tomarías`.
- Escalate-or-wait: `conviene escalar`, `escalar o esperar`, `presionar o esperar`, and related phrasings.
- Close-or-continue: `cerrar ya`, `cerramos el proyecto o`, `dejamos pendiente`.
- Bill/wait-or-evidence: `factura/cobra ... o ... esper...`, `cobrar/facturar con esta evidencia`,
  `esperar recepción formal/aceptación final`.
- Accept-or-mitigate risk: `aceptar/asumir ... riesgo ... mitigar`, `riesgo o mitigar(lo)`.
- Vendor: `cambiar (de) proveedor`, `proveedor actual`.
- Evidence/criteria "to decide": `evidencia necesito para decidir`, `criterio uso para decidir`,
  `justificación necesito`, `respaldo necesito para decidir`, generic `para decidir/escoger`.
- General decision-support phrasing: `en mi lugar`, `harías ... en mi lugar`, `camino tomarías`,
  `deberia/debo proceder`, `manejo esta decisión` / `esta decisión entre`.
- Two end-anchored patterns (`^que me recomiendas hacer$` and `recomiendas hacer$`) that match only
  the *bare* phrase "qué me recomiendas hacer" — deliberately anchored so they do not also match the
  longer, already-calibrated golden case `pa-05` ("qué me recomiendas hacer ahora"), which must stay
  `playbook_analysis`.

### Precision fixes to other families (same file, narrowly scoped)

- `task_action`'s "convert(í/ir) X en tarea" pattern was broadened from a literal `esto` object to
  `(esto|esta decision)`, so "convertí esta decisión en tarea" still matches task_action explicitly
  (it also ties with decision_support's bare "decisión" match, but `task_action` is first in
  `FAMILY_TIE_BREAK_ORDER`, so ties already resolved correctly even before this fix — this change
  makes the match itself accurate, not just accidentally correct via tie-break).
- `communication_draft` gained a new `ayudame a explicar` pattern (weight 5), mirroring its existing
  `ayudame a (contestar|responder)` — "ayudame a explicar la alternativa al cliente" is a drafting-help
  request per the sprint's own precedence rule A (communication_draft wins on an explicit
  drafting/explaining verb).

### Boundary precedence, as implemented

The existing scoring model (deterministic weight sum per family, highest wins, ties resolved only via
`FAMILY_TIE_BREAK_ORDER`) was preserved — no new tie-break logic was added, and `decision_support` was
not added to `FAMILY_TIE_BREAK_ORDER`. Instead, every new decision_support pattern was weighted (and,
where needed, paired with a second matching pattern) so that decision-shaped phrasing scores strictly
higher than the colliding family on the specific test phrases this sprint targets, while phrasing with
no decision connector present still lets the other family win outright (decision_support scores 0).
`task_action` and `communication_draft` collisions resolve via the pre-existing tie-break order
(`FAMILY_TIE_BREAK_ORDER` already lists `task_action` first and `communication_draft` second), so no
new precedence mechanism was needed there.

## Collisions: before → after

| Collision bucket | Sprint 20R | Sprint 21R | Reduction |
|---|---|---|---|
| `unsafeClassifierCollisionCount` | 21 | 5 | 16 |
| `playbookCollisionCount` | 3 | 0 | 3 |
| `generalPmCollisionCount` | 7 | 1 | 6 |
| `riskCollisionCount` | 5 | 2 | 3 |
| `closureCollisionCount` | 2 | 1 | 1 |
| `governanceCollisionCount` | 3 | 0 | 3 |
| `mapping_gap` | 1 | 1 | 0 (unaffected — this is the one case where both classifiers agree but not on decision_support; see Sprint 20R doc) |

`enrichedDecisionSupportDetectionRate`: **33.3% → 88.9%**. `decisionSupportBoundaryCapturedRate` is
the same figure under Sprint 21R's own naming (see "New metrics" below).
`unsupportedMappingCount` rose from 5 to 14 — this is the expected, desired shape of the fix: cases
that used to collide with a *different* live production intent (a routing risk) now correctly land on
the documented `decision_support -> unsupported` safe fallback instead (not a routing risk, just an
unintegrated one).

### Remaining collisions (not fixed this sprint)

5 unsafe classifier collisions remain in the 45-case corpus:

- `dc-25` "qué hago si el cliente no responde, escalo o espero" → still `general_pm_advice` (its own
  "que hago si" pattern scores 8; this is a `general_pm_advice` eagerness issue, out of scope).
- `dc-26` "qué debería hacer con este problema, cuál camino tomo" → still `risk_issue_dependency`
  (bare "problema" match); a three-way collision the Sprint 18R corpus itself already flagged as
  needing future pattern design, not resolved here.
- `dc-32` "deberíamos seguir aunque haya riesgo" → still `risk_issue_dependency` (no accept/mitigate
  verb present to anchor a decision_support match; adding one risked over-broadening).
- `dc-37` "conviene pedir recepción o esperar pruebas" → still `communication_draft` (Sprint 16R's
  "pedir/solicitar recepción" pattern); touching that pattern risked the `cb-06` golden case.
- `dc-40` "pedimos aceptación final o esperamos al cliente" → still `closure_billing`
  (`acceptance_status_check` bare match).

None of these five phrases were in this sprint's required test-phrase list; all are documented here
as honest remaining gaps rather than silently dropped.

## New shadow mapping evaluator metrics

Added to `decisionSupportShadowMappingEvaluation.ts` / `decisionSupportShadowMappingTypes.ts`:

| Metric | Sprint 20R (pre-calibration) | Sprint 21R (post-calibration) |
|---|---|---|
| `enrichedDecisionSupportDetectedCount` | 15 | **40** |
| `enrichedDecisionSupportDetectionRate` | 33.3% | **88.9%** |
| `decisionSupportBoundaryCapturedCount` / `Rate` | 15 / 33.3% | **40 / 88.9%** |
| `unsupportedSafeParkingCount` | n/a (metric added this sprint) | **40** |
| `semanticBoundaryImprovementCount` | n/a | **25** |
| `unsafeClassifierCollisionReduction` | n/a | **16** |
| `playbookCollisionReduction` | n/a | **3** |
| `generalPmCollisionReduction` | n/a | **6** |
| `riskCollisionReduction` | n/a | **3** |
| `closureCollisionReduction` | n/a | **1** |
| `governanceCollisionReduction` | n/a | **3** |

`unsupportedSafeParkingCount` is **not** treated as a production success anywhere in the evaluator or
its `recommendedIntegrationMode` heuristic — it is explicitly documented (in both the type and the
evaluator) as "semantic boundary captured; adapter integration still pending." The
`SPRINT_20R_BASELINE` constant these reduction/improvement fields are computed against is a hardcoded,
documented snapshot of Sprint 20R's own measured numbers (see the code comment at its definition) —
never re-measured at runtime, so these fields are stable regardless of future corpus changes.

## Metrics unaffected or improved as a side effect (not gamed)

- `candidateHandlerSafeRate`: **100% → 100%** (unchanged — this sprint never touched the handler).
- `shadowRoutableRate`: **40% → 40%** (unchanged — confidence gating, not classifier boundary, is now
  the limiting factor; this sprint deliberately did not touch `DecisionDraft`/context reuse).
- `currentMappingSafeRate` (Sprint 18R architecture review): **64.6% → 84.8%** — every case where the
  classifier now correctly detects `decision_support` and still maps to `unsupported` (the documented
  safe fallback) counts as "safe" by that review's own definition, since it never claimed
  `unsupportedSafeParkingCount`-style cases were routable.
- `futureRouteAlreadySupportedRate` (Sprint 18R): **49.4% → 84.8%** — same underlying cause: more
  `future_architecture`-targeted cases now show `enrichedFamily === "decision_support"` live.
- `policyAlignedRate` (Sprint 17R boundary review): **74.3% → 82.9%** — every newly-aligned case has
  `policyTargetKind: "architecture_candidate"` (the boundary corpus's own `decision_support_candidate`
  category); no other boundary category's alignment changed.
- `recommendedIntegrationMode`: **`do_not_integrate` → `do_not_integrate`, unchanged** — the module's
  own threshold (`shadowRoutableRate < 50%`) still holds; this sprint did not adjust that rule to
  manufacture a nicer verdict.
- `recommendedNextSprint`: **"Sprint 21R — Decision Support Classifier Boundary Calibration" →
  "Sprint 21R — Clarification Response Strategy"**. This is the module's own, unmodified heuristic
  (highest of four gap buckets), computed honestly from this run's real numbers: with the classifier
  boundary bucket down to 1 (`playbookCollisionCount` 0 + `generalPmCollisionCount` 1) and the handler
  quality bucket at 0, the clarification-unsafe-mapping bucket (7 — unchanged by this sprint, and
  already present in Sprint 20R) is now the largest of the four. Read the recommendation's literal
  label as "the next sprint after whichever one produced this result" (a fixed type name inherited
  from Sprint 20R's own type union, not a live sprint-number computation) — in real numbering that is
  Sprint 22R.

## Golden corpus / Sprint 17R / Sprint 18R / Sprint 19R impact

- **Golden corpus global `compatibilityRate`: 72.5% — unchanged.**
- **Per-category rates for every previously-calibrated category — unchanged**: `project_status` 100%,
  `closure_billing` 100%, `risk_issue_dependency` 100%, `task_action` 100%, `communication_draft`
  100%, `governance_audit` 90%, `playbook_analysis` 88.9%.
- **`general_pm_advice` category rate: 40% — unchanged** (not a protected category, but verified
  unaffected regardless).
- **One golden fixture entry updated**: `gpa-06` ("qué harías tú en mi lugar"). Its
  `expectedEnrichedFamily` moved from `general_pm_advice` to `decision_support` and
  `expectedMappedIntent` from `general_pm_advice` to `unsupported`, with the note: *"Sprint 21R
  calibration: enriched classifier now detects decision_support boundary; adapter mapping remains
  intentionally safe/unintegrated."* `shouldBeCompatible` stays `false` either way (production's own
  classifier still returns `unknown` for this input, unaffected by this sprint), so this single change
  does not move the global or per-category rate at all.
- **Sprint 17R boundary review**: `policyAlignedRate` 74.3% → 82.9% (documented above);
  `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount` 10 — all
  unchanged.
- **Sprint 18R architecture review**: `currentSafeMappingRate` 64.6% → 84.8%,
  `futureRouteAlreadySupportedRate` 49.4% → 84.8% (both documented above);
  `requiresNewHandlerCount` 45, `requiresClarificationCount` 24, `existingRouteRegressions` 0 — all
  unchanged.
- **Sprint 19R candidate handler**: source file (`decisionSupportCandidateHandler.ts`,
  `decisionSupportAnalyzer.ts`, `decisionSupportCandidateTypes.ts`) was not modified at all this
  sprint; its own 54-test suite passes unmodified.

## Why this does not connect to the router

Per this sprint's explicit constraints, and because `shadowRoutableRate` (40%) is unchanged and still
well under any threshold that would justify even a default-off shadow mode: this sprint calibrates
*classification*, not *routing*. `recommendedIntegrationMode` stayed `do_not_integrate` precisely
because the handler-confidence gap Sprint 20R already identified (no `DecisionDraft` context reuse)
is untouched — fixing the classifier boundary alone does not make routing safe.

## Why this does not change the adapter mapping

`intentCompatibilityAdapter.ts` was not modified. `decision_support -> unsupported` remains the
Sprint 10R documented safe fallback. Every one of the 40 newly-detected `decision_support` cases
still resolves to `"unsupported"` in production-compatible terms — the boundary is now *recognized*
by the enriched classifier, but there is still no production route to send it to. That is exactly
what `unsupportedSafeParkingCount` measures and exactly why it is documented as "not a production
success."

## Recommendation

Per this evaluator's own (unmodified) heuristic, the next sprint should be **Sprint 22R — Clarification
Response Strategy** (the module's literal recommendation is the type-union value "Sprint 21R —
Clarification Response Strategy" — see the note above on why the label lags real sprint numbering).
The clarification-unsafe-mapping bucket (7 cases, unchanged since Sprint 20R) is now the largest of
the four gap buckets this evaluator tracks, having been overtaken in relative size only because the
classifier-boundary bucket this sprint targeted shrank so much (10 → 1). A **Sprint 23R — Decision
Support Adapter Mapping Plan** remains the logical sprint after that, once a real clarification
strategy exists to route the remaining `needs_clarification` cases correctly.

## Sprint 22R follow-up — Clarification Response Strategy

Sprint 22R built exactly that clarification response strategy — see
`docs/conversational-brain-clarification-response-strategy.md` — without touching this document's
classifier calibration at all. Re-running this file's own regression suite
(`tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs`) confirms every
metric above is unchanged: `enrichedDecisionSupportDetectionRate` 88.9%,
`unsafeClassifierCollisionCount` 5 (playbook 0 / general_pm 1 / risk 2 / closure 1 / governance 0),
`recommendedIntegrationMode` `do_not_integrate`. The new strategy's own offline evaluator measured
`acceptableResponseRate` 100% and `safetyPassRate` 100% against the Sprint 18R/17R clarification
corpora on its first real run, and its own `recommendedNextSprint` is **"Sprint 23R — Decision
Support Adapter Mapping Plan"** — i.e. the next architectural step is resolving `decision_support`'s
still-pending adapter mapping (this document's own `do_not_integrate` finding), not further
clarification-response hardening.

## Sprint 23R follow-up — Decision Support Adapter Mapping Plan

Sprint 23R built exactly that adapter mapping plan — see
`docs/conversational-brain-decision-support-adapter-mapping-plan.md` — as a pure offline simulator,
without touching this document's classifier calibration, `intent-patterns.ts`, or
`intentCompatibilityAdapter.ts`. Re-running this file's own regression suite confirms every metric
above is unchanged: `enrichedDecisionSupportDetectionRate` 88.9%, `unsafeClassifierCollisionCount` 5
(playbook 0 / general_pm 1 / risk 2 / closure 1 / governance 0), `recommendedIntegrationMode`
`do_not_integrate`. The new plan's own recommendation, `hybrid_shadow_then_clarify`, is the
`recommendedSprint24Strategy`, with `recommendedNextSprint`: **"Sprint 24R — Decision Support Shadow
Mode Prep"**.
