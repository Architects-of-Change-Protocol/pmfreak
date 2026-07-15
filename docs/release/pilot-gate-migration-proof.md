# Migration Proof — Pilot Gate Sprint 01 (RR-MIGRATE evidence)

Date: 2026-07-15 (session clock). Baseline: branch
`claude/pmfreak-pilot-gate-sprint-pu6esw` from `30862d1`.

## Honesty statement (read first)

This sprint attempted the two closure paths the risk register accepts:

1. **Hosted Supabase project** — NOT AVAILABLE: no `SUPABASE_PROJECT_REF` /
   `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_URL` exist in this environment.
2. **Official Supabase local stack via Docker** — Docker daemon runs in this
   environment (verified, `Server Version: 29.3.1`), but the environment's
   egress policy blocks the container registries' blob CDNs
   (`production.cloudfront.docker.com` → CONNECT 403 from the gateway;
   `public.ecr.aws` blob CDN likewise). `supabase start` cannot pull images.

Therefore **RR-MIGRATE remains OPEN**. What follows is the strongest
evidence achievable here — a genuine, installed PostgreSQL 16.13 server
(not hand-stubbed SQL semantics; the same stub set as Perilla 13 for
Supabase-platform roles/schemas) — plus one **new real defect found and
fixed** that specifically reproduces the hosted-grants scenario.

## Environment

| Field | Value |
| --- | --- |
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), local cluster `16/main` |
| Node / npm | v22.22.2 / 10.9.7 |
| Migration files | **148** (146 at sprint start + 2 added this sprint: `20260826000000_fix_agent_attestation_nonces_grants.sql`, `20260827000000_pilot_agreement_acceptances.sql` → final tree = **148**, all applied clean in run 4) |
| Stubs | `auth`/`storage` schemas + `anon`/`authenticated`/`service_role` roles per `fresh-database-migration-proof.md` §Environment |

## Runs executed (all reproducible)

```bash
# per run: create DB, apply stubs, then
FRESH_DB_URL=postgresql://postgres:***@localhost:5432/<db> \
  ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true npm run check:fresh-db-migrations
```

| Run | Database | Migrations | Result |
| --- | --- | --- | --- |
| 1 | `pmfreak_fresh` | 146/146 | Environment safety / inventory / ordering / fresh apply / schema contracts / decision — **all PASS** |
| 2 (repeatability) | `pmfreak_fresh2` (independent) | 146/146 | **all PASS** |
| 3 (with new fix, hosted-like grants) | `pmfreak_fresh_final` — `ALTER DEFAULT PRIVILEGES` set BEFORE migrations to mirror hosted Supabase grant behavior | **147/147** | **all PASS** |
| 4 (final tree) | `pmfreak_fresh_148` — hosted-like grants, includes `20260827000000_pilot_agreement_acceptances.sql` | **148/148** | **all PASS** |

Schema shape after apply: 409 public tables; 408 with RLS enabled; the 1
exception (`agent_attestation_nonces`) is service-role-only **by design and
now by grants too** (see defect below). 854 policies, 1050 FKs, 1632 indexes.

## RLS / tenant isolation (live)

`scripts/fresh-db-rls-smoke-test.sql` executed against the fresh-applied DB
(platform-default grants mirrored): **10/10 checks pass** — member reads own
workspace/project (1 row), cross-tenant reads return 0 rows, cross-tenant
INSERT rejected by RLS policy, cross-tenant UPDATE/DELETE affect 0 rows,
`capability_verification_snapshots` denied to `authenticated`.

`npm run check:db-contract` → **PASS** against the fresh-applied schema.

## New real defect found and fixed (this sprint)

`agent_attestation_nonces` has RLS intentionally disabled (service-role-only
replay-protection store). The prior report flagged "grants should still gate
it" as untested residual work. Live test under hosted-like default grants:
`authenticated` could SELECT/INSERT/DELETE the nonce store — enough to
delete a replay-protection record (token replay) or spam it.

Fix: `supabase/migrations/20260826000000_fix_agent_attestation_nonces_grants.sql`
(revoke all from `anon`/`authenticated`). Verified live: post-fix,
`authenticated` gets `permission denied for table agent_attestation_nonces`
(run 3, where default privileges granted at creation time and the corrective
migration ran in sequence).

## Seeds & rollback

- **Seeds**: none required — fresh apply yields an empty, functional schema
  (confirmed; `seed-operational-flow-demo.mjs` remains optional demo-only).
- **Rollback**: the repo's roll-forward policy (runbook §9) is preserved —
  both new migrations in this sprint are idempotent (`if not exists` /
  `drop policy if exists` / plain `revoke`) and were re-applied to an
  already-migrated DB without error.

## What still blocks closure (exact remaining work)

Runbook §10 end-to-end against a real hosted Supabase project (or an
environment whose egress allows `supabase start`): hosted fresh-apply +
repeatability, 8-user RLS role matrix with real JWTs, RPC signature
confirmation, grants query, generated-types baseline, existing-DB
compatibility. Estimated effort: ~half a day once credentials exist.
