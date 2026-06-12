# Operational-flow Runtime Gate

**Status:** Required before any release or demo.  
**Blocking since:** merge `38f9129` (post-merge hardening gate P1.7 — 2026-06-11).  
**What it validates:** DB schema, RLS enforcement, append-only audit trail, evidence freeze, authority denial, cross-workspace isolation, idempotent seed, and authenticated API flows — against a real Supabase instance.

---

## Why this gate exists

Static analysis (typecheck, build, contract tests) validates code shape. This gate validates that the **database actually enforces** what the code assumes:

- Authenticated users cannot insert `operational_signals`, `governance_events`, or `operational_decision_records` directly.
- `decision_evidence_links` and `operational_decision_records` are append-only.
- Frozen evidence items cannot be rewritten.
- Cross-workspace reads and writes are filtered by RLS.
- The PM role cannot accept sponsor/PMO-authority recommendations.
- `materialize_operational_chain` is idempotent (reprocessing does not duplicate signals).
- The seed script is idempotent (second run returns `disposition: "reused"`).

These properties **cannot be verified without a live Supabase instance**.

---

## Why you must NOT use production

This gate:

- Creates auth users via `admin.auth.admin.createUser`
- Inserts and **hard-deletes** workspaces, projects, evidence items, signals, risks, governance events, decisions, and evidence links
- Calls `materialize_operational_chain` and `record_operational_decision` RPCs
- Runs the seed script twice (idempotence check) and once with `--reset`

Running against production would corrupt real data.

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Node.js ≥ 20
- `npm install` run in the project root
- The Next.js app running locally

---

## Step 1 — Create an isolated Supabase project

### Option A: Local Supabase (recommended)

```bash
supabase start
# Note the API URL, anon key, and service_role key printed at startup
```

Default values when using `supabase start`:
- URL: `http://localhost:54321`
- Anon key: printed in output
- Service-role key: printed in output

### Option B: Isolated remote branch project

