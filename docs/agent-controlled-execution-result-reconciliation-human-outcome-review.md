# Agent Controlled Execution Result Reconciliation & Human Outcome Review

## Overview

This layer provides deterministic outcome reconciliation, evidence completeness scoring,
intended-vs-actual comparison, confidence calculation, and human outcome review routing
for execution dispatch results. It builds on top of the Controlled Execution Finalization
& Adapter Dispatch Gate layer.

## Constraints

- Does NOT call LLMs, external APIs, or send communications.
- Does NOT perform real external side effects.
- Does NOT send emails, Slack messages, or create tickets.
- Does NOT mutate projects.
- All scoring and classification is deterministic.

## Architecture

### 1. Types (`agent-execution-outcome-types.ts`)

Defines all TypeScript types for the layer including union types, record types, and input types.

### 2. Validation (`agent-execution-outcome-validation.ts`)

Pure functions for validation, normalization, redaction, and deterministic scoring.

### 3. Registry (`agent-execution-outcome-registry.ts`)

In-memory store with pure CRUD operations. Events are append-only. No hard deletes.

### 4. Service (`agent-execution-outcome-service.ts`)

Orchestrates validation, registry calls, and event recording. Emits audit events non-blocking.

### 5. Database Migration (`supabase/migrations/20260805000000_...sql`)

Creates 9 tables with RLS enabled and workspace member policies.

### 6. Database Contract (`src/lib/db/database-contract.ts`)

Row types and column arrays for all 9 tables.

### 7. API Routes (`src/app/api/agents/execution/outcomes/`)

REST endpoints following existing route conventions.

## Tables

1. `agent_execution_outcomes` — Primary outcome record
2. `agent_execution_outcome_reconciliations` — Reconciliation results
3. `agent_execution_outcome_comparisons` — Intended vs actual comparisons
4. `agent_execution_evidence_completeness` — Evidence scoring
5. `agent_execution_outcome_confidence` — Confidence scoring
6. `agent_execution_human_outcome_reviews` — Human review queue entries
7. `agent_execution_failed_dispatch_triage` — Triage for failures
8. `agent_execution_correction_loops` — Correction tracking
9. `agent_execution_outcome_events` — Append-only event log

## Outcome Statuses

`created` → `reconciling` → `reconciled` → `evidence_review` → `comparison_pending`
→ `comparison_complete` → `confidence_scored` → `review_required` / `review_in_progress`
→ `review_complete` / `correction_required` → `correction_in_progress` → `correction_complete`
→ `archived` / `failed`

## Evidence Completeness Scoring

Deterministic scoring based on presence of:
- Dispatch record: +20 pts
- Adapter execution record: +25 pts
- Execution result record: +25 pts
- Evidence items (count >= 1): +20 pts
- Complete lineage: +10 pts

Levels: none (0), minimal (1-20), partial (21-50), sufficient (51-99), complete (100)

## Confidence Scoring

Deterministic scoring (0-100):
- Dispatch succeeded: +25
- Adapter execution exists: +20
- Result exists: +20
- Evidence completeness sufficient/complete: +20
- Lineage complete: +10
- Match status matched: +10 / partial_match: +5
- Penalties: dispatch_failure -20, adapter_failure -15, reconciliation_failure -25, mismatch -15

Levels: low (0-49), medium (50-79), high (80-100)

## Review Requirement Determination

Priority order:
1. `required_correction` if requiresCorrection = true
2. `required_failure` if outcomeType is a failure type
3. `required_mismatch` if matchStatus = mismatch
4. `required_low_confidence` if confidenceLevel = low
5. `not_required` otherwise

## Redacted Fields

The following keys are redacted in all stored payloads:
`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`,
`private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`,
`session_cookie`, `cookie`

## API Endpoints

- `GET /api/agents/execution/outcomes` — List outcomes
- `POST /api/agents/execution/outcomes` — Create outcome
- `POST /api/agents/execution/outcomes/from-dispatch-attempt` — Create from dispatch
- `POST /api/agents/execution/outcomes/reconcile` — Reconcile outcome
- `GET /api/agents/execution/outcomes/summary` — Get full summary
- `GET /api/agents/execution/outcomes/[outcomeId]` — Get outcome detail
- `POST /api/agents/execution/outcomes/[outcomeId]/evidence-completeness` — Score evidence
- `POST /api/agents/execution/outcomes/[outcomeId]/compare` — Compare intended vs actual
- `POST /api/agents/execution/outcomes/[outcomeId]/confidence` — Score confidence
- `GET/POST /api/agents/execution/outcomes/[outcomeId]/review` — Review management
- `POST /api/agents/execution/outcomes/[outcomeId]/decision` — Record decision
- `POST /api/agents/execution/outcomes/[outcomeId]/triage` — Triage failed dispatch
- `POST /api/agents/execution/outcomes/[outcomeId]/correction` — Create correction loop
- `POST /api/agents/execution/outcomes/[outcomeId]/archive` — Archive outcome
- `GET /api/agents/execution/outcomes/[outcomeId]/events` — List events

## Observability Integration

Emits audit events via `agent-observability-service` with source type
`agent_controlled_execution_result_reconciliation_human_outcome_review`.
Audit events are non-blocking (failures are swallowed).

## Prior Layer Dependencies

Depends on records from:
- `agent-execution-dispatch-types` (finalization, dispatch attempt, gate)
- `agent-execution-result-types` (result, evidence)
- `agent-tool-adapter-types` (adapter execution)
- `agent-execution-types` (execution request)
