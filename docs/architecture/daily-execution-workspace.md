# Daily Execution Workspace + Task Detail — Architecture

Date: 2026-07-21
Follows: `docs/architecture/first-execution-experience.md` (Project Creation & First
Execution Experience sprint), `docs/architecture/workspace-activation.md` (Guided
Workspace Onboarding sprint), `docs/architecture/zero-state-ux-refactor-audit.md`
(Zero State UX sprint)

## Executive summary

The previous sprint made it possible to create a project, add a task, and update
its status. This sprint turns that into a daily-use tool: a workspace-wide **Daily
Execution Workspace** (`/execution`) that answers "what needs attention today,"
and a **Task Detail** drawer that is the single place to read and edit a task's
full operational state. `ProjectTaskList` now opens the same Task Detail drawer
rather than growing a second, incompatible editing surface.

The daily loop this sprint builds:

```
Open /execution → see Needs Attention / In Progress / Upcoming / Backlog / Completed
                 → open a task → edit status/assignee/due date/priority/description
                 → drawer closes → list re-sections and re-counts, no manual refresh
```

Everything shown is derived from real `execution_tasks` rows. Attention
classification is a pure, deterministic function of real columns
(`status`, `priority`, `owner_user_id`, `due_date`) — there is no AI ranking,
no fabricated score, and no reason that cannot be traced to a column value.

## Route audit (why `/execution` is new, and what stays untouched)

Before adding a route, the existing execution-shaped surfaces were mapped:

| Surface | Responsibility | Verdict |
|---|---|---|
| `/command-center` | Workspace-wide intelligence console: governance briefs, RAID, recommendations, the advanced draft→task pipeline, dependency graph | Kept as-is. Different job (decisions/coordination, not a daily task list). Its own inline task actions (`handleTaskAction` → `POST /api/execution-tasks/update`) are untouched. |
| `/follow-up-dashboard`, `/projects/[id]/follow-up` | Execution-memory-based delivery summary/narrative | Kept as-is. Different data source (operational memory), different job (retrospective summary, not actionable daily list). |
| `ProjectTaskList` (`/projects/[id]`) | Single-project task list | Kept as the project-scoped view; **now opens the same `TaskDetailDrawer`** as `/execution` instead of having no detail view at all. |
| `/execution` (new) | Cross-project daily task list, attention-first | New — nothing existing was a workspace-wide, quick-action task list. |

No existing route was deprecated or redirected. `NAVIGATION_HIERARCHY` gained one
entry (`Daily Execution` → `/execution`, primary tier) and the pre-existing
`Execution` → `/command-center` lens entry was **left untouched** — renaming it
would have broken `tests/navigation-collapse.test.mjs`'s guardrail against
reintroducing "Command Center" as a nav label, and was out of this sprint's scope
regardless.

## Attention model

`src/lib/execution-attention/` — pure, no I/O, no AI:

```
types.ts                       — TaskAttentionReason, TaskAttentionClassification,
                                  ExecutionSection, ClassifiedExecutionTask
classify-task-attention.ts     — classifyTaskAttention(task, now) + isTaskOverdue/
                                  isTaskDueToday/isTaskUpcoming (calendar-day,
                                  local-timezone comparisons — never raw UTC slices)
resolve-execution-section.ts   — resolveExecutionSection(task, attention, now)
classify-execution-tasks.ts    — classifyExecutionTasks(tasks, now) — attaches
                                  attention + section to every task
sort-execution-tasks.ts        — sortExecutionTasks(classified, mode) — attention/
                                  due_date/priority/updated_at/project, all
                                  deterministic comparators
execution-attention-summary.ts — summarizeExecutionAttention(classified, now) —
                                  real counts only
matches-attention-filter.ts    — the same predicate the summary counts use, so a
                                  "3 overdue" chip and its filter always agree
```

### Attention Matrix