Create a throwaway project on [supabase.com](https://supabase.com) or use a branch project. Set `OPERATIONAL_FLOW_TEST_ALLOW_REMOTE=true` in your env file.

---

## Step 2 — Apply migrations

```bash
# Local
supabase db reset

# Remote
supabase db push --db-url "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

Confirm the most recent migration ran:
```
supabase migration list
# Should show: 20260611000000_operational_evidence_decision_loop
```

---

## Step 3 — Configure environment variables

Copy the example file and fill in the values from Step 1:

```bash
cp .env.operational-flow.example .env.local
# Edit .env.local with your isolated project credentials
```

Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Isolated project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (never commit) |
| `OPERATIONAL_FLOW_TEST_SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| `OPERATIONAL_FLOW_TEST_ANON_KEY` | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY` | Same as `SUPABASE_SERVICE_ROLE_KEY` |
| `OPERATIONAL_FLOW_TEST_BASE_URL` | `http://localhost:3000` |
| `OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE` | Must be `"true"` |

---

## Step 4 — Start the app

```bash
npm run dev
# Wait until "Ready on http://localhost:3000" appears
```

The app **must** be running against the same isolated Supabase project. Confirm by checking `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.

---

## Step 5 — Run the DB/RLS gate

```bash
npm run check:operational-flow-db
```

**Expected output** (all checks pass):
```json
{
  "ok": true,
  "checks": [
    "role-aware evidence RLS",
    "derived-table direct writes denied",
    "cross-workspace denied",
    "transactional idempotent chain",
    "authority denial",
    "atomic decision/evidence/recommendation",
    "append-only audit trail",
    "frozen evidence",
    "exact assurance counts > 30",
    "idempotent seed",
    "authenticated API create/run/decision",
    "API 401/403 scope and role denials"
  ]
}
```

If it exits with code 2 (missing env vars), see the error message — all required variables must be set.  
If it exits with code 1, see the stack trace — a specific assertion failed.

---

## Step 6 — Idempotent seed

You need a workspace ID and an owner/admin user ID. Both are UUIDs from your isolated project.

```bash
# First run — should print disposition: "created"
npm run seed:operational-flow -- <workspace-id> <owner-or-admin-user-id>

# Second run — must print disposition: "reused" and identical projectId
npm run seed:operational-flow -- <workspace-id> <owner-or-admin-user-id>

# Reset run — must print disposition: "reset"
npm run seed:operational-flow -- <workspace-id> <owner-or-admin-user-id> --reset
```

**Pass criteria:**
- `firstSeed.projectId === secondSeed.projectId`
- `secondSeed.disposition === "reused"`
- `resetSeed.disposition === "reset"`
- No duplicate signals, risks, governance events, or recommendations after second run

---

## Step 7 — Smoke test (authenticated browser)

1. Log in as the workspace owner
2. Navigate to `/command-center?projectId=<demo-project-id>` (printed by seed)
3. Confirm **Evidence** tab loads first (not recommended actions)
4. Create a new evidence item (manual note)
5. Run the chain → confirm deterministic signal appears
6. Confirm risk/issue record appears
7. Confirm governance check appears
8. Confirm recommended action appears
9. Register a decision as the owner
10. Confirm evidence snapshot/freeze icon appears on the evidence item
11. Refresh the page → confirm all data persists
12. Open Project Assurance Summary → confirm it shows v1 counts

---

## Step 8 — Security denial checks

Run each of the following and confirm it **fails** (error or HTTP 4xx):

| Test | Expected result |
|---|---|
| Viewer tries to create evidence via API | HTTP 403 |
| Unauthenticated request to `/api/operational-flow` | HTTP 401 |
| Owner tries to create evidence in wrong workspace | HTTP 403 |
| Direct INSERT into `operational_signals` as authenticated user | DB denial |
| Direct INSERT into `governance_events` as authenticated user | DB denial |
| PM tries to accept sponsor/PMO-authority recommendation | DB denial |
| UPDATE on `operational_decision_records` | DB denial |
| UPDATE on `decision_evidence_links` | DB denial |
| UPDATE on frozen `evidence_items` | DB denial |
| Cross-workspace evidence read | Returns empty (0 rows) |
| Cross-workspace evidence write | DB denial |
| Legacy `/api/recommended-actions/decision` on governed recommendation | HTTP 409 |

---

## Step 9 — Save evidence

Save the following before marking the gate passed:

- Screenshot of Command Center with evidence tab open
- Screenshot of completed chain (signal + risk + governance + recommendation)
- Screenshot of decision record
- Screenshot of frozen evidence indicator
- Screenshot of Project Assurance Summary
- Terminal output of `npm run check:operational-flow-db` (full JSON)
- Terminal output of seed idempotence run (both executions)

Store in `artifacts/` or attach to the release PR.

---

## Pass/fail criteria

The gate **passes** when ALL of the following are true:

- `npm run check:operational-flow-db` exits 0 with `"ok": true`
- Seed first run: `disposition: "created"`
- Seed second run: `disposition: "reused"`, same `projectId`
- Seed `--reset`: `disposition: "reset"`
- All smoke test steps completed without error
- All security denial checks confirmed
- Screenshots saved

The gate **fails** (do not release/demo) if any check is skipped, blocked, or produces an unexpected result.

---

## If something fails

| Failure | Action |
|---|---|
| `check:operational-flow-db` assertion fails | Read the stack trace, identify which check, check the RLS policy or RPC |
| Seed duplicates on second run | Check `stableId` determinism or `cleanupScenario` ordering |
| Viewer can create evidence | Check `evidence_items` INSERT RLS policy |
| Direct signal insert succeeds | Check `operational_signals` has no INSERT policy for `authenticated` |
| Append-only check fails | Check `reject_audit_mutation` trigger is installed |
| Frozen evidence can be updated | Check `prepare_evidence_item` trigger and UPDATE RLS policy |
| Legacy 409 not returned | Check `decideRecommendedAction` governance guard |

Open a P0 hotfix branch immediately. Do not release.

---

## Remaining preexisting issues (not blocking this gate)

These were identified in the P1.7 post-merge hardening report and are **not** caused by merge `38f9129`:

- `check:governance` fails at `check:runtime-contract-drift` (commit `2d77158`) — tracked separately
- 3 security boundary tests failing (preexisting, not introduced by this merge)
- `npm run build` / `npm run typecheck` require `npm install` in the CI container
