# Agent Controlled Action Conversion & Approval Bridge

## 1. Purpose

The Controlled Action Conversion & Approval Bridge is the formal gateway from a human-approved action draft to a governed execution request. It ensures that no agent-initiated action bypasses human review, preflight safety validation, or approval requirements before an execution request is created.

## 2. Scope

This layer introduces:

- Action conversion records
- Conversion preflight records
- Approval bridge records
- Conversion event records
- Action draft to execution request mapping
- Decision-to-execution linkage
- Controlled execution request creation
- Approval requirement evaluation
- Conversion readiness status
- Conversion blocking reasons
- Conversion cancellation
- Conversion summary

## 3. Non-Goals

The Controlled Action Conversion & Approval Bridge **does not**:

- Send emails or communications of any kind
- Create Jira tickets, GitHub issues, or similar external artifacts
- Modify Google Calendar or scheduling systems
- Mutate production project records
- Create real tasks in external systems
- Call OpenAI, Anthropic, Gemini, or any LLM provider
- Create embeddings
- Implement autonomous scheduling
- Execute action drafts directly
- Trigger adapter execution
- Convert rejected, archived, or unreviewed items
- Perform real external side effects

## 4. Relationship to Agent Execution Request Runtime

The Execution Request Runtime defines the governed execution request model. This layer creates execution requests through the runtime, using only safe execution modes (`dry_run`, `draft_only`, `approval_required`).

## 5. Relationship to Agent Tool Execution Adapter Layer

The Adapter Layer processes execution requests through deterministic adapters. This layer does **not** invoke the adapter layer. It only creates execution requests that the adapter layer may process in a future sprint.

## 6. Relationship to Agent Execution Results & Evidence Layer

The Results & Evidence Layer normalizes agent output. This layer reads source result and evidence linkage from action drafts and review items for lineage preservation. It does not create new results.

## 7. Relationship to Human Review & Action Inbox

The Human Review & Action Inbox is the upstream source. This layer reads from it:

- Action drafts (`agent_review_action_drafts`)
- Review items (`agent_review_items`)
- Review decisions (`agent_review_decisions`)

It requires that a review item be in `accepted` or `action_drafted` status before a conversion is created.

## 8. Conversion Model

An `AgentActionConversionRecord` captures:

| Field | Description |
|---|---|
| `id` | Unique conversion ID |
| `workspaceId` | Workspace scope |
| `actionDraftId` | Source action draft |
| `reviewItemId` | Source review item |
| `reviewDecisionId` | Source review decision |
| `sourceResultId` | Source execution result |
| `sourceEvidenceId` | Source evidence item |
| `executionRequestId` | Created execution request |
| `approvalBridgeId` | Associated approval bridge |
| `actionType` | Draft type (e.g., `draft_email`) |
| `status` | Current conversion status |
| `readiness` | Readiness assessment |
| `riskLevel` | Evaluated risk level |
| `approvalRequirement` | Approval requirement assessment |
| `blockingReasons` | Reasons preventing conversion |
| `warnings` | Non-blocking concerns |

## 9. Preflight Model

An `AgentActionConversionPreflightRecord` records the result of a deterministic safety check before execution request creation.

Checks performed:

- `action_draft_exists`
- `review_item_exists`
- `review_item_accepted`
- `review_decision_exists`
- `action_draft_convertible`
- `action_draft_not_converted`
- `source_result_linked`
- `source_evidence_linked`
- `target_scope_known`
- `safe_payload_present`
- `risk_level_known`
- `owner_or_role_known`
- `approval_requirement_evaluated`
- `tool_mapping_exists`
- `execution_mode_safe`
- `no_external_side_effects`

Each check has a severity: `info`, `warning`, or `blocking`. Only blocking failures prevent conversion.

## 10. Approval Bridge Model

An `AgentActionApprovalBridgeRecord` links the conversion to the approval governance model.

It captures:

