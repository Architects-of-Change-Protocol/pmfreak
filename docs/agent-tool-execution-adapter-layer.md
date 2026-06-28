# Agent Tool Execution Adapter Layer

**Sprint:** Agent Tool Execution Adapter Layer  
**Status:** Production  
**Version:** 1.0.0

## Safety Statement

**The Agent Tool Execution Adapter Layer does not send emails, create tickets, call external APIs, mutate projects, call LLMs, create embeddings, or perform autonomous external side effects. It only runs safe deterministic local adapters that produce dry-run or draft-only outputs from governed execution requests.**

---

## 1. Overview

The Agent Tool Execution Adapter Layer (ATEAL) is the bridge between a governed `AgentExecutionRequest` and the safe, deterministic, side-effect-free execution of agent tools. It receives approved execution requests in `ready_for_execution` state and dispatches them to registered adapters that produce structured outputs — always as dry-run simulations or draft artifacts, never as live system mutations.

---

## 2. Architecture

```
AgentExecutionRequest (ready_for_execution)
    ↓
AgentToolAdapterRegistry  ← selects adapter by toolKey + executionMode
    ↓
evaluateAgentToolAdapterEligibility  ← checks all safety/policy gates
    ↓
AgentToolAdapterService  ← executes adapter, generates output
    ↓
AgentToolAdapterExecutionRecord  ← in-memory record (+ future DB persistence)
    ↓
complete{DryRun,DraftOnly}Execution  ← signals execution runtime
    ↓
AgentObservabilityService  ← audit trail (non-fatal)
```

---

## 3. Core Types

### AgentToolAdapterExecutionMode
- `dry_run` — simulates execution, no changes
- `draft_only` — generates draft artifacts, no external delivery

### AgentToolAdapterStatus
`registered` | `enabled` | `disabled` | `deprecated`

### AgentToolAdapterExecutionStatus
`queued` | `running` | `succeeded` | `failed` | `refused` | `cancelled`

### AgentToolAdapterOutputType
`noop` | `simulation` | `draft_email` | `draft_task` | `draft_project_update` | `draft_report` | `recommendation` | `structured_summary` | `risk_analysis` | `governance_note`

### AgentToolAdapterRiskPolicy
- `low_only` — only low-risk requests
- `medium_or_lower` — low or medium risk
- `high_with_approval` — high risk requires an approval record
- `critical_blocked` — critical risk is always blocked

### AgentToolAdapterSideEffectPolicy
`none` | `internal_draft_only` | `internal_record_only` | `external_disabled`

---

## 4. Default Adapters

| Adapter Key | Supported Tool Keys | Modes | Output Types | Risk Policy |
|---|---|---|---|---|
| `noop_adapter` | `noop`, `test_noop`, `validate_execution_request` | `dry_run` | `noop`, `simulation` | `medium_or_lower` |
| `draft_email_adapter` | `draft_client_email`, `draft_internal_email`, `prepare_status_email` | `dry_run`, `draft_only` | `draft_email` | `high_with_approval` |
| `draft_task_adapter` | `draft_project_task`, `draft_follow_up_task`, `prepare_action_item` | `dry_run`, `draft_only` | `draft_task` | `high_with_approval` |
| `draft_project_update_adapter` | `draft_project_update`, `prepare_status_update`, `draft_milestone_update` | `dry_run`, `draft_only` | `draft_project_update` | `high_with_approval` |
| `executive_summary_adapter` | `generate_executive_summary`, `draft_executive_report`, `summarize_project_status` | `dry_run`, `draft_only` | `structured_summary`, `draft_report` | `medium_or_lower` |
| `risk_analysis_adapter` | `analyze_project_risk`, `draft_risk_note`, `prepare_risk_escalation` | `dry_run`, `draft_only` | `risk_analysis`, `recommendation` | `high_with_approval` |

---

## 5. Eligibility Checks

The eligibility gate runs the following checks in order:

1. **execution_request_found** — request must exist
2. **execution_request_ready** — state must be `ready_for_execution`
3. **adapter_found** — an adapter must match the tool key and mode
4. **adapter_enabled** — adapter status must be `enabled`
5. **execution_mode_supported** — mode must be `dry_run` or `draft_only` (not `approved_execution` or `approval_required`)
6. **tool_key_supported** — adapter must list the tool key
7. **scope_type_supported** — adapter must support the scope type
8. **risk_policy** — risk level must satisfy adapter's risk policy
9. **approval_required** — high-risk requests via `high_with_approval` policy must have an approval record
10. **external_side_effects** — `externalSideEffectsEnabled` must be false

Each check is recorded in the `checks` array of `AgentToolAdapterEligibilityResult`.

### Reason Codes

