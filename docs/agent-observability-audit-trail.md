# Agent Observability & Audit Trail

## Purpose

The Agent Observability & Audit Trail layer gives PMFreak a unified, governed timeline of agent behavior. Every meaningful agent action leaves an audit footprint that is attributable, scoped, timestamped, risk-classified, safely payloaded, queryable, exportable, and safe to show to authorized PMO and governance users.

## Scope

This layer introduces:

- Agent audit event model
- Agent decision event model
- Event severity, outcome, source, scope, and category models
- Correlation ID support
- Audit-safe payload validation and redaction
- Observability repository and service functions
- Timeline aggregation
- Workspace audit summary
- Audit export (JSON, CSV, Markdown)
- API routes under `/api/agents/audit/`
- Database tables with RLS
- Tests

## Non-goals

The Agent Observability & Audit Trail layer does not execute tools, call LLMs, create embeddings, or autonomously mutate project state. It records audit-safe events, decisions, timelines, summaries, and exports only.

This layer does not:

- Build a full analytics warehouse
- Implement real-time streaming
- Perform anomaly detection or ML-based risk scoring
- Capture raw LLM prompts or responses
- Replace existing feature-specific event tables
- Implement tool execution or autonomous project mutation

## Relationship to Prior Layers

| Layer | Relationship |
|---|---|
| Agent Specification Framework | Agents that are registered emit `agent_registered` / `agent_updated` audit events |
| Agent Tool Registry | Tool eligibility checks can emit `tool_eligibility_checked` events |
| Agent Permission & Approval Layer | Tool request lifecycle emits tool request events via `recordToolRequestAuditEvent` |
| Agent Memory & Context Layer | Memory lifecycle events can emit memory events via `recordMemoryAuditEvent` |

Existing layers are not forced to emit into the unified audit trail immediately. Helper functions are provided for future integration points.

## Audit Event Model

An `AgentAuditEventRecord` captures:

| Field | Purpose |
|---|---|
| `id` | UUID |
| `workspaceId` | Workspace scope |
| `correlationId` | Links related events across layers |
| `category` | Event category (tool, memory, approval, etc.) |
| `eventType` | Specific event type |
| `severity` | Risk classification |
| `outcome` | Result of the action |
| `sourceType` | Which subsystem generated the event |
| `scopeType` / `scopeId` | Governance scope |
| `agentId` / `agentType` | Agent attribution |
| `actorId` | Human actor if applicable |
| `projectId` / `pmId` / `portfolioId` | Business scope |
| `toolKey` / `toolRequestId` / `approvalRequestId` / `memoryId` | Cross-references |
| `title` | Human-readable summary |
| `message` | Optional detail |
| `reasonCode` | Machine-readable reason |
| `redactedPayload` | Safe audit payload with secrets stripped |
| `evidenceRefs` | References to related records |
| `occurredAt` | When the event happened |

## Decision Event Model

An `AgentDecisionEventRecord` captures a decision, recommendation, classification, or proposed action:

| Field | Purpose |
|---|---|
| `decisionType` | Type of decision |
| `status` | Lifecycle status (draft → proposed → accepted/rejected) |
| `confidenceScore` | Optional 0–1 confidence |
| `riskLevel` | Risk classification |
| `summary` / `rationale` | Human-readable content |
| `decisionPayload` | Safe structured payload |
| `auditEventId` | Optional link to audit event |

## Severity Model

| Value | Meaning |
|---|---|
| `info` | Normal, expected event |
| `notice` | Important but not risky |
| `warning` | Elevated risk, needs attention |
| `high` | High-risk: denied access, sensitive action, serious governance concern |
| `critical` | Critical security or governance issue |

## Outcome Model

| Value | Meaning |
|---|---|
| `success` | Action completed |
| `denied` | Blocked by policy or authorization |
| `pending` | Awaiting decision |
| `failed` | Technical failure |
| `cancelled` | Cancelled before completion |
| `revoked` | Previously granted, now revoked |
| `expired` | Expired before use |

## Source Model

`AgentAuditSourceType` values:
- `agent_specification` — agent registration/lifecycle
- `agent_tool_registry` — tool eligibility and assignment
- `agent_tool_approval` — tool request/approval workflow
- `agent_memory_context` — memory access and lifecycle
- `pmo_governance` — PMO governance checks
- `pmo_command_center` — PMO command center actions
- `executive_reporting` — report generation
- `system` — internal system events
- `api` — direct API call

