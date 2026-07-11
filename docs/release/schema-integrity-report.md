# Schema Integrity Report — Perilla 13

Generated from a live fresh-apply database (see `fresh-database-migration-proof.md` for environment caveats — local PostgreSQL, not hosted Supabase). All figures below are queried directly from `pg_catalog`/`information_schema` after all 144 migrations applied successfully.

## D.1 Structural Snapshot

| Object type | Count |
| --- | --- |
| Tables (`public` schema) | 409 |
| Tables with RLS enabled | 408 |
| Foreign key constraints | 1,050 |
| Indexes (`public` schema) | 1,632 |
| Tables with at least one `workspace_id`-covering index | 353 |
| Functions (`public` schema) | 103 |
| Non-internal triggers | 68 |
| Extensions installed | `pgcrypto` (the only extension any migration requires — see B.4 below) |

No database URL, project ref, credentials, or data rows appear in this report — figures only.

## D.2 Runtime Contract Cross-Check

`npm run check:db-contract` (`scripts/check-db-schema-contract.mjs`) statically cross-checks every column the runtime (`src/**`) selects/inserts/updates against `src/lib/db/database-contract.ts`'s declared column allowlist, and fails the build if a runtime file references a column not declared there. This passed both before and after all migration edits in this PR:

```
$ npm run check:db-contract
DB schema contract check passed.
```

This is complementary to, not a substitute for, the live fresh-apply: it catches "runtime code expects a column the contract doesn't declare," while the fresh apply catches "the migration that's supposed to create that column never actually runs." Both passed.

## D.3 Generated Supabase Types

Not run this session — `supabase gen types typescript --linked` requires a linked hosted project, which was not available (see honesty statement in `fresh-database-migration-proof.md`). No `database.types.ts` diff was produced or compared. This is tracked as residual work alongside RR-MIGRATE closure.

## D.4 / D.5 Foreign Keys and Constraints

1,050 foreign key constraints were created successfully across the fresh apply, including every composite `(id, workspace_id)`-style tenant-isolation FK described in the migration history (16 of which were missing their required unique-index target and are now fixed — see `migration-failure-remediation-log.md` F11). No orphan-capable FK was introduced or altered by this PR; all corrections either fixed a previously-impossible-to-create constraint or removed one that referenced a nonexistent/wrong-type column (which could never have existed on any database).

## D.6 Critical Indexes

353 of 409 tables have at least one index covering `workspace_id` (the remainder are global/reference tables, join tables indexed by their own composite key, or the one service-role-only table). No speculative indexes were added; every index added by this PR's fixes (F11, F18) was required either to satisfy a composite foreign key that could not otherwise be created, or to restore an index that a filename/object-name collision was silently discarding (F18).

## E.1 RLS Coverage

| Table | Category | RLS Enabled |
| --- | --- | --- |
| `agent_attestation_nonces` | service-role-only | **No** (documented, intentional — see `rls-tenant-isolation-report.md` §E.5) |
| all other 408 tables | tenant-scoped / global / service-role-only (mixed) | Yes |

Per-table SELECT/INSERT/UPDATE/DELETE policy presence was not exhaustively tabulated for all 408 tables in this session (409 tables is beyond what a single PR session can hand-audit row-by-row); the live two-workspace smoke test in `rls-tenant-isolation-report.md` instead directly exercises the shared tenant-isolation primitives (`is_workspace_member`, `is_workspace_admin`, direct `workspace_id`-scoped policies) that the large majority of these tables' policies are built on, and found (and fixed) the one defect that would have affected all of them: the `workspace_memberships` RLS recursion bug (F26).
