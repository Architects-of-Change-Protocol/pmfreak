# Navigation, Onboarding, Backward Compatibility — Independent Review

## Sidebar

`SidebarPmoTree` (`src/components/pmfreak/navigation/sidebar-pmo-tree.tsx`)
fetches `/api/pmos` once and renders PMOs as top-level groups with nested
projects (collapsible), never a flat mixed list — confirmed by direct
reading. Backing API (`listPmosWithProjects`, `src/lib/pmos/pmo-service.ts`)
issues **exactly 2 SQL queries total** regardless of PMO/project count (one
`select * from pmos where workspace_id=...`, one
`select id,name,status,pmo_id from projects where workspace_id=...`,
grouped in-memory) — confirmed by reading the function body; not N+1.

At 1000 projects this returns a single ~80KB JSON payload with no
pagination/virtualization on either the API or the sidebar tree component.
**Not fixed in this review** (matches the sprint's own guidance: "No
implementes virtualización salvo que el problema sea crítico para el
merge... Puede documentarse como riesgo residual") — documented as a
residual risk in `final-report.md`, not a blocker at the realistically
expected scale (dozens of PMOs, low hundreds of projects per workspace for
this product).

## Project Overview

`src/app/(protected)/projects/[id]/page.tsx` renders Overview; Chat is a
separate route/tab. `ProjectTabNav`'s "Meetings"/"Risks & Issues" links
deliberately omit `?projectId=` and are labeled "(preview)" — a fix from
the prior validation sprint, re-confirmed present in the current file and
re-verified honest: `/meetings` and `/change-detection` genuinely ignore
any `projectId` query param (grep confirms neither page reads
`searchParams`/`projectId` at all), so the label accurately reflects that
these are workspace-wide preview modules, not per-project views yet. All
other tab-nav links (Execution, Timeline, Tasks, Documents, Evidence,
Reports) pass `?projectId=` to destination pages that **do** read it
(confirmed for each: `dashboard`, `follow-up-dashboard`, `upload`,
`evidence`, `executive` all destructure `projectId` from `searchParams`).

## Breadcrumbs

`src/app/(protected)/projects/[id]/page.tsx` renders
`PMOs / {pmo.icon} {pmo.name} / {project.name}` when the project has a
PMO; `pmo-tab-nav.tsx`/PMO pages render `PMOs / {pmo.name} / {section}`.
Both are dynamically rendered from live data, not static strings.

## Command Center (section 11.4)

`src/app/(protected)/command-center/page.tsx` resolves the active
**workspace** via `resolvePreferredWorkspace` (cookie-aware, membership-
validated) independent of any per-project state, and additionally renders
a cross-PMO "operations strip" (`listPmosWithProjects(workspace.workspaceId)`
— all PMOs, all projects) — confirmed the Command Center's own identity is
workspace-scoped, not tied to "the last project visited." Switching
projects and returning to Command Center does not change which workspace's
operations strip is shown (there is no project-derived workspace override
anywhere in this file — confirmed by reading it end to end).

## Backward compatibility — `?projectId=` route matrix

| Ruta histórica | Estado | Verificado |
|---|---|---|
| `/command-center?projectId=` | Soportada (unchanged) | reads `params.projectId` via `resolveActiveProject` |
| `/dashboard?projectId=` | Soportada (unchanged) | `searchParams: Promise<{projectId?}>` |
| `/follow-up-dashboard?projectId=` | Soportada (unchanged) | same |
| `/upload?projectId=` | Soportada (unchanged) | `searchParams.get("projectId")` |
| `/evidence?projectId=` | Soportada (unchanged) | `searchParams.get("projectId")` |
| `/executive?projectId=` | Soportada (unchanged) | `resolveActiveProject` |
| `/meetings?projectId=` | **Never wired** — page ignores the param entirely (pre-existing, not a regression) | tab nav updated to not imply scoping (prior sprint fix, re-confirmed) |
| `/change-detection?projectId=` | Same as above | same |
| `/workspace` | Redirect → `/command-center` (unchanged, legacy quarantine) | file content unchanged, not in this branch's diff |
| `/create-pmo` | Redirect → `/create-command-center` (unchanged) | file content unchanged, not in this branch's diff |
| `/copilot` | Redirect → `/command-center` (unchanged) | file content unchanged, not in this branch's diff |
| `/workspaces` (new, plural) vs `/workspace` (legacy, singular) | No routing collision | `route-policy-registry.ts` lists both as separate, explicit entries; `matchesRoute`'s prefix check (`pathname.startsWith(route + "/")`) cannot conflate `/workspace/` with `/workspaces/...` |

No route was found failing silently. No indiscriminate redirects were
added.

## Onboarding chain (section 12)

Traced end to end via direct file reading (no live server available in
this sandbox):
```
/workspace/setup (GettingStartedFlow)
  → router.push("/create-command-center")
/create-command-center (CreatePmoWizard) → savePmoTenant()
  → upserts workspace_governance (schema v2)
  → promotes the workspace row (name/command_center_type/owner_type)
  → materializes a `pmos` row (idempotent: skips if one already exists —
    confirmed by the `if (!existingPmo?.id)` guard)
  → router.push("/pmo/invite-team")
/pmo/invite-team → router.push("/command-center?from=onboarding&invited=N")
```
`createProjectAction`/`saveProjectOnboarding`/`activateContextAction`
(all three real project-creation entry points) each resolve a PMO via an
explicit `pmoId` if supplied, else `ensureDefaultPmo(workspaceId, userId)`
— confirmed no code path silently picks "the first PMO found" without this
explicit default-or-explicit logic; `ensureDefaultPmo` itself only creates
a new PMO when the workspace genuinely has zero PMOs yet (`listPmos`
returns empty), otherwise returns the existing oldest one — legitimate
"create or reuse the single obvious default" semantics for a workspace's
very first PMO, not a silent-first-of-many assumption.

## Verdict

**Pass.** No broken deep links, no silent misrouting, no hidden
single-PMO/single-project assumption found in the onboarding or navigation
code paths.
