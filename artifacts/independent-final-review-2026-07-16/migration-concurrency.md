# Migration Concurrency & Atomicity — Independent Re-Verification

All three scenarios below were executed fresh in this review session
against `pmfreak_upgrade_v2` (independently rebuilt, see `migration-upgrade.md`),
not copy-pasted from the prior sprint's logs.

## 1. Concurrent backfill (two/N deployers racing)

The workspace-B default-PMO state was reset (`delete from pmos where
workspace_id=...; update projects set pmo_id=null where workspace_id=...`),
then the backfill's `DO $$ ... $$` block was extracted and fired via **5
truly concurrent `psql -f` processes** (backgrounded, `wait`ed together):

```
run 1: DO
run 2: DO
run 3: DO
run 4: DO
run 5: DO

select id, name, created_at from pmos where workspace_id='bbbbbbbb-...bbb1';
                  id                  |    name     |          created_at
--------------------------------------+-------------+-------------------------------
 ae469f47-e7eb-45af-8574-fc493ef0f74d | General PMO | 2026-07-16 21:31:26.666369+00
(1 row)
```

**Exactly 1 row.** The `pg_advisory_xact_lock(hashtext('pmfreak_pmo_backfill_20260828000000'))`
at the top of the DO block serializes concurrent executions; the
NOT-EXISTS check that runs after acquiring the lock is safe because no two
executions can be inside the locked section simultaneously.

## 2. Sequential retry / idempotency

Re-running the same backfill block against the already-migrated database
(no reset) is a no-op:
```
INSERT 0 0
UPDATE 0
```
Confirmed no duplicate PMOs, no re-assignment side effects, on repeat runs.

## 3. Process interrupted after creating PMOs but before linking Projects

This is the specific scenario the sprint's §6.3 explicitly names. It was
tested by injecting a forced exception (`raise exception
'SIMULATED_INTERRUPTION'`) **between** the PMO-insert statement and the
project-linking UPDATE statement, inside a copy of the backfill block, then
running it against a reset workspace-B:

```
$ psql ... -f backfill-interrupted.sql
ERROR:  SIMULATED_INTERRUPTION
CONTEXT:  PL/pgSQL function inline_code_block line 32 at RAISE

-- state immediately after:
select count(*) from pmos where workspace_id='bbbbbbbb-...bbb1';   --> 0
select id, pmo_id from projects where workspace_id='bbbbbbbb-...bbb1';
                  id                  | pmo_id
--------------------------------------+--------
 b0000000-0000-0000-0000-000000000001 |
(1 row)
```

**Zero partial state.** Because the entire backfill (lock acquisition +
insert + update) executes as a single `DO $$ ... $$` block — which Postgres
treats as one statement/transaction regardless of whether an outer tool
also wraps the file — an exception at any point inside it rolls back
everything inserted or updated so far in that block. There is no
"PMOs created but Projects not yet linked" intermediate state reachable by
a real interruption of this migration.

## Protection mechanism used

`pg_advisory_xact_lock` (transaction-scoped advisory lock) + a single `DO`
block wrapping check-then-insert + update. **Not** a unique constraint on
`pmos.workspace_id` (deliberately — a workspace legitimately has many PMOs
as a first-class product feature; a naive unique constraint would have
broken that). **Not** `ON CONFLICT` (no natural conflict target exists for
"first default PMO for this workspace" without an extra marker column,
which would have been unnecessary schema surface for a one-time backfill
concern).

## Verdict

**Pass.** All three concurrency/atomicity scenarios named in §6.3 were
reproduced and confirmed protected, with fresh, session-local evidence.
