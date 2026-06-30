# Agent Controlled Policy Version Activation & Rollback Gate

## Overview

This sprint implements the **Controlled Policy Version Activation & Rollback Gate** — the final governance checkpoint before a simulated policy version is promoted to become the active policy governing PMO decisions. It provides a fully auditable, human-approved lifecycle for both activation and rollback, with no external side effects.

## Lifecycle

### Activation Lifecycle

1. **Activation Request** — Created from a passed dry-run result. Requires a `pass_for_future_activation_planning` dry-run decision.
2. **Precondition Evaluation** — 11 checks evaluated: dry-run completed, evidence package exists, operator review accepted, no open critical blockers, simulated policy version exists, no forbidden patterns, payload serializable, etc.
3. **Activation Gate** — Opened when all preconditions pass. Requires human operator review.
4. **Gate Decision** — Operator records one of: `approve_for_activation`, `reject`, `request_changes`, `block`, `archive`.
5. **Controlled Policy Version** — Created from an approved activation request. Immutable snapshot of the policy at time of approval.
6. **Activation Execution** — The ONLY mutation step. Supersedes the previous active version, sets the new version to `active`, and upserts the active policy pointer (preserving previous version ID for rollback).
7. **Post-Activation Monitoring Hooks** — 10 internal hook records created (no external calls). Types: `policy_behavior_monitor`, `routing_effect_monitor`, `scoring_effect_monitor`, `evidence_requirement_monitor`, `approval_gate_monitor`, `dispatch_gate_monitor`, `operator_workload_monitor`, `rollback_readiness_monitor`, `data_safety_monitor`, `compliance_monitor`.

### Rollback Lifecycle

1. **Rollback Request** — Created when an active policy version needs to be reverted. Requires the activation request to be in `activated` or `rollback_available` status.
2. **Rollback Gate** — Opened for human operator review.
3. **Rollback Gate Decision** — Operator records one of: `approve_rollback`, `reject_rollback`, `request_changes`, `block`, `archive`.
4. **Rollback Execution** — Reverts active pointer to previous version. Non-destructive: original records remain with status `rolled_back`.
5. **Rollback Verification** — Confirms the rollback succeeded: checks `rolled_back` status, audit trail, and that no external side effects occurred.

## Entities

| Entity | Description |
|--------|-------------|
| `AgentPmoPolicyActivationRequest` | Top-level activation request from dry-run |
| `AgentPmoPolicyActivationPrecondition` | Individual precondition check result |
| `AgentPmoPolicyActivationGate` | Human approval gate for activation |
| `AgentPmoPolicyActivationGateDecision` | Operator decision on the gate |
| `AgentPmoControlledPolicyVersion` | Immutable versioned policy snapshot |
| `AgentPmoActivePolicyPointer` | Workspace-scoped pointer to current active version |
| `AgentPmoPolicyActivationExecution` | Record of each activation mutation |
| `AgentPmoPolicyRollbackRequest` | Rollback request with reason |
| `AgentPmoPolicyRollbackGate` | Human approval gate for rollback |
| `AgentPmoPolicyRollbackGateDecision` | Operator decision on rollback gate |
| `AgentPmoPolicyRollbackExecution` | Record of each rollback mutation |
| `AgentPmoPolicyRollbackVerification` | Post-rollback verification result |
| `AgentPmoPolicyActivationAuditEntry` | Append-only audit log entry |
| `AgentPmoPostActivationMonitoringHook` | Internal monitoring hook record |
| `AgentPmoPolicyActivationExport` | Safe export of activation data |
| `AgentPmoPolicyActivationEvent` | Domain event record |

## API Routes

