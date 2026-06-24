# PM Registry Operationalization

## What this slice activates

Sprint 1 introduced Project Manager as a first-class governed entity (domain model, migrations, types, service functions). This operationalization sprint connects that domain to:

- HTTP API routes for all PM Registry operations
- Protected UI pages for PM management
- PM assignment panel on the project detail page
- Real audit/platform events emitted on every mutation

## API Routes

### PM Registry

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/pm-registry` | List PMs for workspace. Optional `?status=active\|inactive\|suspended` filter. |
| POST | `/api/pm-registry` | Register a new PM. Body: `{ displayName, email }` |
| GET | `/api/pm-registry/[pmId]` | Get a single PM. |
| PATCH | `/api/pm-registry/[pmId]` | Update PM display name, email, or status. |
| GET | `/api/pm-registry/[pmId]/profile` | Get PM profile (role, experience, capacity). |
| PUT | `/api/pm-registry/[pmId]/profile` | Create or update PM profile. |
| GET | `/api/pm-registry/[pmId]/assignments` | List PM's assignments. `?includeRemoved=true` for history. |

### Project PM Assignments

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/[projectId]/pm-assignments` | List active assignments for a project. |
| POST | `/api/projects/[projectId]/pm-assignments` | Assign a PM. Body: `{ pmId, assignmentType }` |
| DELETE | `/api/projects/[projectId]/pm-assignments/[assignmentId]` | Unassign (soft delete via `removed_at`). |

### Response format

All routes return:

```json
{ "ok": true, "data": ... }
// or
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

## UI Routes

| Route | Description |
|-------|-------------|
| `/pm-registry` | PM Registry list with create action |
| `/pm-registry/[pmId]` | PM detail with edit, profile, assignments, history |

Project detail page (`/projects/[id]`) now includes a **Project Ownership** section with PM assignment/unassignment.

## Mutation Events

Every successful mutation emits a platform event via `createPlatformEvent`:

| Event | Trigger |
|-------|---------|
| `PROJECT_MANAGER_REGISTERED` | `registerProjectManager()` |
| `PROJECT_MANAGER_UPDATED` | `updateProjectManager()` |
| `PROJECT_MANAGER_PROFILE_UPDATED` | `upsertPMProfile()` |
| `PROJECT_MANAGER_ASSIGNED` | `assignProjectManager()` |
| `PROJECT_MANAGER_UNASSIGNED` | `unassignProjectManager()` |

Events are stored in `platform_events` (category: `governance`, source: `user_action`). Each payload includes `pm_id`, `workspace_id`, `actor_user_id`, `source: "pm_registry"`, and relevant entity IDs.

Events are emitted fire-and-forget (`void`) after successful persistence. A failure to emit does not roll back the mutation.

## Assignment Rules

1. PM must exist in the same workspace.
2. PM must have status `active` to receive new assignments.
3. Only one active `primary` assignment per project at a time.
4. No duplicate active assignments (same PM + project + type).
5. Unassignment sets `removed_at` — hard deletion is never performed.
6. Historical assignments are preserved and queryable via `?includeRemoved=true`.
7. `assignment_type` must be one of: `primary`, `secondary`, `program`, `observer`.

## Hardening Pass (Sprint 2)

### Capacity enforcement

`active_projects_limit` from `pm_profiles` is now enforced at assignment time. The counting rule:

- Assignment types `primary`, `secondary`, `program` each count toward the PM's active project limit.
- Assignment type `observer` does **not** count — it is a monitoring role, not an ownership commitment.
- If no `pm_profiles` row exists for the PM, the limit defaults to **5** (matching the DB column default).
- On breach, the service returns `failureClass: "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED"` with `details: { current_count, limit, attempted_assignment_type }`.
- The API route maps this to HTTP 422.

### PM display enrichment

The GET `/api/projects/[projectId]/pm-assignments` response now enriches each assignment with `pm_display_name` and `pm_email`, resolved via a secondary batch query against `project_managers`. The `ProjectPMAssignment` UI component displays these fields; it falls back to a truncated UUID only if enrichment data is absent.

### Audit event payload shape (verified)

All governance events emitted by the PM Registry include:
- `workspace_id` — workspace boundary for data isolation
- `actor_user_id` — identity of the user who performed the action
- `pm_id` — subject PM
- `source: "pm_registry"` — distinguishes from other event sources
- Entity-specific fields: `project_id`, `assignment_id`, `assignment_type`, `previous_status`, `new_status` where applicable

Events are classified as `eventCategory: "governance"` and stored in `platform_events`.

### Pre-existing TypeScript errors

The repository has pre-existing `TS2307: Cannot find module 'next/server'` and implicit-any JSX errors in files outside the PM Registry domain (e.g., `src/app/api/programs/route.ts`, `src/components/marketing-navbar.tsx`). These are not introduced by this slice.

## Known Limitations

- **Profile validation against PM existence**: `upsertPMProfile` does not currently verify that the PM exists in the same workspace before upserting. The DB FK constraint and RLS policies enforce this at the database layer.

## Follow-up Slices

- **PM Capacity Snapshot Activation**: Aggregate capacity utilization snapshots from assignment history for PMO dashboards.
- **PM Performance Snapshot Activation**: Connect assignment records to delivery metrics to compute PM performance scores.
- **PM Detail Intelligence**: Surface workload, capacity headroom, and assignment history directly on the PM detail page.
- **PMO Governance Compliance Activation**: Surface PM Registry events in the `/audit` page with a `source=pm_registry` filter.
- **PM Registry navigation**: Add `/pm-registry` to the app navigation sidebar.
