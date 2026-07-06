# Golden Intent Evaluation Set — Quick Reference (Sprint 11R)

> Full context, rationale, and the current baseline numbers live in the Sprint 11R section (§11) of
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

## Next steps (Sprint 12R candidate work)

Use `report.byCategory` and `report.topDifferences` to prioritize which classifier's pattern list
(`intentClassifier.rules.ts` for production, `intent-patterns.ts` for the enriched classifier) or
which row of the adapter's mapping table (`intentCompatibilityAdapter.ts`) needs adjustment next —
see §11.7 of the reconciliation doc for the full criteria before proposing any router/handler change.