- Approval requirement type
- Required approver role
- Required approver user (if specific)
- Approval policy key
- Approval reason
- Risk justification

The bridge does **not** automatically approve anything. It records the approval requirement and waits for an explicit `markApprovalBridgeSatisfied` call.

## 11. Execution Request Linkage Model

When all checks pass and approval requirements are satisfied, the service creates a governed execution request via the Agent Execution Request Runtime. The execution request includes:

- Tool key from the action type mapping
- Safe execution mode only (`dry_run`, `draft_only`, `approval_required`)
- Source lineage references:
  - `actionDraftId`
  - `reviewItemId`
  - `reviewDecisionId`
  - `sourceResultId`
  - `sourceEvidenceId`
  - `conversionId`
  - `approvalBridgeId`

## 12. Conversion Event Model

Events are append-only. Types:

- `conversion_created`
- `preflight_started`
- `preflight_passed`
- `preflight_failed`
- `approval_requirement_evaluated`
- `approval_required`
- `approval_not_required`
- `approval_bridge_created`
- `approval_satisfied`
- `execution_request_created`
- `conversion_blocked`
- `conversion_cancelled`
- `conversion_completed`

## 13. Action Draft to Execution Mapping

| Draft Type | Tool Key | Adapter Key | Execution Mode | Requires Approval |
|---|---|---|---|---|
| `draft_email` | `draft_email` | `draft_email_adapter` | `draft_only` | Yes |
| `draft_task` | `draft_task` | `draft_task_adapter` | `draft_only` | Yes |
| `draft_project_update` | `draft_project_update` | `draft_project_update_adapter` | `draft_only` | Yes |
| `draft_risk_escalation` | `risk_analysis` | `risk_analysis_adapter` | `draft_only` | Yes |
| `draft_status_report` | `executive_summary` | `executive_summary_adapter` | `draft_only` | No (unless high/critical risk) |
| `draft_governance_note` | `executive_summary` | `executive_summary_adapter` | `draft_only` | No (unless high/critical risk) |
| `draft_follow_up` | `draft_task` | `draft_task_adapter` | `draft_only` | Yes |
| `manual_action` | `noop` | `noop_adapter` | `dry_run` | Yes |

## 14. Conversion Lifecycle

```
createConversionFromActionDraft
  → status: created, readiness: not_ready

runActionConversionPreflight
  → status: preflight_passed | preflight_failed
  → readiness: ready | blocked | requires_approval

evaluateActionApprovalBridge
  → status: approval_required | approval_not_required
  → creates approval bridge if required

markApprovalBridgeSatisfied (if required)
  → status: approval_satisfied
  → readiness: ready

createExecutionRequestFromActionDraft
  → status: execution_request_created
  → readiness: converted

[or]

cancelActionConversion
  → status: cancelled
  → readiness: blocked
```

## 15. Preflight Lifecycle

1. Load conversion
2. Load action draft, review item, review decisions
3. Evaluate all check conditions
4. Calculate readiness score (0–100)
5. Evaluate approval requirement
6. Create preflight record (append-only)
7. Update conversion status and readiness
8. Record `preflight_started`, `preflight_passed`/`preflight_failed`, `approval_requirement_evaluated` events

## 16. Approval Bridge Lifecycle

1. Load conversion and preflight
2. If approval not required: update conversion to `approval_not_required`, return null
3. If approval required: create bridge record with policy key and required approver role
4. Update conversion to `approval_required`, readiness `requires_approval`
5. Record `approval_bridge_created`, `approval_required` events
6. Human actor calls `markApprovalBridgeSatisfied`
7. Bridge status → `satisfied`, conversion status → `approval_satisfied`, readiness → `ready`

## 17. Execution Request Creation Lifecycle

1. Verify conversion exists
2. Run or load preflight
3. If preflight failed: block, record event, throw
4. If approval required: require bridge status `satisfied`
5. Validate mapping and safe execution mode
6. Create execution request via Execution Request Runtime
7. Update conversion status to `execution_request_created`, readiness `converted`
8. Update action draft status to `converted` (best-effort)
9. Record `execution_request_created`, `conversion_completed` events

