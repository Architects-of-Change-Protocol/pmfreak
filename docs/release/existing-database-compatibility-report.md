# Existing Database Compatibility Report — Perilla 13B

## Status: NOT EXECUTED

Section H of the PR brief requires applying the Perilla 13B corrective
migrations against a second, independently-seeded environment representing
an "existing" (already-migrated, has-data) database, and confirming no
data loss, no duplicate policies, no orphaned foreign keys, no broken
memberships/billing/audit history. This requires a second isolated Supabase
project (or a fresh project seeded to the pre-Perilla-13B schema state) —
none was available this session. **Not independently tested.**

## Reasoned (not tested) compatibility analysis of this PR's 2 new migrations

Perilla 13's own existing-DB-compatibility section
(`fresh-database-migration-proof.md`) established the reasoning pattern
this repo uses when a live second environment isn't available: prove each
statement type is safe by construction. Applying that same reasoning to
Perilla 13B's 2 new migrations:

### `20260824000000_fix_purge_expired_nonces_search_path.sql`

* `create or replace function public.purge_expired_nonces() ... set search_path = public ...` —
  `create or replace function` is non-destructive: it replaces the
  function body/attributes in place, does not touch table data, and
  requires no lock beyond a brief catalog update. Safe on a database with
  existing `agent_attestation_nonces` rows — the function's own DELETE
  statement is unchanged.
* `revoke all on function public.purge_expired_nonces() from public;` —
  purely a privilege change. Since grep confirms zero application call
  sites for this function, no existing caller depends on the PUBLIC grant
  being present; revoking it changes nothing observable except closing an
  unused access path.
* No `drop`, no `truncate`, no unconditional `delete`. **Reasoned: safe.**

### `20260825000000_fix_security_definer_public_execute_grants.sql`

* Contains only `revoke all on function ... from public;` and
  `grant execute on function ... to <role>;` statements — no DDL that
  creates, drops, or alters any table, column, constraint, or index. No
  data is read, written, or migrated by this file.
* Every `revoke` is immediately paired with a `grant` restoring access for
  the role(s) that were the function's actual intended callers (verified
  against existing `grant`/RLS-policy usage in
  [`hosted-grants-report.md`](./hosted-grants-report.md)) — so no
  legitimate existing caller (application code using `authenticated`, or
  the quota RPCs' `service_role` path) loses access. Only the implicit,
  unused `anon`/PUBLIC path is closed.
* **Reasoned: safe, and additionally reversible** — re-running
  `grant execute ... to public` would restore the prior (less safe) state
  if ever needed, though there is no reason to.

## What this reasoning does not replace

This is source-level reasoning, matching the standard Perilla 13 already
set for this exact situation — it is explicitly **not** the same evidence
strength as H.1–H.4's real second-environment test. In particular it does
not measure the before/after metrics H.3 requires (workspace count,
membership count, project count, task count, billing record count, audit
event count, AI usage event count) because there is no live "existing"
database with that data to measure. **RR-MIGRATE is not closed by this
document**, and per the PR brief: "RR-MIGRATE no se cierra si existe riesgo
de pérdida de datos sin resolver" — no risk of data loss is identified
above, but the independent test itself has not run.

## To complete this report for real

1. Obtain a second isolated Supabase project (or a project fresh-applied to
   the pre-Perilla-13B schema state, i.e. 144 migrations, then seeded with
   representative non-real data: a few workspaces, memberships, projects,
   billing records, audit events, AI usage events).
2. Record the H.3 sanitized before-metrics (counts only, no identifiable
   data).
3. Apply the 2 Perilla 13B migrations (`20260824000000`,
   `20260825000000`) on top.
4. Record the H.3 after-metrics; confirm no count decreased unexpectedly.
5. Confirm existing memberships, billing records, and audit history are
   still readable and unchanged; confirm no duplicate-policy or
   orphaned-foreign-key errors during apply.
6. Classify the result: PASS / PASS WITH DOCUMENTED NON-DESTRUCTIVE
   DIFFERENCE / FAIL, and update this document plus
   [`residual-risk-register.md`](./residual-risk-register.md) accordingly.
