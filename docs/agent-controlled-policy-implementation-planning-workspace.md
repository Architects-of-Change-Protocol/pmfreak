# Controlled Policy Implementation Planning Workspace

## Purpose and Scope

The Controlled Policy Implementation Planning Workspace converts a signed-off or PMO-approved approval pack into a controlled planning workspace for future dry-run preparation only. It provides a structured environment for PMO teams to plan, review, and gate-check the prerequisites needed before a dry-run of a policy change can be authorized.

**The Controlled Policy Implementation Planning Workspace does not apply policies, change routing, change risk scoring, update evidence requirements, execute adapters, retry dispatch, call LLMs, create embeddings, train models, call external APIs, mutate projects, create external tickets, create calendar events, send communications, run dry-runs, execute rollback, or activate policy drafts. It converts a signed-off or PMO-approved approval pack into a controlled planning workspace for future dry-run preparation only.**

All workspace data is stored in-memory (no Supabase writes during the planning phase). Migration tables are provided for future persistence.

---

## Non-Goals

This workspace explicitly does NOT:

- Apply any policies to live systems
- Activate policy drafts
- Change routing, risk scoring, or evidence requirements
- Execute adapters or retry dispatch
- Run dry-runs (planning for dry-runs only)
- Execute rollback procedures
- Call LLMs, create embeddings, or train models
- Call external APIs or create external tickets (Jira, Linear, etc.)
- Send communications (email, Slack, calendar)
- Mutate projects or any live data
- Authorize implementation — only authorizes dry-run planning

---

## Relationship to Approval Pack Sprint

This workspace is initiated from an approval pack. The approval pack must exist before a planning workspace can be created. The planning workspace references the approval pack ID and optionally the signoff packet ID and implementation ticket draft ID.

Flow:
1. Policy backlog item → change request → simulation → approval workflow → approval pack (prior sprints)
2. Approval pack → **Implementation Planning Workspace** (this sprint)
3. Implementation Planning Workspace (approved_for_dry_run_planning) → Dry-Run Executor (next sprint)

---

## Data Models

### 1. AgentPmoImplementationPlanningWorkspaceRecord
The root workspace record. Tracks overall status, approval pack reference, and planning version.

**Status lifecycle:** created → planning → under_review → changes_requested | approved_for_dry_run_planning | blocked | archived

### 2. AgentPmoImplementationPlanDraftRecord
A versioned implementation plan draft with objective, scope, non-goals, assumptions, and constraints.

**Status lifecycle:** created → draft → under_review → approved_for_dry_run_planning | changes_requested | blocked | archived

### 3. AgentPmoImplementationTaskBreakdownRecord
10 deterministic planning tasks generated from the workspace. All start with status "planned".

Task types: policy_version_preparation, configuration_review, runtime_mapping_review, safety_check, test_plan_preparation, stakeholder_review, change_window_preparation, rollback_preparation, dry_run_preparation, documentation_update

### 4. AgentPmoPreImplementationChecklistRecord
Container for the 18 pre-implementation checklist items.

### 5. AgentPmoPreImplementationChecklistItemRecord
18 items covering approval pack, plan, scope, simulation, rollback, safety, and payload safety checks.

### 6. AgentPmoStakeholderReadinessRecord
Tracks acknowledgment status per stakeholder role (pmo_owner, security_owner, operations_owner, data_governance_owner, executive_sponsor, implementation_owner, rollback_owner).

### 7. AgentPmoChangeWindowPlanRecord
Proposed change window with type, timing, timezone, business impact estimate, and operational constraints. Requires approval.

### 8. AgentPmoImplementationRiskRecord
Risk register entries with type, severity (low/medium/high/critical), status, risk summary, and mitigation summary.

### 9. AgentPmoRollbackRehearsalPlanRecord
Rollback rehearsal plans with verification steps and expected evidence. Does not execute rollback.

### 10. AgentPmoImplementationGatePrerequisiteRecord
12 gate prerequisites that must be satisfied before the workspace can be approved for dry-run planning.

Gate prerequisite types: approval_pack_exists, approval_pack_signed_off, implementation_plan_approved, task_breakdown_reviewed, stakeholders_acknowledged, change_window_reviewed, risk_register_reviewed, rollback_rehearsal_ready, validation_checklist_passed, security_review_complete, operations_review_complete, data_governance_review_complete

### 11. AgentPmoImplementationPlanningDecisionRecord
Append-only decision log. Decision types: approve_plan_for_dry_run_planning, request_changes, block_plan, waive_prerequisite, archive_planning_workspace.

### 12. AgentPmoImplementationPlanningExportRecord
Markdown, JSON, or CSV export of the planning workspace contents. Safety-validated before creation.

### 13. AgentPmoImplementationPlanningEventRecord
Append-only audit trail of all workspace events.

