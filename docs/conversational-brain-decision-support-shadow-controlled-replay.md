# Sprint 30R — Decision Support Controlled Shadow Replay Evaluation

## Executive summary

Sprint 30R replays the Sprint 18R corpus (79 cases) through the existing Sprint 24R-28R shadow
pipeline — shadow mode prep → capture harness → storage policy assessment → storage draft mapping →
draft validation → a fresh, per-pass Sprint 28R fake (in-memory, test-only) adapter write — three times
per case, to prove the pipeline is **deterministic**, its decisions **stable**, and every layer **safe**
across repeated runs. It implements no new persistence, storage adapter, or router wiring. It is a
**controlled shadow replay evaluation**, not a new capability.

Result:

- profile: `strict_fake_adapter_controlled_replay`
- mode: `multi_pass_replay`
- replayPasses: `3`
- totalCases: `79`
- totalPassResults: `237`
- deterministicReplayRate: `100`
- safeReplayRate: `100`
- fakeWriteAcceptedRate: `100`
- every real-persistence/DB/Supabase/external-call/user-visible-output/production-wiring count: `0`
- every forbidden-retention count: `0`
- decision: `ready_for_clarification_gated_integration_plan`
- recommendedNextSprint: `Sprint 31R — Clarification-Gated Decision Support Integration Plan`

## Qué problema resuelve

Sprints 24R-28R each proved their own layer clean **once**, against a single evaluation run. Sprint
29R then asked the harder question — "is PMFreak ready to move toward real persistence?" — and answered
"not yet" (`do_not_build_real_persistence_yet`) because 13 of 19 readiness domains (tenant isolation,
access control, deletion/retention, audit, observability, rollback, security review, DSR policy, and
more) are simply not built. Sprint 30R answers a narrower, complementary question that sits entirely
within what already exists: **does replaying the existing pipeline multiple times produce the same
decision, the same safety outcome, and the same fake-adapter acceptance every time?** If the pipeline
were flaky — if the same input sometimes classified differently, sometimes failed a gate, or
occasionally got its fake write rejected — that would be a serious problem to find *before* any
integration planning, not after.

Concretely, this sprint answers:

- Is the shadow pipeline deterministic when replaying the same corpus?
- Are its routing decisions stable between runs?
- Do capture records and storage drafts stay policy-clean across repeats?
- Does the fake adapter keep accepting every real draft and rejecting every invalid one?
- Is there any drift between runs?
- Is there any regression against the Sprint 24R-29R baseline?
- Which cases are replay-safe (ready for a future clarification-gated route)?
- Which cases require clarification gating specifically?
- Which cases must stay unsupported?
- Are we ready to *design* (not build) a clarification-gated integration plan?

## Qué NO resuelve todavía

- No decides whether decision_support should ever be wired to the router.
- No implements a clarification loop, gated or otherwise.
- No changes anything about the Sprint 29R readiness gaps (tenant isolation, access control,
  retention, audit, observability, rollback, security review, DSR policy) — those remain exactly as
  documented in Sprint 29R.
- No introduces a new storage adapter, real or fake — it reuses the Sprint 28R fake adapter exactly
  as-is, creating a fresh instance per pass.
- No shows anything to a user, ever.

## Baseline Sprint 29R

Sprint 29R's persistence readiness review, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_default_off_persistence_readiness_review`
- mode: `review_only`
- domains assessed: `19`
- ready domains: `6`
- partially_ready domains: `6`
- not_ready domains: `7`
- blocked domains: `0`
- blockerCount: `17`
- criticalBlockerCount: `7`
- blockingBlockerCount: `9`
- warningBlockerCount: `1`
- readinessScore: `62.9 / 100`
- decision: `do_not_build_real_persistence_yet`
- realPersistenceAllowedNow / migrationFileAllowedNow / sqlFileAllowedNow: `false`
- recommendedNextSprint: `Sprint 30R — Controlled Shadow Replay Evaluation`

`runDecisionSupportShadowControlledReplayEvaluation()` recomputes this exact review (via
`buildDecisionSupportShadowPersistenceReadinessReview()` / `summarizeDecisionSupportShadowPersistenceReadinessReview()`,
reused unchanged) against the same corpus and exposes it as `persistenceReadinessSummary`, so this
sprint's own test suite can assert the numbers above have not moved.

## Why controlled shadow replay after persistence readiness

