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

## Known Limitations

- **Capacity enforcement**: `active_projects_limit` from `pm_profiles` is stored but not enforced at assignment time. The validation is noted as a TODO. A future sprint should query active assignment count and compare against the limit before allowing new assignments.
- **Profile validation against PM existence**: `upsertPMProfile` does not currently verify that the PM exists in the same workspace before upserting. The DB FK constraint and RLS policies enforce this at the database layer, but application-layer verification would provide a clearer error message.
- **PM display in assignment list**: The project assignment panel shows `pm_id` (UUID), not `display_name`. A follow-up can join with `project_managers` to show human-readable names.

## Follow-up Slices

- **Capacity intelligence**: Enforce `active_projects_limit` at assignment time with a count query.
- **PM selector UX**: Show PM name + email in the assignment panel (join query or enriched response).
- **PM Registry navigation**: Add `/pm-registry` to the app navigation sidebar.
- **Audit event page**: Surface PM Registry events in the `/audit` page with a `source=pm_registry` filter.
- **PM performance engine**: Connect PM assignment history to the performance analysis layer.