---

## Lifecycles

### Workspace Status Transitions
- `created` → `planning` (when plan draft created)
- `planning` → `under_review` (when prerequisites evaluated with pending items)
- `under_review` → `approved_for_dry_run_planning` (on approve decision)
- `under_review` → `changes_requested` (on request_changes decision)
- Any status → `blocked` (on block_plan decision)
- Any status → `archived` (on archive decision)

### Decision Effect on Workspace Status
- `approve_plan_for_dry_run_planning` → workspace status: `approved_for_dry_run_planning`
- `request_changes` → workspace status: `changes_requested`
- `block_plan` → workspace status: `blocked`
- `archive_planning_workspace` → workspace status: `archived`
- `waive_prerequisite` → no workspace status change

---

## API Routes

All routes require authentication and workspace membership.

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/agents/execution/implementation-planning/from-approval-pack | Create workspace from approval pack |
| GET/POST | /api/agents/execution/implementation-planning/workspaces | List/create workspaces |
| GET | /api/agents/execution/implementation-planning/workspaces/[id] | Get workspace |
| POST | /api/agents/execution/implementation-planning/workspaces/[id]/status | Update status |
| POST | /api/agents/execution/implementation-planning/workspaces/[id]/archive | Archive workspace |
| GET/POST | /api/agents/execution/implementation-planning/plan-drafts | List/create plan drafts |
| POST | /api/agents/execution/implementation-planning/plan-drafts/[id]/status | Update draft status |
| GET/POST | /api/agents/execution/implementation-planning/task-breakdown | List/generate tasks |
| GET/POST | /api/agents/execution/implementation-planning/pre-checklist | List/generate checklist |
| GET | /api/agents/execution/implementation-planning/pre-checklist/items | List checklist items |
| GET/POST | /api/agents/execution/implementation-planning/stakeholder-readiness | List/record readiness |
| POST | /api/agents/execution/implementation-planning/stakeholder-readiness/[id]/status | Update status |
| GET/POST | /api/agents/execution/implementation-planning/change-window | List/propose change window |
| POST | /api/agents/execution/implementation-planning/change-window/[id]/status | Update status |
| GET/POST | /api/agents/execution/implementation-planning/risks | List/register risks |
| POST | /api/agents/execution/implementation-planning/risks/[id]/status | Update risk status |
| GET/POST | /api/agents/execution/implementation-planning/rollback-rehearsal | List/create rehearsal plans |
| POST | /api/agents/execution/implementation-planning/rollback-rehearsal/[id]/status | Update status |
| GET/POST | /api/agents/execution/implementation-planning/gate-prerequisites | List/evaluate prerequisites |
| POST | /api/agents/execution/implementation-planning/gate-prerequisites/[id]/status | Update status |
| GET/POST | /api/agents/execution/implementation-planning/decisions | List/record decisions |
| GET/POST | /api/agents/execution/implementation-planning/exports | List/generate exports |
| GET | /api/agents/execution/implementation-planning/exports/[id] | Get export |
| GET | /api/agents/execution/implementation-planning/exports/[id]/download | Download export file |
| GET | /api/agents/execution/implementation-planning/summary | Get summary counts |
| GET | /api/agents/execution/implementation-planning/data | Get all workspace data |
| GET | /api/agents/execution/implementation-planning/events | List events |

---

## Privacy and Data Minimization

- No PII is stored in workspace records (no email, phone, address, customer, client fields)
- Payload fields are safety-validated and blocked keys are redacted
- Export safety check rejects content containing blocked field names
- Safe payload fields are limited to 50KB

## RLS / Security Model

All tables use Row Level Security. The policy pattern requires workspace membership:

```sql
using (
  exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = <table>.workspace_id
      and wm.user_id = auth.uid()
  )
)
```

No `using (true)` policies. No public access.

---

## Known Limitations

1. In-memory only: All stores are in-memory Maps. Data does not persist across server restarts.
2. No real-time updates: No WebSocket or SSE support.
3. No concurrent locking: Multiple simultaneous writes may interleave.
4. Gate prerequisite evaluation: Prerequisites are created with "pending" status. Manual updates required for actual satisfaction.
5. Export safety check: Uses simple string matching for blocked fields, not deep JSON analysis.

---

## Suggested Next Sprint: Controlled Policy Implementation Gate & Dry-Run Change Executor

The next sprint should implement the dry-run execution layer, which:
- Consumes a workspace in `approved_for_dry_run_planning` status
- Creates a dry-run execution sandbox
- Simulates policy changes without applying them to live systems
- Captures dry-run outcomes and diffs
- Requires explicit gate approval before any live changes

This sprint should also implement the actual Supabase persistence layer for the tables created in this migration.
