# Project Constitution Amendment Governance

**Epic 1 — Project Constitution · Sprint 3**

This document describes the Constitutional Amendment Governance system, which enables a Project Constitution to evolve through a formal, auditable Amendment process without allowing direct modification of an Active Constitution.

---

## What Is a Constitutional Amendment?

A **Constitutional Amendment** is a formal, governed proposal to modify a Project Constitution. Every modification to an Active (or non-Draft) Constitution must flow through this process.

Amendments carry:
- A **title**, **description**, and **justification**
- One or more **field-level changes** (add, update, remove)
- A full **lifecycle** — Draft → Proposed → Approved → Applied
- Complete **audit trail** via platform events

---

## Amendment Lifecycle

```
Active Constitution
       ↓
Amendment Draft
       ↓
Amendment Proposed
       ↓
Amendment Approved
       ↓
Amendment Applied
       ↓
New Constitution Version
```

### States

| State | Description | Terminal |
|-------|-------------|----------|
| `draft` | Created. Editable. Not submitted for review. | No |
| `proposed` | Submitted for approval. Frozen — no edits allowed. | No |
| `approved` | Approved by a reviewer. Ready to be applied. | No |
| `rejected` | Rejected. No further transitions. | **Yes** |
| `withdrawn` | Withdrawn by author or proposer. No further transitions. | **Yes** |
| `applied` | Applied to the Constitution. Version incremented. Snapshots created. | **Yes** |

### State Machine

```
draft      → proposed, withdrawn
proposed   → approved, rejected, withdrawn
approved   → applied
rejected   → (terminal)
withdrawn  → (terminal)
applied    → (terminal)
```

### Approval Flow

1. Author creates a **Draft Amendment** with title, description, justification, and field-level changes.
2. Author **proposes** the Amendment (`draft → proposed`), freezing it for review.
3. Reviewer **approves** (`proposed → approved`) or **rejects** (`proposed → rejected`).
4. If approved, the Amendment is **applied** (`approved → applied`), modifying the Constitution and incrementing `constitution_version`.
5. At any point before `applied`, the Amendment may be **withdrawn** (`draft/proposed → withdrawn`).

---

## Constitutional Versioning

Each Applied Amendment increments the `constitution_version` counter on the `project_constitutions` table by `1`.

- Initial value: `1`
- After each Amendment Applied: `version + 1`

This counter tracks governance amendments independently of `lifecycle_version`, which tracks status transitions.

---

## Constitutional Snapshots

Two immutable snapshots are created for each Applied Amendment:

| Snapshot | When | Version |
|----------|------|---------|
| **Before** | Immediately before changes are applied | `currentVersion` |
| **After** | Immediately after changes are applied | `newVersion` |

Snapshots are stored in `constitution_snapshots` and are keyed by `constitution_id` + `version`. They capture the full constitution state as JSON and are never modified after creation.

---

## Amendment Changes

Each Amendment contains one or more `constitution_amendment_changes` records:

| Change Type | Meaning |
|-------------|---------|
| `add` | A new field value is introduced |
| `update` | An existing field value is changed |
| `remove` | A field value is removed (set to null) |

Each change records `field_name`, `old_value`, and `new_value`.

---

## Diff Engine

`generateConstitutionDiff()` produces a structured diff from the changes associated with an Amendment:

```typescript
{
  constitutionId: string;
  amendmentId: string;
  changes: Array<{
    field: string;
    previousValue: string | null;
    newValue: string | null;
    changeType: 'add' | 'update' | 'remove';
  }>;
}
```

---

## Audit Events

Every Amendment action emits an event to the `platform_events` system:

