# Agent Controlled Execution Learning Signals & Governance Feedback Loop

## Overview

This layer captures privacy-safe categorical learning signals from controlled execution
outcomes, human review decisions, correction loops, and failed dispatch triage. It
generates governance feedback records, risk calibration signals, evidence quality signals,
adapter performance signals, review decision patterns, and review routing feedback for
workspace-level operational intelligence.

It builds on top of the Controlled Execution Result Reconciliation & Human Outcome Review
layer.

## Constraints

The Controlled Execution Learning Signals & Governance Feedback Loop does not train
models, create embeddings, call LLMs, call external APIs, mutate projects, change
policies, change review routing, execute adapters, retry dispatch, or retain raw payloads.

- Does NOT call LLMs, external APIs, or send communications.
- Does NOT perform real external side effects.
- Does NOT store raw outcome payloads, free text summaries, decision notes, or identifiers.
- Does NOT mutate policies, routing, or scoring values.
- Does NOT execute adapters. Does NOT retry dispatch.
- Does NOT hard-delete any records (archive only).
- All operations are deterministic.
- Privacy filter runs before every signal creation.

## Architecture

### 1. Types (`agent-execution-learning-types.ts`)

Defines all TypeScript types for the layer including:
- Signal record types and status/type/category unions
- Extraction record types and status unions
- Privacy filter record types and classification unions
- Governance feedback record types and severity/status unions
- Risk calibration, evidence quality, adapter performance signal types
- Review decision pattern and routing feedback types
- Workspace learning summary and aggregate signal types
- Learning event record types
- All input types for create/extract/generate operations

### 2. Validation (`agent-execution-learning-validation.ts`)

Pure deterministic functions for:
- 14 type guard validators
- `evaluateLearningPrivacyFilter` — blocks free text, raw payload keys, sensitive keys,
  customer/project identifiers. Returns deterministic pass/block result.
- `assertLearningSignalPayloadSerializable` — throws if payload is not JSON or exceeds 20KB
- `redactLearningSignalPayload` — redacts known sensitive key patterns
- `calculateSignalWeight` — deterministic weight 0-100 based on signal properties
- `calculateLearningConfidence` — deterministic confidence 0-100
- `deriveRiskCalibrationDirection` and `deriveGovernanceFeedbackSeverity`
- Normalization and deduplication utilities

### 3. Registry (`agent-execution-learning-registry.ts`)

Pure in-memory Maps for all 12 record types. CRUD functions with no external dependencies.

- Privacy filter records and learning events are stored in append-only arrays (no updates)
- All create operations generate deterministic IDs
- `_clearLearningStores()` exported for test isolation
- No hard deletes anywhere — signals are archived, not deleted

### 4. Service (`agent-execution-learning-service.ts`)

Orchestrates validation, registry calls, privacy checks, and event recording.

Key functions:
- `runLearningPrivacyFilter` — runs deterministic privacy evaluation, records filter result
- `createPrivacySafeLearningSignal` — enforces privacy filter before every signal creation;
  returns null if blocked (HTTP 422 from API route)
- `extractLearningSignalsFromOutcome` — reads only: status, outcomeType, matchStatus,
  confidenceLevel, evidenceCompletenessLevel, reviewRequirement, reviewStatus, adapterKey
- `extractLearningSignalsFromHumanOutcomeReview` — reads only: decisionType,
  reviewRequirement, reviewStatus, priority, riskLevel, assignedRole, outcomeId, adapterKey
- `extractLearningSignalsFromCorrectionLoop` — reads only: correctionType, status,
  retryRecommended, outcomeId, adapterKey
- `extractLearningSignalsFromFailedDispatchTriage` — reads only: failureCategory,
  retryable, suggestedRetryMode, requiresHumanReview, requiresCorrection,
  requiresEscalation, outcomeId, adapterKey
