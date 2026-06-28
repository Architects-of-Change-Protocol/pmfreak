# Agent Tool Registry

**Sprint**: Agent Foundation Layer — Agent Tool Registry  
**Status**: Active  
**Migration**: `20260726000000_agent_tool_registry.sql`

---

## Purpose

The Agent Tool Registry gives PMFreak a formal catalog of what agents can do, what risks those capabilities carry, and what governance is required before an agent can use them.

Agents should not have vague, unlimited capabilities. Every agent capability in PMFreak must be:
- **Registered** — listed in the agent_tools table
- **Active** — not disabled or deprecated
- **Compatible** — allowed for the agent's type
- **Permitted** — all required permissions are granted
- **Approved** — human approval received when required

---

## Scope

This sprint implements:
- Tool type definitions (`AgentToolRecord`, `AgentToolEligibilityResult`, etc.)
- SQL persistence (`agent_tools`, `agent_tool_assignments`)
- Tool registration, listing, and status management
- Eligibility checking before future execution
- Default PMFreak tool seeding (idempotent)
- API routes for discovery and eligibility
- Database contract entries

---

## Non-Goals

- This sprint does **not** execute tools. Execution is out of scope.
- This sprint does **not** implement the approval workflow. That is the next sprint: Agent Permission & Approval Layer.
- This sprint does **not** add real-time agent orchestration.

---

## Data Model

### `agent_tools`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK → workspaces |
| `tool_key` | text | Stable lowercase snake_case identifier |
| `display_name` | text | Human-readable name |
| `description` | text | What the tool does |
| `category` | text | See categories below |
| `risk_level` | text | low / medium / high / critical |
| `execution_mode` | text | read_only / draft_only / requires_approval / automatic |
| `status` | text | active / disabled / deprecated |
| `input_schema_json` | text | JSON schema for inputs |
| `output_schema_json` | text | JSON schema for outputs |
| `required_permissions_json` | text | JSON array of permission strings |
| `compatible_agent_types_json` | text | JSON array of agent type strings |
| `creates_evidence` | boolean | Whether tool produces auditable evidence |
| `mutates_state` | boolean | Whether tool modifies project/workspace state |
| `requires_human_approval` | boolean | Whether approval is required before use |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Unique constraint: `(workspace_id, tool_key)`

### `agent_tool_assignments`

Explicit per-agent tool grants (on top of type-based compatibility).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK → workspaces |
| `agent_id` | uuid | FK → ai_agents |
| `tool_id` | uuid | FK → agent_tools |
| `status` | text | active / removed |
| `assigned_at` | timestamptz | |
| `assigned_by` | text | User reference |
| `removed_at` | timestamptz | |

---

## Tool Categories

| Category | Description |
|---|---|
| `project_read` | Read-only access to project data |
| `portfolio_read` | Read-only access to portfolio/workspace-level data |
| `pm_read` | Read-only access to PM capacity, performance, load |
| `analysis` | Analytical reasoning over existing data |
| `drafting` | Generating draft content for human review |
| `recommendation` | Proposing actions without executing them |
| `task_generation` | Creating draft tasks for human approval |
| `communication` | Drafting or managing communications |
| `governance` | Governance checks, compliance, policy enforcement |
| `reporting` | Executive or portfolio-level report generation |
| `administration` | Admin-level configuration and management tools |

---

## Risk Levels

| Level | Guidance |
|---|---|
| `low` | Read-only or harmless summarization. No state change. |
| `medium` | Drafts, recommendations, generated tasks not yet executed. |
| `high` | Changes workflow state, creates tasks, sends messages, modifies project metadata. |
| `critical` | External communication, approvals, financial/commercial commitments, deletion, irreversible actions. |

---

## Execution Modes

| Mode | Behavior |
|---|---|
| `read_only` | Never mutates state. Safe to run automatically. |
| `draft_only` | Creates proposed artifacts only. Human must approve or discard. |
| `requires_approval` | Creates an execution request that must be approved before action is taken. |
| `automatic` | Allowed only for low-risk internal actions. Should be rare. |

