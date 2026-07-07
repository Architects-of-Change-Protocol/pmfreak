# Decision Support Shadow Capture Storage Adapter Plan (Sprint 27R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R),
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R),
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md` (Sprint 23R),
> `docs/conversational-brain-decision-support-shadow-mode-prep.md` (Sprint 24R),
> `docs/conversational-brain-decision-support-shadow-capture-harness.md` (Sprint 25R), and
> `docs/conversational-brain-decision-support-shadow-storage-policy.md` (Sprint 26R). This file is the
> standalone design/results document for the storage **adapter plan** produced by Sprint 27R.

## Executive summary

Sprint 26R proved the Sprint 25R shadow capture harness's output is already storage-clean against a
strict, default-off field-classification policy, and reached `storageReadinessStatus:
"ready_for_storage_adapter_design"`. It explicitly left one thing undone: *what would the storage
adapter itself look like?*

Sprint 27R answers that with `decisionSupportShadowCaptureStorageAdapterPlan.ts`: a pure, offline,
deterministic **adapter plan/contract** — not a storage implementation. It:

1. Names and policy-gates every method a future adapter would have (`listDecisionSupportShadowStorageAdapterMethodPolicies()`)
   — three (`validatePolicy`, `mapCaptureRecordToStorageDraft`, `validateStorageDraft`) are implemented
   this sprint as pure functions; five (`writeCaptureDraft`, `deleteByCaptureId`, `deleteByWorkspace`,
   `purgeExpired`, `listByPolicyVersion`) are `futureOnly: true` — named only.
2. Proposes (never creates) a schema (`createDecisionSupportShadowStorageSchemaProposal()`): 21
   allowed/minimized/hashed columns for a `decision_support_shadow_captures` table, plus 22 explicitly
   prohibited columns.
3. Documents (never creates) a migration (`createDecisionSupportShadowStorageMigrationProposal()`):
   preconditions, prohibited contents, rollback requirements, deletion requirements — a plain
   TypeScript object, not a migration or SQL file.
4. Maps a real Sprint 25R capture record to a policy-clean storage draft
   (`mapDecisionSupportCaptureRecordToStorageDraft()`), reusing the Sprint 26R storage policy.
5. Validates that draft against 23 gates (`validateDecisionSupportShadowStorageDraft()`).
6. Simulates the adapter's contract with a no-op (`simulateDecisionSupportShadowStorageAdapter()`) —
   never a real or even fake write.
7. Evaluates the full pipeline over the Sprint 18R corpus
   (`runDecisionSupportShadowStorageAdapterPlanEvaluation()` /
   `summarizeDecisionSupportShadowStorageAdapterPlanEvaluation()`).

| Metric | Value |
|---|---|
| `totalCaptureRecords` / `totalDraftsCreated` (Sprint 18R corpus, dry_run) | 79 / 79 |
| `validDraftRate` / `invalidDraftCount` | 100% / 0 |
| `writeAttemptedCount` / `realPersistenceAttemptedCount` / `dbWriteAttemptedCount` / `supabaseWriteAttemptedCount` | 0 / 0 / 0 / 0 |
| `rawInputIncludedCount` / `inputPreviewIncludedCount` / `fullCandidateIncludedCount` / `userVisibleOutputIncludedCount` | 0 / 0 / 0 / 0 |
| `projectNameIncludedCount` / `emailAddressIncludedCount` / `phoneNumberIncludedCount` | 0 / 0 / 0 |
| `schemaProposalColumnCount` / `prohibitedColumnCount` | 21 / 22 |
| `migrationCreated` / `tableCreated` / `storageAdapterRealImplemented` | false / false / false |
| `readinessStatus` (dry_run only / with test_only_in_memory pass) | `ready_for_noop_adapter_implementation` / `ready_for_fake_adapter_implementation` |
| `recommendedNextSprint` | **"Sprint 28R — Shadow Capture Storage Adapter Fake Implementation"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no real feature flag was created or activated, no database or
Supabase call was ever made, no migration, SQL file, or table exists, and no real (or fake) storage
adapter exists.

## What problem this solves

1. **What interface a future storage adapter would have** —
   `listDecisionSupportShadowStorageAdapterMethodPolicies()`: 8 named methods, each with
   `allowedInSprint27`/`futureOnly`/`mustBeDefaultOff`/`mustNotWriteRealStorage`/
   `requiresPolicyValidation`/`requiresTenantIsolation`/`requiresAccessControl`/`requiresDeletionPath`.
2. **What input/output contract that adapter would use** — `DecisionSupportShadowStorageDraft`: a
   policy-clean, minimized shape produced by `mapDecisionSupportCaptureRecordToStorageDraft()`.
3. **How capture records would be validated against the Sprint 26R policy** —
   `validateDecisionSupportShadowStorageDraft()`: 23 gates, 15 blocking (structural/content
   invariants) and 8 informational (always-true-by-construction invariants like "no migration
   created").
4. **How capture records would map to storage drafts** — `mapDecisionSupportCaptureRecordToStorageDraft()`:
   whitelist-only field-by-field mapping, never a blind spread of the source record.
5. **What schema a future table would use** — `createDecisionSupportShadowStorageSchemaProposal()`.
6. **What migration a future implementation would document** —
   `createDecisionSupportShadowStorageMigrationProposal()`.
7. **What a fake/in-memory adapter would be acceptable as** — a contract simulator only:
   `simulateDecisionSupportShadowStorageAdapter()`, which never writes real data, `writeCaptureDraft`
   included.
8. **What gates block any real write today** — `storage_disabled`, `no_db_write`, `no_supabase_write`,
   `migration_not_created`, `table_not_created`, `adapter_not_real` all pass by construction.
9. **What must exist before Sprint 28R** — see "Criterio para pasar a Sprint 28R" below.
10. **What tests must pass before a fake implementation, and before a real one** — see "Verification"
    below.

## What this does NOT solve yet

- **Does not implement a real or fake storage adapter.** `storageAdapterRealImplemented` is a literal
  `false`; `simulateDecisionSupportShadowStorageAdapter()` is a contract simulation, not an adapter.
- **Does not create a migration, SQL file, or table.** `migrationCreated`/`tableCreated` are literal
  `false`; `createDecisionSupportShadowStorageMigrationProposal()` returns a plain object, never a file.
- **Does not implement `writeCaptureDraft`, `deleteByCaptureId`, `deleteByWorkspace`, `purgeExpired`,
  or `listByPolicyVersion`.** All five are `futureOnly: true`, `allowedInSprint27: false`.
- **Does not call Supabase or a database.** No client is imported anywhere in this package tree.
- **Does not implement a real feature flag.** Reuses the Sprint 26R named-but-unimplemented
  `ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE` flag as-is.
- **Does not connect `decision_support` (or this plan) to the router or request path.**
- **Does not show any storage draft to a user, and does not persist any storage draft** outside this
  evaluation's in-process return value.
- **Does not harden** the Sprint 19R/22R/24R/25R/26R contracts this module reuses — all are reused
  exactly as-is.

## Baseline (Sprint 26R)

| Metric | Sprint 26R baseline |
|---|---|
| Golden corpus `compatibilityRate` | 72.5% |
| Sprint 17R `policyAlignedRate` / `currentSystemAcceptableRate` | 82.9% / 84.3% |
| Sprint 18R `currentSafeMappingRate` / `futureRouteAlreadySupportedRate` | 84.8% / 84.8% |
| Sprint 18R `requiresNewHandlerCount` / `requiresClarificationCount` | 45 / 24 |
| Sprint 19R/20R/21R `candidateHandlerSafeRate` | 100% |
| Sprint 20R/21R `shadowRoutableRate` | 40% |
| Sprint 21R `unsafeClassifierCollisionCount` | 5 |
| Sprint 22R `acceptableResponseRate` / `safetyPassRate` / `routeOptionsCoverageRate` | 100% / 100% / 100% |
| Sprint 22R `overQuestioningCount` | 0 |
| Sprint 23R `recommendedSprint24Strategy` | `hybrid_shadow_then_clarify` |
| Sprint 24R `shadowEligibleCount` / `decisionCandidateGeneratedCount` / `clarificationCandidateGeneratedCount` | 69 / 18 / 51 |
| Sprint 24R `existingRoutePreservedCount` / `blockedBySafetyGateCount` | 10 / 0 |
| Sprint 25R `acceptableCaptureRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| Sprint 25R retention/side-effect counts | all 0 |
| Sprint 26R `storageReadinessStatus` | `ready_for_storage_adapter_design` |
| Sprint 26R violation counts (raw/full/output/db/supabase/side-effect) | all 0 |
| Sprint 26R `captureHarnessCleanRate` / `blockingReadinessGateFailureCount` | 100% / 0 |
| Sprint 26R `recommendedNextSprint` | "Sprint 27R — Shadow Capture Storage Adapter Plan" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Why an adapter plan after the storage policy