Sprint 29R's own decision matrix names exactly one allowed next action that doesn't require building
anything new: *"Run a controlled shadow replay using the fake adapter."* Everything else it allows
(designing tenant isolation, access control, a DSR policy, deletion/purge, retention enforcement,
rollback, observability, a security review checklist) is design work with no code to write yet.
Controlled shadow replay is the one action that *can* be executed immediately, using only what already
exists, and it produces evidence — determinism/safety/write-acceptance rates — that Sprint 31R's
integration plan can cite directly.

## Replay config

```ts
type DecisionSupportShadowControlledReplayConfig = {
  profile: "strict_fake_adapter_controlled_replay";
  mode: DecisionSupportShadowControlledReplayMode;
  replayPasses: number;
  allowFakeAdapterWrites: boolean;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowUserVisibleOutput: false;
  allowProductionWiring: false;
  requireCapturePolicyClean: true;
  requireStorageDraftValid: true;
  requireFakeAdapterSafety: true;
  requireDeterministicOutputs: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportShadowControlledReplayConfig()` defaults to `mode: "multi_pass_replay"`,
`replayPasses: 3`, `allowFakeAdapterWrites: true`, and forces the six `allow*` real-side-effect fields
to `false` **regardless of what a caller's override object claims** — mirroring how the Sprint 28R fake
adapter's own config never actually loosens its four `allow*` real-side-effect flags from an override.
The four `require*` fields are always `true`.

## Replay modes

- `single_pass_replay` — one pass over the corpus.
- `multi_pass_replay` (default) — `replayPasses` (default 3) independent passes, each against its own
  fresh fake adapter instance.
- `determinism_check` — emphasizes cross-pass field agreement.
- `drift_check` — emphasizes per-case `driftReasons` and `stabilityStatus`.
- `safety_regression_check` — emphasizes `finalSafetyStatus` and `unsafeCases` against the Sprint
  24R-29R baseline.

These are documentation-level modes on the config object; every exported function behaves the same
regardless of `mode` — `mode` records *intent*, it does not gate behavior differently in this sprint.

## Replay corpus

This module ships only a small, self-contained synthetic default corpus (three cases), mirroring how
Sprint 29R's own `createDecisionSupportShadowPersistenceReadinessInputMetrics()` never imports from
`tests/fixtures/`. Callers who want the full Sprint 18R corpus's documented numbers (79 cases, 237 pass
results at 3 passes) pass `DECISION_CLARIFICATION_CASES` (from
`tests/fixtures/conversational-brain-decision-clarification-cases.ts`) explicitly — exactly as Sprint
29R's own test suite does.

## Replay pass pipeline

For every case, on every pass:

1. `prepareDecisionSupportShadowModeRun()` (Sprint 24R) — decide the candidate/route.
2. `captureDecisionSupportShadowRun()` in `dry_run` mode (Sprint 25R) — build a minimized capture
   record.
3. `runDecisionSupportShadowStoragePolicyEvaluation()` (Sprint 26R) — assess the capture against the
   storage policy.
4. `mapDecisionSupportCaptureRecordToStorageDraft()` (Sprint 27R) — map to a policy-clean storage
   draft.
5. `validateDecisionSupportShadowStorageDraft()` (Sprint 27R) — validate the draft.
6. `writeDecisionSupportShadowStorageDraftToFakeAdapter()` against a fresh (or injected) Sprint 28R
   fake adapter — fake-write the draft.
7. Classify the case (`classifyDecisionSupportShadowControlledReplayCase()`), compute a safety status,
   recommend a route (`recommendDecisionSupportShadowControlledReplayRoute()`), and record every
   side-effect/forbidden-retention field as a literal `false`.

Every side effect (`sideEffects.*`) and forbidden-retention flag (`forbiddenRetention.*`) on a
`DecisionSupportShadowControlledReplayPassResult` is a literal `false`, matching the same
"structurally guaranteed, never computed" convention as
`DecisionSupportShadowCaptureRecord.rawInputRetained` (Sprint 25R) — a real forbidden-content
violation is detected separately (via the Sprint 27R draft-validation gates) and folded into
`safetyStatus` instead.

## Determinism check

`aggregateDecisionSupportShadowControlledReplayCaseResults()` groups pass results by `caseId` and
compares, across every pass of a case: `category`, `inputHash`, `architectureCategory`,
`desiredFutureRoute`, `targetKind`, `capturePolicyClean`, `storageDraftValid`, `fakeWriteStatus`,
`fakeWriteAccepted`, `routeRecommendation`, and `safetyStatus`. Any disagreement marks the case
`stable: false` and lists every disagreeing field in `driftReasons`.

