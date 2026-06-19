# Project Constitution Lifecycle

## Overview

The Project Constitution is a governed entity whose lifecycle is managed by an explicit state machine. Every status change is audited, versioned, and isolated by workspace.

For CRUD operations, soft delete semantics, and foundation events, see [project-constitution-foundation.md](./project-constitution-foundation.md).

---

## State Diagram

```
              ┌──────────────────────────────┐
              │                              │
              ▼                              │
   ┌─────────────────┐                       │
   │      Draft      │──────────────────────►│
   └────────┬────────┘                       │
            │                                │
            ▼                                │
   ┌─────────────────┐                       │
   │    Proposed     │──► Draft              │
   └────────┬────────┘                       │
            │                                │
            ▼                                │
   ┌─────────────────┐                       │
   │    Approved     │──► Draft              │
   └────────┬────────┘                       │
            │                                │
            ▼                                │ (to Archived)
   ┌─────────────────┐                       │
   │     Active      │                       │
   └──┬──────────────┘                       │
      │         │                            │
      ▼         ▼                            │
 Suspended    Closed ─────────────────────►──┘
      │         │
      └────┬────┘
           │  (Active or Closed)
           ▼
      ┌─────────┐
      │Archived │  ← Terminal. No further transitions.
      └─────────┘
```

### Transition Table

| From      | To                          |
|-----------|-----------------------------|
| Draft     | Proposed, Archived          |
| Proposed  | Draft, Approved, Archived   |
| Approved  | Active, Draft, Archived     |
| Active    | Suspended, Closed           |
| Suspended | Active, Closed              |
| Closed    | Archived                    |
| Archived  | *(none — terminal)*         |

---

## States

### Draft

Constitution created. Editable. Not approved. Not executable.

### Proposed

Constitution submitted for review. Partially frozen. Pending approval.

### Approved

Constitution approved and ready for activation. May receive observations.

### Active

Constitution is in force. Governs the project. Official source of truth.

### Suspended

Constitution temporarily suspended. Project paused. History preserved.

### Closed

Project finalised. No ordinary changes admitted.

### Archived

Constitution archived. Read-only. Historical preservation only. **Terminal state — irreversible.**

---

## Business Rules

1. No transitions outside the defined state machine are permitted.
2. Transition to the same status is not allowed.
3. `Archived` is irreversible (terminal state).
4. `Closed` can only transition to `Archived`.
5. Every transition requires an authenticated actor (`actorId` must be a valid UUID).
6. Every transition emits a specific audit event and the generic `CONSTITUTION_STATUS_CHANGED` event.
7. Every transition increments `lifecycle_version` by 1.
8. All queries and mutations are scoped to the workspace (workspace isolation enforced via `workspace_id`).

---

## Audit Events

Every status transition emits two platform events:

| Event                         | Trigger                              |
|-------------------------------|--------------------------------------|
| `CONSTITUTION_PROPOSED`       | Draft → Proposed                     |
| `CONSTITUTION_APPROVED`       | Proposed → Approved                  |
| `CONSTITUTION_ACTIVATED`      | Approved → Active                    |
| `CONSTITUTION_SUSPENDED`      | Active → Suspended                   |
| `CONSTITUTION_CLOSED`         | Active / Suspended → Closed          |
| `CONSTITUTION_ARCHIVED`       | Closed / others → Archived           |
| `CONSTITUTION_STATUS_CHANGED` | Any valid transition (always emitted)|

### Event Payload

```json
{
  "constitutionId": "<uuid>",
  "projectId": "<uuid>",
  "fromStatus": "<previous status>",
  "toStatus": "<new status>",
  "lifecycleVersion": 3,
  "reason": "<optional reason>",
  "specificEvent": "CONSTITUTION_APPROVED"
}
```

---

## Data Model

### `project_constitutions`

