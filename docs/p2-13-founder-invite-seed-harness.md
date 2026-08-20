# P2-13 — Founder Invite Seed and Isolated Environment Harness

**Status:** implemented; runtime-verified against the disposable local stack.
**Prompt:** `docs/product-baseline/prompts/p2-13-founder-invite-seed-and-isolated-environment-harness.md`
**Unlocks:** P2-14 — Authenticated Two-Tenant Founder Browser Story.
**Fixture expiry owner:** **P2-14.**

---

## What this harness is for

An operator can create, inspect, verify, reset and recreate an explicitly
labelled deterministic Founder scenario in isolated development
infrastructure — without secrets, accidental production targeting, stale
residue, cross-tenant contamination or fabricated canonical lineage.

It is infrastructure. It adds no product feature, no aggregate, no API route,
no migration and no dependency.

---

## Commands

```bash
npm run seed:p2-13-founder -- preflight   # classify the target; mutate nothing
npm run seed:p2-13-founder -- seed        # create the deterministic scenario
npm run seed:p2-13-founder -- verify      # read-only; assert the exact expected state
npm run seed:p2-13-founder -- reset       # remove ONLY the P2-13 fixture scenario
npm run seed:p2-13-founder -- reseed      # reset, then recreate the same scenario
npm run check:p2-13-db                    # full runtime acceptance gate
```

Exit codes: `0` success, `1` incomplete/failed, `2` refused (target not proven
local and isolated, or an opt-in is missing).

Every command prints one JSON report. Reports pass through a redactor before
printing, so no key, token, password or database URL can appear in them.

---

## Safety model

### Fail-closed isolation guard

`scripts/p2-13/isolation-guard.mjs` classifies the target before any client is
constructed. There is no "probably localhost" heuristic: several independent
signals must all agree, and any of them failing is a refusal.

| Signal | Requirement |
|---|---|
| `explicit_p2_13_opt_in` | `P2_13_FOUNDER_FIXTURE_ENABLED=true` |
| `explicit_local_reset_opt_in` | `P2_13_ALLOW_LOCAL_RESET=true` (reset/reseed only) |
| `existing_destructive_opt_in` | `OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true` (reset/reseed only) |
| `node_env_not_production` | `NODE_ENV` is not `production` |
| `remote_override_absent` | `OPERATIONAL_FLOW_TEST_ALLOW_REMOTE` is **never** honoured by P2-13 |
| `supabase_url_loopback` | literal loopback host only (`127.0.0.1`, `localhost`, `[::1]`) |
| `supabase_url_expected_port` | the disposable local API port `54321` |
| `supabase_url_plaintext_loopback_scheme` | `http:` — `https:` indicates a hosted target |
| `app_origin_exact` | exactly `http://localhost:3000` |
| `app_and_harness_share_one_target` | the app and the harness address the same database |
| `database_url_loopback` / `database_url_expected_port` | loopback, port `54322` (reset/reseed only) |
| `no_known_hosted_or_production_host` | no host matches a hosted/staging/production pattern |
| `fixture_actor_password_present` | supplied by the environment, ≥ 12 characters |

`unknown → REFUSE`, `remote → REFUSE`, `production → REFUSE`,
`missing opt-in → REFUSE`.

### Service role boundary

Service role provisions **fixture prerequisites only** — auth users,
workspaces, projects, memberships and the Founder Invite access records — none
of which have an authenticated creation path. It is never used as user
authorization.

The canonical spine is seeded as the **real authenticated fixture actors**
through the verified contracts:

```
capture_operational_input      Source → Raw Input → Normalized Event
derive_operational_evidence    Evidence (from the Normalized Event only)
materialize_operational_chain  Signal → Risk/Issue → Governance Event → Recommendation
```

Evidence is never inserted directly and no digest is ever fabricated.

### Reset scope

Reset deletes only rows addressed by the scenario's own deterministic
workspace, project, invite and actor identities, in explicit
reverse-dependency order derived from the live `pg_constraint` graph, inside a
single transaction. It never truncates, never drops a schema, never resets
migrations, never disables RLS and never disables a foreign key.