| Event | Trigger |
|-------|---------|
| `CONSTITUTION_AMENDMENT_CREATED` | Amendment created |
| `CONSTITUTION_AMENDMENT_UPDATED` | Amendment edited (draft only) |
| `CONSTITUTION_AMENDMENT_PROPOSED` | Amendment proposed |
| `CONSTITUTION_AMENDMENT_APPROVED` | Amendment approved |
| `CONSTITUTION_AMENDMENT_REJECTED` | Amendment rejected |
| `CONSTITUTION_AMENDMENT_WITHDRAWN` | Amendment withdrawn |
| `CONSTITUTION_AMENDMENT_APPLIED` | Amendment applied |
| `CONSTITUTION_SNAPSHOT_CREATED` | Snapshot created (before and after) |
| `CONSTITUTION_VERSION_INCREMENTED` | Constitution version incremented |

All events include `constitutionId`, `amendmentId`, `fromStatus`, `toStatus`, and are scoped to `workspace`.

---

## Governance Rules

| Rule | Description |
|------|-------------|
| Rule 1 | An Active Constitution cannot be modified directly. |
| Rule 2 | Every modification requires a Constitutional Amendment. |
| Rule 3 | Only Draft amendments can be edited. |
| Rule 4 | Only Approved amendments can be applied. |
| Rule 5 | Rejected is a terminal state. |
| Rule 6 | Withdrawn is a terminal state. |
| Rule 7 | Applied is a terminal state. |
| Rule 8 | Every amendment application generates two snapshots (before and after). |
| Rule 9 | Every amendment application increments `constitution_version` by 1. |
| Rule 10 | Every action emits an audit event via the platform_events system. |
| Rule 11 | Workspace isolation is enforced on all amendment operations. |
| Rule 12 | An amendment cannot be applied twice. |

---

## Database Schema

### `constitution_amendments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `workspace_id` | uuid | Workspace isolation |
| `constitution_id` | uuid | FK to project_constitutions |
| `title` | text | Required |
| `description` | text | Optional |
| `justification` | text | Optional |
| `status` | text | Amendment state |
| `created_by` | uuid | Author |
| `approved_by` | uuid | Approver |
| `rejected_by` | uuid | Rejector |
| `rejected_reason` | text | Rejection explanation |
| `withdrawn_by` | uuid | Withdrawer |
| `applied_by` | uuid | Applier |
| `deleted_at` | timestamptz | Soft-delete |

### `constitution_amendment_changes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `workspace_id` | uuid | Workspace isolation |
| `amendment_id` | uuid | FK to constitution_amendments |
| `change_type` | text | `add`, `update`, `remove` |
| `field_name` | text | Constitution field |
| `old_value` | text | Previous value |
| `new_value` | text | New value |

### `constitution_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `workspace_id` | uuid | Workspace isolation |
| `constitution_id` | uuid | FK to project_constitutions |
| `version` | integer | constitution_version at capture time |
| `snapshot_data` | jsonb | Full constitution state |
| `created_by` | uuid | Actor |

### `project_constitutions` (amendment column)

| Column | Type | Notes |
|--------|------|-------|
| `constitution_version` | integer | Starts at 1, increments per applied amendment |

---

## Services

| Function | Description |
|----------|-------------|
| `createAmendment` | Create a Draft Amendment |
| `updateAmendment` | Edit a Draft Amendment |
| `proposeAmendment` | Transition draft → proposed |
| `approveAmendment` | Transition proposed → approved |
| `rejectAmendment` | Transition proposed → rejected |
| `withdrawAmendment` | Transition draft/proposed → withdrawn |
| `applyAmendment` | Transition approved → applied; applies changes; increments version; creates snapshots |
| `getAmendmentHistory` | Return amendment + its changes |
| `listAmendments` | List amendments for a constitution |
| `getConstitutionDiff` | Generate diff from amendment changes |
| `listConstitutionSnapshots` | List snapshots for a constitution |
| `explainConstitutionAmendmentGovernance` | Explain the Amendment governance system |

---

## Workspace Isolation

All tables use Row Level Security (RLS) with `public.is_workspace_member(workspace_id)` policies. Composite foreign keys enforce cross-workspace isolation at the database level. All service functions validate `workspaceId` and scope every query with `.eq("workspace_id", workspaceId)`.
