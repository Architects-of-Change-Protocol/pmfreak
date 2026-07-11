# Generated Supabase Types Drift Report — Perilla 13B

## Status: NOT EXECUTED

`supabase gen types typescript --linked` requires a linked hosted project.
No hosted Supabase project was available this session.

## Baseline finding (source-only, done this session)

```bash
find src -iname '*database.types*' -o -iname '*supabase*types*'
grep -rln 'SupabaseClient<Database>' src
```

Both return empty. **PMFreak's codebase does not currently use generated
Supabase types at all** — `createSupabaseServerClient()` and related
factories construct untyped (or hand-typed) clients; there is no
`Database` generic threaded through `.from()`/`.rpc()` calls. This means:

* There is **no existing versioned types file to diff against** — G.2 of
  the PR brief ("Comparar contra tipos versionados") has no baseline in
  this repository as of Perilla 13B. The first hosted run that generates
  types will be establishing a baseline, not diffing one.
* Runtime type safety for Supabase queries currently comes from
  hand-written interfaces at each call site (e.g. `RpcReserveResult`,
  `RpcCommitResult` in `src/lib/quota/upload-quota.ts` — see
  [`hosted-rpc-signature-report.md`](./hosted-rpc-signature-report.md)),
  not from the database schema itself. Drift between the hand-written
  interfaces and the real schema would not be caught by `tsc` today; it
  would only surface at runtime.

This is a real, previously-undocumented gap surfaced by attempting to plan
this report — **not a new defect introduced by this PR**, and out of scope
to fix here (adopting `Database`-typed clients repo-wide is a
significant, cross-cutting change, not a "Supabase-specific
incompatibility found by hosted testing" per principle 6 of the PR brief).
Flagged for a future hardening pass.

## To complete this report for real

1. Follow the execution plan in
   [`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md)
   through a successful fresh apply.
2. Run:
   ```bash
   supabase gen types typescript --linked > /tmp/pmfreak-hosted-database.types.ts
   ```
3. Since no prior versioned types file exists, the first run establishes
   the baseline. Commit it as `src/lib/supabase/database.types.ts` (or
   equivalent) **only if**:
   - the hosted schema is confirmed correct (fresh apply passed all of
     sections C–F of the PR brief), and
   - a follow-up typecheck pass against the hand-written interfaces listed
     above is planned (not necessarily completed in the same PR — but the
     gap must be tracked, not silently left open).
4. Classify any difference between the generated types and the
   hand-written interfaces per the PR brief's categories: expected schema
   correction / stale generated type / unexpected table / missing table /
   missing column / type mismatch / nullability mismatch / RPC mismatch.
5. Do not overwrite silently — document the diff in this file before
   committing any generated types file.
