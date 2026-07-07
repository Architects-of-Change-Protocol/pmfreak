# Decision Support Shadow Capture Storage Policy / Default-Off Persistence Plan (Sprint 26R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R),
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R),
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md` (Sprint 23R),
> `docs/conversational-brain-decision-support-shadow-mode-prep.md` (Sprint 24R), and
> `docs/conversational-brain-decision-support-shadow-capture-harness.md` (Sprint 25R). This file is
> the standalone design/results document for the storage policy produced by Sprint 26R.

## Executive summary

Sprint 25R proved a shadow capture harness can turn a Sprint 24R shadow-mode run into a minimized,
redacted capture record — offline, in `dry_run` or `test_only_in_memory` mode, never touching a real
database. It explicitly left one thing undone: *what would ever be allowed to reach real storage, and
under what conditions?* Sprint 25R's own evaluator recommended exactly this as its Sprint 26R
criterion.

Sprint 26R answers that with `decisionSupportShadowCaptureStoragePolicy.ts`: a pure, offline,
deterministic **policy** — not a storage implementation. It classifies every field a capture record
could carry into a future persistent store (`allowed` / `prohibited` /
`allowed_with_hashing` / `allowed_with_redaction` / `allowed_with_minimization` /
`allowed_only_test_memory` / `allowed_only_future_default_off` / `requires_explicit_policy_exception`),
defines a strict, currently-zero-retention retention policy and a hard-delete-only deletion policy,
and assembles a "default-off persistence plan" that *names* — but does not implement — a future
feature flag (`ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE`, default off). It then assesses real
Sprint 25R capture records (via the reused `runDecisionSupportShadowCaptureHarnessEvaluation()`)
against that policy to prove today's harness output is already storage-clean.

| Metric | Value |
|---|---|
| `totalCaptureRecords` / `assessedRecords` (Sprint 18R corpus) | 79 / 79 |
| `allowedFieldCount` / `prohibitedFieldCount` / `exceptionRequiredFieldCount` | 30 / 24 / 1 |
| `prohibitedFieldObservedCount` | 0 |
| `rawInputViolationCount` / `fullCandidateViolationCount` / `userVisibleOutputViolationCount` | 0 / 0 / 0 |
| `dbWriteViolationCount` / `supabaseWriteViolationCount` / `sideEffectViolationCount` | 0 / 0 / 0 |
| `retentionPolicyDefinedCount` / `deletionPolicyDefinedCount` | 79 / 79 |
| `captureHarnessCleanRate` | **100%** |
| `readinessGatePassRate` / `blockingReadinessGateFailureCount` | 81% / **0** |
| `storageReadinessStatus` | **`ready_for_storage_adapter_design`** |
| `recommendedNextSprint` | **"Sprint 27R — Shadow Capture Storage Adapter Plan"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no real feature flag was created or activated, no database or
Supabase call was ever made, no migration or table exists, and no storage adapter exists.

## What problem this solves

1. **Which fields would be allowed into future persistent storage, and under what transformation** —
   `classifyDecisionSupportShadowStorageField()` / `listDecisionSupportShadowStorageFieldPolicies()`.
2. **Which fields are prohibited forever** — an explicit 24-entry table (`rawInput`,
   `fullDecisionCandidate`, `userVisibleOutput`, `emailAddress`, `projectName`, `conversationMessages`,
   `responseText`, etc.) plus three dynamic fallback rules (`*Raw` suffix, `*full*candidate*`
   substring pair, `*responseText*` substring) and a safe default for any unrecognized field name.
3. **Which fields require an explicit policy exception** — `inputPreview` (high risk, not allowed in
   future persistent storage by default; allowed only in test memory).
4. **What retention applies today, and what a future proposal would look like** —
   `createDecisionSupportShadowStorageRetentionPolicy()`: `ephemeral_only`, 0 retention days today; a
   documented (never enabled) future proposal of 7/30 days once real prerequisites exist.
5. **What deletion policy applies** — `createDecisionSupportShadowStorageDeletionPolicy()`: hard
   delete only, deletable by capture id / workspace / policy version, purge-on-bug-detection for any
   raw payload or full candidate.
6. **What gates block any real persistence today** — 21 readiness gates (14 blocking, 5 warning, 2
   info); see "Readiness gates" below.
7. **What feature flag a future implementation would need** — named, not implemented:
   `ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE`, default `false`.
8. **What minimum audit trail must exist** — `audit_metadata_required` passes today because every
   Sprint 25R capture record already carries `auditMetadata`.
9. **How storage readiness is evaluated** —
   `runDecisionSupportShadowStoragePolicyEvaluation()` + `summarizeDecisionSupportShadowStoragePolicyEvaluation()`
   over the Sprint 18R corpus, reusing the Sprint 25R capture harness end-to-end.
10. **What Sprint 27R would need** — see "Criterio para pasar a Sprint 27R" below.

## What this does NOT solve yet

- **Does not implement a real storage/persistence layer.** No database, table, or file is ever
  created; `storageAdapterImplemented` is a literal `false`.
- **Does not create a migration.** `dbMigrationImplemented` is a literal `false`.
- **Does not call Supabase.** `supabaseWriteImplemented` is a literal `false`; no Supabase client is
  imported.
- **Does not implement a real feature flag.** `requiredFeatureFlagName` only documents the future
  flag's name; nothing reads `process.env` or any feature-flag service.
- **Does not implement tenant isolation, access control, or policy-version storage.** These are named,
  unsatisfied prerequisites (`tenant_isolation_required` / `access_control_required` /
  `policy_version_required` readiness gates), not built here.
- **Does not connect shadow capture (or this policy) to the router or request path.**
- **Does not show any capture record to a user, and does not persist any capture record** outside the
  Sprint 25R in-memory, test-only sink.
- **Does not harden** the Sprint 19R candidate handler, Sprint 22R clarification strategy, Sprint 24R
  shadow mode prep, or Sprint 25R capture harness — all four are reused exactly as-is.

## Baseline (Sprint 25R)

| Metric | Sprint 25R baseline |
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
| Sprint 24R `acceptableShadowPrepRunRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| Sprint 25R `acceptableCaptureRate` (dry_run and test_only_in_memory) | 100% / 100% |
| Sprint 25R `allBlockingGatesPassedRate` (dry_run and test_only_in_memory) | 100% / 100% |
| Sprint 25R retention/side-effect counts | all 0 |
| Sprint 25R `recommendedNextSprint` | "Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Strict default-off policy