| Reason | Evidence (real column) | Contributes to severity |
|---|---|---|
| `overdue` | `due_date` < start of today (local), status not terminal | critical (if also blocked or priority=critical), else high |
| `blocked` | `status === "blocked"` | critical (if also overdue), else high |
| `due_today` | `due_date` falls on today's calendar day (local) | high (if priority high/critical), else normal |
| `high_priority` | `priority` is `high` or `critical` | normal (unless combined with overdue/blocked/due_today above) |
| `unassigned` | `owner_user_id === null` | normal |

Exclusions: `completed`/`cancelled` tasks are never classified as needing
attention, regardless of how overdue their `due_date` is — a finished task is not
work in need of a decision.

**Deliberately not implemented**, per the sprint brief's own instruction to leave
undefined rules out rather than guess:

- `stale_in_progress` — needs a product-approved "in_progress for N days" threshold
  that does not exist yet. Left out of `TaskAttentionReason` entirely (not merely
  unused) so it cannot be silently half-wired.
- `at_risk` — no stable, evidence-backed definition exists. Not a union member.
- Any opaque score (`attentionScore`, "Execution Health: 82%", etc.) — every
  number in the UI is a real array length (`summarizeExecutionAttention`), never a
  derived percentage.

### Section placement (derived, not stored)

`resolveExecutionSection`: `completed`/`cancelled` → **Completed Recently**; else
if `requiresAttention` → **Needs Attention** (wins over In Progress — a blocked or
overdue in-progress task is not routine ongoing work); else `in_progress` status →
**In Progress**; else a future `due_date` → **Upcoming**; else → **Backlog**.

### Sort order (`mode: "attention"`, the default)

`sortRank` (lower first): overdue+blocked (0) → overdue+critical-priority (10) →
overdue (20) → blocked (30) → due-today+high-priority (40) → due-today (50) →
high-priority (60) → unassigned (70) → everything else (800), tie-broken by due
date ascending then title. This is the same order named in the sprint brief's
§7.4 and is fully unit-tested for determinism (input-order independence).

## API

Additive only — nothing existing was removed or had its contract changed.

```
GET  /api/execution-tasks?projectId=            (unchanged — ProjectTaskList, Command Center)
POST /api/execution-tasks                       (unchanged — Quick Add Task)
POST /api/execution-tasks/update                 (unchanged — legacy quick-status path,
                                                    still used by ProjectTaskList's inline
                                                    status select and Command Center)
GET  /api/execution-tasks/activity?taskId=       (unchanged)
POST /api/execution-tasks/convert                (unchanged — advanced pipeline)

GET  /api/execution-tasks/daily                  (new) — workspace-wide listing
GET  /api/execution-tasks/:taskId                (new) — task + permissions + activity
PATCH /api/execution-tasks/:taskId               (new) — partial update, whitelisted
```

### `GET /api/execution-tasks/daily`

