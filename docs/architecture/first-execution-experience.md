# Project Creation & First Execution Experience — Architecture

Date: 2026-07-21
Follows: `docs/architecture/workspace-activation.md` (Guided Workspace Onboarding sprint),
`docs/architecture/zero-state-ux-refactor-audit.md` (Zero State UX sprint)

## Product rule

The first operational experience must be direct. A new user creates a
project and a task manually — no RAID item, no recommendation, no AI
conversation, no template, no PMO configuration is a prerequisite. Advanced
flows (RAID → Recommended Action → Task Draft → Execution Task) remain fully
available and unchanged; this sprint adds a parallel, canonical direct path
into the same entities.

## The schema decision

`execution_tasks.task_draft_id` was `not null`, and `task_drafts.recommended_action_id`
was `not null` — meaning an execution task could not exist without first
passing through a recommended action and a task draft. One additive
migration removes that:

```sql
alter table public.execution_tasks alter column task_draft_id drop not null;
```

(`supabase/migrations/20260830000000_execution_tasks_optional_draft.sql`)

Nothing else changed. The existing unique index on `task_draft_id` already
permits unlimited `NULL`s (Postgres unique-index semantics), so manual tasks
need no synthetic draft/recommendation row — they simply have
`task_draft_id`, `recommended_action_id`, and `raid_item_id` all `null`, and
are tagged `source_payload.source = "manual"`. `task_drafts` itself is
untouched. `convertTaskDraftToExecutionTask` (the advanced path) is
unaffected — it always sets `task_draft_id`.

## Two entry points into the same canonical entities

```
Advanced:  raid_items → recommended_actions → task_drafts → execution_tasks
                                                    (convertTaskDraftToExecutionTask)

Direct:    execution_tasks                          (createExecutionTaskDirect)
           projects                                 (createMinimalProject)
```

Both paths write the exact same tables with the exact same shape. Nothing
downstream (dashboards, activation evidence, Command Center) needs to know
which path a task came from.

## New architecture

```
src/lib/execution-tasks/
  create-execution-task.ts   — validateCreateExecutionTaskInput (pure) +
                                createExecutionTaskDirect (tenancy, auth, insert)
  task-labels.ts              — single DB-value → UI-label mapping (status, priority)

src/lib/projects/
  create-minimal-project.ts   — validateCreateMinimalProjectInput (pure) +
                                createMinimalProject (workspace/PMO resolution, insert)
                                Used by both createProjectAction (server action,
                                redirect-based) and POST /api/projects (JSON, for the modal).

src/lib/workspace-team.ts
  listWorkspaceMembersForAssignment — real workspace_memberships resolved to
                                       display name/email (service-role
                                       auth.admin.getUserById; no profiles table
                                       exists). Registered in
                                       privileged-access-registry.ts.

src/app/api/execution-tasks/route.ts        — GET (existing) + POST (new, direct create)
src/app/api/projects/route.ts               — GET (existing) + POST (new, direct create)
src/app/api/workspace-team/members/route.ts — GET, workspaceId or projectId (resolved server-side)

src/components/pmfreak/ui/modal.tsx                    — shared a11y modal shell (focus trap, Escape, focus return)
src/components/pmfreak/projects/create-project-modal.tsx
src/components/pmfreak/tasks/quick-add-task-modal.tsx
src/components/pmfreak/empty-states/create-project-cta.tsx  — modal-trigger CTA slot
src/components/pmfreak/empty-states/add-task-cta.tsx         — modal-trigger CTA slot
src/components/pmfreak/tasks/project-task-list.tsx           — First Execution View
```

## Tenancy

- `createExecutionTaskDirect` resolves `workspace_id` from the project row
  itself (never a client-supplied value), calls
  `requireProjectAccess(projectId, "write")` (the same AOC-backed capability
  gate the advanced conversion path uses), and — if an assignee is supplied
  — verifies that user has a real `workspace_memberships` row in that
  project's workspace before allowing the assignment.
- `createMinimalProject` resolves the write workspace via
  `resolveWriteWorkspace(userId)`, which only ever returns a workspace the
  authenticated caller actually belongs to — tenancy is enforced by
  construction, not by an extra check.
- `GET /api/workspace-team/members` accepts `projectId` and derives
  `workspace_id` server-side via `getProjectWorkspaceId`, so a caller cannot
  request another workspace's roster by passing an arbitrary `workspaceId`
  — `listWorkspaceMembersForAssignment` still independently requires the
  caller's own membership in the resolved workspace.

## Onboarding integration

`src/lib/workspace-activation/activation-rules.ts` required no changes:
`operationallyStarted` was already `projectExists && taskExists`, and
`deriveActivationStage` already reaches `execution_started` on exactly that
condition — manual tasks satisfy the same boolean presence probe
(`execution_tasks` table, no `source` filter) that converted tasks do. What
changed is *how the CTA behaves*: the `task_created` step's CTA, and the
`EmptyDashboard` / `EmptyProjects` / `EmptyPortfolio` / `EmptyExecution`
"create project" CTAs, now open the relevant modal directly instead of
linking to `/command-center` (a pre-existing routing gap this sprint also
closes). Both modals call SWR's global `mutate("/api/workspace-activation")`
on success, so the onboarding panel and empty states update immediately
without waiting for the panel's 30s polling interval.

## Matrix

| Action | Surface(s) | Entity | Permission | Success transition | Cache invalidated |
|---|---|---|---|---|---|
| Create project | EmptyDashboard/Projects/Portfolio, EmptyExecution (no project), Quick Add Task blocked state, `/projects` inline form, `/projects/new` wizard (unchanged, advanced) | `projects` | role ≠ viewer | Modal → success view → "Add first task"; form → redirect to Command Center | `/api/workspace-activation` |
| Add task | Onboarding panel, EmptyExecution (has project), Project Landing empty/populated state | `execution_tasks` | `requireProjectAccess(projectId, "write")` | Modal → success view → "Add another task"; list revalidates | `/api/workspace-activation`, `/api/execution-tasks?projectId=` |
| Change task status | Project Landing task list | `execution_tasks` | same (via update route's project read-access check) | Inline select, list revalidates | `/api/execution-tasks?projectId=` |

## What stayed untouched

- `convertTaskDraftToExecutionTask`, `task_drafts`, `recommended_actions`,
  RAID extraction, and the Command Center's "Needs You" queue.
- The 5-step `/projects/new` wizard (`CreateProjectWizard` /
  `saveProjectOnboarding`) — still the advanced project-setup path.
- `src/lib/workspace-activation/activation-rules.ts` and
  `evaluate-workspace-activation.ts` — evidence and stage logic already
  matched this sprint's requirements before any code changed.

## Deferred (documented, not silently dropped)

`projects` has no `start_date`, `target_date`, or `priority` columns. The
sprint spec lists these as optional-recommended, not required; adding them
would mean a second migration plus updates to the landing page, project
settings, and every read site. The minimal Create Project form is scoped to
what the schema already supports: `name` (required), `description`
(optional), `pmoId` (optional, defaulted via the existing `ensureDefaultPmo`).