| Reason Code | Meaning |
|---|---|
| `eligible` | All checks passed |
| `execution_request_not_found` | Request not found |
| `execution_request_not_ready` | Request not in ready state |
| `unsupported_execution_mode` | Mode not supported |
| `unsupported_tool_key` | Tool key not in adapter's list |
| `unsupported_scope_type` | Scope type not supported |
| `adapter_not_found` | No adapter matches |
| `adapter_disabled` | Adapter is disabled or deprecated |
| `risk_policy_denied` | Risk level blocked by policy |
| `approval_required` | Approval record missing for high-risk |
| `external_side_effects_disabled` | Adapter has external side effects |
| `payload_not_safe` | Payload failed safety check |

---

## 6. Output Generation

All outputs are deterministic local computations. No LLM, no network calls, no external APIs.

### noop_adapter
```json
{ "type": "noop", "message": "No operation performed.", "wouldExecute": false }
```

### draft_email_adapter
```json
{
  "type": "draft_email",
  "subject": "Draft: <title>",
  "body": "Draft generated from safe execution request input.",
  "recipients": [],
  "sendStatus": "not_sent",
  "requiresHumanReview": true
}
```

### draft_task_adapter
```json
{
  "type": "draft_task",
  "title": "<title from payload>",
  "description": "<description>",
  "status": "draft",
  "requiresHumanReview": true
}
```

### draft_project_update_adapter
```json
{
  "type": "draft_project_update",
  "summary": "<summary>",
  "status": "draft",
  "appliedToProject": false,
  "requiresHumanReview": true
}
```

### executive_summary_adapter
```json
{
  "type": "structured_summary",
  "summary": "<summary>",
  "sections": [],
  "status": "draft",
  "requiresHumanReview": true
}
```

### risk_analysis_adapter
```json
{
  "type": "risk_analysis",
  "riskLevel": "<riskLevel from request>",
  "findings": [],
  "recommendations": [],
  "status": "draft",
  "requiresHumanReview": true
}
```

---

## 7. Evidence Refs

Every execution produces a structured list of evidence references:

```
execution_request:<id>
adapter:<adapterKey>
tool:<toolKey>
mode:<executionMode>
scope:<scopeType>:<scopeId|workspace>
approval_request:<approvalRequestId>   (if present)
memory:<memoryId>                       (for each memoryId)
```

---

## 8. Service API

### runAgentToolAdapter(input)
Main entry point. Loads the execution request, evaluates eligibility, runs the adapter, records events.

```typescript
type AgentToolAdapterRunInput = {
  workspaceId: string;
  executionRequestId: string;
  adapterKey?: string | null;    // override auto-selection
  actorId?: string | null;
  forceDryRun?: boolean;
};
```

Returns `AgentToolAdapterRunResult`.

### runDryRunAdapter(input)
Convenience wrapper that forces `dry_run` mode.

### runDraftOnlyAdapter(input)
Convenience wrapper for `draft_only` mode.

### CRUD Functions
- `createAgentToolAdapterExecution(data)` — create execution record
- `updateAgentToolAdapterExecution(id, updates)` — update record
- `getAgentToolAdapterExecutionById(workspaceId, id)` — fetch by ID
- `listAgentToolAdapterExecutions(workspaceId, filters?)` — list with optional filters
- `recordAgentToolAdapterExecutionEvent(data)` — record event
- `listAgentToolAdapterExecutionEvents(workspaceId, adapterExecutionId)` — list events

---

## 9. Registry API

- `getDefaultAgentToolAdapters()` — returns all 6 registered adapters
- `getAgentToolAdapterByKey(adapterKey)` — find by key
- `findAgentToolAdaptersForToolKey(toolKey)` — find all adapters for a tool
- `selectAgentToolAdapterForExecutionRequest(input)` — auto-select best adapter
- `evaluateAgentToolAdapterEligibility(input)` — run eligibility checks

---

## 10. Validation API

- `validateAgentToolAdapterExecutionMode(value)` — type guard
- `validateAgentToolAdapterStatus(value)` — type guard
- `validateAgentToolAdapterExecutionStatus(value)` — type guard
- `validateAgentToolAdapterOutputType(value)` — type guard
- `validateAgentToolAdapterRiskPolicy(value)` — type guard
- `validateAgentToolAdapterSideEffectPolicy(value)` — type guard
- `validateAgentToolAdapterExecutionEventType(value)` — type guard
- `normalizeAgentToolAdapterDefinition(input)` — validate + normalize + deduplicate
- `assertAdapterOutputSerializable(value)` — throws if not JSON-serializable
- `redactAdapterPayload(value)` — redact sensitive keys

---

## 11. Payload Redaction

The following keys are always redacted from input snapshots:
`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`

Redaction is recursive — nested objects are also redacted.

---

