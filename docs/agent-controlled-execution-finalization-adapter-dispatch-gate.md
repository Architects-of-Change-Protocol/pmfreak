# Controlled Execution Finalization & Adapter Dispatch Gate

## Purpose

The Controlled Execution Finalization & Adapter Dispatch Gate is the final governed decision point before a safe adapter is invoked. It takes a governed execution request that has already passed through the Controlled Action Conversion & Approval Bridge, and determines whether that request is ready, approved, confirmed, locked, idempotent, and dispatchable.

The Controlled Execution Finalization & Adapter Dispatch Gate does not send communications, create tickets, update projects, call LLMs, create embeddings, or perform external side effects.

It only finalizes governed execution requests and dispatches to safe deterministic adapters in dry-run or draft-only modes when readiness, approval, confirmation, lock, and idempotency checks pass.

## Scope

- Execution finalization records
- Dispatch readiness evaluation
- Dispatch gate records
- Execution locks
- Idempotency records
- Dispatch attempts
- Final human confirmation records
- Dispatch events
- Safe adapter dispatch in dry_run/draft_only modes only
- Result reconciliation hooks
- Audit trail

## Non-Goals

- Does not send real emails, Slack messages, or communications
- Does not create Jira tickets or GitHub issues
- Does not mutate production project records
- Does not call OpenAI, Anthropic, Gemini, or any LLM provider
- Does not create embeddings
- Does not implement autonomous scheduling
- Does not execute side-effectful adapters
- Does not bypass execution requests, adapter eligibility, result/evidence layer, human review, or action conversion approval bridge

## Relationship to Prior Layers

### Agent Execution Request Runtime
Creates governed execution requests. This layer finalizes them for dispatch.

### Agent Tool Execution Adapter Layer
Provides safe deterministic adapters. This layer selects and invokes them in safe modes only (dry_run, draft_only).

### Agent Execution Results & Evidence Layer
Normalizes adapter output into results and evidence. This layer reconciles adapter output by creating result records when possible.

### Human Review & Action Inbox
Provides accepted action drafts. Finalization traces lineage back through review items.

### Controlled Action Conversion & Approval Bridge
Creates governed execution requests from accepted action drafts. This layer is the next step: it finalizes those requests for dispatch.

## Domain Model

### Execution Finalization

The central record for a governed execution request's path through the finalization and dispatch gate.

Fields: `id`, `workspaceId`, `executionRequestId`, `actionConversionId`, `actionDraftId`, `reviewItemId`, `sourceResultId`, `sourceEvidenceId`, `status`, `readiness`, `executionMode`, `riskLevel`, `selectedToolKey`, `selectedAdapterKey`, `sideEffectMode`, `confirmationRequirement`, `confirmationStatus`, `approvalVerified`, `lockStatus`, `idempotencyStatus`, `dispatchGateId`, `latestDispatchAttemptId`, `adapterExecutionId`, `resultId`, `evidenceIds`, `blockingReasons`, `warnings`, `finalizationPayload`, `safeFinalizationPayload`.

### Dispatch Readiness

A deterministic evaluation of whether an execution request is dispatchable. All checks must pass for `readiness: "ready"`. If only final confirmation is missing, the state becomes `requires_confirmation`.

### Dispatch Gate

The formal controlled decision point. Created after readiness passes. Records whether dispatch is allowed, what adapter and mode are selected, and whether confirmation is required.

### Execution Lock

Prevents duplicate dispatch. Keyed by `workspaceId:executionRequestId`. Acquired before dispatch, released on success or failure. Released on cancellation.

### Idempotency

Ensures repeated dispatch requests do not produce duplicate adapter runs. Keyed by workspace + request + adapter + mode. If status is `completed`, returns existing finalization without re-dispatching.

### Dispatch Attempt

Records each individual dispatch attempt. Append-only. Links to gate, adapter execution, result, and evidence.

### Final Human Confirmation

Required for high-risk or critical-risk dispatch, or for side-effect-potential modes. In this sprint, confirmation is metadata only — it permits safe adapter dispatch in dry_run/draft_only mode, not real external actions.

### Dispatch Event

Append-only audit log of finalization and dispatch lifecycle activity. Covers finalization_created through dispatch_completed.

## Finalization Lifecycle