- `generateGovernanceFeedbackFromSignals` — creates feedback RECORDS only, no policy mutation
- `generateRiskCalibrationSignals` — workspace-scoped categorical risk signals
- `generateEvidenceQualitySignals` — evidence completeness patterns per adapter
- `generateAdapterPerformanceSignals` — adapter success/failure patterns
- `generateReviewDecisionPatterns` — human review decision outcome patterns
- `generateReviewRoutingFeedback` — routing effectiveness observations
- `generateWorkspaceLearningSummary` — aggregate summary for workspace
- `createPrivacySafeAggregateSignal` — threshold-gated aggregate signal creation
- `archiveLearningSignal` — sets status to archived (no delete)
- `buildExecutionLearningSummary` — full workspace summary for the summary API

### 5. Database Migration

File: `supabase/migrations/20260806000000_agent_controlled_execution_learning_signals_governance_feedback_loop.sql`

Creates 12 tables with RLS enabled and workspace member policies on all tables.
Uses `exists (select 1 from workspace_members where ...)` — never `using (true)`.

### 6. Database Contract (`src/lib/db/database-contract.ts`)

12 Row types and 12 column arrays. DATABASE_CONTRACT_VERSION string appended with
`controlled-execution-learning-signals-governance-feedback-loop`.

### 7. API Routes (`src/app/api/agents/execution/learning/`)

19 REST endpoints following existing Next.js App Router conventions.

## Tables

1. `agent_execution_learning_signals` — Privacy-safe categorical signal records
2. `agent_execution_learning_extractions` — Extraction operation records
3. `agent_execution_learning_privacy_filters` — Append-only privacy evaluation log
4. `agent_execution_governance_feedback` — Governance observation records (no policy mutation)
5. `agent_execution_risk_calibration_signals` — Risk level calibration signals
6. `agent_execution_evidence_quality_signals` — Evidence completeness quality signals
7. `agent_execution_adapter_performance_signals` — Adapter quality observation signals
8. `agent_execution_review_decision_patterns` — Human review decision outcome patterns
9. `agent_execution_review_routing_feedback` — Review routing effectiveness observations
10. `agent_execution_workspace_learning_summaries` — Workspace-level aggregate summaries
11. `agent_execution_aggregate_learning_signals` — Threshold-gated aggregate signals
12. `agent_execution_learning_events` — Append-only learning event log

## Signal Statuses

`created` → `privacy_pending` → `privacy_passed` | `privacy_blocked` → `active` →
`archived` | `invalidated`

## Signal Types

`outcome_accepted`, `outcome_rejected`, `correction_requested`, `retry_recommended`,
`evidence_missing`, `evidence_complete`, `confidence_low`, `confidence_high`,
`intended_actual_matched`, `intended_actual_mismatched`, `dispatch_failed`,
`triage_retryable`, `triage_escalated`, `risk_underestimated`, `risk_overestimated`,
`risk_aligned`, `adapter_quality_positive`, `adapter_quality_negative`,
`review_approved`, `review_rejected`, `review_escalated`, `review_deferred`,
`routing_effective`, `routing_ineffective`, `pattern_detected`

## Signal Categories

`outcome`, `correction`, `evidence`, `confidence`, `dispatch`, `triage`, `risk`,
`adapter`, `review`, `routing`, `pattern`, `governance`

## Privacy Filter

The privacy filter is deterministic. It runs before every signal creation. It blocks:
- Raw payload keys in signalPayload (e.g., `payload`, `body`, `content`, `rawOutput`)
- Sensitive key patterns (e.g., `password`, `email`, `token`, `secret`, `key`)
- Customer identifiers in signalPayload (e.g., `customerId`, `userId`, `accountId`)
- Project identifiers in signalPayload (e.g., `projectId`, `projectName`)
- Free text in signalValue exceeding 240 characters
- Free text in signalPayload values exceeding 100 characters

When blocked, `createPrivacySafeLearningSignal` returns `null` and the API route
returns HTTP 422.

## Governance Feedback

