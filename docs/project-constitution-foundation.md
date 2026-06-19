# Project Constitution Foundation

## Purpose

The Project Constitution Foundation provides the canonical governance record for a project within a workspace. It captures identity, stakeholder roles, objectives, constraints, and timeline boundaries — the minimum set of information required to anchor all downstream governance (decisions, risks, scope changes) to a coherent project context.

## Table

`public.project_constitutions`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace scope (RLS enforced) |
| name | text | Required |
| description | text | Optional narrative |
| status | text | `draft \| active \| on_hold \| completed \| cancelled` |
| sponsor | text | Organizational sponsor name |
| client | text | Client or customer name |
| pm_responsible_id | uuid | FK → auth.users |
| objectives | text[] | Ordered list of project objectives |
| constraints | text[] | Ordered list of project constraints |
| start_date | date | ISO 8601 date |
| target_end_date | date | ISO 8601 date |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | Immutable on creation |
| updated_at | timestamptz | Updated on every mutation |
| deleted_at | timestamptz | Null = active; set on soft delete |
| metadata | jsonb | Extensible key/value bag |

## Service API (`src/lib/project-constitution/service.ts`)

| Function | Description |
|---|---|
| `createProjectConstitution(input)` | Persists a new constitution in `draft` status and emits `PROJECT_CREATED`. |
| `updateProjectConstitution(input)` | Patches one or more fields and emits `PROJECT_UPDATED`. |
| `changeProjectConstitutionStatus(input)` | Transitions status and emits `PROJECT_STATUS_CHANGED`. Idempotent if status unchanged. |
| `softDeleteProjectConstitution(input)` | Sets `deleted_at` and emits `PROJECT_ARCHIVED`. No physical deletion. |
| `getProjectConstitution(id, workspaceId)` | Returns a single active record. |
| `listProjectConstitutions(workspaceId, status?)` | Returns summaries for a workspace, optionally filtered by status. |

All functions return `Result<T>` — either `{ ok: true; data: T }` or `{ ok: false; error: string; failureClass: ... }`.

## Audit Events

All events are written to `platform_events` with `event_category: "project"` and `raw_reference_table: "project_constitutions"`.

| Event | Trigger |
|---|---|
| `PROJECT_CREATED` | `createProjectConstitution` |
| `PROJECT_UPDATED` | `updateProjectConstitution` |
| `PROJECT_STATUS_CHANGED` | `changeProjectConstitutionStatus` |
| `PROJECT_ARCHIVED` | `softDeleteProjectConstitution` |

## Workspace Isolation

Row-Level Security is enforced via `public.is_workspace_member(workspace_id)`. All queries scope to `workspace_id` at the service layer as a defense-in-depth measure. Records with `deleted_at IS NOT NULL` are filtered out by all standard policies and service queries.

## Capability Explain

```ts
import { explainProjectConstitutionCapability } from "@/lib/project-constitution";
const explain = explainProjectConstitutionCapability();
// explain.purpose — why this capability exists
// explain.scope — what it covers
// explain.limits — what it does NOT do
// explain.auditEvents — which events are emitted
// explain.workspaceIsolation — how isolation is enforced
```

## Validations

- `workspaceId`, `createdBy`, `updatedBy`, `changedBy`, `deletedBy`, `pmResponsibleId` — UUID format required.
- `name` — non-empty string required.
- `startDate`, `targetEndDate` — must match `YYYY-MM-DD` and parse as a valid date, or be null/omitted.
- `status` — must be one of the five defined statuses.

## Out of Scope

- Task scheduling and resource management.
- Budget and financial tracking.
- Risk registers and RAID logs.
- UI components and navigation.