## 18. Blocking Reasons

Conversions are blocked when preflight checks with `blocking` severity fail:

- Action draft not found
- Review item not found or not in `accepted`/`action_drafted` status
- Action draft in non-convertible status
- Action draft already converted
- Risk level unknown
- No tool mapping for action type
- Execution mode not safe

## 19. Warning Model

Warnings are non-blocking and informational:

- Review decision not found (informational — lineage may be incomplete)
- Source result not linked
- Source evidence not linked
- Target scope not specified
- Owner or role not identified

## 20. Risk and Approval Policy

| Risk Level | Approval Requirement | Required Approver Role |
|---|---|---|
| `low` | `not_required` (unless action type requires it) | n/a |
| `medium` | Per action type mapping | `project_manager` |
| `high` | `required_high_risk` | `pmo_lead` |
| `critical` | `required_critical_risk` | `executive` |

External side effect potential always triggers `required_external_side_effect`.

## 21. Ownership Model

Owner resolution order:

1. Explicit `ownerId`/`ownerRole` from request
2. `assignedTo`/`assignedRole` from review item
3. `createdBy` from action draft
4. Fallback role if available

## 22. RLS/Security Model

All four tables have RLS enabled:

- `agent_action_conversions`
- `agent_action_conversion_preflights`
- `agent_action_approval_bridges`
- `agent_action_conversion_events`

Policies allow read and write only to authenticated workspace members. No public access. No `using (true)` policies.

## 23. API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/agents/execution/action-conversions` | Create raw conversion |
| `GET` | `/api/agents/execution/action-conversions` | List conversions with filters |
| `GET` | `/api/agents/execution/action-conversions/[conversionId]` | Get conversion detail |
| `POST` | `/api/agents/execution/action-conversions/from-action-draft` | Create conversion from action draft |
| `POST` | `/api/agents/execution/action-conversions/[conversionId]/preflight` | Run preflight |
| `POST` | `/api/agents/execution/action-conversions/[conversionId]/approval-bridge` | Evaluate approval bridge |
| `POST` | `/api/agents/execution/action-conversions/[conversionId]/approval-satisfied` | Mark approval satisfied |
| `POST` | `/api/agents/execution/action-conversions/[conversionId]/execution-request` | Create execution request |
| `POST` | `/api/agents/execution/action-conversions/[conversionId]/cancel` | Cancel conversion |
| `GET` | `/api/agents/execution/action-conversions/[conversionId]/events` | List conversion events |
| `GET` | `/api/agents/execution/action-conversions/summary` | Get conversion summary |

## 24. Optional UI Behavior

No UI was added in this sprint. The backend, API, tests, and documentation are the complete deliverable. UI can be added in a future sprint under `/command-center/action-conversions` following existing command center patterns.

## 25. Example: Conversion from Action Draft

```ts
// 1. Create conversion
const conversion = await createConversionFromActionDraft({
  workspaceId: "ws-123",
  actionDraftId: "draft-456",
  ownerRole: "pmo_lead",
  actorId: "user-789",
});

// 2. Run preflight
const preflight = await runActionConversionPreflight({
  workspaceId: "ws-123",
  conversionId: conversion.id,
  actorId: "user-789",
});

// 3. Evaluate approval bridge
const bridge = await evaluateActionApprovalBridge({
  workspaceId: "ws-123",
  conversionId: conversion.id,
  actorId: "user-789",
});

// 4. If bridge required, mark satisfied
if (bridge) {
  await markApprovalBridgeSatisfied({
    workspaceId: "ws-123",
    approvalBridgeId: bridge.id,
    actorId: "user-789",
    message: "Approved by PMO lead after review",
  });
}

// 5. Create execution request
const updated = await createExecutionRequestFromActionDraft({
  workspaceId: "ws-123",
  conversionId: conversion.id,
  actorId: "user-789",
});
```