Because P2-03/P2-04/P2-06 deliberately make Raw Input, Normalized Event,
derived Evidence, Material Action records and platform events immutable with
no service-role exemption, reset temporarily disables exactly those eight
**named** immutability triggers inside its one transaction and re-enables them
before commit. A failure anywhere rolls back the trigger state with the
deletion. See "Deviations" below.

### Reset privilege, stated precisely

Reset connects as the local `postgres` maintenance role (via `psql`, or
`docker exec` into the single local `supabase_db_*` container). On the
disposable local Supabase stack that role is **not** a superuser
(`rolsuper = false`) but it **does** hold `rolbypassrls`, exactly as
`service_role` does. Therefore:

- every RLS policy remains **configured and unchanged** — nothing is dropped,
  altered or switched off; and
- RLS is **not enforced against this maintenance connection**.

Those are two different statements and only the first is true of enforcement.
This document does not claim "RLS enforced throughout" for the reset path.

Tenant isolation is never argued from this path. It is proven separately, as
ordinary authenticated actors subject to RLS, by `npm run check:p2-13-db`
(A→A allow, A→B deny, B→B allow, B→A deny, cross-tenant write and id
substitution denied). The bypass privilege is used only to delete fixture
rows, and only after the fail-closed guard has classified the target
`LOCAL_ISOLATED` under both destructive opt-ins.

The guard is enforced where the capability is minted, not only at today's call
sites: `resolveSqlRunner()` re-runs the isolation guard in destructive mode
over the same environment the executor would use, so a caller that forgets to
guard first cannot obtain a SQL executor at all.

---

## The deterministic scenario

Scenario id `3ddb9e47-c57d-5599-89c6-a2282a3d1f0c`
(`deterministicUuid("scenario")` over the namespace
`pmfreak:p2-13:founder-invite:v1`).

| | Tenant A | Tenant B |
|---|---|---|
| Semantic role | Founder scenario under test | Isolation / IDOR negative control |
| Workspace | `a766e43a-b980-59e8-8861-4e166c5d16e8` | `63e11bb6-5b72-5f96-8bc4-ef053ea2072b` |
| Project | `060659c6-40a3-56d0-982d-80e5fd15ad74` | `f591eb61-69ae-56bd-ac0c-5d571666d781` |
| Actors | `owner`, `pm`, `viewer` | `owner` |
| Actor reference | `p2-13:tenant-A:<role>` | `p2-13:tenant-B:owner` |

Actor identity is carried as a deterministic email natural key plus a stable
reference. **No credential appears in the manifest, the handoff or any
report.** The fixture password is supplied only through
`P2_13_FIXTURE_ACTOR_PASSWORD`.

### Identity rules

- Deterministic: scenario id, workspace/project ids, invite/trial/activation
  ids, actor emails, source keys, idempotency keys, correlation ids, and the
  fixture payloads (so content and event digests are byte-identical across a
  reseed).
- Contract-generated: Source, Raw Input, Normalized Event, Evidence, Signal,
  Risk/Issue, Governance Event and Recommendation primary keys. These are
  minted by the verified RPCs and are addressed by their deterministic natural
  key. Forcing them would mean bypassing the derivation boundary P2-13 exists
  to honour, so a reseed legitimately mints new ones.
- Never identity: titles, timestamp proximity, insertion order.

### Fixture labelling

Uses the canonical representation the verified schema already enforces — no
ad-hoc label:

- `operational_sources.is_fixture = true`,
  `fixture_label = 'DEMO / FIXTURE'`, `fixture_expires_when` non-empty
- `evidence_items.fixture_state = 'DEMO_FIXTURE'`
- `projects.onboarding_payload.fixtureLabel = 'DEMO / FIXTURE'` plus the
  scenario key and expiry gate
- workspace and project names are prefixed `DEMO / FIXTURE`

