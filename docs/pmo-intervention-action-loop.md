# PMO Intervention / Action Loop

## Overview

The PMO Intervention Action Loop is a human-governed action queue derived from PMO governance violations. It proposes discrete, reviewable interventions for human approval and execution — no PM assignments, capacity records, or performance data are ever mutated automatically.

## Key principles

- **Deterministic**: Every action is generated from a governance snapshot, not from probabilistic inference.
- **Human-governed**: All actions move through an explicit approval lifecycle before any execution occurs.
- **Non-destructive**: This module does not mutate PM capacity, PM assignments, project data, or performance records.
- **Auditable**: All status transitions are recorded with actor, timestamp, and reason.

## Architecture

```
PMO Governance Compliance Snapshot
         ↓ violations[]
generatePMOInterventionActions()
         ↓ dedup + map
PMO Intervention Actions (Supabase: pmo_intervention_actions)
         ↓ human review
updatePMOInterventionActionStatus()
         ↓ platform events
PMO_INTERVENTION_ACTION_GENERATED
PMO_INTERVENTION_ACTION_STATUS_CHANGED
```

## Module

**`src/lib/pmo-intervention/`**
- `types.ts` — All types, enums, interfaces
- `pmo-intervention.ts` — Core logic: generate, list, get, update
- `index.ts` — Barrel export

## Status lifecycle

```
proposed → approved → in_progress → completed
proposed → rejected              (terminal)
proposed → dismissed             (terminal)
approved → cancelled             (terminal)
in_progress → cancelled          (terminal)
```

Terminal states have no further transitions: `completed`, `rejected`, `dismissed`, `cancelled`.

## Priority derivation

| Violation type | Priority override |
|---|---|
| `OVERLOADED_WITHOUT_RECOMMENDATION` | critical |
| `CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION` | critical |
| `CRITICAL_PM_WITHOUT_RECOMMENDATION` | critical |
| `CAPACITY_SNAPSHOT_MISSING` | high |
| `PERFORMANCE_SNAPSHOT_MISSING` | high |
| `LOW_CONFIDENCE_WITHOUT_RECOMMENDATION` | high |
| `HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE` | high |
| all others | derived from violation severity |

## Violation → action type mapping

| Violation | Action type |
|---|---|
| `PM_PROFILE_MISSING`, `PM_ROLE_MISSING`, `PM_EXPERIENCE_LEVEL_MISSING`, `PM_ACTIVE_PROJECTS_LIMIT_MISSING` | `complete_pm_profile` |
| `CAPACITY_SNAPSHOT_MISSING`, `CAPACITY_SNAPSHOT_STALE`, `DOSSIER_CAPACITY_SECTION_MISSING` | `generate_capacity_snapshot` |
| `OVERLOADED_WITHOUT_RECOMMENDATION`, `AT_CAPACITY_WITHOUT_RECOMMENDATION`, `NEAR_CAPACITY_WITHOUT_RECOMMENDATION`, `OVERLOADED_NOT_IN_ATTENTION_QUEUE`, `CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION` | `review_capacity_overload` |
| `PERFORMANCE_SNAPSHOT_MISSING`, `PERFORMANCE_SNAPSHOT_STALE`, `DOSSIER_PERFORMANCE_SECTION_MISSING` | `generate_performance_snapshot` |
| `CRITICAL_PM_WITHOUT_RECOMMENDATION`, `CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION`, `RISKY_PM_NOT_IN_ATTENTION_QUEUE` | `escalate_critical_pm_risk` |
| `HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE`, `WARNING_PM_WITHOUT_RECOMMENDATION`, `PERFORMANCE_RISK_MISSING`, `PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION` | `review_pm_performance_risk` |
| `LOW_CONFIDENCE_WITHOUT_RECOMMENDATION`, `EVIDENCE_CONFIDENCE_MISSING`, etc. | `improve_evidence_coverage` |
| `INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS`, `SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS`, etc. | `review_assignment_hygiene` |
| `RECOMMENDATION_MISSING_SEVERITY`, `RECOMMENDATION_MISSING_SOURCE`, etc. | `review_intervention_readiness` |