`createDecisionSupportShadowStoragePolicyProfile()` / `createDecisionSupportShadowDefaultOffPersistencePlan()`
always return `profile: "strict_default_off"` with:

| Field | Value |
|---|---|
| `persistenceDefaultEnabled` | `false` |
| `requiresFeatureFlag` | `true` |
| `requiredFeatureFlagName` | `"ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE"` |
| `featureFlagDefault` | `false` |
| `storageAdapterImplemented` | `false` |
| `dbMigrationImplemented` | `false` |
| `supabaseWriteImplemented` | `false` |
| `productionRouteChanged` | `false` |

These eight fields never vary with mode, corpus, or evaluation results — they are literal constants,
identical to how Sprint 24R/25R's own `isDefaultOff`/`dbWriteAttempted` flags are literal constants,
not computed values.

## Field classification

`classifyDecisionSupportShadowStorageField(fieldName)` is a pure function of the field name: it looks
up a 55-entry known-field table (30 allowed-family entries + 24 prohibited entries [+1 exception-only
entry, `inputPreview`]), then falls back to three dynamic rules, then a safe default. `value` is
accepted for future observation-based auditing but never changes the classification.

### Allowed fields (30) — with required transformation

| Decision | Fields | Transformation |
|---|---|---|
| `allowed` (17) | `captureId`, `generatedAt`, `mode`, `sinkKind`, `rawInputRetained`, `fullDecisionCandidateRetained`, `fullClarificationCandidateRetained`, `userVisibleOutputRetained`, `architectureCategory`, `desiredFutureRoute`, `targetKind`, `sourceStatus`, `sourceCandidateKind`, `captureStatus`, `safetySnapshot`, `auditMetadata`, `allBlockingGatesPassed`, `dbWriteAttempted`, `supabaseWriteAttempted`, `shouldExecuteAction`, `shouldSendEmail`, `shouldCreateTask`, `shouldWriteToDb`, `shouldReturnCandidateToUser`, `shouldPersistShadowResult` | None — persisted as-is. |
| `allowed_with_hashing` (2) | `inputHash`, `sourceRunId` | Hash before persisting. |
| `allowed_with_minimization` (2) | `candidateSummary`, `gateResults` | Keep reduced to structural counts/labels only. |
| `allowed_with_redaction` (1) | `warnings` | Redact any potentially sensitive substring before persisting. |