Fixture Evidence can never be mistaken for LIVE Evidence: it fails the P2-09
observation-eligibility predicate (`fixture_state = 'LIVE'`), and
`capture_live_operational_input` refuses a fixture source with
`intake_source_fixture_prohibited`. Both are asserted by the runtime gate.

---

## Canonical spine ownership

P2-13 prepares state. P2-14 must still OBSERVE and PERFORM the transitions its
acceptance story verifies — pre-completing them would make that story pass
without exercising it.

| Canonical node | Owner |
|---|---|
| Source | **PRESEEDED** |
| Raw Input | **PRESEEDED** |
| Normalized Event | **PRESEEDED** |
| Evidence | **PRESEEDED** |
| Finding (Signal → Risk/Issue → Governance Event) | **PRESEEDED** (2 / 2 / 2 per tenant) |
| Recommendation | **PRESEEDED** (2 per tenant, all `proposed`) |
| Decision | **P2-14 CREATED** |
| Material Action | **P2-14 CREATED** |
| Task | **P2-14 CREATED** |
| Internal Execution | **P2-14 CREATED** |
| Outcome | **P2-14 CREATED** |
| Observation | **P2-14 CREATED** |

`verify` asserts every P2-14-owned state is exactly zero after a seed, so a
future change that quietly pre-completes one fails the gate.

The expected chain counts are contract-derived, not guessed: both tenant
payloads match exactly two deterministic detector rules (`scope_creep` via
"additional activity", `missing_approval` via "without formal approval"), and
a focused test re-reads those rules out of the verified migration to prove it.

---

## P2-14 handoff manifest

The machine-readable manifest is produced by
`buildP2_14HandoffManifest()` in `scripts/p2-13/founder-scenario-manifest.mjs`
and is emitted in the `handoff` field of every successful `seed` / `reseed`
report.

- **FOUNDER_SCENARIO_ID:** `3ddb9e47-c57d-5599-89c6-a2282a3d1f0c`
- **TENANT_A:** workspace `a766e43a-…`, project `060659c6-…`, actors
  `p2-13:tenant-A:owner|pm|viewer`
- **TENANT_B:** workspace `63e11bb6-…`, project `f591eb61-…`, actor
  `p2-13:tenant-B:owner`
- **SEEDED_START_STATE:** DEMO / FIXTURE source, one immutable raw input with a
  real sha256 digest, one accepted normalized event, one derived
  `DEMO_FIXTURE` evidence item, 2 signals / 2 risk-issue records / 2 governance
  events, 2 governed recommendations in `proposed`, plus an accepted invite,
  an active trial licence and a workspace activation per tenant.
- **EXPECTED_P2_14_TRANSITIONS:** record a Decision on a proposed
  Recommendation → propose a governed Material Action → dispatch it to exactly
  one internal Task → drive execution → ensure an expected Outcome that Task
  completion does not achieve → record an evidence-linked Observation →
  review lineage and the canonical audit export.
- **EXPECTED_NEGATIVE_CONTROL:** Tenant B. A must not read or mutate B; B must
  not read A; cross-project and cross-workspace id substitution is denied
  server-side.
- **Commands:** as listed at the top of this document.
- **FIXTURE EXPIRY OWNER:** **P2-14.**

No credential appears in the manifest.

---

## Fixture expiry

| | |
|---|---|
| Owner | P2-13 (creation) / P2-14 (removal) |
| Removal condition | P2-14 `VERIFIED` and no longer dependent on fixture-only setup |
| Gate | P2-14 |

These fixtures are temporary Founder infrastructure and must never silently
become permanent product data. When P2-14 is verified, run
`npm run seed:p2-13-founder -- reset` and remove the harness or re-scope it to
whatever P2-15 requires.

---

## Operator setup

1. Start the disposable local stack and apply migrations:
   `supabase start` (see `docs/operational-flow-runtime-gate.md`).