Sprint 26R answered *what* is allowed into storage; Sprint 27R answers *how* it would get there. A
policy without a contract is not actionable — this sprint turns the policy into a concrete method
list, a draft shape, a schema proposal, and a migration proposal, while keeping every actual write
path (`writeCaptureDraft` and its siblings) `futureOnly`. This mirrors the same "propose, then
implement one sprint later" cadence Sprint 23R (adapter mapping plan) → Sprint 24R (shadow mode prep)
and Sprint 25R (capture harness) → Sprint 26R (storage policy) already used.

## Strict default-off adapter plan

`createDecisionSupportShadowStorageAdapterPlanProfile()` always returns
`profile: "strict_default_off_adapter_plan"` with:

| Field | Value |
|---|---|
| `storageEnabled` | `false` |
| `realPersistenceAllowed` | `false` |
| `storageAdapterImplemented` | `false` |
| `dbMigrationImplemented` | `false` |
| `tableCreated` | `false` |
| `supabaseWriteImplemented` | `false` |
| `productionRouteChanged` | `false` |

These seven fields never vary with `mode` — literal constants, not computed values.

## Adapter method policies

| Method | `allowedInSprint27` | `futureOnly` |
|---|---|---|
| `validatePolicy` | true | false |
| `mapCaptureRecordToStorageDraft` | true | false |
| `validateStorageDraft` | true | false |
| `writeCaptureDraft` | false | true |
| `deleteByCaptureId` | false | true |
| `deleteByWorkspace` | false | true |
| `purgeExpired` | false | true |
| `listByPolicyVersion` | false | true |