| Column             | Type        | Description                                     |
|--------------------|-------------|-------------------------------------------------|
| `id`               | uuid        | Primary key                                     |
| `workspace_id`     | uuid        | Workspace isolation boundary                    |
| `project_id`       | uuid        | Associated project                              |
| `title`            | text        | Constitution title                              |
| `description`      | text        | Optional description                            |
| `current_status`   | text        | Current lifecycle state                         |
| `status_changed_at`| timestamptz | When the status last changed                    |
| `status_changed_by`| uuid        | Actor who performed the last transition         |
| `lifecycle_version`| integer     | Increments on every valid transition; starts at 1 |
| `created_by`       | uuid        | Author                                          |
| `created_at`       | timestamptz | Record creation timestamp                       |
| `updated_at`       | timestamptz | Last update timestamp                           |
| `metadata`         | jsonb       | Extension data                                  |

### `constitution_lifecycle_history`

| Column                  | Type        | Description                               |
|-------------------------|-------------|-------------------------------------------|
| `id`                    | uuid        | Primary key                               |
| `workspace_id`          | uuid        | Workspace isolation boundary              |
| `constitution_id`       | uuid        | FK to `project_constitutions`             |
| `from_status`           | text        | Status before transition                  |
| `to_status`             | text        | Status after transition                   |
| `changed_by`            | uuid        | Actor who triggered the transition        |
| `changed_at`            | timestamptz | When the transition occurred              |
| `reason`                | text        | Optional reason provided by the actor     |
| `lifecycle_version_after` | integer   | `lifecycle_version` after this transition |
| `metadata`              | jsonb       | Extension data                            |

---

## API

### `createConstitution(input)`

Creates a new constitution in `draft` status.

```typescript
const result = await createConstitution({
  workspaceId: "...",
  projectId: "...",
  title: "Project Alpha Constitution",
  createdBy: "user-uuid",
});
```

### `changeConstitutionStatus(input)`

Transitions a constitution to a new status. Validates the transition, records history, and emits audit events.

```typescript
const result = await changeConstitutionStatus({
  constitutionId: "...",
  workspaceId: "...",
  targetStatus: "proposed",
  actorId: "user-uuid",
  reason: "Ready for stakeholder review",
});
```

**Error cases:**

| Error                                                                 | `failureClass`         |
|-----------------------------------------------------------------------|------------------------|
| Invalid UUID inputs                                                   | `validation_failed`    |
| Constitution not found in workspace                                   | `not_found`            |
| Transition not allowed by state machine                               | `validation_failed`    |
| Transition to same status                                             | `validation_failed`    |
| Database write failure                                                | `persistence_failed`   |
| Event emission failure                                                | `event_emission_failed`|

### `getConstitutionLifecycleHistory(input)`

Returns the full ordered history of status transitions for a constitution.

```typescript
const result = await getConstitutionLifecycleHistory({
  constitutionId: "...",
  workspaceId: "...",
});
// result.data: ConstitutionLifecycleHistoryEntry[]
// each entry: { changed_at, changed_by, from_status, to_status, reason, lifecycle_version_after }
```

### `explainConstitutionLifecycle()`

Returns a structured description of the lifecycle for programmatic introspection or documentation generation.

```typescript
const explanation = explainConstitutionLifecycle();
// explanation.states — all 7 states with labels, descriptions, allowed transitions, terminal flag
// explanation.terminalStates — ['archived']
// explanation.auditEvents — all 7 event type names
// explanation.rules — 8 business rules as strings
```

---

## Error Examples

### Attempting an invalid transition

```
Constitution transition from 'active' to 'draft' is not allowed.
failureClass: validation_failed
```

### Attempting transition to the same state

```
Constitution is already in status 'approved'; transition to the same status is not allowed.
failureClass: validation_failed
```

### Attempting to transition out of archived

```
Constitution transition from 'archived' to 'active' is not allowed.
failureClass: validation_failed
allowedTargets: []
```

### Missing authenticated actor

```
actorId must be a UUID (authenticated actor required).
failureClass: validation_failed
```

---

## Workspace Isolation

Every query and mutation filters by `workspace_id`. The `getConstitutionLifecycleHistory` function verifies workspace ownership by first fetching the constitution with the workspace filter before querying history. The database migration enforces a composite foreign key `(project_id, workspace_id)` referencing `projects(id, workspace_id)`, and Row Level Security is enabled on both tables using `is_workspace_member(workspace_id)`.