## Deduplication

An action is not created if an open action (status: `proposed`, `approved`, or `in_progress`) already exists with the same key:

**With source_violation_id**: `workspace_id | source_type | source_violation_id | action_type | target_type | target_id`

**Without source_violation_id**: `workspace_id | source_type | action_type | target_type | target_id | pm_id | project_id`

Once a prior action reaches a terminal state (`completed`, `rejected`, `dismissed`, `cancelled`), a new action can be created for the same violation.

## Platform events

| Event type | Trigger |
|---|---|
| `PMO_INTERVENTION_ACTION_GENERATED` | After `generatePMOInterventionActions` succeeds |
| `PMO_INTERVENTION_ACTION_STATUS_CHANGED` | After any successful status transition |

Events are fire-and-forget and do not fail the operation if event recording fails.

## API routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/pmo-interventions` | List actions (supports `status`, `priority`, `actionType`, `targetType`, `limit` query params) |
| `POST` | `/api/pmo-interventions/generate` | Generate actions from governance snapshot |
| `GET` | `/api/pmo-interventions/[actionId]` | Get single action |
| `POST` | `/api/pmo-interventions/[actionId]/status` | Update action status |

### Response shape

Success: `{ ok: true, data: ... }`

Error: `{ ok: false, error: { code: "...", message: "..." } }`

### Error codes

| Code | Meaning |
|---|---|
| `PMO_INTERVENTION_WORKSPACE_REQUIRED` | No workspace found for actor |
| `PMO_INTERVENTION_UNAUTHORIZED` | Actor not authorized |
| `PMO_INTERVENTION_GENERATION_FAILED` | Governance snapshot failed |
| `PMO_INTERVENTION_ACTION_NOT_FOUND` | Action not found in workspace |
| `PMO_INTERVENTION_INVALID_STATUS` | Unrecognized status value |
| `PMO_INTERVENTION_INVALID_STATUS_TRANSITION` | Transition not allowed by lifecycle |
| `PMO_INTERVENTION_STATUS_UPDATE_FAILED` | Persistence error |
| `PMO_INTERVENTION_CREATE_FAILED` | Creation error |

## UI

Route: `/pmo-interventions` (PMO Intervention Center)

Sections:
- **Header**: title, description, Generate Actions button, Refresh button, nav links
- **Summary cards**: Proposed, Approved, In Progress, Completed, Critical, High Priority, Pending Approval, Dismissed/Rejected
- **Generation result banner**: shown after generate
- **Filters**: status, priority, action_type
- **Action queue**: grouped by status with expandable cards
- **Action controls**: Approve/Reject/Dismiss (proposed); Start/Cancel (approved); Complete/Cancel (in_progress)
- **Empty state**: guidance to generate actions

## Persistence

Actions are persisted to the **`pmo_intervention_actions`** Supabase table (migration: `supabase/migrations/20260719000000_pmo_intervention_actions.sql`). Actions survive server restarts. The DB contract type and selectable columns are declared in `src/lib/db/database-contract.ts` (`PMOInterventionActionRow`, `PMO_INTERVENTION_ACTION_SELECTABLE_COLUMNS`).

Key persistence behaviours:
- **Generate**: existing open actions are queried first to build a dedup index; new actions are `INSERT`ed one per violation; events only emit after successful insert.
- **Dedup**: open actions (`proposed`, `approved`, `in_progress`) are deduplicated by `(workspace_id, source_type, violation_id, action_type, target_type, target_id)`.
- **Status update**: current row is fetched, transition validated, then `UPDATE`ed; event only emits after successful update.
- **List / Get**: standard Supabase `SELECT` with workspace scoping and optional filters.

## Constraints

- Do NOT automatically mutate PM assignments, projects, capacity, or performance data
- Do NOT implement Executive Reporting or Alerts
- Do NOT send notifications automatically
- Do NOT implement autonomous agents
- All actions are deterministic and human-governed
