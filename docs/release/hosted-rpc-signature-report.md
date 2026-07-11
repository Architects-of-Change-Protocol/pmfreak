# Hosted RPC Signature Report — Perilla 13B (RR-MIGRATE prep)

## Status: static inventory only — NOT executed against a hosted Supabase project

This report was produced by grepping the repository for `.rpc(` call sites
and comparing each one against the `create or replace function` statement
that defines it in `supabase/migrations/`. That comparison is genuinely
useful (it catches argument-name/count drift between application code and
the migration files that are supposed to define the database side of the
contract), but it is **source-vs-source**, not source-vs-live-database. It
does **not** confirm:

- that a hosted Supabase project actually has these functions installed
  with these exact signatures (that requires the hosted fresh-apply in
  section C of the PR brief, which has not run — see
  [`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md)),
- that PostgREST's introspected RPC schema matches what the client library
  expects at call time,
- that the functions execute successfully end-to-end under a real
  `authenticated`/`service_role` session (F.2 of the PR brief — not run).

No credentials for a hosted Supabase project were available in this session
(see [`residual-risk-register.md`](./residual-risk-register.md), RR-MIGRATE).
**RR-MIGRATE is not closed by this document.**

## Inventory method

```bash
grep -rn '\.rpc(' src --include='*.ts' --include='*.tsx'
```

Found 4 files, 9 call sites, 8 distinct RPC functions. For each, the
migration file defining it (via `grep -rln 'create.*function.*<name>' supabase/migrations`)
was located and its parameter list compared against the call site's argument
object.

## Call site inventory

| Runtime Call Site | Function | Call-Site Arguments | Expected Return (TS cast) | Migration-Defined Signature | Static Match |
| --- | --- | --- | --- | --- | --- |
| `src/app/api/operational-flow/assurance/route.ts:16` | `get_operational_assurance_summary` | `p_workspace_id`, `p_project_id` | `unknown` (passed through as JSON response body) | `(p_workspace_id uuid, p_project_id uuid) returns jsonb` — `security invoker`, `set search_path = public` | Match |
| `src/lib/operational-flow/operational-flow-service.ts:91` | `get_operational_assurance_summary` | `p_workspace_id`, `p_project_id` (same call, second call site) | `unknown`, merged into `OperationalSummary` | same as above | Match |
| `src/lib/quota/upload-quota.ts:90` | `reserve_upload_quota` | `p_company_id`, `p_upload_amount`, `p_upload_limit`, `p_month_key`, `p_request_id` | `RpcReserveResult` (`{ allowed, reservation_id, previous_usage, new_usage, limit, reset_period }`) | `(p_company_id text, p_upload_amount integer, p_upload_limit integer, p_month_key text, p_request_id text) returns jsonb` | Match |
| `src/lib/quota/upload-quota.ts:161` | `commit_upload_quota` | `p_reservation_id`, `p_company_id` | `RpcCommitResult` (`{ committed, reason, new_usage }`) | `(p_reservation_id uuid, p_company_id text) returns jsonb` — `security definer`, `set search_path = public` | Match |
| `src/lib/quota/upload-quota.ts:215` | `cancel_upload_quota` | `p_reservation_id`, `p_company_id` | not asserted (best-effort cancel path, logs only) | `(p_reservation_id uuid, p_company_id text) returns jsonb` — `security definer`, `set search_path = public` | Match |
| `src/lib/operational-flow/operational-flow-service.ts:52` | `materialize_operational_chain` | `p_evidence_item_id` | `{ evidenceItemId, detector, chain, agentRunId }` | `(p_evidence_item_id uuid) returns jsonb` — `security definer`, `set search_path = public` | Match |
| `src/lib/operational-flow/operational-flow-service.ts:54` | `record_operational_chain_failure` | `p_evidence_item_id`, `p_error_message` | not asserted (error path, fire-and-throw) | `(p_evidence_item_id uuid, p_error_message text) returns void` — `security definer`, `set search_path = public` | Match |
| `src/lib/operational-flow/operational-flow-service.ts:67` | `record_operational_decision` | `p_recommendation_id`, `p_manual_evidence_item_id`, `p_decision`, `p_decision_status`, `p_rationale` | `Record<string, unknown>` via `unwrap()` | `(p_recommendation_id uuid, p_manual_evidence_item_id uuid, p_decision text, p_decision_status text, p_rationale text) returns jsonb` — `security definer`, `set search_path = public` | Match |
| `src/lib/security/abuse-protection.ts:184` | `abuse_rate_limit_increment` | `p_scope`, `p_identifier_hash`, `p_window_start`, `p_metadata` | `number` (cast from `data`) | `(p_scope text, p_identifier_hash text, p_window_start timestamptz, p_metadata jsonb default '{}'::jsonb) returns integer` — `security definer`, `set search_path = public` | Match |

**Result: 8/8 distinct functions, 9/9 call sites — argument names and
counts match their migration-defined signature.** No drift found at the
source level.

## What this does not cover (honesty statement)

* **PostgREST-level exposure** — whether these functions are actually
  reachable via `supabase.rpc()` on a real linked project (schema cache,
  `EXECUTE` grants reaching the calling role) is untested. Static grants
  review is in
  [`hosted-grants-report.md`](./hosted-grants-report.md) §SECURITY DEFINER
  review, also static-only.
* **Runtime execution** (F.2 of the PR brief) — none of these 8 functions
  were actually invoked against a live database this session.
* **Return-type serialization** — the TypeScript casts (`as RpcReserveResult`,
  etc.) are trusted, not verified against `jsonb` output shape from a live
  call.
* **RPCs not reached by a static `.rpc(` grep** — any dynamic/computed RPC
  name (none found in this codebase — all 9 call sites use string literals)
  would be missed by this method.

## To complete this report for real

1. Obtain a hosted Supabase project per
   [`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md).
2. Run the fresh apply (section C of the PR brief).
3. Call each of the 8 functions above via `supabase.rpc()` using a real
   `authenticated` session and a real `service_role` client where
   applicable, asserting the response shape matches the TS cast.
4. Confirm via `select proname, proargnames, prosecdef from pg_proc where pronamespace = 'public'::regnamespace` that the deployed signatures match this table.
5. Update the "Static Match" column to "Match (live-verified)" per row, with
   the invocation evidence.
