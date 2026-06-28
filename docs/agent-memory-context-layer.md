# Agent Memory & Context Layer

## Purpose

The Agent Memory & Context Layer gives PMFreak a formal, governed model for what context an agent can know, where that context came from, how long it may be retained, whether it contains sensitive information, and whether it may be used for future reasoning.

This layer does not implement LLM inference, embeddings, or autonomous execution. It creates the governance foundation that future reasoning layers will build upon.

## Scope

This sprint introduces:

- Agent context scope types
- Agent memory kinds
- Memory status lifecycle model
- Sensitivity classification model
- Retention policy model
- Context source/provenance model
- Memory event/audit types
- `agent_context_policies` database table
- `agent_memory_records` database table
- `agent_memory_events` database table
- `agent_context_windows` database table
- Row-level security policies
- Database contract updates
- Memory/context validation helpers
- Policy evaluation helper
- Repository (DB) functions
- Service functions
- Memory access authorization helper
- API routes under `/api/agents/memory` and `/api/agents/context-policies`
- Tests
- This documentation

## Non-Goals

This sprint does **not** implement:

- Vector search or semantic retrieval
- LLM summarization or inference
- Embeddings
- Autonomous memory updates
- External data ingestion (Slack, Gmail, Jira, GitHub, etc.)
- Actual tool execution
- Automatic project mutation
- Hidden cross-project or cross-workspace memory
- Model fine-tuning or prompt injection defense
- Full legal hold / data loss prevention platform
- AOC Agent Passport integration

> The Agent Memory & Context Layer does not call LLMs, create embeddings, or execute tools. It creates governed memory/context records, policies, access checks, and audit events only.

## Relationship to Previous Sprints

| Layer | Relationship |
|---|---|
| Agent Specification Framework | Defines what agent types exist and their governed properties |
| Agent Tool Registry | Defines tools agents can request; memory may capture tool-related context |
| Agent Permission & Approval Layer | Tool requests and approval decisions can be memory source types (`tool_request`, `approval_decision`) |
| Agent Memory & Context Layer (this) | Adds the governed memory and context model that future agent reasoning will rely on |

## Context Scope Model

A **context scope** defines the boundary within which a piece of memory is valid.

| Scope Type | Meaning |
|---|---|
| `workspace` | Applies broadly inside a workspace if policy allows |
| `portfolio` | Applies to a portfolio or multi-project grouping |
| `project` | Applies to a specific project |
| `pm` | Applies to a specific project manager |
| `agent` | Applies to a specific agent or agent type |
| `tool_request` | Applies to a specific tool request |
| `approval_request` | Applies to a specific approval decision |

## Memory Kind Model

| Kind | Meaning |
|---|---|
| `fact` | Stable fact from project/workspace/PM context |
| `summary` | Human-readable summary of a larger context |
| `decision` | Decision made by PM, PMO, sponsor, client, or governance process |
| `risk` | Risk or exposure that may influence future recommendations |
| `issue` | Active or historical issue/blocker |
| `preference` | Stated preference from PM, client, stakeholder, or workspace |
| `constraint` | Deadline, budget, policy, capacity, or contractual boundary |
| `lesson_learned` | Retrospective learning that may inform future PMO recommendations |
| `operating_context` | Useful working context that frames how an agent should interpret a situation |
| `evidence_reference` | Pointer to source evidence, artifact, report, approval, or event |

## Sensitivity Model

| Level | Meaning |
|---|---|
| `public` | Safe to use broadly inside normal product flows |
| `internal` | Internal workspace/project context |
| `confidential` | Sensitive project, PM, client, financial, or operational information |
| `restricted` | Highly sensitive; requires explicit policy allowance or approval |

Sensitivity is ranked: `public < internal < confidential < restricted`.

Policy enforcement uses this rank to determine whether a memory's sensitivity exceeds what is permitted.

## Retention Policy Model

| Policy | Behavior |
|---|---|
| `session_only` | Do not persist beyond current session/request flow (~24h default expiry) |
| `short_term` | Retain for a limited period (default 30 days) |
| `project_lifetime` | Retain while the project is active and governed |
| `workspace_lifetime` | Retain at workspace level until manually archived/revoked |
| `custom` | Use `retentionDays` or `expiresAt` |

## Memory Status Lifecycle

```
active → stale → archived
active → expired
active → revoked
stale  → revoked
stale  → archived
```

