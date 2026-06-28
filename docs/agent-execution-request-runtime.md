# Agent Execution Request Runtime

The Agent Execution Request Runtime governs the full lifecycle of agent tool execution requests in PMFreak. It provides a structured, auditable, and approval-gated mechanism for agents to request and execute tools within workspace governance constraints.

## Design Principles

- No LLM calls: all logic is deterministic rule-based
- No real tool execution: the runtime manages lifecycle only
- Observability integration is non-fatal (wrapped in try/catch)
- All DB operations use Supabase server client with RLS
- Payloads are validated, size-limited (50KB), and redacted of secrets

## Execution Modes

| Mode | Description |
|------|-------------|
| `dry_run` | Simulates execution without side effects |
| `draft_only` | Produces draft artifacts only |
| `approval_required` | Requires human approval before execution |
| `approved_execution` | Pre-approved, can execute directly |

## Execution States (12)

```
draft → pending_preflight → ready_for_execution → completed
                         → pending_approval → approved → ready_for_execution
                         → preflight_failed → pending_preflight (retry)
                         → blocked → (cancelled | expired)
```

Terminal states: `completed`, `failed`, `cancelled`, `expired`

## Risk Levels

- `low`: minimal risk, can proceed directly
- `medium`: default, standard checks
- `high`: requires approval
- `critical`: requires approval, elevated scrutiny

## State Machine Transitions

| From | Allowed To |
|------|------------|
| `draft` | `pending_preflight`, `cancelled` |
| `pending_preflight` | `ready_for_execution`, `pending_approval`, `preflight_failed`, `blocked`, `cancelled` |
| `preflight_failed` | `pending_preflight`, `cancelled`, `expired` |
| `blocked` | `cancelled`, `expired` |
| `pending_approval` | `approved`, `blocked`, `cancelled`, `expired` |
| `approved` | `ready_for_execution`, `cancelled`, `expired` |
| `ready_for_execution` | `completed`, `failed`, `cancelled`, `expired` |
| `executing` | `completed`, `failed`, `cancelled` |
| `completed` | (none) |
| `failed` | (none) |
| `cancelled` | (none) |
| `expired` | (none) |

## Preflight Checks

1. **Tool existence**: verifies tool is registered in the tool registry
2. **Risk-based approval**: `high`/`critical` risk auto-requires approval
3. **Mode-based approval**: `approval_required` mode auto-requires approval

## Scope Types (8)

`workspace`, `portfolio`, `project`, `pm`, `agent`, `tool_request`, `approval_request`, `memory_record`

## Source Types (6)

`api`, `agent`, `scheduler`, `webhook`, `system`, `user`

## Event Types (15)

`execution_request_created`, `execution_request_updated`, `execution_preflight_started`, `execution_preflight_passed`, `execution_preflight_failed`, `execution_blocked`, `execution_pending_approval`, `execution_approved`, `execution_ready`, `execution_dry_run_completed`, `execution_draft_completed`, `execution_cancelled`, `execution_expired`, `execution_failed`, `execution_state_transition`

## Preflight Statuses (5)

`not_started`, `in_progress`, `passed`, `failed`, `skipped`

## Payload Safety

- Maximum payload size: 50KB (enforced at validation)
- Redacted keys: `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`

## Database Tables

### `agent_execution_requests`

Main table tracking execution request lifecycle with all columns for correlation, scoping, preflight, approval, and result tracking. RLS: members read/insert, admins update.

### `agent_execution_events`

Audit trail of all state transitions and events for a request. Immutable append-only log. RLS: members read/insert.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents/execution/requests` | Member | List requests |
| POST | `/api/agents/execution/requests` | Member | Create request |
| GET | `/api/agents/execution/requests/:id` | Member | Get request |
| POST | `/api/agents/execution/requests/:id/preflight` | Member | Run preflight |
| POST | `/api/agents/execution/requests/:id/approve` | Admin | Approve request |
| POST | `/api/agents/execution/requests/:id/ready` | Admin | Mark ready |
| POST | `/api/agents/execution/requests/:id/complete-dry-run` | Member | Complete dry run |
| POST | `/api/agents/execution/requests/:id/complete-draft` | Member | Complete draft |
| POST | `/api/agents/execution/requests/:id/cancel` | Member | Cancel request |
| POST | `/api/agents/execution/requests/:id/expire` | Admin | Expire request |
| POST | `/api/agents/execution/requests/:id/fail` | Admin | Fail request |
| GET | `/api/agents/execution/requests/:id/events` | Member | List events |

## Service Functions

- `createGovernedAgentExecutionRequest`: validates, normalizes, redacts payload, creates in draft state
- `runAgentExecutionPreflight`: checks tool existence, risk, mode; determines next state
- `approveAgentExecutionRequest`: transitions `pending_approval → approved`
- `markAgentExecutionReady`: transitions `approved → ready_for_execution`
- `completeDryRunExecution`: dry_run mode only, transitions to completed
- `completeDraftOnlyExecution`: draft_only mode only, transitions to completed
- `cancelAgentExecutionRequest`: cancels from any non-terminal state
- `expireAgentExecutionRequest`: expires from any non-terminal state
- `failAgentExecution`: fails execution with error code/message

## Integration with Observability

Execution events are recorded to both the local `agent_execution_events` table and (non-fatally) to the Agent Observability audit trail. The `execution` category and `agent_execution_runtime` source type are added to `AgentAuditEventCategory` and `AgentAuditSourceType` respectively.

## Constraints

- No LLM or AI calls anywhere in this layer
- No real tool execution — lifecycle management only
- All observability calls wrapped in try/catch (non-fatal)
- State machine enforces valid transitions; invalid transitions throw
- Payloads validated for JSON safety and size before storage