Workspace resolved server-side via `resolvePreferredWorkspace(userId)` — **never**
from a client `workspaceId` param (there isn't one). Query params: `projectId`,
`assigneeId` (`me` | `unassigned` | a member id), `status`, `priority`, `search`,
`limit`/`cursor`. A `projectId` outside the resolved workspace yields the empty
result set, never another workspace's tasks. `search` matches task title,
description, or project name (via a project-name pre-filter joined into the
`execution_tasks` `.or()` clause). Response is capped at `limit` (default 200, max
500) with `hasMore`/`nextCursor` for a future "load more"; the client additionally
caps each section's initial render at 20 rows with a "View all N" expander (§34).

### `GET /api/execution-tasks/:taskId`

Returns `{ task, permissions: { canEdit, canAssign, canDelete }, activity }`.
`canEdit`/`canAssign` share one gate (`requireProjectAccess(projectId, "write")`)
— this domain has no separate assign-only permission tier. `canDelete` is always
`false` (see Known gaps). `activity` is `execution_task_events` rows, ordered —
empty array (never fabricated) when none exist; the UI renders "No recorded
activity yet" for that case.

### `PATCH /api/execution-tasks/:taskId`

Whitelisted fields only: `title`, `description`, `status`, `priority`,
`assigneeId`, `dueDate`. Validated by the pure
`validateUpdateExecutionTaskInput(body, currentStatus)` (mirrors
`validateCreateExecutionTaskInput`'s shape/limits, plus a status-transition check
against `isValidStatusTransition`). Requires project `write` access **before**
validation for any field, including status — unlike the legacy `/update`
sub-route (kept at `read` for its existing callers), so this is the endpoint that
actually rejects a viewer's direct PATCH. A new `assigneeId` is re-verified
against `listWorkspaceMembersForAssignment(task.workspace_id)` — the task's own
workspace, resolved from the DB row, never the client. One
`execution_task_events` row is written per changed field
(`task_title_changed`, `task_description_changed`, `task_status_changed` /
`task_completed` / `task_cancelled`, `task_priority_changed`,
`task_assignee_changed`, `task_due_date_changed`), `actor_user_id` always the
server-resolved caller. Reopening a completed task (`completed` → `in_progress`)
clears `completed_at`.

## Shared components

`src/components/pmfreak/execution/` — used by both `/execution` and (for
`TaskDetailDrawer`) `ProjectTaskList`, so there is one status/priority/assignee/
due-date mapping and one detail experience, not per-surface duplicates:

```
task-attention-badge.tsx     — TaskAttentionBadges (ordered by evaluation priority)
task-status-control.tsx      — shared status <select>, options = isValidStatusTransition
task-priority-control.tsx    — shared priority <select>
task-assignee-control.tsx    — shared assignee <select>, real members only
task-due-date-control.tsx    — shared date input, timezone-safe (local calendar date)
execution-task-row.tsx        — the Daily Execution row: title (opens detail) + quick actions
execution-summary.tsx         — real-count chips, doubles as attention filter
execution-filters.tsx         — project/assignee/status/priority/search/sort, URL-driven
task-detail-drawer.tsx        — full read/edit surface + activity feed
daily-execution-client.tsx    — orchestrates fetch, classification, sections, URL filters
```

`src/components/pmfreak/ui/drawer.tsx` is a new primitive (no drawer existed
before this sprint) — same a11y contract as the existing `Modal` (focus trap,
Escape-to-close, focus-return), rendered as a right-side panel on desktop that
widens to full-screen under the `sm` breakpoint, rather than a separate mobile
component.

Every read-only control (`TaskStatusControl`, `TaskAssigneeControl`,
`TaskDueDateControl`, `TaskPriorityControl`) branches explicitly on `canEdit` and
renders a plain read-only value — never a disabled-but-visible control with no
explanation. The Task Detail drawer additionally states *why* editing is
unavailable ("Only project managers and workspace administrators can edit this
task").

## Reactivity

Every mutation (row quick actions, drawer field edits, Quick Add Task) calls the
route directly, then updates local state and/or the SWR cache — no polling.
`TaskDetailDrawer` re-fetches its own detail (task + activity) after every
successful `PATCH` so the activity feed and field values are always the server's
truth, never optimistically fabricated. `DailyExecutionClient` merges a task
update into its SWR cache on `onTaskUpdated`, which re-triggers classification/
section placement/summary counts on the next render — a task moving from
`not_started` to `in_progress` moves sections and updates counts without a manual
refresh. Filters/search/sort/attention-chip state all live in the URL query
string (`router.replace`, `scroll: false`) so the view is shareable and survives
a refresh or back/forward navigation.

## Permissions matrix

| Action | Owner | Admin | PM | Viewer |
|---|---|---|---|---|
| View Daily Execution / Task Detail | ✓ | ✓ | ✓ | ✓ (read-only) |
| Change status / priority / due date | ✓ | ✓ | ✓ | ✗ |
| Reassign task | ✓ | ✓ | ✓ | ✗ |
| Edit title / description | ✓ | ✓ | ✓ | ✗ |
| Delete / archive task | — not implemented this sprint — | | | |

Gate is `requireProjectAccess(projectId, "write")`, matching this codebase's
existing `owner | admin | pm | viewer` role vocabulary (`src/lib/workspace-access.ts`)
— no new role was introduced. Server-side enforcement is authoritative: a direct
`PATCH` from a viewer session is rejected with 403 regardless of what the client
UI shows.

## Tenancy

- Daily listing workspace comes from `resolvePreferredWorkspace(userId)`, never a
  client param.
- A `projectId` filter is checked against that resolved workspace's own project
  list before being applied; an out-of-workspace id yields zero rows.
- Task Detail's `GET`/`PATCH` derive `project_id`/`workspace_id` from the loaded
  `execution_tasks` row, then re-check access via `requireProjectAccess` — a
  caller cannot widen scope by supplying a different id in the request body (the
  route ignores `body.projectId`/`body.workspaceId` entirely; there is no
  cross-project move in this sprint, see Known gaps).
- A new assignee is checked against `listWorkspaceMembersForAssignment(task.workspace_id)`
  — the task's own workspace — so a foreign-workspace user id can never be saved
  as an owner.

## Known gaps (explicitly deferred, not silently skipped)

- **`stale_in_progress` attention reason** — needs a product decision on the
  staleness threshold.
- **Archive/delete** — `execution_tasks` has no `archived`/`deleted_at` column;
  adding one without an approved deletion/audit policy would be a speculative
  schema change. `canDelete` is hard-coded `false`; no delete UI exists.
- **Cross-project task move** — `project_id` is read-only in Task Detail; moving
  a task between projects has no defined permission/reference-integrity story
  yet.
- **Milestone display** — `execution_tasks.milestone_id` exists but Task Detail
  does not resolve/show a milestone name (no join is wired for it yet); showing
  a raw id would violate the "no technical ids in the UI" rule, so it is omitted
  rather than shown badly.
- **Comments** — no comment/conversation infrastructure exists for tasks; not
  built this sprint per the brief's explicit permission to defer it.
- **Full cursor pagination** — the daily endpoint supports `limit`/`cursor`, but
  the workspace's realistic task volume at this stage is small; deeper
  cursor-based infinite scroll across thousands of tasks is deferred until that
  volume exists.
- **Telemetry events** (`daily_execution_viewed`, `task_status_changed`, …) — not
  added; no analytics SDK is wired into this codebase yet (confirmed during
  discovery), and the brief says not to add mock telemetry.
- **Manual UAT** — this sprint was implemented and tested in a sandboxed remote
  environment with no live Supabase project configured (`.env.local` absent).
  Automated coverage (unit + structural/guardrail tests, typecheck, lint, full
  test suite, build, governance, db-contract) all pass; the browser walkthroughs
  in the brief's §43 (UAT 1–5) have **not** been performed against a real
  database and are called out here rather than claimed.

## Tests

- `tests/execution-attention-classification.test.ts` (40 tests) — overdue/due-today/
  upcoming/blocked/unassigned/high-priority classification, timezone boundaries,
  severity rules, section placement, deterministic sort, summary counts, filter/
  summary agreement.
- `tests/execution-task-update-validation.test.ts` (22 tests) — partial-update
  whitelist, unknown-field rejection, status transition validation, field limits.
- `tests/daily-execution-workspace.test.ts` (29 tests) — tenancy (workspace/
  assignee/project resolved server-side), permission gating order, no-mass-
  assignment, audit-event coverage, no duplicated status/priority mapping, no
  fabricated data strings, read-only UI behavior, nav wiring.
- Full existing suite (12,571 tests before this sprint) still passes unchanged —
  `ProjectTaskList`'s guardrail tests in `tests/first-execution-experience.test.ts`
  were re-run and pass with the drawer wired in.