### Exception-required field (1)

- **`inputPreview`** — `requires_explicit_policy_exception`, risk `high`. A sanitized/redacted/
  truncated preview is still derived from real PM conversation content. **Not allowed in future
  persistent storage by default** — allowed only in test memory, and only with an explicit, documented
  policy exception for any real persistence.

### Prohibited fields (24, explicit table)

`rawInput`, `input`, `fullInput`, `prompt`, `originalUserText`, `fullDecisionCandidate`,
`fullClarificationCandidate`, `decisionCandidate.responseText`,
`decisionCandidate.recommendationText`, `decisionCandidate.fullRecommendation`,
`clarificationCandidate.responseText`, `userVisibleOutput`, `emailAddress`, `phoneNumber`,
`projectName`, `conversationMessages`, `recentMessages`, `attachedContextRaw`, `rawEvidence`,
`rawEmailBody`, `rawMeetingTranscript`, `rawDocumentContent`, `rawCustomerData`, `responseText`.

### Dynamic fallback rules (fields not in the table)

1. Field name ends with `"Raw"` → `prohibited`, `critical`.
2. Field name contains `"responseText"` (case-insensitive) → `prohibited`, `critical`.
3. Field name contains both `"full"` and `"candidate"` (case-insensitive) → `prohibited`, `critical`.
4. Otherwise → `requires_explicit_policy_exception`, `high` — **an unrecognized field is never
   silently allowed.**

## Retention policy

`createDecisionSupportShadowStorageRetentionPolicy()`:

| Field | Value |
|---|---|
| `retentionMode` | `"ephemeral_only"` |
| `defaultRetentionDays` | `0` |
| `maximumRetentionDays` | `0` |
| `deletionRequired` | `true` |
| `deletionTrigger` | `"ttl_expiry"` |
| `requiresDeletionAudit` | `true` |

`notes` documents (never enables) a future proposal: `defaultRetentionDays: 7` /
`maximumRetentionDays: 30`, gated on a real feature flag, a storage adapter, a deletion job, stored
policy versioning, tenant isolation, and an admin purge path all existing first.
`persistenceDefaultEnabled` stays `false` regardless of any future retention-day proposal.

## Deletion policy

`createDecisionSupportShadowStorageDeletionPolicy()`:

| Field | Value |
|---|---|
| `hardDeleteRequired` | `true` |
| `softDeleteAllowed` | `false` |
| `deletionAuditMetadataOnly` | `true` |
| `deleteByCaptureIdRequired` | `true` |
| `deleteByWorkspaceRequired` | `true` |
| `deleteByPolicyVersionRequired` | `true` |
| `deleteRawPayloadIfEverIntroduced` | `true` |

`notes` documents: any raw payload or full candidate that ever appears via a future bug must be
purged (not merely flagged); a purge path must exist and be testable **before** a storage prototype is
built, not added afterward; deletion audit records may retain only metadata, never the deleted
record's own content.

## Default-off feature flag plan

`requiredFeatureFlagName: "ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE"`, `featureFlagDefault:
false` — named only. No config file, environment variable, or feature-flag service reads, creates, or
evaluates it anywhere in this sprint's code.

## Readiness gates (21)

| Gate | Severity | Passes today because |
|---|---|---|
| `storage_default_off` | blocking | `persistenceDefaultEnabled` is a literal `false`. |
| `no_db_migration` | blocking | No migration file exists or is created. |
| `no_storage_adapter` | blocking | `storageAdapterImplemented` is a literal `false`. |
| `no_supabase_write` | blocking | `supabaseWriteImplemented` is a literal `false`; no Supabase client is imported. |
| `no_raw_input` | blocking | Every evaluated Sprint 25R capture record carries `rawInputRetained: false`. |
| `no_full_candidate` | blocking | Every evaluated record carries both full-candidate-retained flags `false`. |
| `no_user_visible_output` | blocking | Every evaluated record carries `userVisibleOutputRetained: false`. |
| `input_hash_only` | warning | Only `inputHash` is allowed by default; `inputPreview` is not. |
| `input_preview_policy` | warning | This plan does not propose persisting `inputPreview`. |
| `candidate_summary_only` | blocking | Only the minimized `candidateSummary` is ever a persistence candidate. |
| `retention_policy_defined` | blocking | `createDecisionSupportShadowStorageRetentionPolicy()` always returns a policy. |
| `deletion_policy_defined` | blocking | `createDecisionSupportShadowStorageDeletionPolicy()` always returns a policy. |
| `tenant_isolation_required` | warning (unsatisfied) | No tenant/project isolation mechanism exists yet. |
| `access_control_required` | warning (unsatisfied) | No access-control mechanism exists yet. |
| `feature_flag_required` | warning (unsatisfied) | The flag is only named, not implemented. |
| `audit_metadata_required` | blocking | Every capture record already carries `auditMetadata`. |
| `policy_version_required` | warning (unsatisfied) | No stored/queryable policy-version field exists yet. |
| `capture_harness_clean` | blocking | Sprint 25R harness metrics are clean (100% acceptable, zero violations). |
| `shadow_mode_clean` | blocking | Sprint 24R shadow mode prep metrics are clean. |
| `adapter_unchanged` | info | This module does not import `intentCompatibilityAdapter.ts`. |
| `router_unchanged` | info | This module does not import any router/composer/handler file. |