```
created
↓
readiness_pending → readiness_passed / readiness_failed
↓
confirmation_required → confirmation_satisfied (if applicable)
↓
dispatch_ready
↓
dispatch_started
↓
dispatch_succeeded / dispatch_failed
↓
result_reconciled
↓
completed
```

Cancellation is allowed from any non-terminal status.

## Readiness Lifecycle

The `runExecutionDispatchReadiness` function evaluates all readiness checks deterministically:
- execution_request_exists
- workspace_matches
- execution_request_dispatchable
- execution_mode_safe
- approval_ready
- approval_bridge_satisfied
- conversion_linkage_valid
- adapter_mapping_exists
- adapter_eligible
- side_effect_mode_allowed
- final_confirmation_satisfied
- execution_lock_available
- idempotency_key_valid
- no_prior_successful_dispatch
- payload_safe
- scope_known
- risk_level_known

## Dispatch Gate Lifecycle

```
created → allowed / blocked / confirmation_required
         ↓
    dispatching → succeeded / failed
```

## Lock Lifecycle

```
available → acquired → released / expired
```

Locks are never deleted. Lock is always released after dispatch, success or failure.

## Idempotency Lifecycle

```
new → in_progress → completed / failed
               ↓
           replayed (if same key reused after completion)
```

## Adapter Dispatch Lifecycle

Only allowed when:
- Gate status is `allowed`
- Finalization readiness is `ready`
- Execution mode is `dry_run` or `draft_only`
- Final confirmation satisfied if required
- Idempotency key is new or completed (replay)
- Lock is available

Blocked for:
- `approved_execution`
- `live_execution`
- `external_side_effect`
- Any unknown unsafe mode

## Result Reconciliation Lifecycle

If adapter dispatch succeeds:
1. `adapterExecutionId` is stored on the finalization and dispatch attempt
2. `createAgentExecutionResult` is called against the execution results service
3. `resultId` is linked if created
4. `evidenceIds` are linked if created
5. Finalization status becomes `result_reconciled`

If result creation fails:
- Finalization status remains `dispatch_succeeded` (not `result_reconciled`)
- Warning `result_reconciliation_failed` is not claimed unless actually recorded
- Adapter dispatch outcome is kept separate from result reconciliation outcome

## Blocking Reasons

Common blocking reasons:
- Execution request not found
- Workspace mismatch
- Execution request not in dispatchable state
- Execution mode unsafe (not dry_run or draft_only)
- Approval readiness not satisfied
- Approval bridge not satisfied
- No adapter mapping found
- Adapter not eligible
- Side-effect mode not allowed
- Final confirmation required but not provided
- Execution lock already held
- Idempotency record in progress

## Risk and Final Confirmation Policy

| Risk Level | Execution Mode | Confirmation Required |
|------------|----------------|-----------------------|
| low        | dry_run        | No                    |
| medium     | dry_run        | No                    |
| high       | any            | Yes (required_high_risk) |
| critical   | any            | Yes (required_critical_risk) |
| any        | side_effect_potential | Yes (required_side_effect_potential) |

## Side-Effect Mode Enforcement

| Execution Mode     | Side Effect Mode       | Allowed for Dispatch |
|--------------------|------------------------|----------------------|
| dry_run            | dry_run                | Yes                  |
| draft_only         | draft_only             | Yes                  |
| approval_required  | side_effect_potential  | No (blocked)         |
| approved_execution | side_effect_blocked    | No                   |
| live_execution     | side_effect_blocked    | No                   |
| external_side_effect | side_effect_blocked  | No                   |

## RLS / Security Model

All seven tables have Row Level Security enabled. Access is restricted to workspace members. No public access. No `true` policies.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/agents/execution/dispatch/finalizations | Create finalization directly |
| GET | /api/agents/execution/dispatch/finalizations | List finalizations |
| GET | /api/agents/execution/dispatch/finalizations/[finalizationId] | Get finalization detail |
| POST | /api/agents/execution/dispatch/finalizations/from-execution-request | Create from execution request |
| POST | /api/agents/execution/dispatch/finalizations/[finalizationId]/readiness | Run readiness checks |
| POST | /api/agents/execution/dispatch/finalizations/[finalizationId]/gate | Create dispatch gate |
| POST | /api/agents/execution/dispatch/finalizations/[finalizationId]/confirm | Record final confirmation |
| POST | /api/agents/execution/dispatch/finalizations/[finalizationId]/dispatch | Dispatch to adapter |
| POST | /api/agents/execution/dispatch/finalizations/[finalizationId]/cancel | Cancel dispatch |
| GET | /api/agents/execution/dispatch/finalizations/[finalizationId]/events | List dispatch events |
| GET | /api/agents/execution/dispatch/summary | Dispatch summary |

