# Hosted Supabase Migration Proof — Perilla 13B

## Status: NOT EXECUTED

**No hosted Supabase project or credentials were available in this
session.** This document is the execution plan and evidence template for
closing RR-MIGRATE — it is not itself the closure evidence. Per the PR
brief's own honesty rule (section 4, "No fabricar evidencia"), RR-MIGRATE
**remains OPEN**. See
[`residual-risk-register.md`](./residual-risk-register.md) for the current
state and [`fresh-database-migration-proof.md`](./fresh-database-migration-proof.md)
for the strongest evidence gathered so far (local PostgreSQL 16, Perilla 13).

## What exists today, ready to run the moment credentials are available

| Prerequisite | Status |
| --- | --- |
| Hosted-mode code path in `scripts/check-fresh-db-migrations.mjs` | Ready — `link`, `db push`, and (new, Perilla 13B) post-push repeatability verification via `supabase migration list --linked` |
| Safety guard (project-ref match, destructive-confirmation, production-host rejection) | Ready — behavioral tests in `tests/fresh-db-migrations-safety-guard.test.mjs` (Perilla 13B) |
| Migration files | 146 (144 at Perilla 13 close + 2 Perilla 13B SECURITY DEFINER hardening fixes — see [`hosted-grants-report.md`](./hosted-grants-report.md)) |
| RPC inventory (static) | Done — [`hosted-rpc-signature-report.md`](./hosted-rpc-signature-report.md) |
| SECURITY DEFINER / grants review (static) | Done — [`hosted-grants-report.md`](./hosted-grants-report.md) |
| Runbook | [`database-bootstrap-runbook.md`](./database-bootstrap-runbook.md) §1 "Hosted Supabase (preferred)" |

## Execution plan (to run when credentials are available)

1. Create a new, empty, isolated Supabase project dedicated to this test
   (suggested name: `pmfreak-migration-validation`). Never reuse pilot,
   staging, or any project with real data.
2. Export (never commit) the required variables:
   ```bash
   export SUPABASE_PROJECT_REF=<ref>
   export FRESH_DB_EXPECTED_PROJECT_REF=<ref>   # must exactly match
   export SUPABASE_ACCESS_TOKEN=<token>
   export SUPABASE_DB_URL=<connection string>
   export SUPABASE_ANON_KEY=<anon key>
   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
   export ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true
   ```
3. Verify the project is empty of PMFreak objects (only the platform
   schemas `auth`/`storage`/`extensions`/`realtime` are expected).
4. `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` — confirm the
   linked ref matches `FRESH_DB_EXPECTED_PROJECT_REF`.
5. `npx supabase migration list` — record local/remote counts before apply
   (sanitized: counts only, no connection strings).
6. `npm run check:fresh-db-migrations` — applies all 146 migrations, then
   runs the new repeatability check (fails on remote-pending,
   remote-unexpected, or count mismatch).
7. Re-run step 6 a second time — expect "no pending migrations" both times
   (C.4 repeatability).
8. Run `psql -f scripts/fresh-db-rls-smoke-test.sql` against the linked
   project's connection string for the tenant-isolation smoke test, then
   the full E.2/E.3 role matrix (see
   [`hosted-rls-role-matrix.md`](./hosted-rls-role-matrix.md) for the
   template).
9. Execute the 8 RPCs in [`hosted-rpc-signature-report.md`](./hosted-rpc-signature-report.md)
   against real `authenticated`/`service_role` sessions.
10. Run `supabase gen types typescript --linked > /tmp/pmfreak-hosted-database.types.ts`
    and diff against the versioned types (see
    [`generated-types-drift-report.md`](./generated-types-drift-report.md)).
11. Update this document, `hosted-rls-role-matrix.md`,
    `generated-types-drift-report.md`,
    `existing-database-compatibility-report.md`, and
    `residual-risk-register.md` with the real results, and only then move
    RR-MIGRATE to Closed.

## Result table (to be filled in from a real run)

```
Hosted Supabase fresh apply........ NOT EXECUTED
Migration count..................... NOT EXECUTED
Supabase platform compatibility..... NOT EXECUTED
Auth schema compatibility........... NOT EXECUTED
Storage schema compatibility........ NOT EXECUTED
RLS coverage......................... NOT EXECUTED
Tenant isolation..................... NOT EXECUTED
Full role matrix...................... NOT EXECUTED
RPC signatures......................... Static inventory done (hosted-rpc-signature-report.md); live execution NOT DONE
SECURITY DEFINER review................ Static review done (hosted-grants-report.md); live grants NOT VERIFIED
Grants.................................. NOT EXECUTED
Generated types drift................... NOT EXECUTED
Existing DB compatibility............... NOT EXECUTED
RR-MIGRATE: OPEN
```