2. Copy `.env.operational-flow.example` to `.env.local` and fill in the local
   values, including the two P2-13 flags and `P2_13_FIXTURE_ACTOR_PASSWORD`.
3. Export them into the shell (these scripts read `process.env` only, matching
   the existing gate scripts):
   `set -a && . ./.env.local && set +a`
4. `npm run seed:p2-13-founder -- preflight` — expect
   `"databaseTargetClassification": "LOCAL_ISOLATED"`.
5. `npm run seed:p2-13-founder -- seed`, then `npm run check:p2-13-db`.

`seed`, `verify`, `reset` and `reseed` do **not** require the Next.js app to be
running; they drive the canonical RPCs directly as authenticated actors. The
app is required for `npm run check:operational-flow-db` and for P2-14.

---

## Recovery

| Situation | Action |
|---|---|
| `PARTIAL_SEED` | Read `completedStages` / `failedStages` / `unreachedStages`, fix the named cause, re-run `seed` (canonical idempotent replay repairs missing derived nodes; the chain stage reports `created`, `repaired` or `already_materialized` per tenant). |
| `verify` reports `INCOMPLETE` | The report names each missing or mismatched node. Re-run `seed`; if a node conflicts rather than being missing, use `reseed`. |
| A conflicting canonical node | `seed` refuses with the canonical idempotency conflict and never overwrites. Only `reset` + recreate resolves it — that is what `reseed` does. |
| Residue after reset | `reset` re-counts residue through PostgREST, independently of the SQL session that deleted it, and reports `RESIDUE_REMAINS` rather than success. |
| Wrong target | The guard refuses with exit 2 and names every failing signal. |
| `fixture_actor_signin` — identity exists, password does not match | The fixture accounts were created by an earlier run under a different `P2_13_FIXTURE_ACTOR_PASSWORD`. Re-run with `P2_13_REALIGN_FIXTURE_ACTORS=true` to realign them to the configured value, or `reset` the scenario and seed fresh. The harness never realigns silently. |

---

## Deviations and known limitations

1. **Reset temporarily disables eight named immutability triggers.** The
   verified contracts intentionally forbid deleting Raw Input, Normalized
   Event, derived Evidence, Material Action records and platform events, with
   no service-role exemption. A disposable fixture scenario still has to be
   removable. Reset therefore disables exactly those triggers *by name* inside
   one transaction and re-enables them before commit, only after the guard
   proves `LOCAL_ISOLATED` and only under `P2_13_ALLOW_LOCAL_RESET=true`.
   Foreign keys remain fully enforced throughout, and `DISABLE TRIGGER ALL` /
   `session_replication_role` are never used. RLS policies remain configured
   and unchanged, but the `postgres` maintenance role holds `rolbypassrls`, so
   RLS is not enforced against the reset connection — see "Reset privilege,
   stated precisely" above. No product code path is affected.
2. **Reset needs local SQL access.** It uses `psql` if present, otherwise the
   single local `supabase_db_*` container. Two candidate containers is an
   ambiguity and is refused, not guessed between.
3. **Trial-licence window uses the harness clock.** `trial_end_at` is set one
   year ahead from the harness clock, and `verify` only requires more than 30
   days remaining, so ordinary skew cannot decide it. This is a fixture access
   record, not a governance authorization; the P2-06 material-action window
   remains server-derived and untouched.
4. **No placeholder integrity value is introduced or persisted.** P2-13
   validates provenance solely through the canonical P2-03/P2-04 chain:
   `operational_raw_inputs.content_digest` →
   `operational_normalized_events.event_digest` (plus `raw_input_id` and
   `provenance.rawDigest`) → `evidence_items.derivation_digest` (plus
   `normalized_event_id` / `raw_input_id` / `source_id`). All are real sha256,
   all are asserted by the runtime gate, which additionally recomputes the raw
   digest from the stored payload in read-only SQL.

   The verified P2-04 RPC passes a `repeat('0', 64)` literal in its INSERT
   column list for the pre-existing legacy `evidence_items.evidence_hash`
   column, but that value never persists: the upstream
   `trg_prepare_evidence_item` BEFORE INSERT trigger overwrites it with
   `compute_evidence_hash(title, content, source_reference, source_type,
   version)`. Every seeded row therefore carries a real sha256 (verified on
   the live stack: 165/165 rows sha256-shaped, 0 zero-filled). P2-13 never
   supplies, compares against, or derives any provenance assertion from that
   column.
