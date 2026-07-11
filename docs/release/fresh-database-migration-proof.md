# Fresh Database Migration Proof — Perilla 13

## Honesty statement (read first)

This audit had **no credentials for a hosted Supabase project** (no `SUPABASE_ACCESS_TOKEN`, no `SUPABASE_PROJECT_REF`) and **no Docker daemon** available to run the official `supabase start` local stack (`docker ps` fails: `connect: no such file or directory`). Per the PR's honesty requirement, this means:

- The evidence below is a **real, live SQL execution** against an isolated local PostgreSQL 16 server — not a mock, not a static parser, not a dry run. It genuinely applies every migration file, in order, and genuinely executes RLS policies under simulated `anon`/`authenticated`/`service_role` roles with a real `auth.uid()`.
- It is **not** a hosted Supabase project and **not** the official Supabase CLI local stack. `auth.uid()`/`auth.jwt()`/`auth.role()` and the `storage.buckets`/`storage.objects` tables were hand-stubbed to the minimum shape migrations require (see "Environment" below), and `anon`/`authenticated`/`service_role` table grants were set to match Supabase's documented platform defaults, since a bare Postgres server does not provision these automatically. GoTrue (real auth), PostgREST (real REST semantics), and the Storage service are not present.
- **Decision: RR-MIGRATE remains OPEN.** This is the strongest evidence achievable without external access in this environment, and it found and fixed 26 real, previously-undetected defects (see `migration-failure-remediation-log.md`) — including one, F26, that was a genuine cross-database-state bug, not merely a fresh-install artifact. But it does not meet the bar this PR sets for closure (a real hosted Supabase project or the official local stack). What's needed to close it:
  1. An isolated hosted Supabase project (`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`), **or**
  2. Docker access in this environment so `supabase start` can run the official local stack.
  3. Then run `ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true FRESH_DB_EXPECTED_PROJECT_REF=<ref> npm run check:fresh-db-migrations` (hosted mode) or the equivalent local-stack invocation, and re-run the RLS/tenant-isolation smoke test in `rls-tenant-isolation-report.md` against that environment.

## Environment

| Field | Value |
| --- | --- |
| Environment type | Local PostgreSQL (not hosted Supabase, not official Supabase local stack) |
| PostgreSQL version | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) |
| Supabase CLI version | 2.109.1 (installed via `npx`, not used to apply migrations — no project to link) |
| Node version | v22.22.2 |
| npm version | 10.9.7 |
| Baseline commit SHA | `842230290f23c834955fd66470ba4a68cea1b676` (Perilla 12 merge, `origin/main`) |
| Date/time | 2026-07-11 (session clock) |
| Sanitized project identifier | n/a — local ephemeral database, dropped and recreated for each run, no project ref |

Manual environment stubs applied before each fresh apply (not part of any migration; documented so this run is fully reproducible):

```sql
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create extension if not exists pgcrypto;
grant usage on schema public, auth to anon, authenticated, service_role;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to service_role;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Supabase-platform-default grants (not present by default on bare Postgres):
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
```

## Migration Inventory (C.3)

| Metric | Value |
| --- | --- |
| Migration files discovered | 144 (142 pre-existing at Perilla 12 merge + 2 corrective migrations added by this PR) |
| Migrations applied | 144 |
| Migrations skipped | 0 |
| Migrations repaired | 26 files edited/renamed/reordered + 2 new corrective migrations (see `migration-failure-remediation-log.md`) |
| Migrations failed (final state) | 0 |

Discovered count = applied count. 0 unexplained skips. 0 failures in the final state, after remediation.

## Fresh Apply Procedure and Result

```bash
# 1. Drop and recreate an empty database + environment stubs (above)
# 2. Apply every migrations/*.sql file, in lexicographic order, stopping at the first error
for f in $(ls supabase/migrations | sort); do
  psql -v ON_ERROR_STOP=1 -d pmfreak_fresh -f "supabase/migrations/$f"
done
```

- **Start:** empty database, only the environment stubs above.
- **First run:** failed at migration #1 of 142 (`20260428120000_p0_state_tables.sql`, invalid `CREATE POLICY IF NOT EXISTS` syntax). See `migration-failure-remediation-log.md` for the full sequence of 26 failures found and fixed, one at a time, by re-running this exact loop after each fix.
- **Final run (this proof):**

```
ALL 144 MIGRATIONS APPLIED SUCCESSFULLY
```

Also verified via the new automation harness, in local mode against a second, independently-created database (`pmfreak_fresh_harness_test`):

```
$ FRESH_DB_URL=postgresql://postgres:***@localhost:5432/pmfreak_fresh_harness_test \
  ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true npm run check:fresh-db-migrations

PMFreak Fresh Database Migration Proof
Mode: local
Migration files discovered: 144

[apply:local] target: postgresql://[redacted]@loc...[redacted]
  Tables in public schema: 409
  Tables without RLS enabled: 1

Environment safety........ PASS
Migration inventory....... PASS
Migration ordering........ PASS
Fresh apply............... PASS
Schema contracts.......... PASS
Decision.................. PASS
```

No secrets appear in this document, in the harness's own output, or in `.fresh-db-migration-logs/`.

## Schema Validation Result

409 tables created in `public`. 408 have row-level security enabled; the 1 exception (`agent_attestation_nonces`) is documented-and-intentional (service-role-only access via `createPrivilegedSupabaseClient`, verified in source — see `rls-tenant-isolation-report.md` and `schema-integrity-report.md`). **PASS.**

## RLS / Tenant Isolation Result

Full two-workspace live smoke test: cross-tenant SELECT/INSERT/UPDATE/DELETE all correctly rejected under the `authenticated` role with a real `auth.uid()`; own-workspace access correctly allowed; service-role-only table correctly rejects `authenticated`. **PASS.** Full detail in `rls-tenant-isolation-report.md`.

## RPC / Function / Trigger Result

103 functions and 68 non-internal triggers created without error as part of the fresh apply. Full detail in `schema-integrity-report.md`.

## Existing-Database Compatibility Result

Not directly re-tested against a second, independently-seeded "existing" database in this session (no such environment was available). Reasoning for why the fixes are existing-DB-safe is documented per-fix in `migration-failure-remediation-log.md`'s "Existing DB Compatibility" column — in short: every fix to a *historical* migration file corrects a statement that provably could never have executed successfully anywhere (a syntax error, a missing relation, or a type mismatch means it never ran, on any database, fresh or existing), so no existing database can be running under the old, broken text. The two *new* corrective migrations (F25, F26) are pure `enable row level security` / `revoke` / `create or replace function` / `drop policy if exists` + `create policy` statements — safe, additive, and idempotent to run against any existing database. **Not independently verified this session; flagged as residual work below.**

## RR-MIGRATE Decision

```
Fresh DB Apply............ PASS (local PostgreSQL, not hosted Supabase / official local stack)
Migration Count........... PASS (144 discovered = 144 applied, 0 skipped, 0 failed)
Schema Integrity.......... PASS
RLS Coverage............... PASS (408/409; 1 documented exception)
Tenant Isolation........... PASS (live two-workspace smoke test)
RPC Contracts.............. PARTIAL (functions created; full call-site signature audit not run this session)
Existing DB Compatibility.. NOT INDEPENDENTLY VERIFIED (reasoned, not tested, this session)
RR-MIGRATE: OPEN
```

See `docs/release/residual-risk-register.md` for the exact credential/access needed to close it, and Section Q of this PR's task description for the honesty rule this decision follows.