`writeCaptureDraft` additionally requires tenant isolation, access control, and a deletion path
(`requiresTenantIsolation`/`requiresAccessControl`/`requiresDeletionPath` all `true`) — none of which
this sprint builds.

## Schema proposal

`createDecisionSupportShadowStorageSchemaProposal()` proposes (never creates) a
`decision_support_shadow_captures` table with `status: "proposal_only"`,
`migrationCreated`/`tableCreated: false`.

### Allowed columns (21)

`capture_id`, `source_run_id_hash`, `generated_at`, `mode`, `sink_kind`, `input_hash`,
`architecture_category`, `desired_future_route`, `target_kind`, `source_status`,
`source_candidate_kind`, `capture_status`, `candidate_summary_json_minimized`, `safety_snapshot_json`,
`gate_summary_json_minimized`, `audit_summary_json`, `all_blocking_gates_passed`, `policy_version`,
`retention_mode`, `retention_expires_at`, `deletion_required`.

### Prohibited columns (22)

`raw_input`, `input`, `input_preview`, `full_input`, `prompt`, `original_user_text`,
`full_decision_candidate`, `full_clarification_candidate`, `decision_response_text`,
`clarification_response_text`, `recommendation_text`, `user_visible_output`, `project_name`,
`email_address`, `phone_number`, `recent_messages`, `conversation_messages`, `raw_evidence`,
`raw_email_body`, `raw_meeting_transcript`, `raw_document_content`, `raw_customer_data`.

### Required indexes / constraints

5 required indexes (capture_id, input_hash, policy_version, generated_at, retention_expires_at) and 7
required constraints (no nullable capture_id/input_hash/policy_version, no raw payload columns,
`deletion_required` must be true, `storage_enabled` must default false, feature flag must remain
default false).

## Migration proposal, proposal only

