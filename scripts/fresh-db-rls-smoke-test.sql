-- Two-workspace RLS / tenant-isolation smoke test for Perilla 13
-- (RR-MIGRATE). Run against a fresh-applied database, as a role able to
-- `set role authenticated` and `set request.jwt.claim.sub`/`.role` (a plain
-- superuser connection on local Postgres, or any role on a real Supabase
-- project). See docs/release/rls-tenant-isolation-report.md for expected
-- output and docs/release/database-bootstrap-runbook.md for how to run this.
--
--   psql -v ON_ERROR_STOP=0 -d <fresh-db> -f scripts/fresh-db-rls-smoke-test.sql
--
-- ON_ERROR_STOP is intentionally off: several statements below are EXPECTED
-- to error (that IS the pass condition for cross-tenant writes).
\set ON_ERROR_STOP off
\pset pager off

-- Seed: two users, two workspaces, two projects, memberships
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

insert into public.workspaces (id, name, created_by_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', '22222222-2222-2222-2222-222222222222');

insert into public.workspace_memberships (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.projects (id, workspace_id, name, user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B', '22222222-2222-2222-2222-222222222222');

-- ── As User A (authenticated) ──────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set request.jwt.claim.role = 'authenticated';

select 'TEST 1: User A can read Workspace A (expect 1 row)' as test;
select count(*) from public.workspaces where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select 'TEST 2: User A cannot read Workspace B (expect 0 rows)' as test;
select count(*) from public.workspaces where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select 'TEST 3: User A can read Project A (expect 1 row)' as test;
select count(*) from public.projects where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select 'TEST 4: User A cannot read Project B (expect 0 rows)' as test;
select count(*) from public.projects where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select 'TEST 5: User A cross-tenant INSERT into Project B workspace (expect ERROR / 0 rows affected)' as test;
insert into public.projects (id, workspace_id, name, user_id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hostile Insert', '11111111-1111-1111-1111-111111111111');

select 'TEST 6: User A cross-tenant UPDATE of Project B (expect 0 rows updated)' as test;
update public.projects set name = 'Hijacked' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select name from public.projects where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select 'TEST 7: User A cross-tenant DELETE of Project B (expect 0 rows deleted)' as test;
delete from public.projects where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select count(*) from public.projects where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- ── As User B (authenticated) ──────────────────────────────────────────────
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select 'TEST 8: User B cannot read Workspace A (expect 0 rows)' as test;
select count(*) from public.workspaces where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select 'TEST 9: User B cannot read Project A (expect 0 rows)' as test;
select count(*) from public.projects where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

reset role;

-- ── Service-role boundary: capability_verification_* must reject authenticated ──
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select 'TEST 10: authenticated cannot read capability_verification_snapshots (expect ERROR or 0 rows)' as test;
select count(*) from public.capability_verification_snapshots;

reset role;
