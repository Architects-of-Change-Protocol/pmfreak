# Agent Permission & Approval Layer

## Overview

The Agent Permission & Approval Layer governs how AI agents request and receive authorization to use tools that require human oversight. It provides a full audit trail, approval lifecycle management, and a clean service API for integrating approval workflows into agent pipelines.

This layer sits on top of the [Agent Tool Registry](../supabase/migrations/20260726000000_agent_tool_registry.sql) and adds:

- **Request lifecycle** — agents request tool access; humans approve or reject
- **Decision records** — all approvals/rejections are stored with actor, timestamp, and notes
- **Revocation** — approved access can be revoked at any time
- **Audit events** — every state transition emits a structured event record
- **Authorization state query** — a single call returns the current authorization state for any agent+tool pair

---

## Database Tables

### `agent_tool_requests`

Records an agent's request to use a tool that requires human approval.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `agent_id` | text | Identifies the requesting agent |
| `agent_type` | text | Agent type (e.g. "copilot", "analyzer") |
| `tool_id` | uuid FK → agent_tools | |
| `tool_key` | text | Denormalized for fast lookup |
| `status` | text | `pending`, `approved`, `rejected`, `cancelled`, `expired` |
| `request_reason` | text | Optional human-readable justification |
| `request_context_json` | text | JSON blob of context payload |
| `requested_by` | text | User or system that initiated the request |
| `requested_at` | timestamptz | |
| `expires_at` | timestamptz | Optional TTL |
| `resolved_at` | timestamptz | Set when status leaves `pending` |
| `created_at` / `updated_at` | timestamptz | |

### `agent_tool_approvals`

Records the human decision on a tool request.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `request_id` | uuid FK → agent_tool_requests | |
| `workspace_id` | uuid FK → workspaces | |
| `decision` | text | `approved` or `rejected` |
| `decided_by` | text | User who made the decision |
| `decision_note` | text | Optional note |
| `decided_at` | timestamptz | |
| `revoked_at` | timestamptz | Null unless approval has been revoked |
| `revoked_by` | text | |
| `revocation_note` | text | |
| `created_at` / `updated_at` | timestamptz | |

### `agent_tool_approval_events`

Immutable audit trail for all state transitions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `request_id` | uuid FK → agent_tool_requests | |
| `workspace_id` | uuid FK → workspaces | |
| `event_type` | text | See event types below |
| `actor` | text | User or system that triggered the event |
| `note` | text | Optional human-readable note |
| `metadata_json` | text | JSON structured metadata |
| `created_at` | timestamptz | |

#### Event types

- `request_created` — a new approval request was submitted
- `request_approved` — a human approved the request
- `request_rejected` — a human rejected the request
- `request_cancelled` — the requester cancelled the pending request
- `request_expired` — the request TTL expired before a decision was made
- `approval_revoked` — a previously granted approval was revoked

---

## Row-Level Security

All three tables are RLS-protected:

- **Read**: any workspace member (`workspace_memberships` lookup)
- **Insert** (requests): any workspace member
- **Write** (approvals, events, request updates): `owner` or `admin` role only

---

## TypeScript Modules

### `src/lib/agents/agent-tool-approval-types.ts`

All domain types. Key types:

- `AgentToolRequestStatus` — `pending | approved | rejected | cancelled | expired`
- `AgentToolApprovalDecision` — `approved | rejected`
- `AgentToolApprovalEventType` — all event types
- `AgentToolAuthorizationState` — current state of a tool authorization
- `AgentToolRequestRecord` — request domain object
- `AgentToolApprovalRecord` — approval decision domain object
- `AgentToolApprovalEventRecord` — audit event domain object
- `AgentToolAuthorizationResult` — returned by `getAgentToolAuthorizationState`
- `CreateAgentToolRequestInput` / `DecideAgentToolApprovalInput` — input types

### `src/lib/agents/agent-tool-approval-validation.ts`

Pure validation helpers:

- `detectSensitivePayloadKeys(context)` — scans a request context object for sensitive field names
- `validateRequestContext(context)` — returns an error string if sensitive keys are present
- `validateCreateAgentToolRequestInput(input)` — full validation for request creation
- `validateDecideAgentToolApprovalInput(input)` — full validation for approval decisions
- `isValidApprovalDecision(value)` — type guard

#### Sensitive key guard

The following keys are rejected in `requestContext` payloads:

`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`, `private_key`

This check recurses into nested objects.

### `src/lib/agents/agent-tool-approval-policy.ts`

```ts
requiresApprovalForTool(tool: AgentToolRecord): { required: boolean; reason: string | null }
```

Returns whether a tool requires human approval based on:

1. `requiresHumanApproval === true` — explicit flag
2. `executionMode === "requires_approval"` — mode-based
3. `riskLevel === "critical"` — always requires approval
4. `riskLevel === "high" && mutatesState === true` — high-risk state mutation

### `src/lib/agents/agent-tool-approval-registry.ts`

Database access layer. Functions:

