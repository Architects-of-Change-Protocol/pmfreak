# Database Bootstrap Runbook — Perilla 13 (updated by Perilla 13B)

For a technician new to PMFreak who needs to stand up an isolated environment, apply migrations, and validate tenant isolation from scratch. Two paths are documented: hosted Supabase (preferred — closes RR-MIGRATE) and local Postgres (what this PR's evidence was actually gathered with — see the honesty statement in `fresh-database-migration-proof.md`).

**Perilla 13B added §10, "Full hosted closure checklist"** — the exact
sequence to run once hosted credentials are available, cross-referencing
every evidence document this repo now has a template for. Perilla 13B
itself did not have hosted credentials and did not run it — see
[`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md).

## 1. Create an isolated environment

**Hosted Supabase (preferred):**
1. Create a new, empty Supabase project dedicated to this test — never reuse pilot, staging, or any project with real data.
2. From the Supabase dashboard, note the project ref, database URL, anon key, and service role key. Generate a personal access token for `supabase login`/CLI use.
3. Set (in your shell, never committed):
   ```bash
   export SUPABASE_PROJECT_REF=<ref>
   export SUPABASE_ACCESS_TOKEN=<token>
   export SUPABASE_DB_URL=<connection string>
   export FRESH_DB_EXPECTED_PROJECT_REF=<ref>   # must exactly match SUPABASE_PROJECT_REF
   export ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true  # never defaults to true
   ```

**Local Postgres (what this PR used, when Docker/hosted access is unavailable):**
1. Requires a local PostgreSQL 16+ server (`pg_ctlcluster`/`service postgresql start` or equivalent) and the ability to create/drop databases.
2. `createdb pmfreak_fresh` (or `psql -c "create database pmfreak_fresh;"`).
3. Apply the environment stubs from `fresh-database-migration-proof.md` ("Environment" section) — these replace the `auth`/`storage` schemas and roles that a real Supabase project provisions automatically. **This step has no equivalent against a real Supabase project — skip it there.**
4. Set:
   ```bash
   export FRESH_DB_URL=postgresql://<user>:<password>@localhost:5432/pmfreak_fresh
   export ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true
   ```

**Official Supabase local stack (`supabase start`)**, if Docker is available in your environment, is the closer-to-real alternative to the local-Postgres path and needs no manual `auth`/`storage` stubbing — prefer it over hand-stubbed local Postgres when Docker is available.

## 2. Apply migrations

```bash
npm run check:fresh-db-migrations
```

This single command (`scripts/check-fresh-db-migrations.mjs`) validates the safety guard, checks migration inventory/ordering (duplicate timestamps, filename format), applies `supabase/roles.sql` before every fresh migration chain, and reports schema contract results. Local Postgres mode applies the bootstrap with `psql`; hosted mode uses `supabase db push --include-roles`. It refuses to run at all without `ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true`, and refuses hosted mode unless `FRESH_DB_EXPECTED_PROJECT_REF` exactly matches `SUPABASE_PROJECT_REF`. With no database variables set, it runs in `verify-only` mode (static checks only — safe to run anywhere, anytime, including CI on every PR).

## 3. Install extensions

Only one Postgres extension is required by any migration: `pgcrypto` (used for `gen_random_uuid()`). Every migration that needs it declares `create extension if not exists pgcrypto;` itself — no separate manual step is required on a real Supabase project (it ships enabled by default) or on the local path above (stubbed in step 1.3).

## 4. Seeds / bootstrap

PMFreak has no mandatory seed data — a fresh apply produces an empty, fully-functional schema. `scripts/seed-operational-flow-demo.mjs` exists for populating demo data for the operational-flow feature specifically; it is optional and not required for schema validation.

## 5. Validate schema

```bash
npm run check:db-contract       # runtime code vs. declared column contract
```

Ad hoc validation queries (used to produce `schema-integrity-report.md`):

```sql
select count(*) from pg_tables where schemaname = 'public';
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;  -- tables missing RLS
select count(*) from pg_constraint where contype = 'f';                     -- foreign keys
select count(*) from pg_indexes where schemaname = 'public';                -- indexes
```

## 6. Create a first test user and workspace

Against a real Supabase project, create a user via the Auth API/dashboard, then:

```sql
insert into public.workspaces (id, name, created_by_user_id) values (gen_random_uuid(), 'My Workspace', '<user-id>');
insert into public.workspace_memberships (workspace_id, user_id, role) values ('<workspace-id>', '<user-id>', 'owner');
```

Against local Postgres (no real auth), insert directly into the stubbed `auth.users` table first (see `fresh-database-migration-proof.md`).

## 7. Run tenant-isolation tests

```bash
psql -v ON_ERROR_STOP=0 -d <your-db> -f scripts/fresh-db-rls-smoke-test.sql
```

Expected output and interpretation: `docs/release/rls-tenant-isolation-report.md`. The script seeds two workspaces/users itself — run it against a scratch database, not one with real data.

## 8. Diagnose a failure

- **`relation "..." does not exist`** — a migration references an object created later (ordering defect) or never created at all (missing dependency). Check `migration-failure-remediation-log.md` for prior examples of both.
- **`policy "..." already exists`** — a `create policy` is missing its `drop policy if exists` guard, or two migrations declare the same object name for different purposes (see F09/F12/F15 for the object-name-collision pattern and how to detect it: `grep` for the object name across all migrations and diff the column lists).
- **`infinite recursion detected in policy for relation "..."`** — an RLS policy's `USING`/`WITH CHECK` clause queries its own table (directly or via a helper function that isn't `SECURITY DEFINER`). Fix by routing the self-referential check through a `SECURITY DEFINER` helper with a pinned `search_path` (see F26).
- **`operator does not exist: uuid = text`** (or vice versa) — a column was declared with the wrong type relative to what it's compared against in an RLS policy or join. Check the column's `\d table` output against the other side of the comparison.
- **Duplicate timestamp / non-lexicographic ordering** — caught automatically by `npm run check:fresh-db-migrations` in `verify-only` mode; fix by renumbering the later file(s) to a free timestamp, preserving relative order (see F14/F24 for the renumbering pattern, and grep first for any other file referencing the old filename by name before renaming).

## 9. Roll forward, don't roll back

If a migration partially applies against a database that already has real data, do not `DROP` or hand-edit objects out-of-band. Write a new, timestamped, idempotent corrective migration (`create ... if not exists`, `drop policy if exists` + `create policy`, `do $$ if not exists (...) then ... end if; end $$;` for constraints) that finishes or corrects the job, following the same pattern used throughout `migration-failure-remediation-log.md`.

## 10. Full hosted closure checklist (Perilla 13B)

The exact sequence to close RR-MIGRATE for real, once hosted credentials
exist (none were available to Perilla 13B — this section documents the
plan, not a completed run):

1. Create the isolated project and export the vars per §1 "Hosted Supabase"
   above.
2. `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` — confirm the
   linked ref.
3. `npx supabase migration list` — record local/remote counts (sanitized).
4. `npm run check:fresh-db-migrations` — applies `supabase/roles.sql` first via
   `supabase db push --include-roles`, then applies all versioned migrations, then
   the new (Perilla 13B) post-push repeatability check
   (`verifyHostedRepeatability` in `scripts/check-fresh-db-migrations.mjs`)
   parses `supabase migration list --linked` and fails on remote-pending,
   remote-unexpected, or count-mismatch rows.
5. Re-run step 4 — expect clean repeatability both times (C.4).
6. Create the 8 test users from
   [`hosted-rls-role-matrix.md`](./hosted-rls-role-matrix.md) via the real
   Auth API, run the full E.2/E.3 matrix with real JWT sessions (never a
   service-role client filtering results — E.4).
7. Execute the 8 RPCs in
   [`hosted-rpc-signature-report.md`](./hosted-rpc-signature-report.md)
   against real sessions; confirm the live signatures match the static
   inventory.
8. Query effective grants per
   [`hosted-grants-report.md`](./hosted-grants-report.md) §"To complete
   this report for real" and confirm they match the static review.
9. `supabase gen types typescript --linked` and diff per
   [`generated-types-drift-report.md`](./generated-types-drift-report.md)
   (no existing versioned types file to diff against yet — this run
   establishes the baseline).
10. Test existing-database compatibility per
    [`existing-database-compatibility-report.md`](./existing-database-compatibility-report.md)
    on a second seeded environment.
11. Update every document listed above plus
    [`residual-risk-register.md`](./residual-risk-register.md) with the
    real results before moving RR-MIGRATE to Closed — never mark it closed
    from a partial run.