Governance feedback records observations only. No policy is mutated. No routing is
changed. No scoring value is updated. The records are available for human review and
downstream reporting only.

## Aggregate Signals

Aggregate signals use `aggregateScope: "workspace"`. Global scope is disabled.
Aggregate signals are only created when `count >= threshold`.

## Observability Events

17 new audit event types are added to `AgentAuditEventType`:
- `execution_learning_signal_created`
- `execution_learning_signal_privacy_checked`
- `execution_learning_signal_privacy_passed`
- `execution_learning_signal_privacy_blocked`
- `execution_learning_extraction_started`
- `execution_learning_extraction_succeeded`
- `execution_learning_extraction_failed`
- `execution_governance_feedback_created`
- `execution_risk_calibration_signal_created`
- `execution_evidence_quality_signal_created`
- `execution_adapter_performance_signal_created`
- `execution_review_decision_pattern_created`
- `execution_review_routing_feedback_created`
- `execution_workspace_learning_summary_created`
- `execution_aggregate_signal_created`
- `execution_learning_signal_archived`

New source type: `agent_controlled_execution_learning_signals_governance_feedback_loop`

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents/execution/learning/signals` | List signals |
| POST | `/api/agents/execution/learning/signals` | Create signal |
| GET | `/api/agents/execution/learning/signals/[signalId]` | Get signal |
| POST | `/api/agents/execution/learning/signals/[signalId]/archive` | Archive signal |
| POST | `/api/agents/execution/learning/extract/outcome` | Extract from outcome |
| POST | `/api/agents/execution/learning/extract/review` | Extract from review |
| POST | `/api/agents/execution/learning/extract/correction` | Extract from correction loop |
| POST | `/api/agents/execution/learning/extract/triage` | Extract from failed dispatch triage |
| POST | `/api/agents/execution/learning/privacy-filter` | Run privacy filter |
| GET | `/api/agents/execution/learning/governance-feedback` | List governance feedback |
| POST | `/api/agents/execution/learning/governance-feedback` | Generate governance feedback |
| POST | `/api/agents/execution/learning/governance-feedback/[feedbackId]/status` | Update status |
| POST | `/api/agents/execution/learning/risk-calibration` | Generate risk calibration signals |
| POST | `/api/agents/execution/learning/evidence-quality` | Generate evidence quality signals |
| POST | `/api/agents/execution/learning/adapter-performance` | Generate adapter performance signals |
| POST | `/api/agents/execution/learning/review-patterns` | Generate review decision patterns |
| POST | `/api/agents/execution/learning/review-routing` | Generate review routing feedback |
| POST | `/api/agents/execution/learning/workspace-summary` | Generate workspace summary |
| GET | `/api/agents/execution/learning/summary` | Get full learning summary |
| GET | `/api/agents/execution/learning/events` | List learning events |

## Prohibited Behaviors

The following are explicitly prohibited and verified by automated tests:

- Calling OpenAI, Anthropic, or any LLM API
- Calling any embedding API or fine-tuning API
- Making any `fetch()` calls in service or registry files
- Storing `outcomePayload`, `safeOutcomePayload`, `intendedSummary`, `actualSummary`,
  decision note text, failure description text, or correction note text in signals
- Mutating policies (`updatePolicy`, `setPolicy`, `mutatePolicy`)
- Mutating review routing (`changeRouting`)
- Using `using (true)` in RLS policies
- Hard-deleting records (`.delete()` or `DELETE FROM`)
- Executing adapters
- Retrying dispatch

## Security

All API routes require authentication (`requireAuthenticatedUser`) and workspace
membership (`requireWorkspaceMember`). RLS policies on all 12 tables require workspace
membership via `exists (select 1 from workspace_members ...)`.

## Retention

Signal retention classes: `ephemeral`, `short_term`, `standard`, `long_term`,
`permanent`. Privacy classifications: `public`, `internal`, `restricted`, `confidential`.
Archive-only pattern — no hard deletes at any layer.