`createDecisionSupportShadowStorageMigrationProposal()` returns `status: "proposal_only"`,
`migrationFileCreated: false`, `migrationShouldNotBeCreatedInSprint27: true`,
`proposedMigrationName: "add_decision_support_shadow_captures_default_off"`. It documents 11 required
preconditions, 8 prohibited migration contents, 4 rollback requirements, and 5 deletion requirements —
all as plain string arrays on a TypeScript object, never a `.sql` file.

## Storage draft contract

`DecisionSupportShadowStorageDraft`: `kind`, `draftId`, `sourceCaptureId`, `policyVersion`,
`storageAdapterPlanProfile`, `storageEnabled: false`, `realPersistenceAllowed: false`,
`proposedTableName`, `fields` (the 20 allowed/minimized fields), `excludedFields` (documents every
forbidden field name), `policyAssessmentSummary` (7 literal-true exclusion flags), and `warnings`.

## Storage draft mapper

`mapDecisionSupportCaptureRecordToStorageDraft()` is a **whitelist mapper**: it reads only the known
fields off a Sprint 25R `DecisionSupportShadowCaptureRecord` and writes only the known fields onto the
draft — it never spreads the source record, so an unexpected extra key on the source (e.g. a bug that
adds a `rawInput` field to a capture record) is never copied onto the draft either. `sourceRunId` is
hashed (never carried raw); `candidateSummary`/`gateSummary`/`auditSummary` are minimized objects;
`retentionExpiresAt` is always `null` and `deletionRequired` is always `true`.

## Storage draft validation gates

23 gates in `validateDecisionSupportShadowStorageDraft()`:

- **Blocking (15):** `storage_disabled`, `policy_profile_attached`, `policy_version_attached`,
  `no_raw_input`, `no_input_preview`, `no_full_candidate`, `no_user_visible_output`,
  `no_project_name`, `no_email_address`, `no_phone_number`, `candidate_summary_minimized`,
  `safety_snapshot_only`, `audit_summary_only`, `retention_policy_attached`,
  `deletion_policy_attached`.
- **Informational (8):** `schema_proposal_only`, `migration_not_created`, `table_not_created`,
  `adapter_not_real`, `no_db_write`, `no_supabase_write`, `router_unchanged`,
  `adapter_mapping_unchanged` — always true by this module's own construction.

## No-op adapter simulation

`simulateDecisionSupportShadowStorageAdapter()` validates a draft and reports `noopWriteAccepted` only
if every blocking gate passes. `writeAttempted`/`realPersistenceAttempted`/`dbWriteAttempted`/
`supabaseWriteAttempted` are all literal `false` unconditionally — this is a contract simulation, not
a real or even fake adapter.

## Evaluation metrics and results

`runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES)` +
`summarizeDecisionSupportShadowStorageAdapterPlanEvaluation()` against the Sprint 18R corpus (79
cases, via the Sprint 25R harness in `dry_run`):

- `totalCaptureRecords` / `totalDraftsCreated`: 79 / 79
- `validDraftRate` / `invalidDraftCount`: 100% / 0
- `writeAttemptedCount` / `realPersistenceAttemptedCount` / `dbWriteAttemptedCount` /
  `supabaseWriteAttemptedCount`: 0 / 0 / 0 / 0
- Every forbidden-field inclusion count (raw input, input preview, full candidate, user-visible
  output, project name, email address, phone number): 0
- `migrationCreated` / `tableCreated` / `storageAdapterRealImplemented`: false / false / false
- `readinessStatus`: `ready_for_noop_adapter_implementation` (dry_run only) or
  `ready_for_fake_adapter_implementation` (when a `test_only_in_memory` pass is included)
- `recommendedNextSprint`: "Sprint 28R — Shadow Capture Storage Adapter Fake Implementation"
- `representativeValidDrafts`: non-empty; `weakDrafts` / `blockingValidationFailures`: empty

## Why no real storage exists yet

- **No DB:** no tenant isolation, access control, or deletion path exists yet — writing to a real
  database today would create ungoverned, undeletable data.
- **No migration:** a migration presumes a settled, reviewed schema and a real rollback path; this
  sprint proposes the schema and documents the migration's requirements, nothing more.