## Scope Model

`AgentAuditScopeType` values:
`workspace`, `portfolio`, `project`, `pm`, `agent`, `tool_request`, `approval_request`, `memory_record`, `context_policy`, `report`

## Correlation ID

A `correlationId` connects related events across a single agent workflow. For example, all events from one tool request lifecycle (eligibility check → approval request → approval decision → memory access) can share one `correlationId`. The timeline and list APIs support filtering by `correlationId`.

## Audit-Safe Payload & Redaction

All audit payloads are passed through `redactAuditPayload` before persistence. Keys matching any of the following patterns are replaced with `[REDACTED]`:

```
password, secret, token, apiKey, api_key, authorization,
stripe_secret, private_key, credential, client_secret,
refresh_token, access_token, session_cookie, cookie
```

`assertAuditPayloadSerializable` enforces that payloads are JSON-serializable and under 50 KB. Only `redacted_payload_json` is surfaced through API responses.

## Data Model

### Tables

- `agent_audit_events` — primary audit record
- `agent_decision_events` — decision/recommendation records
- `agent_audit_exports` — persisted export artifacts

### Migration

`supabase/migrations/20260729000000_agent_observability_audit_trail.sql`

## RLS / Security Model

| Table | Policy |
|---|---|
| `agent_audit_events` | Workspace members read + insert |
| `agent_decision_events` | Workspace members read + insert; owner/admin update |
| `agent_audit_exports` | Owner/admin read + insert only |

No permissive `using (true)` policies. RLS is enabled on all three tables. Audit events are not globally readable.

## API Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/agents/audit/events` | workspace member | Record audit event |
| GET | `/api/agents/audit/events` | workspace member | List audit events |
| GET | `/api/agents/audit/events/[eventId]` | workspace member | Get audit event |
| POST | `/api/agents/audit/decisions` | workspace member | Record decision |
| GET | `/api/agents/audit/decisions` | workspace member | List decisions |
| GET | `/api/agents/audit/decisions/[decisionId]` | workspace member | Get decision |
| PATCH | `/api/agents/audit/decisions/[decisionId]` | owner/admin | Update decision status |
| GET | `/api/agents/audit/timeline` | workspace member | Get unified timeline |
| GET | `/api/agents/audit/summary` | workspace member | Get workspace summary |
| POST | `/api/agents/audit/exports` | owner/admin | Create audit export |
| GET | `/api/agents/audit/exports` | owner/admin | List exports |
| GET | `/api/agents/audit/exports/[exportId]` | owner/admin | Get export content |

## Timeline Behavior

`getAgentTimeline` returns a unified sorted list of `AgentTimelineEntry` records from `agent_audit_events`. Entries are sorted newest first. Supported filters: `correlationId`, `agentId`, `agentType`, `projectId`, `pmId`, `portfolioId`, `scopeType`, `scopeId`, `limit`.

Future enhancement: merge in tool request events and memory events from feature-specific tables.

## Summary Behavior

`getWorkspaceAgentAuditSummary` returns:
- `totalEvents`
- `byCategory` — event count by category
- `bySeverity` — event count by severity
- `byOutcome` — event count by outcome
- `highRiskCount` — count of `severity = 'high'`
- `deniedCount` — count of `outcome = 'denied'`
- `criticalCount` — count of `severity = 'critical'`

## Audit Export Behavior

`exportAgentAuditTrail` supports three formats:

**JSON** — includes metadata, filters applied, and events array with only redacted payloads.

**CSV** — tab-separated columns: `occurredAt`, `category`, `eventType`, `severity`, `outcome`, `sourceType`, `scopeType`, `scopeId`, `agentType`, `actorId`, `projectId`, `pmId`, `toolKey`, `title`, `reasonCode`, `correlationId`. Values are properly escaped.

**Markdown** — includes `# Agent Audit Trail` header, metadata, summary, and one entry per event.

All exports persist to `agent_audit_exports`. A `audit_export_created` audit event is recorded automatically.

## Example Audit Event

