# RLS Negative Tests — Independent Re-Execution

Re-run in this review session against `pmfreak_upgrade_v2` (independently
rebuilt at current HEAD — see `migration-upgrade.md`), using simulated JWT
claims (`set_config('request.jwt.claim.sub', ..., false)` — session-scoped,
**not** `true`/transaction-local, which was a methodological bug caught and
fixed during the *original* validation sprint and re-confirmed correct
here) against the `authenticated` Postgres role.

```
CONTROL PASS: auth.uid() resolves to viewer-a
CONTROL PASS: viewer-a CAN see own workspace-A pmos (1 rows)
PASS test_1: viewer-a cannot see workspace-B/C pmos
PASS test_2: viewer-a cannot see workspace-B projects
PASS test_3: viewer-a INSERT into pmos blocked by RLS (new row violates row-level security policy for table "pmos")
CONTROL PASS: auth.uid() resolves to pm-a
PASS test_4: pm-a (role=pm) INSERT succeeded as expected
PASS test_5: cross-workspace PMO insert blocked by RLS (new row violates row-level security policy for table "pmos")
CONTROL PASS: auth.uid() resolves to owner-b
PASS test_6: raw SQL UPDATE did not change pmo_id cross-workspace
CONTROL PASS: auth.uid() resolves to viewer-a (2nd check)
PASS test_7: viewer-a cannot read workspace-B context_messages
PASS test_8: owner-b (the real owner) CAN read their own workspace-B context_messages
```

Every negative test (1/2/3/5/7) has a positive control in the same run
(`CONTROL PASS: ... CAN see own ...`, test_4, test_8) proving the identity
simulation actually resolves (`auth.uid()` is not silently NULL, which would
make every negative test trivially — and misleadingly — pass).

## Additional independent tests (new in this review, section 8.2/8.3/13)

```sql
select policyname, cmd, qual from pg_policies where tablename='projects' and cmd='DELETE';
--  workspace members can delete projects | DELETE | EXISTS(... workspace_memberships wm WHERE wm.workspace_id=projects.workspace_id AND wm.user_id=auth.uid())
```
**No role predicate at all** — confirms any workspace member's DELETE
passes RLS regardless of role. This is exactly why the app-layer
`admin`-minimum check on `DELETE /api/projects/[id]` (added in the prior
validation sprint) is load-bearing, not redundant defense-in-depth.

```sql
-- archived-PMO raw-SQL assignment (not an access-boundary question —
-- confirms current behavior, motivated the app-layer fix in defects.md D2)
NOTICE: assigning a project to an archived PMO via raw SQL: ALLOWED
```
RLS/triggers correctly treat `status='archived'` as a soft, non-access
boundary (by design — archived PMOs keep their existing projects working).
The **app layer**, however, needed an explicit reject for *new* assignments
to an archived target, since the UI's own dropdown already excludes
archived PMOs and a crafted request could otherwise bypass that — fixed
in this review, see `defects.md` D2.

```sql
-- nonexistent pmo_id (well-formed UUID, no matching row)
update projects set pmo_id = '99999999-9999-9999-9999-999999999999'::uuid where id = '...';
-- ERROR: projects.pmo_id must reference a PMO in the same workspace (project workspace ..., pmo 99999999-...)
```
The trigger correctly rejects a syntactically valid but non-existent
`pmo_id` too (not just a real cross-workspace one) — `(select workspace_id
from pmos where id = new.pmo_id)` returns `NULL`, and `NULL IS DISTINCT
FROM <real workspace_id>` is `TRUE`.

```sql
-- project row integrity after the failed attempt
select id, pmo_id from projects where id = '...';
--  unchanged (still points at its original, valid pmo_id)
```
No partial corruption from the rejected write.

## Cross-workspace pmo_id trigger — known-id variant (defeats RLS-blindness)

The `test_6` scenario above uses a **live subquery** to fetch the target
PMO id, which RLS blinds to zero rows for a non-member — meaning `test_6`'s
"PASS" alone doesn't prove the trigger rejects a write when the id is
**known** by some other means (e.g. leaked, guessed, or obtained while the
attacker was still a member of that workspace). Re-tested with a
**hardcoded** id:

```
NOTICE: PASS test_6b: DB TRIGGER rejected cross-workspace pmo_id assignment
  via known/hardcoded id (projects.pmo_id must reference a PMO in the same
  workspace (project workspace bbbbbbbb-..., pmo b80e5ecc-...))
```

## Thread identity (section 9.5)

```sql
insert into context_conversations (workspace_id, context_type) values (A, 'workspace');
insert into context_conversations (workspace_id, context_type, pmo_id) values (A, 'pmo', PMO1);
insert into context_conversations (workspace_id, context_type, project_id) values (A, 'project', Alpha);
insert into context_conversations (workspace_id, context_type, project_id) values (A, 'project', Beta);
insert into context_conversations (workspace_id, context_type) values (B, 'workspace');
```
→ 5 distinct `id` values (confirmed — no accidental row reuse across scopes).

```sql
insert into context_conversations (workspace_id, context_type) values (A, 'workspace');  -- second one
-- ERROR: duplicate key value violates unique constraint "context_conversations_scope_unique_idx"
```
Confirms exactly one canonical thread per scope — a second attempt at the
same scope is rejected, not silently duplicated or silently overwriting.

`git grep` for dangerous global-fallback patterns
(`mostRecentConversation`, `latestConversation`) returned **zero matches**
anywhere in `src/`. The two `order by created_at` occurrences in the chat
files are (1) ordering the *project list within an already-resolved scope*
for display, and (2) ordering *messages within an already-identified
conversation_id* chronologically — neither selects "which conversation" by
recency; both are read-context-safe.

## Verdict

**Pass.** All negative tests, all positive controls, both trigger variants,
and thread-identity uniqueness independently reproduced.
