# Golden Intent Evaluation Set — Quick Reference (Sprint 11R, calibrated in Sprint 12R/13R)

> Full context, rationale, and the current baseline numbers live in the Sprint 11R (§11),
> Sprint 12R (§12), and Sprint 13R (§13) sections of
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

## Next steps (Sprint 14R candidate work)

Use `report.byCategory` and `report.topDifferences` to prioritize which classifier's pattern list
(`intentClassifier.rules.ts` for production, `intent-patterns.ts` for the enriched classifier) or
which row of the adapter's mapping table (`intentCompatibilityAdapter.ts`) needs adjustment next.
`governance_audit` (40%), `risk_issue_dependency` (30%), and `general_pm_advice` (30%) are now the
largest remaining gaps below the 85% staging threshold — `general_pm_advice` likely also needs a
design review for overlap with `playbook_analysis`/`decision_support`, not just vocabulary. See
§13.7 of the reconciliation doc for the full criteria before proposing any router/handler change.