Every **blocking** gate passes today (`blockingReadinessGateFailureCount: 0`); four **warning** gates
(`tenant_isolation_required` / `access_control_required` / `feature_flag_required` /
`policy_version_required`) are unsatisfied by design — they mark real prerequisites for storage
*implementation*, not this policy sprint. `readinessGatePassRate` is therefore 81% (17/21), not 100%,
and that is expected: 100% would mean this sprint had implemented those prerequisites, which it
explicitly must not.

## Storage readiness logic

`runDecisionSupportShadowStoragePolicyEvaluation()` accepts a `DecisionClarificationCase[]` corpus
(default path: generates capture records via the reused Sprint 25R harness, `dry_run` by default,
`test_only_in_memory` too when `includeTestMemoryPass: true`), an already-computed
`DecisionSupportShadowCaptureResult[]`, or an array of capture-record-like objects (used for
synthetic-violation tests). `assessDecisionSupportShadowCaptureRecordForStorage()` then classifies
every field on each record and flags a violation if any prohibited field is observed with a non-empty
value, or if any of `rawInputRetained` / `fullDecisionCandidateRetained` /
`fullClarificationCandidateRetained` / `userVisibleOutputRetained` / `dbWriteAttempted` /
`supabaseWriteAttempted` / `shouldExecuteAction` / `shouldSendEmail` / `shouldCreateTask` /
`shouldWriteToDb` / `shouldReturnCandidateToUser` / `shouldPersistShadowResult` is observed as `true`.

`storageReadinessStatus` resolution:

- Any record-level violation → `"blocked_by_policy_violation"`.
- Else any **blocking** readiness gate failed → `"not_ready_for_real_storage"`.
- Else any **warning** readiness gate unsatisfied → `"ready_for_storage_adapter_design"` (today's
  status against the Sprint 18R corpus).
- Else (every gate, including every warning-severity future prerequisite, satisfied — only reachable
  via `assumeFuturePrerequisitesSatisfied: true`, a test-only scenario) →
  `"ready_for_default_off_storage_prototype"`.

## Evaluation results (Sprint 18R corpus, 79 cases)

| Metric | Value |
|---|---|
| `totalCaptureRecords` / `assessedRecords` | 79 / 79 |
| `allowedFieldCount` / `prohibitedFieldCount` / `exceptionRequiredFieldCount` | 30 / 24 / 1 |
| `prohibitedFieldObservedCount` | 0 |
| `rawInputViolationCount` / `fullCandidateViolationCount` / `userVisibleOutputViolationCount` | 0 / 0 / 0 |
| `dbWriteViolationCount` / `supabaseWriteViolationCount` / `sideEffectViolationCount` | 0 / 0 / 0 |
| `retentionPolicyDefinedCount` / `deletionPolicyDefinedCount` | 79 / 79 |
| `captureHarnessCleanCount` / `captureHarnessCleanRate` | 79 / **100%** |
| `readinessGatePassCount` / `readinessGatePassRate` | 17 / 21 (81%) |
| `blockingReadinessGateFailureCount` | **0** |
| `storageReadinessStatus` | **`ready_for_storage_adapter_design`** |
| `recommendedNextSprint` | **"Sprint 27R — Shadow Capture Storage Adapter Plan"** |
| `weakRecordAssessments` | `[]` (nothing violates the policy) |