5. **Intake instants are fixed constants** (`2026-02-03T09:15Z` /
   `09:20Z`) so `verify` can assert exact equality and so insertion time is
   never an accidental identity. Freshness is unaffected: with `stale_at`
   null, P2-04 derives `CURRENT`.
6. **Browser-session proof is P2-14's.** P2-13 proves two-tenant isolation with
   real authenticated database actors, which is where RLS is enforced. The
   authenticated browser journey, session refresh and screenshots belong to
   P2-14 and are deliberately not absorbed here.
7. **HTTP route coverage.** The seed drives the canonical RPCs directly; the
   `/api/operational-flow` route path over the same contracts remains covered
   by `npm run check:operational-flow-db` and by P2-14.
8. **The Finding chain is replayed only when a branch is missing.**
   `materialize_operational_chain` is idempotent for every canonical node it
   creates — signal, risk/issue record, governance event and recommendation all
   use `on conflict … do nothing` — but it appends a fresh `agent_runs` +
   `agent_outputs` detector-run record on every invocation. That is correct for
   a real detector execution and P2-13 must not weaken the verified P2-06
   contract to make its own replay tidy, so the decision is made in the
   harness: `seed` reads the current fan-out first and calls the contract only
   when a branch is actually absent. Completeness is tested across all four
   branches, not signals alone, so a partially damaged chain still replays and
   is repaired with surviving ids untouched.

   `verify` reports `nodes.detectorRuns` but deliberately does **not** pin it
   to 1: a genuine repair *is* a second detector execution and must not be
   reported as a damaged scenario. The idempotency claim is proven instead by
   `npm run check:p2-13-db`, which compares the count — and the whole
   scenario row footprint — across consecutive seeds and requires a delta of
   zero, and which separately asserts that a repair replay is reported
   honestly as `repaired` with the detector-run count visibly moving to 2.
9. **Fixture identities are resolved by admin lookup, never by signing in.**
   `reset` used to find the accounts to delete by authenticating as them,
   which meant a rotated `P2_13_FIXTURE_ACTOR_PASSWORD` left orphan fixture
   accounts behind while reset reported success. Identity resolution now goes
   through the admin API, matched strictly against the deterministic scenario
   emails, so reset removes what it claims to remove.

   Realigning an existing identity's password is a separate, explicit opt-in
   (`P2_13_REALIGN_FIXTURE_ACTORS=true`) rather than automatic behaviour.
   Without it a mismatched password is a hard `PARTIAL_SEED` naming the
   recovery. Automatic realignment would mean any value passing the length
   check silently became the fixture password — a typo would rewrite working
   credentials, and a seed that genuinely could not authenticate would repair
   itself into reporting success, destroying the partial-failure evidence this
   harness exists to produce.

---

## Files

| File | Role |
|---|---|
| `scripts/p2-13-founder-scenario.mjs` | operator CLI (`preflight`/`seed`/`verify`/`reset`/`reseed`) |
| `scripts/p2-13/founder-scenario-manifest.mjs` | deterministic scenario + P2-14 handoff (pure) |
| `scripts/p2-13/isolation-guard.mjs` | fail-closed target classification (pure) |
| `scripts/p2-13/fixture-cleanup.mjs` | reverse-dependency cleanup plan, reset SQL, SQL runner |
| `scripts/p2-13/observability.mjs` | secret redaction + honest stage accounting (pure) |
| `scripts/check-p2-13-db.mjs` | runtime acceptance gate |
| `tests/p2-13-founder-invite-seed-harness.test.mjs` | focused tests for the pure logic |
