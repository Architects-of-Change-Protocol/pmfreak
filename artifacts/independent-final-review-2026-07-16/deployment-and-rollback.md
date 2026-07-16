# Deployment Plan (Independent Review Addendum)

This supplements, and does not replace, the prior validation sprint's own
deployment plan (`artifacts/validation-sprint-2026-07-16/EXECUTIVE-REPORT.md`
§E), which remains accurate. Additions from this review:

## Pre-deploy checks
1. All items from the prior plan, plus:
2. **Sync local `main` before any future review of this branch** — this
   review found the local `main` ref 23 PRs stale, which would have
   materially misled a diff-based review. Always `git fetch origin main &&
   git branch -f main origin/main` (or equivalent) before computing
   `merge-base`/`diff --stat` against `main`.
3. Confirm the one overlapping file with main's advance
   (`src/app/(protected)/command-center/page.tsx`) merges cleanly at
   PR-merge time (non-conflicting per `git merge-tree`, re-confirm if main
   advances further before merge).

## Backup and recovery considerations
4. Standard pre-migration snapshot (unchanged from prior plan).
5. The two `BEFORE INSERT/UPDATE` triggers
   (`enforce_project_pmo_same_workspace`,
   `enforce_context_conversation_same_workspace`) are pure validation —
   they never mutate data, only reject invalid writes. No new failure mode
   for existing data; they only affect **future** writes after deployment.

## Migration execution
6. Unchanged from prior plan — single serialized apply via the normal
   Supabase migration pipeline.
7. Post-migration, run the exact integrity SQL in `migration-upgrade.md`
   against production data.

## Application deployment
8. Unchanged from prior plan.

## Post-deploy SQL verification
9. `select count(*) from projects where pmo_id is null;` → expect 0.
10. `select count(*) from projects p join pmos m on m.id=p.pmo_id where
    p.workspace_id <> m.workspace_id;` → expect 0 (this is now also
    enforced going forward by the trigger, but confirm zero pre-existing
    violations from the backfill itself).
11. `select tgname from pg_trigger where tgname like '%same_workspace%';`
    → expect both triggers present.

## Smoke tests
12. Create a new workspace → PMO → project chain end to end (traced in
    `navigation-compatibility.md`, not live-executed in this sandbox — no
    running app server with real auth was available).
13. Confirm an existing (pre-migration) user's `/command-center` and
    `/pmos` still resolve correctly.
14. Attempt (as a non-admin test account, in a staging environment) to
    delete a project — confirm 403, not 500 or success.

## Monitoring
15. Unchanged from prior plan (`workspace_scope_violation`/
    `project_scope_violation` event spikes).
16. **New**: watch for `"must reference a PMO/project in the same
    workspace"` trigger-exception text in application logs — this should
    never occur from legitimate application code paths (all of which
    validate before writing); any occurrence indicates either an attack
    attempt or a bug in a code path not covered by this review.

## Rollback criteria
Unchanged from prior plan.

## Rollback procedure
Unchanged from prior plan — the migration remains purely additive and safe
to leave applied even if the application is rolled back (no existing
column was renamed, retyped, or made newly `NOT NULL`; the two new
triggers only reject genuinely invalid new writes, which a prior
application version would never attempt since it doesn't write
`pmo_id`/`context_conversations` at all).
