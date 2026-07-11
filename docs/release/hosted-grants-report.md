# Hosted Grants Report — Perilla 13B (RR-MIGRATE prep)

## Status: static review only — NOT executed against a hosted Supabase project

This report covers PR brief sections F.3 (SECURITY DEFINER review) and F.4
(grants) for the `anon` / `authenticated` / `service_role` roles. Everything
in this document was produced by reading `supabase/migrations/` source and
running the new `npm run check:security-definer-hardening` checker
(`scripts/check-security-definer-hardening.mjs`) against it — **no hosted
Supabase project was available this session** (see
[`residual-risk-register.md`](./residual-risk-register.md), RR-MIGRATE), so
none of this was confirmed against the *effective* grants on a real linked
project. **RR-MIGRATE is not closed by this document.**

## What a static review can and cannot prove

Can prove: every `security definer` function *declared in the migration
files* pins `search_path` and has an explicit `revoke ... from public`
statement somewhere in the migration corpus (i.e., the migrations, if
applied in order to an empty database, would not leave any SECURITY DEFINER
function reachable by `anon`/PUBLIC by accident).

Cannot prove: that a real hosted project's *effective* grants match this —
a manual `grant`/`revoke` run directly against the hosted database outside
of a migration would not be visible here. That requires the live grants
query in "To complete this report for real" below, against a project that
has actually had these migrations applied (section C of the PR brief — not
run this session).

## F.3 — SECURITY DEFINER review

New checker: `scripts/check-security-definer-hardening.mjs`
(`npm run check:security-definer-hardening`, now wired into
`npm run check:beta-release` as a blocking gate). It scans every migration
file for `security definer` function definitions and verifies each one (a)
pins `set search_path`, and (b) has a corresponding
`revoke all on function ... from public` somewhere in the corpus.

**Before this PR: 18 SECURITY DEFINER functions found. 9 problems: 1
missing `search_path`, 8 missing an explicit PUBLIC revoke (relying on
PostgreSQL's default PUBLIC execute grant).** After the two corrective
migrations below, the checker passes clean (0 problems, 18/18 functions
covered).

| Function | search_path (before) | PUBLIC revoke (before) | Fix |
| --- | --- | --- | --- |
| `purge_expired_nonces` | **Missing** | Missing | `20260824000000_fix_purge_expired_nonces_search_path.sql` — re-declared as `public.purge_expired_nonces()` with `set search_path = public`, added `revoke all ... from public`. Not called from any application code (grep confirms zero call sites in `src/`); likely intended for a future scheduled-cleanup job. |
| `reserve_upload_quota` | Present | Missing | `20260825000000_fix_security_definer_public_execute_grants.sql` — added `revoke ... from public`; existing `grant ... to authenticated, service_role` unchanged |
| `commit_upload_quota` | Present | Missing | same migration, same pattern |
| `cancel_upload_quota` | Present | Missing | same migration, same pattern |
| `is_organizational_memory_governor` | Present | Missing | same migration; added `grant execute ... to authenticated` (matches its RLS-policy `to authenticated` usage, which previously worked only via the un-revoked PUBLIC grant) |
| `is_organizational_pattern_governor` | Present | Missing | same pattern |
| `is_decision_effectiveness_governor` | Present | Missing | same pattern |
| `is_bridge_owner` | Present | Missing | same pattern |
| `prepare_decision_evidence_link` | Present | Missing — **not fixed, accepted** | `returns trigger`; Postgres refuses direct SQL calls to trigger functions regardless of EXECUTE grants ("trigger functions can only be called as triggers"), so the un-revoked PUBLIC grant is inert. Left as-is to keep the corrective migration minimal. |
| All other 9 functions (`operational_workspace_role`, `can_access_operational_project`, `can_write_operational_project`, `operational_authority_evaluation`, `materialize_operational_chain`, `record_operational_chain_failure`, `record_operational_decision`, `is_workspace_admin`, `abuse_rate_limit_increment`) | Present | Present | Already correct — no change |

Severity note: none of the 8 real (non-trigger) findings had a demonstrated
exploit. The quota functions already required a valid session for their
intended callers at the application layer; the four `is_*_governor`/
`is_bridge_owner` functions only return a boolean membership check. But an
un-revoked PUBLIC grant on a SECURITY DEFINER function means `anon` could
call it directly via `supabase.rpc()` on a real hosted project (PostgREST
exposes any function `anon`/`authenticated` has EXECUTE on) — this is
exactly the class of gap F.3 asks this review to find, and it is a genuine,
previously-undetected inconsistency with this codebase's own established
hardening contract (see `20260823000001_fix_workspace_memberships_rls_recursion.sql`'s
comment, which names that same contract for `is_workspace_admin`).

Not mechanically checkable by this static tool (reviewed by hand instead):

* **No dynamic SQL from user input** — read every SECURITY DEFINER
  function body in `supabase/migrations/`; none constructs a SQL string
  from a parameter (`execute format(...)` / string concatenation into
  `execute`). All are static `plpgsql`/`sql` bodies with parameterized
  `where`/`insert` clauses. Not exercised at runtime.
* **Authorization inside function** — spot-checked: `commit_upload_quota`
  and `cancel_upload_quota` re-validate `p_company_id` against the
  reservation row before acting;
  `can_write_operational_project`/`operational_authority_evaluation` chain
  through `operational_workspace_role`; the `is_*_governor` functions
  check `workspace_memberships` for the calling `auth.uid()`. Not proven
  against a live session this session.

## F.4 — Grants (anon / authenticated / service_role)

Not executed — capturing the *effective* grants on `anon`/`authenticated`/
`service_role` requires a real linked project (`\dp` / `information_schema.role_routine_grants`
against a live database). What was checked statically instead:

* Every `revoke ... from public` / `grant execute ... to <role>` pair in
  `supabase/migrations/` was enumerated by the checker above — 18/18
  SECURITY DEFINER functions now have an explicit, intentional grant
  target (`authenticated`, `service_role`, or both) rather than an
  implicit PUBLIC default.
* Table-level grants were not separately audited in this pass (RLS
  coverage for tables is tracked in
  [`rls-tenant-isolation-report.md`](./rls-tenant-isolation-report.md) and
  [`schema-integrity-report.md`](./schema-integrity-report.md) from
  Perilla 13's local-Postgres run — 408/409 tables RLS-enabled, 1
  documented service-role-only exception).
* `token_hash`-style column-level exposure was audited in Perilla 11 (see
  `workspace-invite-token-hashing.test.mjs`) — not re-verified against a
  hosted project this session.

**Not claimed**: "authenticated cannot select token_hash", "anon cannot
access tenant data", "PUBLIC cannot execute privileged RPCs" as *live*
facts — those are the RLS-policy-plus-grant *design*, consistent with
source, but unproven against a real database this session.

## To complete this report for real

1. Obtain a hosted Supabase project and run the fresh apply (section C of
   the PR brief — see
   [`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md)).
2. Run, against the linked project:
   ```sql
   select p.proname, p.prosecdef, p.proconfig,
          has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
          has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef;
   ```
3. Confirm the result matches the "after" column of the table above (only
   the intended roles show `true`).
4. Repeat for table-level grants
   (`information_schema.role_table_grants` filtered to `anon`) to confirm
   no tenant table is directly `SELECT`-able by `anon` outside RLS.
5. Update this document's status line to "live-verified" with the query
   output (redacted of any project-identifying detail) attached.