## 12. Execution Lifecycle

```
queued → running → succeeded
                 → failed
         refused (eligibility gate)
         cancelled
```

Events emitted at each transition:
- `adapter_execution_created`
- `adapter_eligibility_checked`
- `adapter_execution_started`
- `adapter_execution_succeeded` / `adapter_execution_failed` / `adapter_execution_refused`

---

## 13. Observability Integration

The service emits audit events to `AgentObservabilityService` via dynamic import. All audit calls are non-fatal — observability failures do not affect execution outcomes.

Source type: `agent_tool_adapter_layer`

Audit event types added:
- `adapter_eligibility_checked`
- `adapter_execution_created`
- `adapter_execution_started`
- `adapter_execution_succeeded`
- `adapter_execution_failed`
- `adapter_execution_refused`
- `adapter_execution_cancelled`

---

## 14. API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/agents/execution/adapters` | List all adapters (filterable by tool_key, execution_mode) |
| GET | `/api/agents/execution/adapters/[adapterKey]` | Get adapter by key |
| POST | `/api/agents/execution/requests/[executionRequestId]/adapter-run` | Run adapter for request |
| GET | `/api/agents/execution/adapter-executions` | List adapter executions |
| GET | `/api/agents/execution/adapter-executions/[id]` | Get execution by ID |
| GET | `/api/agents/execution/adapter-executions/[id]/events` | List execution events |

All routes require authentication. All workspace-scoped routes require workspace membership.

---

## 15. Database Schema

### agent_tool_adapter_executions

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace FK |
| execution_request_id | uuid | Execution request FK |
| adapter_key | text | Adapter identifier |
| tool_key | text | Tool key |
| execution_mode | text | dry_run or draft_only |
| execution_status | text | queued/running/succeeded/failed/refused/cancelled |
| output_type | text | Output type |
| input_snapshot_json | jsonb | Raw input snapshot |
| safe_input_snapshot_json | jsonb | Redacted input snapshot |
| output_payload_json | jsonb | Generated output |
| evidence_refs_json | jsonb | Evidence references |
| warnings_json | jsonb | Warnings |
| refusal_reason | text | Reason if refused |
| error_code | text | Error code if failed |
| error_message | text | Error message if failed |
| actor_id | uuid | Actor who triggered execution |
| started_at | timestamptz | Execution start time |
| completed_at | timestamptz | Execution completion time |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Record last updated |

### agent_tool_adapter_execution_events

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace FK |
| adapter_execution_id | uuid | Execution record FK |
| execution_request_id | uuid | Request FK |
| event_type | text | Event type |
| message | text | Human-readable message |
| event_payload_json | jsonb | Event data |
| actor_id | uuid | Actor |
| created_at | timestamptz | Timestamp |

Row-level security is enabled on both tables. Members can read and insert within their workspaces.

---

## 16. In-Memory Persistence

The current implementation uses in-memory `Map` stores for execution records and events. This enables:
- Testing without a database
- Fast local execution
- Future migration to Supabase without API changes

The database schema (migration `20260731000000_agent_tool_execution_adapter_layer.sql`) is provided for production Supabase deployment.

---

## 17. Security Constraints

1. **No external calls** — adapters never call external APIs, send HTTP requests, or open network connections
2. **No LLM calls** — all output is deterministic
3. **No email delivery** — draft emails are never sent
4. **No project mutation** — draft project updates are never applied
5. **External side effects blocked** — `externalSideEffectsEnabled` is validated to be `false` on all adapters
6. **Payload redaction** — sensitive keys are stripped before storage
7. **Mode restriction** — `approved_execution` and `approval_required` modes are blocked at the adapter layer
8. **Risk gating** — critical risk is always blocked; high risk requires approval records

---

## 18. Error Handling

- All adapter execution errors are caught and result in `executionStatus: "failed"`
- Observability/audit errors are caught and swallowed (non-fatal)
- Execution request completion errors (DB unavailable) are caught and swallowed
- Eligibility refusals produce a complete `refused` record with the refusal reason

---

## 19. Integration with Agent Execution Request Runtime

This layer depends on the Agent Execution Request Runtime:
- `getAgentExecutionRequestById` — loads the request
- `completeDryRunExecution` / `completeDraftOnlyExecution` — signals completion
- `failAgentExecution` — signals failure
- `AgentExecutionRequestRecord` — the central input type

---

## 20. Testing

Tests are in `tests/agent-tool-adapter-layer.test.mjs` and run without a database:

```bash
npx tsx --test tests/agent-tool-adapter-layer.test.mjs
```