| Status | Meaning |
|---|---|
| `active` | Memory can be considered for agent use |
| `stale` | Memory exists but may require refresh before use |
| `expired` | Passed retention boundary; must not be used |
| `revoked` | Explicitly revoked; must not be used |
| `archived` | Preserved for audit/history; not active for agent use |

No memory records are hard-deleted. All status changes are recorded as events.

## Context Policy Model

A **context policy** governs what agents may access or retain in a workspace.

Key controls:

| Field | Purpose |
|---|---|
| `allowedScopeTypes` | Which scopes are permitted (empty = all) |
| `allowedMemoryKinds` | Which memory kinds are permitted (empty = all) |
| `maxSensitivity` | Maximum permitted sensitivity level |
| `allowCrossProjectMemory` | Whether memory from one project can cross to another |
| `allowCrossPmMemory` | Whether PM-scoped memory can cross PM boundaries |
| `allowPortfolioMemory` | Whether portfolio-level memory is permitted |
| `allowRestrictedMemory` | Whether restricted-sensitivity memory can be created |
| `requireApprovalForConfidential` | Whether confidential memory requires approval |
| `requireApprovalForRestricted` | Whether restricted memory requires approval |
| `hideExpiredMemory` | Whether expired memory is excluded from listings |
| `defaultRetentionPolicy` | Default retention policy for new memories |
| `defaultRetentionDays` | Default retention days for `short_term` |

## Data Model

### `agent_context_policies`

Workspace-level policies governing agent memory access and retention.

Unique constraint: `(workspace_id, policy_key)`.

### `agent_memory_records`

Governed records of context that agents may use. Every record has:
- A workspace, scope type, memory kind, sensitivity, retention policy, and status
- Source provenance (type, ID, URI, free-form JSON)
- Expiration and stale timestamps
- Access count and last accessed tracking

### `agent_memory_events`

Append-only audit log for all memory lifecycle events. References `workspace_id` and optionally `memory_id`.

### `agent_context_windows`

Reusable context window definitions for agent/project/PM use. Scoped by workspace, agent type, scope type, and scope ID. Unique constraint: `(workspace_id, window_key)`.

## RLS / Security Model

All tables have RLS enabled.

| Table | Read | Insert | Update |
|---|---|---|---|
| `agent_context_policies` | Workspace members | Workspace owner/admin | Workspace owner/admin |
| `agent_memory_records` | Workspace members | Workspace members | Workspace owner/admin |
| `agent_memory_events` | Workspace members | Workspace members | — |
| `agent_context_windows` | Workspace members | Workspace owner/admin | Workspace owner/admin |

No permissive `using (true)` policies exist. All policies use workspace membership checks.

## API Routes

### Memory

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/agents/memory` | Workspace member |
| `GET` | `/api/agents/memory` | Workspace member |
| `GET` | `/api/agents/memory/[memoryId]` | Workspace member |
| `POST` | `/api/agents/memory/[memoryId]/access` | Workspace member |
| `POST` | `/api/agents/memory/[memoryId]/stale` | Workspace owner/admin |
| `POST` | `/api/agents/memory/[memoryId]/expire` | Workspace owner/admin |
| `POST` | `/api/agents/memory/[memoryId]/revoke` | Workspace owner/admin |
| `POST` | `/api/agents/memory/[memoryId]/archive` | Workspace owner/admin |
| `GET` | `/api/agents/memory/[memoryId]/events` | Workspace member |

### Context Policies

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/agents/context-policies/defaults` | Workspace owner/admin |
| `GET` | `/api/agents/context-policies` | Workspace member |
| `POST` | `/api/agents/context-policies` | Workspace owner/admin |
| `GET` | `/api/agents/context-policies/[policyKey]` | Workspace member |

## Event / Audit Model

All memory lifecycle changes produce `agent_memory_events` records.

| Event Type | Triggered By |
|---|---|
| `memory_created` | `createGovernedAgentMemory` |
| `memory_updated` | Manual updates |
| `memory_accessed` | `checkAgentMemoryAccess` (on allowed access) |
| `memory_policy_evaluated` | Policy evaluation during creation |
| `memory_marked_stale` | `markMemoryStale` |
| `memory_expired` | `expireMemory` |
| `memory_revoked` | `revokeMemory` |
| `memory_archived` | `archiveMemory` |
| `sensitivity_changed` | Sensitivity lifecycle changes |
| `retention_changed` | Retention policy updates |
| `source_refreshed` | Source refresh events |

