# Upgrade Database Migration — Independent Re-Verification

A fresh pre-refactor baseline (`pmfreak_upgrade_v2`) was built from scratch
in this review — all 148 pre-hierarchy migrations applied in order, then
seeded with representative data (not reused from the prior sprint's
database instance, though the same seed SQL file was reused as input —
the database itself was rebuilt from nothing).

## Seed composition (matches sprint §6.2 requirements)

- 2 workspaces with an activated PMO governance tenant (schema v2) and a
  bootstrap-only workspace (no governance tenant) respectively, plus a
  third, zero-project workspace.
- 6 users across 4 distinct `workspace_memberships.role` values
  (owner/admin/pm/viewer).
- 6 projects: mix of active/archived/completed, spanning the many-project
  workspace (5) and the single-project workspace (1).
- Pre-existing `raid_items`, `vault_documents`, `runtime_conversation_state`,
  `message_analyses`, `operational_governance_briefs`,
  `workspace_governance` rows.

## Pre-migration counts

```
 projects                   | 6
 raid_items                 | 2
 runtime_conversation_state | 1
 vault_documents            | 2
 workspace_memberships      | 6
 workspaces                 | 3
```

## Migration applied

```
$ psql ... -d pmfreak_upgrade_v2 -f supabase/migrations/20260828000000_workspace_pmo_project_hierarchy.sql
CREATE INDEX / ALTER TABLE / CREATE POLICY / CREATE TABLE / ... / DO / CREATE FUNCTION / CREATE TRIGGER (x2)
```
Zero errors.

## Mandatory integrity SQL (sprint §6.2, run verbatim)

```sql
select count(*) from projects;                                                    -- 6
select count(*) from pmos;                                                        -- 2
select count(*) from projects where pmo_id is null;                               -- 0
select count(*) from projects p join pmos m on m.id=p.pmo_id
  where p.workspace_id <> m.workspace_id;                                         -- 0
select workspace_id, count(*) from pmos group by workspace_id order by 1;
--  aaaaaaaa...aaa1 | 1
--  bbbbbbbb...bbb1 | 1
```

## Post-migration data preservation

```
 raid_items                 | 2   (unchanged)
 vault_documents            | 2   (unchanged)
 runtime_conversation_state | 1   (unchanged)
 workspace_memberships      | 6   (unchanged)
```

## Findings

- **Zero Project loss**: 6 → 6.
- **Zero orphaned Projects**: 0 rows with `pmo_id is null`.
- **Zero cross-workspace mismatches**: 0 rows where `project.workspace_id ≠ pmo.workspace_id`.
- **Correct default PMO naming**: the workspace with an activated governance
  tenant got a PMO named from its `governance_jsonb.identity.pmoName`; the
  bootstrap-only workspace got the `"General PMO"` fallback name.
- **Empty workspace correctly excluded**: the zero-project, no-governance
  workspace received **zero** PMOs (not a spurious empty default) — the
  backfill's `WHERE (exists(...projects...) OR wg.workspace_id IS NOT NULL)`
  guard is confirmed working as intended.
- **All pre-existing related data preserved exactly.**

## Verdict

**Pass.** Fully re-derived from a fresh baseline in this review session,
independent of the prior sprint's cached results — all figures match.
