# Agent Human Review & Action Inbox

**Sprint: Human Review & Action Inbox**

This layer provides a structured human review workflow for AI agent execution outputs. It sits on top of the Agent Execution Results & Evidence Layer and allows humans to review, decide on, and convert AI-generated results into actionable drafts.

## Architecture

All stores are **in-memory** (no Supabase). The same pattern as preceding implementation layers.

### Layer files

| File | Purpose |
|------|---------|
| `agent-review-inbox-types.ts` | TypeScript types and enums |
| `agent-review-inbox-validation.ts` | Validators, normalizers, redactors |
| `agent-review-inbox-registry.ts` | In-memory CRUD (Map stores) |
| `agent-review-inbox-service.ts` | Business logic |

## Key Concepts

### Review Queues

Queues organize review items by domain. Six default queues are created per workspace:

- `personal_review` — personal review items
- `project_review` — project-level items (default)
- `pmo_governance` — governance and low-confidence items
- `risk_review` — risk analysis outputs
- `compliance_review` — compliance items
- `executive_review` — high-level executive items

### Queue Routing (from execution results)

| Condition | Queue |
|-----------|-------|
| `resultType === "risk_analysis"` | `risk_review` |
| `resultType === "governance_note"` | `pmo_governance` |
| `confidenceScore < 50` | `pmo_governance` |
| Default | `project_review` |

### Review Item Lifecycle

```
queued → assigned → in_review → accepted / rejected / needs_more_evidence / escalated / deferred / archived
                                  ↓
                            action_drafted → completed
```

### Decision Types

- `accept` — approve the item
- `reject` — reject the item
- `request_more_evidence` — needs more supporting data
- `archive` — archive without decision
- `escalate` — escalate to higher authority
- `mark_duplicate` — mark as duplicate (archives)
- `defer` — defer for later
- `convert_to_action_draft` — convert to action draft

### Action Drafts

Created from accepted review items. Types:

- `draft_email`, `draft_task`, `draft_project_update`
- `draft_risk_escalation`, `draft_status_report`
- `draft_governance_note`, `draft_follow_up`, `manual_action`

Status flow: `draft → ready_for_approval → approval_requested → approved / rejected / cancelled / converted`

## API Routes

All routes require workspace membership. Actor ID always comes from authenticated user, never from request body.

### Queues
- `GET /api/agents/execution/review/queues` — list queues
- `POST /api/agents/execution/review/queues` — create queue
- `GET /api/agents/execution/review/queues/[queueId]` — get queue

### Items
- `GET /api/agents/execution/review/items` — list items (with filters)
- `POST /api/agents/execution/review/items` — create item
- `POST /api/agents/execution/review/items/from-result` — create from execution result
- `POST /api/agents/execution/review/items/from-evidence` — create from evidence item
- `GET /api/agents/execution/review/items/[reviewItemId]` — get item
- `POST /api/agents/execution/review/items/[reviewItemId]/assign` — assign item
- `POST /api/agents/execution/review/items/[reviewItemId]/open` — open item for review
- `POST /api/agents/execution/review/items/[reviewItemId]/accept` — accept
- `POST /api/agents/execution/review/items/[reviewItemId]/reject` — reject
- `POST /api/agents/execution/review/items/[reviewItemId]/request-more-evidence` — request more evidence
- `POST /api/agents/execution/review/items/[reviewItemId]/archive` — archive
- `POST /api/agents/execution/review/items/[reviewItemId]/escalate` — escalate
- `GET /api/agents/execution/review/items/[reviewItemId]/decisions` — list decisions
- `GET /api/agents/execution/review/items/[reviewItemId]/events` — list events
- `POST /api/agents/execution/review/items/[reviewItemId]/action-draft` — convert to action draft

### Action Drafts
- `GET /api/agents/execution/review/action-drafts` — list drafts
- `POST /api/agents/execution/review/action-drafts` — create draft
- `GET /api/agents/execution/review/action-drafts/[actionDraftId]` — get draft
- `POST /api/agents/execution/review/action-drafts/[actionDraftId]/ready-for-approval` — mark ready
- `POST /api/agents/execution/review/action-drafts/[actionDraftId]/cancel` — cancel

### Summary
- `GET /api/agents/execution/review/summary` — inbox summary with counts by status/priority/queue

## Safety Constraints

- No LLM calls
- No external API calls
- No email/Slack/webhook mutations
- No project mutations
- Payload redaction: `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `stripe_secret`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`
- Max payload size: 100KB
- Confidence score clamped to 0-100