- **No Supabase storage:** no Supabase client is imported anywhere in this package tree.
- **No real (or fake) storage adapter:** `writeCaptureDraft` and its siblings remain `futureOnly` —
  named and policy-gated, not implemented.
- **No repository:** a repository presumes a real adapter exists underneath it.

## Criterio para pasar a Sprint 28R

1. `validDraftRate` stays at 100% and every forbidden-field inclusion count stays at 0 against the
   Sprint 18R corpus, in both `dry_run` and `test_only_in_memory` passes.
2. `blockingValidationFailures` stays empty.
3. `readinessStatus` reaches `ready_for_fake_adapter_implementation`.
4. All regression suites (Sprint 17R-26R + golden) stay unchanged.

## Verification

Ran:

```
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-adapter-plan.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-policy.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-capture-harness.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mode-prep.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs
npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs
npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs
npx tsx --test tests/conversational-brain-intent-classifier.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs
npm run lint:aoc-boundaries
```

All green (858 assertions across the full related suite; 90 in this sprint's own file). `tsc --noEmit`
surfaces only pre-existing, unrelated failures elsewhere in the repository (missing `react`/`next`/
`stripe`/`@supabase/*`/`@types/node` type declarations) — none reference any Sprint 27R file.

Nothing in this sprint touched `POST /api/command-center/chat`, the router, the composer, any
production handler, `intentCompatibilityAdapter.ts`, `intentClassifier.rules.ts`, or
`intent-patterns.ts`. No database, migration, SQL file, table, storage adapter, or repository was
created. No feature flag was activated. No email/task/draft/execution ever happened. No shadow output
was shown to or persisted for a user. Recommendation: **Sprint 28R — Shadow Capture Storage Adapter
Fake Implementation**.

## Sprint 28R note

Sprint 28R built `decisionSupportShadowCaptureStorageFakeAdapter.ts`, a fake (in-memory-only)
implementation of the five `futureOnly` methods this plan named (`writeCaptureDraft` ->
`writeDraft`/`deleteByCaptureId`/`deleteByWorkspace`/`purgeExpired`/`listByPolicyVersion`), reusing
`mapDecisionSupportCaptureRecordToStorageDraft()`, `validateDecisionSupportShadowStorageDraft()`, and
`runDecisionSupportShadowStorageAdapterPlanEvaluation()` from this module exactly as-is. This
document's own 90-test suite still passes unchanged: `validDraftRate` 100%, `invalidDraftCount` 0,
`readinessStatus` still reaches `ready_for_fake_adapter_implementation` with a `test_only_in_memory`
pass, `recommendedNextSprint` still reads "Sprint 28R — Shadow Capture Storage Adapter Fake
Implementation". Sprint 28R did not modify `decisionSupportShadowCaptureStorageAdapterPlan.ts` or
`decisionSupportShadowCaptureStorageAdapterPlanTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md` for the full fake adapter.

---

## Nota — Sprint 29R

Sprint 29R creó una **Persistence Readiness Review**
(`docs/conversational-brain-decision-support-shadow-persistence-readiness.md`). No cambió producción.
No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó un loop de clarificación persistente. No
conectó `decision_support` al router. Decisión explícita: `do_not_build_real_persistence_yet`. Siguiente
sprint recomendado: **Sprint 30R — Controlled Shadow Replay Evaluation**.


---

## Nota — Sprint 30R

Sprint 30R creó una **Controlled Shadow Replay Evaluation**
(`docs/conversational-brain-decision-support-shadow-controlled-replay.md`), replayando el corpus del
Sprint 18R (79 casos) tres veces a través del pipeline shadow existente usando unicamente el fake
adapter del Sprint 28R. No cambió producción. No cambió routing. No activó ningún feature flag. No creó
DB/migrations/tables/SQL files. No creó storage adapter real. No creó repository real. No implementó un
loop de clarificación persistente. No conectó `decision_support` al router. Decisión explícita:
`ready_for_clarification_gated_integration_plan`. Siguiente sprint recomendado: **Sprint 31R —
Clarification-Gated Decision Support Integration Plan**.


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

