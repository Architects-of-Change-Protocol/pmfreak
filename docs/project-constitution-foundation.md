# Project Constitution Foundation

## Overview

Project Constitution is the formal governing document of a project. This document covers the Foundation layer — CRUD operations, workspace isolation, soft delete semantics, and audit events.

For lifecycle state machine, status transitions, and versioning, see [project-constitution-lifecycle.md](./project-constitution-lifecycle.md).

---

## Data Model

### `project_constitutions`

| Column              | Type        | Description                                               |
|---------------------|-------------|-----------------------------------------------------------|
| `id`                | uuid        | Primary key                                               |
| `workspace_id`      | uuid        | Workspace isolation boundary (enforced via RLS)           |
| `project_id`        | uuid        | Associated project                                        |
| `title`             | text        | Constitution title (required, non-empty)                  |
| `description`       | text        | Optional description                                      |
| `current_status`    | text        | Lifecycle state (see lifecycle doc)                       |
| `status_changed_at` | timestamptz | Timestamp of last status change                           |
| `status_changed_by` | uuid        | Actor who last changed status                             |
| `lifecycle_version` | integer     | Increments on every transition; starts at 1               |
| `created_by`        | uuid        | Author                                                    |
| `created_at`        | timestamptz | Record creation timestamp                                 |
| `updated_at`        | timestamptz | Last update timestamp                                     |
| `metadata`          | jsonb       | Extension data                                            |

**Composite FK:** `(project_id, workspace_id)` references `projects(id, workspace_id)` — prevents cross-workspace data leakage at the database level.

---

## Soft Delete

Project constitutions use `current_status = 'archived'` as soft delete.

- `archived` is a **terminal state** in the lifecycle machine — no further transitions are possible.
- Archived constitutions are excluded from `listConstitutions` results by default (`excludeArchived` defaults to `true`).
- `updateConstitution` blocks on archived constitutions with `failureClass: "governance_violation"`.
- Records are never physically deleted; historical data is always preserved.

---

## Workspace Isolation

Every operation is scoped to `workspace_id`:

- All queries include `.eq("workspace_id", workspaceId)`.
- `listConstitutions` always filters by `workspaceId`.
- `exportConstitution` verifies workspace ownership before assembling history.
- RLS enforces `is_workspace_member(workspace_id)` at the database level for all read and write operations.
- RLS insert policy requires `created_by = auth.uid()` — no impersonation.

---

## API

### `createConstitution(input)`

Creates a new constitution in `draft` status. Emits `CONSTITUTION_CREATED`.

```typescript
const result = await createConstitution({
  workspaceId: "...",
  projectId: "...",
  title: "Project Alpha Constitution",
  description: "Governing document for Project Alpha",
  createdBy: "user-uuid",
});
// result.ok === true → result.data: ConstitutionRecord
```

**Validation:**
- `workspaceId`, `projectId`, `createdBy` must be valid UUIDs.
- `title` is required and non-empty.

---

### `getConstitution(constitutionId, workspaceId)`

Retrieves a constitution by ID, scoped to workspace.

```typescript
const result = await getConstitution("constitution-uuid", "workspace-uuid");
// result.ok === false → failureClass: "not_found" if not in workspace
```

---

### `listConstitutions(filters)`

Lists constitutions for a workspace. Excludes archived by default.

```typescript
// List all non-archived constitutions in workspace
const result = await listConstitutions({ workspaceId: "..." });

// List by project
const result = await listConstitutions({ workspaceId: "...", projectId: "..." });

// List only active constitutions
const result = await listConstitutions({ workspaceId: "...", status: "active" });

// Include archived (explicitly opt in)
const result = await listConstitutions({ workspaceId: "...", excludeArchived: false });
```

---

### `updateConstitution(input)`

Updates `title`, `description`, or `metadata` of a constitution. Emits `CONSTITUTION_UPDATED`.

Only `draft` constitutions can be directly edited. Use the amendment process for non-draft constitutions.

```typescript
const result = await updateConstitution({
  constitutionId: "...",
  workspaceId: "...",
  actorId: "user-uuid",
  title: "Revised Title",
  description: "Updated description",
});
```

**Governance blocks:**
- `archived` → `"Archived constitutions are read-only and cannot be updated."` (`governance_violation`)
- Non-draft (proposed, approved, active, suspended, closed) → `"use the amendment process."` (`governance_violation`)

---

### `exportConstitution(input)`

Returns the full constitution record plus its complete lifecycle history.

```typescript
const result = await exportConstitution({ constitutionId: "...", workspaceId: "..." });
// result.data: { constitution, lifecycleHistory, exportedAt }
```

---

## Audit Events

| Event                  | Trigger                            |
|------------------------|------------------------------------|
| `CONSTITUTION_CREATED` | `createConstitution` succeeds      |
| `CONSTITUTION_UPDATED` | `updateConstitution` succeeds      |

All events set:
- `eventCategory: "governance"`
- `learningEligible: false`
- `rawReferenceTable: "project_constitutions"`
- `rawReferenceId: <constitution uuid>`
- `visibility: "workspace"`
- `sensitivityLevel: "internal"`

For lifecycle transition events (`CONSTITUTION_PROPOSED`, `CONSTITUTION_APPROVED`, etc.), see [project-constitution-lifecycle.md](./project-constitution-lifecycle.md).

---

## Error Reference

| Condition                               | `failureClass`         |
|-----------------------------------------|------------------------|
| Invalid UUID inputs                     | `validation_failed`    |
| Empty title                             | `validation_failed`    |
| Constitution not found in workspace     | `not_found`            |
| Updating an archived constitution       | `governance_violation` |
| Updating a non-draft constitution       | `governance_violation` |
| Database write failure                  | `persistence_failed`   |
| Event emission failure                  | `event_emission_failed`|

---

## Module Structure

```
src/lib/project-constitution/
├── index.ts                  — public exports
├── types.ts                  — ConstitutionRecord, ConstitutionResult<T>, ConstitutionListFilters, ConstitutionExport, …
├── constitution-service.ts   — CRUD + lifecycle service functions
├── state-machine.ts          — allowedTransitions, validateConstitutionTransition, TERMINAL_STATES
└── lifecycle-explanation.ts  — explainConstitutionLifecycle() (pure, no Supabase dependency)
```

Database:
```
supabase/migrations/20260623000000_project_constitution_lifecycle.sql
  — project_constitutions (foundation + lifecycle fields)
  — constitution_lifecycle_history (transition audit trail)
```
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