## Example: Finalization from Execution Request

```json
POST /api/agents/execution/dispatch/finalizations/from-execution-request
{
  "workspaceId": "ws_abc",
  "executionRequestId": "req_123",
  "actionConversionId": "conv_456"
}

Response:
{
  "ok": true,
  "data": {
    "id": "fin_789",
    "status": "created",
    "readiness": "not_ready",
    "executionMode": "dry_run",
    "selectedAdapterKey": "dry_run_analysis_adapter",
    "confirmationRequirement": "not_required"
  }
}
```

## Example: Readiness Result

```json
POST /api/agents/execution/dispatch/finalizations/fin_789/readiness
{
  "workspaceId": "ws_abc"
}

Response:
{
  "ok": true,
  "data": {
    "status": "readiness_passed",
    "readiness": "ready",
    "blockingReasons": [],
    "approvalVerified": true
  }
}
```

## Example: Dispatch Gate

```json
POST /api/agents/execution/dispatch/finalizations/fin_789/gate
{
  "workspaceId": "ws_abc"
}

Response:
{
  "ok": true,
  "data": {
    "status": "allowed",
    "dispatchAllowed": true,
    "selectedAdapterKey": "dry_run_analysis_adapter",
    "executionMode": "dry_run"
  }
}
```

## Example: Final Confirmation

```json
POST /api/agents/execution/dispatch/finalizations/fin_789/confirm
{
  "workspaceId": "ws_abc",
  "rationale": "Reviewed all readiness checks. Approving dry-run dispatch."
}
```

## Example: Idempotent Dispatch

Sending the same `idempotencyKey` twice returns the existing finalization without creating a new adapter execution.

```json
POST /api/agents/execution/dispatch/finalizations/fin_789/dispatch
{
  "workspaceId": "ws_abc",
  "idempotencyKey": "my-unique-dispatch-key-001"
}
```

## Example: Adapter Dispatch Result

```json
{
  "ok": true,
  "data": {
    "status": "result_reconciled",
    "readiness": "reconciled",
    "adapterExecutionId": "adapter_exec_001",
    "resultId": "result_001",
    "idempotencyStatus": "completed",
    "lockStatus": "released"
  }
}
```

## Prohibited Behavior

This sprint does not:
- Send real emails, Slack messages, or any communications
- Create Jira tickets, GitHub issues, or external records
- Modify Google Calendar or any calendar service
- Mutate production project records
- Update project status
- Create real tasks
- Call OpenAI, Anthropic, Gemini, or any LLM provider
- Create embeddings
- Execute side-effectful adapters
- Perform real-world side effects

## Testing Guide

Run focused tests:
```bash
npm test -- tests/agent-controlled-execution-finalization-adapter-dispatch-gate.test.mjs
```

Run full suite:
```bash
npm test
```

## Known Limitations

1. **Adapter dispatch result ID**: The `runAgentToolAdapter` function does not return the adapter execution record ID directly. The service lists adapter executions filtered by `executionRequestId` to find the most recent one. This is a known limitation and may produce unexpected results if multiple adapter executions exist for the same request.

2. **Result reconciliation**: If the execution results service is not available or the execution request lacks required fields (toolKey, executionMode, etc.), result reconciliation is skipped. The finalization is marked `dispatch_succeeded` rather than `result_reconciled`. This is documented and intentional.

3. **In-memory store**: All data is stored in-memory. A production deployment would use the database tables defined in the migration.

4. **Observability audit**: Audit events are best-effort. If the observability service is unavailable, dispatch continues without audit records.

## Suggested Next Sprint

**Controlled Execution Result Reconciliation & Human Outcome Review**

Once governed execution requests can be finalized and safely dispatched to adapters, the next layer should strengthen post-dispatch result reconciliation, compare intended vs actual outcomes, and send completed outcomes back into human review when confidence, risk, or evidence quality requires it.

That next sprint should focus on:
- Post-dispatch result reconciliation
- Intended vs actual comparison
- Evidence completeness scoring
- Dispatch outcome confidence
- Human outcome review triggers
- Failed dispatch triage
- Result correction loop
- Adapter result normalization hardening
- Audit-ready outcome reports