Test coverage:
- Type union validators (all 7 types)
- `normalizeAgentToolAdapterDefinition` validation
- `redactAdapterPayload` key redaction
- `assertAdapterOutputSerializable` serialization
- Registry: all 6 adapters, selection, eligibility
- Eligibility: all 10 check cases
- Service: in-memory CRUD, refused path
- `generateAdapterOutput`: all 6 adapters
- Migration file content
- Database contract updates
- API route file existence
- Observability type updates
- Index exports
- No-side-effect checks

---

## 21. Database Contract

Types added to `src/lib/db/database-contract.ts`:
- `AgentToolAdapterExecutionRow`
- `AgentToolAdapterExecutionEventRow`
- `AGENT_TOOL_ADAPTER_EXECUTION_COLUMNS`
- `AGENT_TOOL_ADAPTER_EXECUTION_EVENT_COLUMNS`

`DATABASE_CONTRACT_VERSION` updated with suffix: `-agent-tool-execution-adapter-layer`

---

## 22. File Index

| File | Purpose |
|---|---|
| `src/lib/agents/agent-tool-adapter-types.ts` | All type definitions |
| `src/lib/agents/agent-tool-adapter-validation.ts` | Type guards, normalization, redaction |
| `src/lib/agents/agent-tool-adapter-registry.ts` | Default adapters, selection, eligibility |
| `src/lib/agents/agent-tool-adapter-service.ts` | Execution service (in-memory) |
| `src/lib/agents/index.ts` | Public exports |
| `src/lib/agents/agent-observability-types.ts` | Added adapter event/source types |
| `src/lib/db/database-contract.ts` | Added row types + updated version |
| `supabase/migrations/20260731000000_agent_tool_execution_adapter_layer.sql` | DB schema |
| `src/app/api/agents/execution/adapters/route.ts` | List adapters |
| `src/app/api/agents/execution/adapters/[adapterKey]/route.ts` | Get adapter |
| `src/app/api/agents/execution/requests/[executionRequestId]/adapter-run/route.ts` | Run adapter |
| `src/app/api/agents/execution/adapter-executions/route.ts` | List executions |
| `src/app/api/agents/execution/adapter-executions/[adapterExecutionId]/route.ts` | Get execution |
| `src/app/api/agents/execution/adapter-executions/[adapterExecutionId]/events/route.ts` | List events |
| `tests/agent-tool-adapter-layer.test.mjs` | Test suite |
| `docs/agent-tool-execution-adapter-layer.md` | This document |

---

## 23. Supported Scope Types

All adapters support:
`workspace`, `portfolio`, `project`, `pm`, `agent`, `tool_request`, `approval_request`, `memory_record`

---

## 24. Adapter Definition Fields

| Field | Type | Description |
|---|---|---|
| adapterKey | string | Unique adapter identifier |
| displayName | string | Human-readable name |
| description | string | What the adapter does |
| status | AgentToolAdapterStatus | Current status |
| supportedToolKeys | string[] | Tool keys this adapter handles |
| supportedExecutionModes | AgentToolAdapterExecutionMode[] | Modes supported |
| supportedScopeTypes | string[] | Scope types supported |
| outputTypes | AgentToolAdapterOutputType[] | Output types produced |
| riskPolicy | AgentToolAdapterRiskPolicy | Risk level policy |
| sideEffectPolicy | AgentToolAdapterSideEffectPolicy | Side effect policy |
| requiresApprovalByDefault | boolean | Whether approval is required by default |
| supportsDryRun | boolean | Whether dry run is supported |
| supportsDraftOnly | boolean | Whether draft only is supported |
| externalSideEffectsPossible | boolean | Whether external side effects are possible (always false) |
| externalSideEffectsEnabled | boolean | Whether external side effects are enabled (always false) |
| version | string | Adapter version |
| owner | string \| null | Owner identifier |
| policyNotes | string[] | Policy notes |

---

## 25. Governance Principles

1. **Human-in-the-loop** — all output types include `requiresHumanReview: true`
2. **Least privilege** — adapters only access what the execution request provides
3. **Audit trail** — every execution creates an immutable event log
4. **Defense in depth** — eligibility checks are independent layers
5. **Fail safe** — on error, execution refuses rather than partially applying
6. **Separation of concerns** — registry, service, and types are distinct modules

---

## 26. Future Considerations

- Supabase persistence for `agent_tool_adapter_executions` (schema is ready)
- Additional adapter types: `governance_note`, `recommendation`
- Adapter versioning and rollback
- Adapter-level rate limiting
- Cross-adapter evidence correlation
- Approval workflow integration for high-risk `draft_only` adapters

---

## 27. Related Sprints

- **Agent Execution Request Runtime** — provides the request lifecycle
- **Agent Observability & Audit Trail** — provides the audit event infrastructure
- **Agent Memory & Context Layer** — provides memory IDs referenced in evidence

---

## 28. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-07-31 | Initial implementation |
