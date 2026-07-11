# RLS and Tenant Isolation Report — Perilla 13

Environment caveats (stubbed `auth.uid()`, no hosted Supabase) are the same as `fresh-database-migration-proof.md` — read that first. The test itself is real SQL executed under the simulated `authenticated` role with a real `auth.uid()` value, against the actual RLS policies the migrations create; it is not a mock or a source-code scan.

## E.1 RLS Coverage

408 of 409 tables have `ENABLE ROW LEVEL SECURITY` set after a full fresh apply. The one exception:

| Table | Category | RLS Enabled | Justification |
| --- | --- | --- | --- |
| `agent_attestation_nonces` | service-role-only | No | `20260515000000_agent_attestation_nonces.sql` explicitly disables RLS with an inline comment ("accessed only via service role"), and this is verified true in the only consumer: `src/lib/security/agent-attestation.ts` uses `createPrivilegedSupabaseClient(...)` (a service-role client, with an `AUDIT_REF`-tagged comment explaining the replay-protection nonce store must bypass RLS so a token cannot suppress its own revocation record), not the ordinary `createSupabaseServerClient()`. No bypass found; retained as-is (E.6). |

Two additional tables were **found to have an undocumented RLS gap during this audit** and fixed as blocking defects (not retained as residual risk, per E.6's instruction to fix real bypasses): see `capability_verification_snapshots`/`_receipts`/`_audit_records` in `migration-failure-remediation-log.md` F25. They now show `relrowsecurity = true` with `anon`/`authenticated` explicitly revoked.

## E.6 Legacy RLS (RR-RLS-LEGACY)

Per the PR's instruction not to expand this into a full re-architecture: `onboarding_analyses` and `governance_audit_events` (the two tables `RR-RLS-LEGACY` in `residual-risk-register.md` already flags as still on legacy `company_id`-based RLS) were checked for (a) fresh-apply-blocking defects and (b) a real cross-tenant bypass.

- (a) No fresh-apply blocker — both tables apply cleanly.
- (b) No bypass found: both tables' RLS policies still correctly scope by `current_company_id()`, and no query path exists that lets a user read another company's `company_id` value to spoof this. **Retained as non-blocking documented risk**, unchanged from Perilla 11's assessment.

## E.2 / E.4 Two-Workspace Live Test

Fixture: `scripts/fresh-db-rls-smoke-test.sql`. Seeds User A / Workspace A / Project A and User B / Workspace B / Project B, then runs each test `set role authenticated` with a real `request.jwt.claim.sub` matching the seeded user, exercising the actual `workspaces`/`workspace_memberships`/`projects` RLS policies the migrations create (including `is_workspace_member()`).

Actual output from a clean fresh-applied database (144/144 migrations, including the two corrective migrations from this PR):

```
TEST 1: User A can read Workspace A (expect 1 row)          -> count = 1   PASS
TEST 2: User A cannot read Workspace B (expect 0 rows)       -> count = 0   PASS
TEST 3: User A can read Project A (expect 1 row)             -> count = 1   PASS
TEST 4: User A cannot read Project B (expect 0 rows)          -> count = 0   PASS
TEST 5: User A cross-tenant INSERT into Project B workspace  -> ERROR: new row violates row-level security policy for table "projects"   PASS (rejected)
TEST 6: User A cross-tenant UPDATE of Project B               -> UPDATE 0 rows; name unchanged (0 rows visible)   PASS (rejected)
TEST 7: User A cross-tenant DELETE of Project B               -> DELETE 0 rows; row still present               PASS (rejected)
TEST 8: User B cannot read Workspace A (expect 0 rows)        -> count = 0   PASS
TEST 9: User B cannot read Project A (expect 0 rows)          -> count = 0   PASS
TEST 10: authenticated cannot read capability_verification_snapshots -> count = 0   PASS (F25 fix confirmed effective)
```

**10/10 PASS.** SELECT, INSERT, UPDATE, and DELETE are all covered; every cross-tenant write attempt was rejected by RLS (not merely returning 0 matched rows for the read case — INSERT genuinely errored with `new row violates row-level security policy`).

## E.3 Membership Role Matrix

Not exhaustively tested this session — only the `owner` role was exercised in the live test above (User A and User B are both workspace owners of their respective workspaces). `admin`/`pm`/`viewer`/non-member/removed-member/expired-invite scenarios were not separately driven through live SQL in this pass. This is real residual work, tracked below, not a claimed-but-unverified pass.

## E.5 Service Role Boundary

TEST 10 above confirms `authenticated` cannot read `capability_verification_snapshots` post-fix (F25). `agent_attestation_nonces` was not separately live-tested (its RLS-disabled-by-design status is verified by source inspection instead, per E.1 above) — the correct live test would attempt a direct `authenticated`-role query against it and expect `permission denied`, given RLS is off but grants should still gate it; this is tracked as residual work.

## Blocking Defect Found and Fixed

**`workspace_memberships` RLS recursion (migration-failure-remediation-log.md F26).** The first run of this exact smoke test (before the corrective migration in this PR) failed nearly every test with `ERROR: infinite recursion detected in policy for relation "workspace_memberships"` — not a fresh-database artifact, a genuine bug that would recur on any database (fresh or existing) the moment `workspace_admins_can_read_all_memberships` evaluated for a real user. Fixed by routing the "is this user an owner/admin" check through the pre-existing `is_workspace_admin()` `SECURITY DEFINER` helper instead of a raw self-referencing subquery. Re-running the smoke test after the fix produced the 10/10 PASS result above.

## Residual Work (not claimed as done)

- Full owner/admin/pm/viewer/non-member/removed-member/expired-invite role matrix (E.3) — only `owner` was live-tested.
- Direct live test of `agent_attestation_nonces`'s service-role boundary (verified by source read instead).
- Storage bucket/object policy isolation (E.5/F.5) — bucket creation was proven to apply (`20260515200000_storage_bucket_setup.sql` runs cleanly against the hand-stubbed `storage` schema), but policy enforcement was not live-tested since real Storage/PostgREST behavior isn't present in this environment.