## Drift check

`stabilityStatus` is:

- `stable` — zero `driftReasons`.
- `not_deterministic` — `inputHash` itself disagreed between passes (the pipeline should never hash
  the same input two different ways).
- `major_drift` — a safety-relevant field disagreed (`capturePolicyClean`, `storageDraftValid`,
  `fakeWriteStatus`, `fakeWriteAccepted`, or `safetyStatus`).
- `minor_drift` — any other field disagreed.

## Safety regression check

Each case's `finalSafetyStatus` is the **worst** status observed across its passes (`blocked` >
`unsafe` > `warning` > `safe`) — a single unsafe/blocked pass is enough to mark the whole case unsafe,
since determinism cannot be assumed once any pass disagrees. `safetyStatus` on an individual pass
result is derived purely from structural pipeline outcomes:

- `unsafe` — a forbidden-content draft-validation gate failed (raw input, a full candidate,
  user-visible output, a project name, an email, or a phone number was detected on the draft).
- `blocked` — the capture failed the storage-policy assessment, the storage draft failed validation,
  or the fake adapter rejected the write.
- `safe` — otherwise.

Note: `safetyStatus` is **never** derived from the mere presence of a non-empty `warnings` array.
Sprint 19R/24R/26R already attach routine, expected informational warnings to every successful run
(e.g. "no concrete options detected — every option returned is a generic placeholder", "inputPreview
requires an explicit policy exception") that do not indicate an actual policy violation. Treating any
non-empty `warnings` array as unsafe would make every real corpus case look unsafe, which would defeat
the purpose of this check. `"warning"` remains a reachable value of the safety-status type for callers
of `recommendDecisionSupportShadowControlledReplayRoute()` that pass it in directly (e.g. hand-built
synthetic aggregates in tests) — the replay pass itself never produces it.

Beyond per-case safety, the evaluation additionally recomputes the Sprint 28R fake adapter's own
evaluation (`runDecisionSupportShadowStorageFakeAdapterEvaluation()` /
`summarizeDecisionSupportShadowStorageFakeAdapterEvaluation()`, reused unchanged) against the same
corpus as `fakeAdapterBaselineSummary`, to prove the fake adapter's write/reject behavior — including
its 11 synthetic invalid-draft rejection checks — has not regressed.

## Fake adapter write validation

Every valid, policy-clean draft is fake-written via a fresh, per-pass Sprint 28R fake adapter instance
and expected to be accepted (`fakeWriteStatus: "fake_write_accepted"`). A synthetic invalid draft
(exercised directly in this sprint's own test suite by building a real draft via the pipeline and then
forcing `storageEnabled: true`/`realPersistenceAllowed: true` on a clone) is expected to be rejected
(`"fake_write_rejected"`, `status: "rejected_by_policy"`) — proving the fake adapter's own rejection
behavior has not regressed. No synthetic invalid draft is ever injected into the main corpus replay
pass — the corpus itself is expected to be, and is, 100% valid.

## Route recommendation logic

`recommendDecisionSupportShadowControlledReplayRoute()`:

1. `decision_candidate` + `safe` → `clarification_gated_decision_support`, `requiresClarificationGate: true`.
2. `clarification_candidate` (any category, otherwise clean) → `clarification_gated_decision_support`,
   `requiresClarificationGate: true`.
3. `existing_route_preserved` → `keep_existing_route`, `shouldUseExistingRoute: true`.
4. `unsupported_or_not_applicable` → `keep_unsupported`, `shouldRemainUnsupported: true`.
5. **Drift** (`stable: false` / non-empty `driftReasons`) **or** a non-`safe` safety status
   (`warning`/`unsafe`/`blocked`) → `shadow_only`, `shouldRemainShadowOnly: true` — overriding every
   other rule. A replay that is not proven stable and safe must never be recommended for
   clarification-gated integration, or for keeping an existing/unsupported route, since either of those
   recommendations asserts a stronger guarantee than an unstable/unsafe replay can back up.

Against the real Sprint 18R corpus: 45 `decision_candidate` + 24 `clarification_candidate` cases →
`clarification_gated_decision_support` (69 total); 10 `existing_route_preserved` cases →
`keep_existing_route`; 0 `unsupported_or_not_applicable` cases (the corpus has none); 0 `shadow_only`
(no drift, no safety concern observed).

## Summary metrics

`summarizeDecisionSupportShadowControlledReplayEvaluation()` accepts either a full
`runDecisionSupportShadowControlledReplayEvaluation()` result or a bare
`DecisionSupportShadowControlledReplayCaseAggregate[]` (plus `options.passResults`/`options.replayPasses`),
and reports: case/pass counts, determinism/safety/fake-write rates, per-route-recommendation counts,
every side-effect and forbidden-retention count (all expected `0`), a decision, and a recommended next
sprint.

## Decisión

```
allClean =
  deterministicReplayRate === 100 &&
  safeReplayRate === 100 &&
  fakeWriteAcceptedRate === 100 &&
  every real-persistence/DB/Supabase/external-call/user-visible-output/production-wiring count === 0 &&
  every forbidden-retention count === 0

if (allClean && fake-adapter baseline not regressed) -> ready_for_clarification_gated_integration_plan
else if (any case unstable)                          -> blocked_by_replay_drift
else if (any case unsafe)                            -> blocked_by_safety_regression
else if (any fake write rejected, or fake-adapter baseline regressed) -> blocked_by_fake_adapter_regression
else                                                  -> continue_shadow_replay_only
```

Against the Sprint 18R corpus: `decision: ready_for_clarification_gated_integration_plan`.

## Siguiente sprint recomendado

`Sprint 31R — Clarification-Gated Decision Support Integration Plan`.

## Por qué no se creó DB

Sprint 29R already found tenant isolation, access control, a real deletion/purge/retention path, an
audit trail policy, observability, a tested rollback plan, a security review, and a DSR policy all
missing. None of that changes because a replay proved the existing shadow pipeline deterministic —
writing to a real database today would still create ungoverned, undeletable, unauditable data.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by running a
replay — `migrationShouldNotBeCreatedInSprint27` (still true through Sprint 30R) is unaffected.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and no tenant isolation or access control
exists to govern a Supabase write — unchanged from Sprint 26R-29R.

## Por qué no se creó storage adapter real

This sprint proves the *existing* Sprint 28R fake adapter's behavior is stable across replays — it
does not build a new or real adapter. Every write in this sprint lands in a fresh, per-pass, in-process
fake adapter instance that disappears when the pass completes.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this sprint does not build.

## Por qué no se conectó producción

This module reuses the existing, already-isolated Sprint 24R-29R modules exactly as-is. It is not
imported by `intentCompatibilityAdapter.ts`, `brainRouter.ts`, `responseComposer.ts`, any
`handlers/*.ts`, or `POST /api/command-center/chat`, and adds no new import into any of those files.
`src/lib/playbook-engine/conversation/decision-support/index.ts` (this package's own barrel) exports
the new module, but that barrel is itself never re-exported from the production
`src/lib/playbook-engine/conversation/index.ts` barrel — a fact this sprint's own test suite asserts
directly, mirroring every prior sprint in this tree.

## Criterio para pasar a Sprint 31R

`deterministicReplayRate`, `safeReplayRate`, and `fakeWriteAcceptedRate` must all stay at `100%`, and
every forbidden-retention/side-effect count must stay at `0`, against the Sprint 18R corpus — which is
exactly what this sprint measured. Sprint 31R can then design a Clarification-Gated Decision Support
Integration Plan: still without implementing real persistence, without wiring the router, and without
showing anything to a user. The Sprint 29R prerequisites for *real persistence* specifically (tenant
isolation, access control, deletion/retention, audit, observability, rollback, security review, DSR
policy) remain untouched and still block any real persistence — Sprint 31R's integration plan is
explicitly scoped to *clarification-gated decision support*, not to persistence.

---

## Nota — Sprint 31R

Sprint 31R creó un **Clarification-Gated Decision Support Integration Plan**
(`docs/conversational-brain-decision-support-clarification-gated-integration-plan.md`), clasificando
los 79 casos del corpus Sprint 18R (vía el replay del Sprint 30R) en cuatro tipos de ruta de integración
y construyendo un contrato de ruta y requisitos de clarification gate para cada uno. No cambió
producción. No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files.
No creó storage adapter real. No creó repository real. No implementó un loop de clarificación
persistente. No conectó `decision_support` al router. No mostró output de `decision_support` al
usuario. Decisión explícita: `ready_for_user_visible_dry_run_plan`. Siguiente sprint recomendado:
**Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan**.

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