## Example Memory Record

```json
{
  "id": "mem_abc123",
  "workspaceId": "ws_xyz",
  "agentType": "project_assistant",
  "scopeType": "project",
  "scopeId": "proj_456",
  "memoryKind": "decision",
  "title": "Client approved revised delivery window",
  "summary": "The client accepted a revised delivery window after reviewing updated constraints.",
  "sourceType": "meeting_notes",
  "sourceId": "meeting_123",
  "provenance": {
    "meetingDate": "2026-07-28",
    "capturedBy": "PM"
  },
  "sensitivity": "internal",
  "retentionPolicy": "project_lifetime",
  "status": "active",
  "accessCount": 0,
  "createdAt": "2026-07-28T10:00:00Z",
  "updatedAt": "2026-07-28T10:00:00Z"
}
```

## Example Context Policy

```json
{
  "policyKey": "default_agent_context_policy",
  "displayName": "Default Agent Context Policy",
  "allowedScopeTypes": ["workspace", "portfolio", "project", "pm", "agent", "tool_request", "approval_request"],
  "allowedMemoryKinds": ["fact", "summary", "decision", "risk", "issue", "preference", "constraint", "lesson_learned", "operating_context", "evidence_reference"],
  "maxSensitivity": "confidential",
  "defaultRetentionPolicy": "short_term",
  "defaultRetentionDays": 30,
  "allowCrossProjectMemory": false,
  "allowCrossPmMemory": false,
  "allowPortfolioMemory": true,
  "allowRestrictedMemory": false,
  "requireApprovalForConfidential": true,
  "requireApprovalForRestricted": true,
  "hideExpiredMemory": true,
  "status": "active"
}
```

## Example Access Result

```json
{
  "memoryId": "mem_abc123",
  "accessState": "allowed",
  "allowed": true,
  "reasonCode": "allowed",
  "message": "Memory access granted.",
  "sensitivity": "internal"
}
```

Denied example:

```json
{
  "memoryId": "mem_abc123",
  "accessState": "denied",
  "allowed": false,
  "reasonCode": "sensitivity_not_allowed",
  "message": "Memory sensitivity \"confidential\" exceeds allowed level \"internal\"."
}
```

## Local Testing Guide

```bash
# Run memory/context tests
node --experimental-strip-types --test tests/agent-memory-context.test.mjs

# Run all agent tests
node --experimental-strip-types --test tests/agent-tool-registry.test.mjs
node --experimental-strip-types --test tests/agent-tool-approval.test.mjs
node --experimental-strip-types --test tests/agent-memory-context.test.mjs

# Typecheck
npm run typecheck

# Build
npm run build
```

## Validation Commands

```bash
npm run typecheck
npm test
npm run build
```

## Known Limitations

1. **No approval workflow for confidential/restricted memory.** When policy requires approval for confidential/restricted memory, the current implementation creates the record with status `stale` (pending review). A full memory approval workflow is deferred to a future sprint.

2. **No automatic expiry sweep.** Expired memory is excluded from queries by default, but a background job to automatically transition `active` records to `expired` based on `expires_at` is not yet implemented.

3. **No context window population.** The `agent_context_windows` table and its schema exist, but the service layer for managing context window membership (adding/removing memory records) is deferred.

4. **No cross-workspace memory guard at DB layer.** Cross-workspace isolation is enforced at the API and service layer via `workspace_id` scoping. RLS reinforces this.

5. **actorId from request body is not validated against session.** Current route convention does not expose the authenticated user ID from server-authorization helpers in all lifecycle routes. The `actorId` is taken from the authenticated user session where available.

6. **No vector search or semantic retrieval.** Memory records hold text content only. Retrieval is by structured filter (scope, kind, sensitivity, status). Embedding-based retrieval belongs to a future sprint.

## Suggested Next Sprint

**Agent Observability & Audit Trail**

Now that PMFreak has governed agent specifications, tool registry, approval gates, and governed memory/context, the next layer should make agent behavior observable across the system.

That sprint should add:

- Agent activity events
- Agent decision events
- Tool request timeline
- Memory access timeline
- Approval timeline
- Workspace-level agent audit log
- Actor attribution
- Risk/event filters
- PMO governance review view
- Audit export foundation