- `createAgentToolRequest(input)` — insert a new request row
- `getAgentToolRequestById(workspaceId, requestId)` — fetch by ID
- `listAgentToolRequests(workspaceId, filters)` — filtered list with pagination
- `updateAgentToolRequestStatus(workspaceId, requestId, status)` — update status
- `recordAgentToolApproval(input)` — insert a decision record
- `listApprovalsForRequest(workspaceId, requestId)` — get decisions for a request
- `revokeAgentToolApprovalRecord(workspaceId, approvalId, revokedBy, note)` — mark approval revoked
- `recordAgentToolApprovalEvent(input)` — insert an audit event
- `listApprovalEventsForRequest(workspaceId, requestId)` — get audit trail for a request

### `src/lib/agents/agent-tool-approval-service.ts`

Business logic layer. Functions:

#### `requestAgentToolAuthorization(input: CreateAgentToolRequestInput)`

Submits a new tool authorization request. Validates input, checks tool eligibility (with `allowApprovalRequiredTools: true`), enforces approval policy, creates the request record, and emits a `request_created` event.

Returns `{ ok: true; request }` or `{ ok: false; error }`.

#### `decideAgentToolApproval(input: DecideAgentToolApprovalInput)`

Records an approval or rejection decision on a pending request. Validates that the request is still pending (and not expired), records the approval, updates request status, and emits the appropriate event.

Returns `{ ok: true; request; approval }` or `{ ok: false; error }`.

#### `getAgentToolAuthorizationState(workspaceId, agentId, toolKey)`

Returns the current `AgentToolAuthorizationResult` for an agent+tool pair. Inspects all requests for the pair and resolves to one of: `authorized`, `pending`, `rejected`, `revoked`, `not_requested`, `expired`.

#### `cancelAgentToolRequest(workspaceId, requestId, cancelledBy?)`

Cancels a pending request. Only `pending` requests can be cancelled. Emits `request_cancelled` event.

#### `revokeAgentToolApproval(workspaceId, requestId, revokedBy, revocationNote?)`

Revokes the active approval on an approved request. Only `approved` requests with an active (non-revoked) approval can be revoked. Emits `approval_revoked` event.

---

## API Routes

All routes are under `/api/agents/tool-requests`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/agents/tool-requests` | member | Submit a new tool authorization request |
| `GET` | `/api/agents/tool-requests` | member | List requests with optional filters |
| `GET` | `/api/agents/tool-requests/[requestId]` | member | Get a single request |
| `POST` | `/api/agents/tool-requests/[requestId]/approve` | admin | Approve a pending request |
| `POST` | `/api/agents/tool-requests/[requestId]/reject` | admin | Reject a pending request |
| `POST` | `/api/agents/tool-requests/[requestId]/cancel` | member | Cancel a pending request |
| `POST` | `/api/agents/tool-requests/[requestId]/revoke` | admin | Revoke an approved request |
| `GET` | `/api/agents/tool-requests/[requestId]/events` | member | Get the audit event trail |

### Request body shape (POST `/api/agents/tool-requests`)

```json
{
  "workspaceId": "uuid",
  "agentId": "string",
  "agentType": "string",
  "toolKey": "string",
  "requestReason": "optional string",
  "requestContext": { "optional": "metadata" },
  "requestedBy": "optional user id",
  "expiresAt": "optional ISO timestamp"
}
```

### Decision body shape (approve/reject)

```json
{
  "workspaceId": "uuid",
  "decidedBy": "optional — defaults to authenticated user id",
  "decisionNote": "optional string"
}
```

---

## Usage example

```ts
import {
  requestAgentToolAuthorization,
  decideAgentToolApproval,
  getAgentToolAuthorizationState,
  cancelAgentToolRequest,
  revokeAgentToolApproval,
} from "@/lib/agents";

// 1. Agent requests authorization
const result = await requestAgentToolAuthorization({
  workspaceId: "ws-abc",
  agentId: "agent-xyz",
  agentType: "copilot",
  toolKey: "draft_client_email",
  requestReason: "Drafting update for Project Alpha client",
  requestContext: { projectId: "proj-1" },
  requestedBy: "user-123",
});

if (result.ok) {
  console.log("Request created:", result.request.id);
}

// 2. Human approves
const decision = await decideAgentToolApproval({
  requestId: result.request.id,
  workspaceId: "ws-abc",
  decision: "approved",
  decidedBy: "admin-user-id",
  decisionNote: "Approved for this session.",
});

// 3. Check state
const state = await getAgentToolAuthorizationState("ws-abc", "agent-xyz", "draft_client_email");
// state.state === "authorized"

// 4. Revoke if needed
await revokeAgentToolApproval("ws-abc", result.request.id, "admin-user-id", "No longer needed.");
```

---

## What this sprint does NOT implement

- **Tool execution** — this layer only manages authorization records
- **Polling/webhooks** — consumers must query `getAgentToolAuthorizationState` themselves
- **Email/notification on approval** — out of scope for this sprint
- **Per-session vs persistent approvals** — all approvals are persistent until revoked

---

## Tests

See `tests/agent-tool-approval.test.mjs` for comprehensive coverage of:

- Type definitions
- Sensitive payload guard
- Request and decision validation
- Policy logic
- Registry function exports
- Service function exports and behavior
- Authorization state computation
- Migration schema
- Database contract
- Index exports
- API route existence and access control