```json
{
  "id": "aae_abc123",
  "workspaceId": "ws_xyz",
  "correlationId": "corr_req_789",
  "category": "tool",
  "eventType": "tool_request_created",
  "severity": "notice",
  "outcome": "pending",
  "sourceType": "agent_tool_approval",
  "scopeType": "tool_request",
  "scopeId": "req_789",
  "agentType": "project_assistant",
  "toolKey": "draft_client_email",
  "title": "Tool request created: draft_client_email",
  "reasonCode": "human_approval_required",
  "evidenceRefs": ["tool_request:req_789"],
  "occurredAt": "2026-07-29T10:00:00.000Z"
}
```

## Example Decision Event

```json
{
  "id": "ade_def456",
  "workspaceId": "ws_xyz",
  "correlationId": "corr_req_789",
  "agentType": "pmo_analyst",
  "decisionType": "recommendation",
  "status": "proposed",
  "scopeType": "project",
  "scopeId": "proj_123",
  "title": "Recommend escalation",
  "summary": "Project should be escalated due to repeated schedule risk.",
  "confidenceScore": 0.82,
  "riskLevel": "medium",
  "evidenceRefs": ["memory:mem_abc", "tool_request:req_789"]
}
```

## Example Timeline Response

```json
{
  "timeline": [
    {
      "id": "aae_latest",
      "source": "audit_event",
      "occurredAt": "2026-07-29T10:05:00.000Z",
      "category": "tool",
      "eventType": "tool_request_approved",
      "title": "Tool request approved: draft_client_email",
      "severity": "notice",
      "outcome": "success",
      "correlationId": "corr_req_789"
    },
    {
      "id": "aae_abc123",
      "source": "audit_event",
      "occurredAt": "2026-07-29T10:00:00.000Z",
      "category": "tool",
      "eventType": "tool_request_created",
      "title": "Tool request created: draft_client_email",
      "severity": "notice",
      "outcome": "pending",
      "correlationId": "corr_req_789"
    }
  ]
}
```

## Example Export

```markdown
# Agent Audit Trail

**Generated at:** 2026-07-29T10:10:00.000Z
**Workspace:** ws_xyz
**Filters:** severity: warning, occurredFrom: 2026-07-01T00:00:00.000Z

## Summary

Total events: **3**

## Events

### Tool request rejected: draft_client_email
- **Timestamp:** 2026-07-29T09:45:00.000Z
- **Category:** tool
- **Event type:** tool_request_rejected
- **Severity:** warning
- **Outcome:** denied
- **Correlation ID:** corr_req_789
```

## Local Testing

```bash
node --test tests/agent-observability-audit.test.mjs
```

## Validation Commands

```bash
npm run typecheck
npm test
npm run build
node --test tests/agent-observability-audit.test.mjs
node --test tests/agent-memory-context.test.mjs
node --test tests/agent-tool-approval.test.mjs
node --test tests/agent-tool-registry.test.mjs
```

## Known Limitations

1. **Timeline aggregation** — MVP uses `agent_audit_events` as the primary source. Feature-specific event tables (`agent_memory_events`, `agent_tool_approval_events`) are not merged in yet. Helper functions (`recordMemoryAuditEvent`, `recordToolRequestAuditEvent`) allow future layers to emit into the unified trail.

2. **Cross-layer integration** — Existing services (`agent-tool-approval-service.ts`, `agent-memory-service.ts`) do not yet call the observability helpers to avoid circular import risk. Integration points are documented.

3. **No real-time streaming** — Observability is query-based, not event-stream-based.

4. **No anomaly detection** — Severity classification is rule-based, not ML-based.

5. **No UI** — A dedicated governance/observability UI is not included in this sprint. Data is fully accessible via API routes.

## Suggested Next Sprint

**Technical Validation Cleanup — Typecheck, Tests & Build Stabilization**

Pre-existing typecheck failures in `auth-shell.tsx`, `auth-button.tsx`, `auth-field.tsx`, and `program-builder-ui.test.ts` remain. Before adding more product scope, PMFreak should achieve fully clean `npm run typecheck`, `npm test`, and `npm run build`.

After cleanup: **Agent Execution Request Runtime** — a controlled execution request model with state machine, preflight checks, approval validation, memory/context validation, audit event emission during execution, and dry-run mode.