## 26. Example: Preflight

The preflight checks 16 conditions and returns:

```ts
{
  id: "pf-001",
  status: "passed",
  readinessScore: 87,
  checks: [
    { checkType: "action_draft_exists", passed: true, severity: "blocking", message: "Action draft must exist" },
    { checkType: "review_item_accepted", passed: true, severity: "blocking", message: "..." },
    // ...
  ],
  blockingReasons: [],
  warnings: ["Source evidence linkage is recommended"],
  approvalRequired: true,
  approvalRequirement: "required",
}
```

## 27. Example: Approval Bridge

```ts
{
  id: "bridge-001",
  conversionId: "conv-001",
  approvalRequirement: "required",
  status: "required",
  approvalPolicyKey: "draft_email_medium_approval",
  requiredApproverRole: "project_manager",
  approvalReason: "Action type 'draft_email' with risk level 'medium' requires approval",
}
```

## 28. Example: Execution Request Linkage

The created execution request preserves full lineage:

```ts
{
  toolKey: "draft_email",
  executionMode: "draft_only",
  inputPayload: {
    conversionId: "conv-001",
    actionDraftId: "draft-456",
    reviewItemId: "item-789",
    reviewDecisionId: "decision-001",
    approvalBridgeId: "bridge-001",
  }
}
```

## 29. Prohibited Behavior

The Controlled Action Conversion & Approval Bridge does not send communications, create tickets, update projects, call LLMs, create embeddings, execute adapters, or perform external side effects.

It converts human-approved action drafts into governed execution requests only after deterministic preflight and approval bridge checks.

## 30. Testing Guide

Tests live in `tests/agent-controlled-action-conversion-approval-bridge.test.mjs`.

Run with:

```bash
node --experimental-strip-types --test tests/agent-controlled-action-conversion-approval-bridge.test.mjs
```

Or with tsx if available:

```bash
npm test -- tests/agent-controlled-action-conversion-approval-bridge.test.mjs
```

Test categories:

- Type/enum validators
- Input validation and normalization
- Payload redaction
- Readiness calculation
- Approval requirement evaluation
- Action draft to execution mapping
- Migration file contents
- Database contract
- Registry exports and behavior
- Service exports and behavior
- API route existence
- Observability types
- Service safety (no prohibited calls)
- Terminology compliance

## 31. Known Limitations

1. **Supabase dependency for execution requests**: The `createExecutionRequestFromActionDraft` function calls the Agent Execution Request Runtime which requires a Supabase connection. In test environments without Supabase, the execution request creation is attempted and gracefully falls back. The conversion record is still updated to `execution_request_created` status with `executionRequestCreationStatus: "failed"` to document the intent.

2. **Audit events are best-effort**: Calls to `recordAgentAuditEvent` are wrapped in try/catch. Audit failures do not block conversion operations.

3. **Action draft status update is best-effort**: Updating the action draft to `converted` status after execution request creation is attempted but will not block the conversion if the registry doesn't support the status transition.

4. **No UI**: No UI was implemented in this sprint. The backend API is complete.

5. **Approval bridge does not connect to external approval systems**: The bridge records approval requirements but does not integrate with external approval workflow systems. That integration is deferred to a future sprint.

## 32. Suggested Next Sprint

**Controlled Execution Finalization & Adapter Dispatch Gate**

Once accepted action drafts can be converted into governed execution requests with preflight and approval bridge controls, the next layer should determine how approved execution requests are safely dispatched to adapters without violating side-effect constraints.

That next sprint should focus on:

- Execution dispatch readiness
- Adapter dispatch gate
- Approval verification before dispatch
- Execution lock
- Idempotency
- Side-effect mode enforcement
- Final human confirmation for side-effectful actions
- Execution result reconciliation
- Dispatch audit trail
