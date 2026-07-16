-- RLS negative tests — run as the `authenticated` role with JWT sub claim
-- simulated per-user. set_config(..., false) = SESSION-scoped (persists
-- across the autocommitting statements in this psql -f run); the earlier
-- (..., true) session-local variant would have expired after one statement
-- and silently made every subsequent check meaningless (auth.uid() NULL
-- hides everything, not just other workspaces) — this version adds a
-- positive control per identity to prove auth.uid() is actually resolving.

\pset format unaligned
\pset tuples_only off

reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Identity: viewer-a (workspace A, role=viewer)
-- ═══════════════════════════════════════════════════════════════════════════
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111104', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

select case when auth.uid()::text = '11111111-1111-1111-1111-111111111104' then 'CONTROL PASS: auth.uid() resolves to viewer-a' else 'CONTROL FAIL: auth.uid() = ' || coalesce(auth.uid()::text,'NULL') end as control_0;

select case when count(*) > 0 then 'CONTROL PASS: viewer-a CAN see own workspace-A pmos (' || count(*) || ' rows)' else 'CONTROL FAIL: viewer-a sees zero own-workspace pmos — RLS or auth broken' end as control_1
from pmos where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

select case when count(*) = 0 then 'PASS test_1: viewer-a cannot see workspace-B/C pmos' else 'FAIL test_1: leaked ' || count(*) || ' rows' end as test_1
from pmos where workspace_id in ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1');

select case when count(*) = 0 then 'PASS test_2: viewer-a cannot see workspace-B projects' else 'FAIL test_2: leaked ' || count(*) || ' rows' end as test_2
from projects where workspace_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

do $$
begin
  insert into pmos (workspace_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Viewer Rogue PMO');
  raise notice 'FAIL test_3: viewer-a INSERT into own-workspace pmos was NOT blocked';
exception when insufficient_privilege or others then
  raise notice 'PASS test_3: viewer-a INSERT blocked by RLS (%)', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Identity: pm-a (workspace A, role=pm)
-- ═══════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111103', false);
select case when auth.uid()::text = '11111111-1111-1111-1111-111111111103' then 'CONTROL PASS: auth.uid() resolves to pm-a' else 'CONTROL FAIL: auth.uid() = ' || coalesce(auth.uid()::text,'NULL') end as control_2;

do $$
begin
  insert into pmos (workspace_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'PM Legit PMO');
  raise notice 'PASS test_4: pm-a (role=pm) INSERT succeeded as expected';
exception when others then
  raise notice 'FAIL test_4: pm-a INSERT unexpectedly blocked (%)', sqlerrm;
end $$;

do $$
begin
  insert into pmos (workspace_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Cross Workspace Attempt');
  raise notice 'FAIL test_5: pm-a inserted into a workspace they do not belong to';
exception when insufficient_privilege or others then
  raise notice 'PASS test_5: cross-workspace PMO insert blocked by RLS (%)', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Identity: owner-b (workspace B, role=owner) — raw-SQL cross-workspace project move
-- ═══════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111105', false);
select case when auth.uid()::text = '11111111-1111-1111-1111-111111111105' then 'CONTROL PASS: auth.uid() resolves to owner-b' else 'CONTROL FAIL: auth.uid() = ' || coalesce(auth.uid()::text,'NULL') end as control_3;

do $$
declare
  ws_a_pmo_id uuid;
  after_pmo_id uuid;
begin
  select id into ws_a_pmo_id from pmos where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' limit 1;
  update projects set pmo_id = ws_a_pmo_id where id = 'b0000000-0000-0000-0000-000000000001';
  select pmo_id into after_pmo_id from projects where id = 'b0000000-0000-0000-0000-000000000001';
  if after_pmo_id = ws_a_pmo_id then
    raise notice 'FINDING test_6: raw SQL UPDATE let owner-b set pmo_id=% (workspace-A PMO) on their own workspace-B project — RLS on projects only checks the PROJECT''s workspace membership, not the target PMO''s workspace. This is NOT reachable through the app API (project-admin-service.ts validates pmo.workspace_id === project.workspace_id server-side before this UPDATE is ever issued) but is a raw-SQL/direct-Supabase-client gap.', ws_a_pmo_id;
  else
    raise notice 'PASS test_6: raw SQL UPDATE did not change pmo_id cross-workspace';
  end if;
end $$;

reset role;
update projects set pmo_id = (select id from pmos where workspace_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' order by created_at limit 1) where id = 'b0000000-0000-0000-0000-000000000001';

-- ═══════════════════════════════════════════════════════════════════════════
-- context_conversations / context_messages RLS
-- ═══════════════════════════════════════════════════════════════════════════
insert into context_conversations (id, workspace_id, context_type, title) values
  ('c1111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'workspace', 'WS-B workspace chat')
on conflict (id) do nothing;
insert into context_messages (conversation_id, workspace_id, role, content) values
  ('c1111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'user', 'SECRET-WSB-9182')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111104', false);
select case when auth.uid()::text = '11111111-1111-1111-1111-111111111104' then 'CONTROL PASS: auth.uid() resolves to viewer-a (2nd check)' else 'CONTROL FAIL' end as control_4;

select case when count(*) = 0 then 'PASS test_7: viewer-a cannot read workspace-B context_messages' else 'FAIL test_7: leaked ' || count(*) || ' rows' end as test_7
from context_messages where content like '%SECRET-WSB%';

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111105', false);
set role authenticated;
select case when count(*) = 1 then 'PASS test_8: owner-b (the real owner) CAN read their own workspace-B context_messages' else 'FAIL/CONTROL test_8: owner-b sees ' || count(*) || ' rows (expected 1)' end as test_8
from context_messages where content like '%SECRET-WSB%';

reset role;
