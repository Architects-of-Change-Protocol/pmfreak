# Data Recovery & Migration Readiness — Perilla 11 (Beta Release Closure Gate)

Reviewed: 2026-07-10 against `main` @ post-Perilla-10 plus this perilla's
three migrations.

## G.1 Migration inventory & validation

* **142 SQL migrations** under `supabase/migrations/`, timestamp-prefixed
  (`YYYYMMDDHHMMSS_description.sql`), applied in lexicographic order.
* **Fixed in this perilla:** `create_dashboard_task_lifecycle.sql` had **no
  timestamp prefix**, so migration tooling either skipped it or applied it
  after every other migration nondeterministically. Renamed to
  `20260822000000_dashboard_task_lifecycle.sql` and its `create policy`
  statements made idempotent (`drop policy if exists` first), so it is safe
  whether or not a given environment already applied it manually.
* **Known, documented, non-blocking:** three timestamp collisions exist among
  older migrations (`20260616000000` ×2, `20260623000000` ×3,
  `20260702000000` ×2). Within each collision the files touch disjoint
  objects and are written defensively (`create table if not exists`, etc.),
  so relative order does not change the outcome; tie-break is by filename.
  Do **not** rename them — they are already recorded under these names in
  deployed environments' migration tables. New migrations must use unique
  timestamps (this perilla's use 20260820/21/22).
* **Destructive-DDL sweep:** no `DROP TABLE`, no `TRUNCATE`, and — before
  this perilla — no `DROP COLUMN` anywhere. The single `DROP COLUMN` now in
  the tree is the **deliberate** removal of the plaintext
  `workspace_invitations.token` bearer credential
  (`20260820000000_workspace_invite_token_hashing.sql`), with legacy pending
  invites revoked first; that data loss is the security objective, and the
  migration is idempotent. `DELETE FROM` appears only inside cleanup
  functions bounded to expired nonces / quota reservations.
* **RLS after migration:** `enable row level security` appears 403× across
  119 migrations; every table-creating migration enables RLS at creation.
  Two tenancy models coexist by design (legacy `current_company_id()` claims
  vs workspace-membership joins) — inventory in
  `docs/security/rls-gap-inventory-phase-4.3.md`.
* **Runtime/schema drift:** `npm run check:db-contract` (static: every column
  selected in `src/**` must be declared in
  `src/lib/db/database-contract.ts`) — **passed**.
* **Live-database validation:** the repo has a full destructive RLS/flow
  harness (`npm run check:operational-flow-db`) that requires an isolated
  Supabase project (`OPERATIONAL_FLOW_TEST_*` env). It could not run inside
  this gate's environment (no live database) and is a **pilot precondition**:
  run it against a fresh staging project — which also proves "all 142
  migrations apply in order on a clean database" — before first pilot
  deploy. Tracked as RR-MIGRATE in the residual risk register.

## G.2 Rollback strategy

* Migrations are forward-only by convention; corrective migrations are the
  rollback mechanism (`forward-fix`). The three Perilla-11 migrations are
  idempotent and re-runnable.
* Rollback for the invite-token migration specifically: **not applicable
  backwards** (the plaintext column is gone by design). Recovery path if the
  hashed flow misbehaves: re-issue invitations (creation is cheap and
  self-service for owners/admins) — no data restore required.
* Application rollback: redeploy the previous Vercel build (see
  `docs/release/release-runbook.md` for the package-level equivalent). DB
  schema is backward-compatible for one release in both directions for these
  migrations (new columns are nullable; dropped column was unread by any
  surviving code path).

## G.3 Backup readiness

| Item | State |
| ---- | ----- |
| Backup provider | Supabase managed backups (daily) on the hosted project; PITR available on Pro tier and above — **must be confirmed enabled on the pilot project** |
| Backup frequency | Daily (Supabase default); PITR granularity if enabled |
| Retention | Per Supabase plan (7 days default Pro) — confirm on the pilot project |
| Restore procedure | Supabase dashboard → Database → Backups → restore to new project; then repoint `NEXT_PUBLIC_SUPABASE_URL`/keys via Vercel env and redeploy. Runbook section 8 has the step-by-step. |
| Responsible owner | Pilot operator (repo owner) — no dedicated ops role exists yet |
| Last restore test | **Never performed.** A restore rehearsal on a scratch project is a pilot precondition (RR-BACKUP in the risk register). |

## G.4 Data export

* **No full workspace export exists.** What exists: computed-artifact JSON
  exports (constitutional workspace/brief/dashboard, portfolio/operational/
  governance/executive briefs) and governance-artifact export routes under
  `src/app/api/agents/**` — none is a raw tenant data dump.
* Identified data sets a complete export would need: projects, tasks,
  milestones, risks, decisions, evidence (+ storage objects), members,
  audit events (3 tables), operational memory.
* Classified as **residual risk RR-EXPORT** (medium): acceptable for a
  closed, supervised pilot whose participants are covered by direct
  operator support (a manual, service-role SQL export per table is possible
  on request); not acceptable for GA.

## G.5 Deletion & retention (actual current behavior)

* **No application-level workspace deletion exists** (no
  `DELETE /api/workspaces/*` route). Deletion is a service-role/DB operation
  only.
* If a `workspaces` row is deleted, `on delete cascade` fans out to the
  dependent graph (69 FK references) — memberships, projects, invitations,
  audit events, memory, etc. are removed irreversibly.
* Retained regardless of workspace deletion: `billing_webhook_events`
  (keyed by Stripe event, needed for idempotency/audit), `security_events`
  rows without workspace FK, `early_access_*` (email-keyed),
  `abuse_rate_limits` (hashed identifiers), `ai_usage_events` rows keep
  `workspace_id` as a plain UUID column (no FK) for cost history.
* Uploaded files live in Supabase storage buckets (`20260515200000`); bucket
  objects are **not** cascade-deleted with the workspace row — manual
  cleanup required. Documented here as actual behavior; a retention policy
  is future scope.
* Backups retain deleted data until backup expiry (Supabase retention
  window) — communicate this to pilot participants on any deletion request.