---

## Default Tools

The following tools are seeded by `ensureDefaultAgentTools()`:

| Tool Key | Category | Risk | Mode | Approval Required |
|---|---|---|---|---|
| `read_project_summary` | project_read | low | read_only | No |
| `read_project_risks` | project_read | low | read_only | No |
| `read_project_timeline` | project_read | low | read_only | No |
| `read_pm_capacity_snapshot` | pm_read | low | read_only | No |
| `classify_project_status` | analysis | low | read_only | No |
| `draft_project_update` | drafting | medium | draft_only | No |
| `draft_client_email` | communication | medium | draft_only | **Yes** |
| `create_task_draft` | task_generation | medium | draft_only | No |
| `suggest_intervention` | recommendation | medium | draft_only | No |
| `generate_executive_summary` | reporting | medium | draft_only | No |
| `recommend_next_action` | recommendation | medium | draft_only | No |
| `analyze_meeting_notes` | analysis | low | read_only | No |

---

## Eligibility Rules

`checkAgentToolEligibility()` returns an `AgentToolEligibilityResult`.

Rules applied in order:
1. Tool not found → `tool_not_found` (not eligible)
2. Tool is `disabled` → `tool_disabled` (not eligible)
3. Tool is `deprecated` → `tool_deprecated` (not eligible)
4. `compatibleAgentTypes` non-empty and agent type not in list → `agent_type_not_compatible` (not eligible)
5. `requiredPermissions` not all granted → `missing_permission` (not eligible)
6. `requiresHumanApproval=true` and `allowApprovalRequiredTools=false` → `human_approval_required` (not eligible, `requiredApproval: true`)
7. All checks pass → `eligible`

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/agents/tools` | List tools in workspace |
| `POST` | `/api/agents/tools` | Register a new tool (admin) |
| `GET` | `/api/agents/tools/[toolKey]` | Get a specific tool |
| `PATCH` | `/api/agents/tools/[toolKey]` | Update tool status (admin) |
| `POST` | `/api/agents/tools/[toolKey]/eligibility` | Check eligibility for an agent |
| `POST` | `/api/agents/tools/defaults` | Seed default tools (admin, idempotent) |

---

## Security & Governance Notes

- All tool tables have RLS enabled.
- Workspace members can read tools.
- Only `owner` or `admin` roles can register, update, or seed tools.
- Eligibility checks are available to any authenticated workspace member.
- `requires_human_approval` flags are surfaced in eligibility results for the next sprint's approval workflow.
- Tool keys are immutable once registered (stable identifiers for audit trails).

---

## Validation Commands

```bash
npm run typecheck
npm test -- --test-name-pattern "agent-tool"
npm run build
```

---

## Examples

### Register a tool
```bash
POST /api/agents/tools
{
  "workspaceId": "...",
  "toolKey": "read_project_summary",
  "displayName": "Read Project Summary",
  "description": "Retrieve the current summary and status of a project.",
  "category": "project_read",
  "riskLevel": "low",
  "executionMode": "read_only"
}
```

### Check eligibility
```bash
POST /api/agents/tools/read_project_summary/eligibility
{
  "workspaceId": "...",
  "agentType": "copilot",
  "grantedPermissions": [],
  "allowApprovalRequiredTools": false
}
```

### Seed defaults
```bash
POST /api/agents/tools/defaults
{ "workspaceId": "..." }
```

---

## Suggested Next Sprint

**Agent Permission & Approval Layer**

The tool registry now models `requiresHumanApproval` and the eligibility check surfaces it. The next sprint should implement:
- A formal approval request record (when an agent wants to use an approval-required tool)
- A PM/admin approval UI
- Approval status tracking and audit trail
- Rejection handling and reason capture
- Integration of approval state into the eligibility check

This completes the governance loop from tool registration → eligibility check → approval request → approved execution.
