# Command Center Foundation

Status: first-launch foundation implemented. This document describes the
governance data model and first-launch UX introduced to satisfy the Command
Center architecture principles:

- The user owns their identity.
- Each Command Center owns its intelligence.
- Every project belongs to a Command Center.
- PMO is one type of Command Center, not the universal container.

## Data model

A Command Center is **not** a new table. It is the existing `workspaces` table
(`supabase/migrations/20260512160000_workspace_authorization_rewrite.sql`),
extended with governance/typing metadata in
`supabase/migrations/20260702000000_command_center_governance_foundation.sql`:

| Column | Meaning |
| --- | --- |
| `command_center_type` | `company_pmo \| team_portfolio \| independent \| client_portfolio \| improvement_program`. `NULL` = not yet configured. |
| `owner_type` | `personal \| company \| team \| client \| program` |
| `data_owner` | `auth.users` FK — the user accountable for the Command Center's data |
| `visibility_scope` | `user \| command_center \| organization \| client \| public` (default `command_center`) |
| `confidentiality_level` | `public \| internal \| confidential \| restricted` (default `internal`) |
| `governance_policy_id` | reserved for a future governance policy engine |
| `source_context` | free-text strategic objective seeded at creation |

This keeps `workspace_id` as the single foreign key already used by every
project, agent, memory, and repository table in the schema (117+ migrations
depend on it) — `workspace_id` *is* `command_center_id` conceptually. No
rename was performed; introducing a second, parallel container or a
mechanical rename across the whole schema was assessed as high risk for a
first-launch task and rejected in favor of this additive migration.

A user can belong to many Command Centers via the existing
`workspace_memberships` table (already many-to-many). See
`src/lib/workspaces.ts`:

- `getUserCommandCenters(userId)` — Command Centers the user belongs to that
  have been configured (`command_center_type IS NOT NULL`).
- `getCommandCenterById(workspaceId)` — governance metadata for the active
  Command Center.

Type helpers and the five supported types live in
`src/lib/command-center/command-center-types.ts`.

## Bootstrap vs. configured

Every new user gets a workspace row auto-created on first login
(`ensureUserWorkspace` in `src/lib/workspaces.ts`) so the rest of the app has
somewhere to attach RLS-scoped data before the user has made any governance
decisions. That row has `command_center_type = NULL`.

**A workspace with `command_center_type IS NULL` is treated as "no Command
Center exists yet"** for first-launch UX and gating purposes
(`src/lib/auth/resolve-onboarding-state.ts` — `needs_pmo_setup`). Creating a
Command Center (`/create-command-center`, preferred; `/create-pmo`, legacy backward-compatible redirect; `src/lib/pmo/save-pmo-tenant.ts`) promotes this
same row in place: it sets `name`, `command_center_type`, `owner_type`,
`data_owner`, and `source_context` rather than creating an orphaned second
workspace. Additional Command Centers (future consultant/client-portfolio use
cases) are created as new workspace rows with their own membership.

## Scoping rules (already enforced by existing RLS)

Projects, `ai_agents`, `agent_memory_records`, `agent_context_policies`, and
`workspace_governance` are all scoped by `workspace_id` with RLS policies
keyed off `workspace_memberships`. This means:

- No project can exist without a Command Center (`projects.workspace_id` is
  `NOT NULL`, cascades on delete).
- Agents and memory only ever retrieve from the active Command Center — there
  is no cross-workspace query path in the RLS policies.
- User-level data lives only in Supabase auth `user_metadata`
  (`src/lib/auth.ts`), which is limited to portable preferences (name, role,
  onboarding flag) — no confidential Command Center data is stored there.

No changes were required to the RLS layer or to project/agent/memory schemas
to satisfy these rules — they already hold. This migration only adds the
typing/governance metadata to the container itself.

## First-launch UX

- `src/components/pmfreak/activation/getting-started-flow.tsx` (step 0) is the
  entry point for a user with no Command Center: title, subtitle, a primary
  **Create Command Center** action, and a disabled **Create Project** action
  with the required tooltip copy. No demo content or sample prompts are
  shown.
- `/create-command-center` (`src/app/(protected)/create-command-center/page.tsx`,
  `src/components/pmfreak/pmo/create-pmo-wizard.tsx`) is the preferred
  user-facing Command Center creation flow. `/create-pmo`
  (`src/app/(protected)/create-pmo/page.tsx`) remains a legacy,
  backward-compatible redirect to the preferred route. Step 1 asks for the
  Command Center type using the five official types from
  `COMMAND_CENTER_TYPES`. Product/UI language should say **Command Center**
  for the governance container while the technical persistence model remains
  `workspaces` and `workspace_id` remains the canonical database foreign key.
- `src/components/pmfreak/workspace/command-center-context-banner.tsx` renders
  the "You are working inside: [Name]" indicator plus the type label and the
  company-owned vs. independent contextual notice
  (`isCompanyOwnedContext(ownerType)`).
- `src/lib/command-center/agent-idle-copy.ts` is the single source of truth
  for the three agent idle-state strings (no Command Center / no project /
  active), wired into the dashboard and the per-project Command Center empty
  state (`src/features/command-center/command-center-empty-state.tsx`).

## Naming note

"Command Center" was previously also the name of the per-project operational
brief page (`/command-center`, `src/features/command-center/*`). Its route
was left unchanged to avoid touching the auth-continuity/route-policy
machinery that depends on that literal path
(`src/lib/auth/route-policy-registry.ts`,
`src/lib/auth/onboarding-route-map.ts`, `src/proxy.ts`), but its user-facing
label was renamed to **Project Brief** everywhere it appears in navigation
(`src/features/navigation/module-registry.ts`, the dashboard module grid) so
"Command Center" now refers exclusively to the governance container described
in this document. `/pmo-command-center` (the PMO aggregation dashboard) was
left as-is; it does not collide with the new terminology.

## Deliberately out of scope for this pass

- Full rename of `workspace(_id)` to `command_center(_id)` across the schema
  and 1000+ source files.
- Rebuilding the populated (non-empty-state) dashboard, `/projects`, and
  `/command-center` pages, several of which still render hardcoded
  illustrative agent metrics predating this work.
- Governed Intelligence Distillation / cross-Command-Center airlock — no
  cross-context retrieval exists today, and none was added.
- Public pricing tiers or Consultant/Agency/Enterprise marketing copy.