`representativeAllowedFields`: `captureId`, `sourceRunId`, `generatedAt`, `mode`, `sinkKind`,
`inputHash`, `rawInputRetained`, `fullDecisionCandidateRetained`.
`representativeProhibitedFields`: `rawInput`, `input`, `fullInput`, `prompt`, `originalUserText`,
`fullDecisionCandidate`, `fullClarificationCandidate`, `decisionCandidate.responseText`.
`representativePolicyExceptions`: `inputPreview`.

The separate `tests/fixtures/conversational-brain-decision-support-shadow-storage-policy-cases.ts`
corpus (34 hand-authored cases) exercises `classifyDecisionSupportShadowStorageField()` directly:
every allowed-family field, the one exception field, every explicit prohibited field, and all three
dynamic fallback rules plus the unknown-field default. Scenario-level coverage (retention, deletion,
the named feature flag, real dry_run/test_only_in_memory record assessment, and synthetic
policy-violation records) is asserted directly in the test file against the module's functions.

## Por qué no se creó DB

No storage adapter, retention job, deletion job, tenant isolation, access control, or policy-version
storage exists yet — escribir a una base de datos real hoy crearía datos sin gobernanza (sin manera de
borrarlos por capture id/workspace/policy version, sin aislamiento por tenant).

## Por qué no se creó migration

Una migración presupone un esquema ya decidido; la clasificación de campos de este sprint
(`allowed`/`prohibited`/`requires_explicit_policy_exception`) es precisamente la decisión de forma de
esquema que debe existir antes de escribir cualquier migración.

## Por qué no se creó Supabase storage

`supabaseWriteImplemented` es un literal `false`; ningún cliente de Supabase se importa en este
módulo. El gate `no_supabase_write` pasa exactamente porque no existe ese import, verificado
directamente por un test que lee el código fuente del archivo.

## Por qué no se creó storage adapter real

Un storage adapter presupone una política de retención/deletion ya asentada y un feature flag real,
default-off, que lo controle. Este sprint define la política y nombra el flag, pero implementa
ninguno de los dos — `storageAdapterImplemented` es un literal `false`.

## Criterio para pasar a Sprint 27R

Sprint 27R (**Shadow Capture Storage Adapter Plan**) puede proceder si `storageReadinessStatus` se
mantiene en `ready_for_storage_adapter_design` (o mejor) contra el corpus del Sprint 18R,
`blockingReadinessGateFailureCount` se mantiene en 0, todos los conteos de violación se mantienen en
0, y `readinessGatePassRate` refleja únicamente los cuatro prerequisitos futuros nombrados
(`tenant_isolation_required` / `access_control_required` / `feature_flag_required` /
`policy_version_required`) como pendientes — exactamente las mismas restricciones que gobernaron este
sprint. Sprint 27R diseñaría (todavía sin construir) un storage adapter alrededor de esta política —
seguiría sin activar el feature flag real, sin crear una migración, y sin conectar shadow capture al
router.

## Verification

Ran the following, all green, all prior-sprint metrics unchanged:

- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-policy.test.mjs` (new, 97 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-capture-harness.test.mjs` (77 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mode-prep.test.mjs` (51 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs` (45 tests)
- `npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs` (77 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` (99 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` (52 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` (54 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` (51 tests)
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` (45 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` (21 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` (21 tests)
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` (32 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (46 tests)
- `npm run lint:aoc-boundaries` — passed.
- Scoped `npx tsc --noEmit` against this sprint's two new files (plus their direct dependencies)
  reports zero errors originating in either new file. Repo-wide `npm run typecheck` fails only on
  pre-existing, unrelated errors (missing `@/lib/conversational-brain` path alias resolution, missing
  `@/lib/project-constitution`, missing `node`/`@types/node`) — the same condition Sprint 23R/24R/25R
  documented; none of this sprint's files appear in that error output.

Confirmed untouched: `POST /api/command-center/chat`, the router, the composer, every production
handler, every feature flag, the DB/Supabase/Gmail integrations, `intentClassifier.rules.ts`,
`intentCompatibilityAdapter.ts`, and `intent-patterns.ts`.
`src/lib/playbook-engine/conversation/decision-support/index.ts` was updated to export the new module
(an isolated barrel, not re-exported from `src/lib/playbook-engine/conversation/index.ts` — the
production barrel is unmodified, verified directly by a test that reads its source).