All routes are under `/api/agents/execution/policy-activation/`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/from-dry-run` | Create activation request from passed dry-run |
| GET | `/requests` | List activation requests |
| GET | `/requests/[id]` | Get activation request by ID |
| POST | `/requests/[id]/archive` | Archive an activation request |
| POST | `/preconditions` | Evaluate preconditions |
| GET | `/preconditions` | List precondition results |
| POST | `/gates` | Create activation gate |
| GET | `/gates` | List activation gates |
| POST | `/gate-decisions` | Record gate decision |
| GET | `/gate-decisions` | List gate decisions |
| POST | `/controlled-versions` | Create controlled policy version |
| GET | `/controlled-versions` | List controlled policy versions |
| GET | `/controlled-versions/[id]` | Get controlled policy version |
| POST | `/controlled-versions/[id]/status` | Update version status |
| GET | `/active-pointers` | List active policy pointers |
| POST | `/execute` | Execute policy activation |
| GET | `/executions` | List activation executions |
| POST | `/rollback-requests` | Create rollback request |
| GET | `/rollback-requests` | List rollback requests |
| GET | `/rollback-requests/[id]` | Get rollback request |
| POST | `/rollback-gates` | Create rollback gate |
| GET | `/rollback-gates` | List rollback gates |
| POST | `/rollback-gate-decisions` | Record rollback gate decision |
| GET | `/rollback-gate-decisions` | List rollback gate decisions |
| POST | `/rollback-execute` | Execute rollback |
| GET | `/rollback-executions` | List rollback executions |
| POST | `/rollback-verifications` | Verify rollback |
| GET | `/rollback-verifications` | List rollback verifications |
| POST | `/monitoring-hooks` | Create post-activation monitoring hooks |
| GET | `/monitoring-hooks` | List monitoring hooks |
| POST | `/monitoring-hooks/[id]/status` | Update monitoring hook status |
| GET | `/audit` | List audit entries |
| POST | `/exports` | Generate export |
| GET | `/exports` | List exports |
| GET | `/exports/[id]` | Get export |
| GET | `/exports/[id]/download` | Download export content |
| GET | `/summary` | Get activation summary |
| GET | `/data` | Get all activation data for workspace |
| GET | `/events` | List activation events |

## Safety Constraints

- **No LLM calls**: No OpenAI, Anthropic, Gemini, or any other AI provider is called.
- **No external notifications**: No emails, Slack messages, Jira tickets, GitHub issues, or calendar events.
- **No adapter execution**: No adapters are run, no projects are mutated, no external APIs are called.
- **No raw payload storage**: All payloads are redacted via `BLOCKED_KEYS` (password, secret, token, apiKey, etc.) before storage.
- **No human gate bypass**: Activation and rollback can only proceed after explicit human gate approval.
- **Workspace-scoped access**: All data is RLS-protected via `workspace_memberships` joins.
- **Active pointer uniqueness**: One active policy pointer per `(workspace_id, policy_area)` pair — enforced by unique constraint in the database.
- **Append-only audit trail**: Audit entries and events are never deleted or modified.
- **Export safety validation**: All exports are validated against `BLOCKED_KEYS` and `FORBIDDEN_EXECUTABLE_PATTERNS` before being stored.

## Database

Migration: `supabase/migrations/20260812000000_agent_controlled_policy_version_activation_rollback_gate.sql`

- 16 tables with RLS enabled
- Unique constraint: `agent_pmo_active_policy_pointers_workspace_area_unique` on `(workspace_id, policy_area)`
- All policies use workspace membership checks — no `using (true)` or public access
- Foreign keys to: `workspaces`, `auth.users`, dry-run tables, planning tables

## Observability

New `AgentAuditEventType` values (25 added):
- `pmo_policy_activation_request_created` through `pmo_policy_activation_request_archived`

New `AgentAuditSourceType`:
- `agent_controlled_policy_version_activation_rollback_gate`

## Export Formats

Three formats supported:
- `markdown` — Human-readable report
- `json` — Machine-readable structured data
- `csv` — Tabular summary

All exports pass safety validation before storage. Download via `/exports/[id]/download`.
