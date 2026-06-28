# Agent Execution Results & Evidence Layer

Sprint: Agent Execution Results & Evidence Layer

## Overview

The Agent Execution Results & Evidence Layer provides structured capture, storage, and review of agent execution outcomes. Every governed agent action produces a result record backed by evidence items, a lineage chain, and an event log.

## Core Concepts

### 1. Result Types (`AgentExecutionResultType`)

Thirteen result types span the range of adapter outputs:

- `noop` — no action taken
- `simulation` — dry-run simulation result
- `draft_email` — composed but unsent email
- `draft_task` — task item staged for creation
- `draft_project_update` — project status update draft
- `draft_report` — report draft
- `structured_summary` — machine-readable structured summary
- `risk_analysis` — risk register entry
- `recommendation` — actionable recommendation
- `governance_note` — governance/audit note
- `adapter_refusal` — adapter declined to execute
- `adapter_failure` — adapter execution failed
- `execution_failure` — general execution failure

### 2. Result Statuses (`AgentExecutionResultStatus`)

- `created` — just created, not yet reviewed
- `ready_for_review` — review has been requested
- `superseded` — replaced by a newer result
- `archived` — retained for audit, no longer active
- `discarded` — abandoned
- `failed` — failed to produce a usable result

### 3. Review States (`AgentExecutionResultReviewState`)

- `not_ready` — not ready for human review
- `ready` — ready for human review
- `reviewed` — has been reviewed
- `rejected` — rejected by reviewer
- `accepted` — accepted by reviewer
- `needs_more_evidence` — reviewer requested more evidence

### 4. Evidence Types (`AgentExecutionEvidenceType`)

Eleven evidence types capture provenance:

- `execution_request` — the governed execution request
- `adapter_execution` — the adapter execution record
- `approval` — approval record
- `memory` — memory context reference
- `audit_event` — audit trail entry
- `input_snapshot` — snapshot of adapter input
- `output_snapshot` — snapshot of adapter output
- `scope_reference` — scope entity reference
- `tool_reference` — tool definition reference
- `manual_note` — manually added note
- `artifact_metadata` — artifact metadata

### 5. Evidence Sources (`AgentExecutionEvidenceSource`)

- `agent_execution_runtime` — from the execution runtime
- `agent_tool_adapter_layer` — from the adapter layer
- `agent_memory_context` — from the memory layer
- `agent_observability` — from the observability/audit layer
- `agent_approval` — from the approval system
- `manual` — manually provided
- `system` — system-generated

### 6. Confidence Levels (`AgentExecutionConfidenceLevel`)

- `low` — score < 40
- `medium` — score 40–74
- `high` — score ≥ 75

### 7. Artifact Types (`AgentExecutionResultArtifactType`)

- `inline_json`, `markdown`, `draft_email`, `draft_task`, `draft_report`, `risk_register_entry`, `governance_note`, `external_reference`

### 8. Retention Policies (`AgentExecutionRetentionPolicy`)

- `standard` — default retention
- `short_lived` — ephemeral
- `long_lived` — extended retention (used for risk, governance, recommendation)
- `legal_hold` — cannot be deleted
- `delete_eligible` — eligible for purge

### 9. Lineage Types

Each lineage record captures one hop in the provenance chain:

- `execution_request`, `adapter_execution`, `evidence`, `approval`, `memory`, `audit`, `scope`, `artifact`

### 10. Result Event Types (`AgentExecutionResultEventType`)

Eleven event types:

- `result_created`, `result_ready_for_review`, `result_superseded`, `result_archived`, `result_discarded`
- `evidence_created`, `evidence_linked`
- `confidence_calculated`, `lineage_recorded`, `retention_policy_applied`
- `result_export_metadata_created`

## Data Model

### `AgentExecutionResultRecord`

The primary result record. Key fields:

| Field | Description |
|---|---|
| `id` | UUID |
| `workspaceId` | Workspace scope |
| `executionRequestId` | Links to governed execution request |
| `adapterExecutionId` | Links to adapter execution |
| `resultType` | What kind of result |
| `resultStatus` | Lifecycle status |
| `reviewState` | Human review state |
| `confidenceScore` | 0–100 |
| `confidenceLevel` | low/medium/high |
| `confidenceReasons` | Reasons list |
| `evidenceIds` | IDs of attached evidence |
| `lineageRefs` | Lineage reference IDs |
| `safeResultPayload` | Redacted payload (secrets removed) |
| `retentionPolicy` | How long to retain |

### `AgentExecutionEvidenceRecord`

An individual evidence item. Key fields:

| Field | Description |
|---|---|
| `evidenceType` | Classification |
| `evidenceSource` | Where it came from |
| `evidencePayload` | Raw payload |
| `safeEvidencePayload` | Redacted payload |
| `evidenceHash` | Deterministic fingerprint for deduplication |
| `confidenceWeight` | Weight (0–100) in confidence calculation |

### `AgentExecutionResultLineageRecord`

Immutable provenance record linking a result to a referenced entity.

### `AgentExecutionResultEventRecord`

Event log entry for result and evidence lifecycle events.

## Services

### `createResultFromAdapterExecution`

The primary high-level factory. Given an `executionRequestId` and `adapterExecutionId`:

1. Loads the execution request and adapter execution
2. Maps output type to result type
3. Creates the result record
4. Creates 2–6 evidence items automatically (execution_request, adapter_execution, output_snapshot, scope_reference, approval, memory)
5. Links all evidence to the result
6. Records complete lineage chain
7. Calculates confidence score
8. Sets `reviewState: "ready"` if succeeded with sufficient evidence
9. Fires audit event (best-effort)

### `createResultFromPayload`

Creates a result from a raw `CreateAgentExecutionResultInput`. Use for manual or synthetic results.

### `createEvidenceForExecutionResult`

Creates an evidence item and fires `evidence_created` event.

### `calculateResultConfidence`

Recalculates confidence for an existing result based on its current evidence items.

### `markResultReadyForReview`

Sets status → `ready_for_review`, reviewState → `ready`.

### `archiveExecutionResult`

Sets status → `archived`, reviewState → `reviewed`.

### `supersedeExecutionResult`

Sets status → `superseded`.

### `buildExecutionResultExportMetadata`

Returns a comprehensive export metadata object including confidence, evidence count, and safe payload.

## Confidence Algorithm

The confidence score (0–100) is calculated by summing positive signals and subtracting penalties:

| Signal | Points |
|---|---|
| Execution request exists | +15 |
| Adapter execution exists | +15 |
| Adapter succeeded | +15 |
| Approval present | +10 |
| Required approval satisfied | +10 |
| Input snapshot present | +10 |
| Output payload present | +10 |
| 3+ evidence items | +10 |
| Audit trail present | +5 |
| Scope known | +5 |
| Errors present | −30 |
| Refusal present | −30 |

Score is clamped to [0, 100]. Level: high ≥ 75, medium ≥ 40, low < 40.

## Security

- `safeResultPayload` and `safeEvidencePayload` automatically redact keys matching: `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`
- Redaction is recursive (nested objects)
- Payload size limit: 100 KB

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/agents/execution/results` | List results |
| POST | `/api/agents/execution/results` | Create result from payload |
| POST | `/api/agents/execution/results/from-adapter-execution` | Create result from adapter execution |
| GET | `/api/agents/execution/results/[resultId]` | Get result |
| POST | `/api/agents/execution/results/[resultId]/ready` | Mark ready for review |
| POST | `/api/agents/execution/results/[resultId]/archive` | Archive result |
| POST | `/api/agents/execution/results/[resultId]/supersede` | Supersede result |
| GET | `/api/agents/execution/results/[resultId]/lineage` | Get lineage |
| GET | `/api/agents/execution/results/[resultId]/events` | Get events |
| GET | `/api/agents/execution/results/[resultId]/export-metadata` | Get export metadata |
| GET | `/api/agents/execution/evidence` | List evidence |
| POST | `/api/agents/execution/evidence` | Create evidence |
| GET | `/api/agents/execution/evidence/[evidenceId]` | Get evidence |
| POST | `/api/agents/execution/results/[resultId]/evidence/[evidenceId]/link` | Link evidence to result |

All routes require `requireAuthenticatedUser` + `requireWorkspaceMember`. Responses: `{ ok: true, data: { ... } }` or `{ ok: false, error: { code, message } }`.

## Database Tables

Four tables in `20260801000000_agent_execution_results_evidence_layer.sql`:

- `agent_execution_results` — primary result records
- `agent_execution_evidence_items` — evidence items
- `agent_execution_result_lineage` — immutable lineage chain
- `agent_execution_result_events` — event log

All tables have RLS enabled with workspace member policies for SELECT and INSERT.

## In-Memory Architecture

This layer uses pure in-memory Maps (no Supabase). The SQL migration defines the schema for when persistence is added. The `_clearResultStores()` export enables test isolation.

## Observability Integration

Audit events are fired (best-effort, wrapped in try/catch) for:
- `result_created`
- `result_ready_for_review`
- `result_archived`
- `result_superseded`

Source type: `agent_execution_results_evidence_layer`
