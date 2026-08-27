# P0-LAUNCH-03 — Production Runtime & Deployment Acceptance

**Claim boundary: this is LOCAL PRODUCTION-LIKE acceptance, not a real public production deployment.**
See [Scope and what this does not claim](#scope-and-what-this-does-not-claim).

| | |
|---|---|
| Base `main` | `490677d91cfa1ae005eebc182df1b2b44dd1577f` (#588, P0-LAUNCH-02) |
| Branch | `test/p0-launch-03-production-runtime-acceptance` |
| Predecessors | [P0-PKG-09](./p0-pkg-09-downstream-convergence.md) (frozen artifacts), [P0-LAUNCH-02](./p0-launch-02-integrated-founder-acceptance.md) (integrated Founder journey) |
| Focused gate | `npm run check:production-runtime-acceptance` |
| Artifact pins changed | **none** |
| Product code changed | **none** |

P0-LAUNCH-02 proved one integrated Founder journey runs truthfully across the
converged stack — inside a single test process. This increment answers a
different question: **can that accepted stack be built, started, operated,
stopped, restarted and validated through PMFreak's supported production runtime
path?**

---

## 1. What was already present, and what was not

Every gate in this repository whose name contains *production*, *runtime*,
*hardening* or *startup* was, before this increment, a `readFileSync` and a
regular expression over source text:

| Command | What it actually does |
|---|---|
| `check:production-runtime` | asserts ~20 files exist under `src/lib/production-runtime/` |
| `check:runtime-hardening` | asserts ~20 files exist under `src/lib/runtime-hardening/` |
| `check:runtime-contracts` | counts occurrences of `any` in two files |
| `diag:runtime` | three regexes against `bootstrap.ts` and `health/route.ts` |
| `test:launch-smoke` | three more regexes |
| `docs/release/startup-readiness.md` | claimed startup assertions were "enforced by" the two above |

All of them pass with the application unable to boot.

The decisive gap: **`npm run start` was declared in `package.json` and executed
by nothing.** A repository-wide search for `next start` / `npm run start` across
`scripts/`, `tests/`, `.github/` and `docs/release/` returned zero hits, and the
only HTTP evidence in the repository — the P2-14 Playwright journey — points its
`webServer` at `npm run dev`.

What *was* already present and correct, and simply had never been exercised
against a running production process:

* `GET /api/health` — a genuine liveness probe (AOC adapter composition).
* `GET /api/ready` — a genuine **readiness** probe, explicitly distinct from
  liveness: configuration, governance-capability and a real Supabase
  reachability check with a 3 s abort timeout; `200 ready` / `503 not_ready`.
  Its only prior test mocks `globalThis.fetch`, so its database probe had
  **never actually reached a database**.
* `POST /api/login` — a real Supabase SSR session path, drivable without a browser.
* The `PMFreak → Frontera → Protocol` dispatch boundary, reachable over HTTP.

So the missing artefact was the harness, not the product. No product code was
changed by this increment.

---

## 2. The production runtime that was accepted

Next.js **16.3.2**. Per `node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`,
the Node.js server (`next build` + `next start`) is the deployment option with
full feature support, and it is exactly what `package.json` declares.

```
PRODUCTION_BUILD_COMMAND   npm run build     ->  next build
PRODUCTION_START_COMMAND   npm run start     ->  next start --port <port>
BUILD_OUTPUT               .next/            (no output:"standalone", no static export)
PROCESS_MODEL              npm  ->  sh -c "next start --port N"  ->  next-server (v16.3.2)
PORT                       ephemeral, allocated per run
DATABASE                   local disposable Supabase stack (Docker), Kong on 54321
AUTH                       Supabase email/password -> SSR session cookie (sb-*-auth-token)
FRONTERA_STORE             file-backed SQLite, created FRESH per run under the OS temp dir
```

There is no `Dockerfile`, `docker-compose`, or `vercel.json` in the repository,
and no deployment job in CI, so a container harness was not available to reuse;
`next build` + `next start` is the highest-available option in the preference
order and the one the repository actually supports.

### Environment the gate requires

The gate reads `process.env` directly and creates no configuration of its own,
matching every other runtime gate in this repository:

```bash
set -a && . ./.env.local && set +a
npm run seed:p2-13-founder          # PMFreak database state for tenant A (operator, out of band)
npm run check:production-runtime-acceptance
```

Required: `OPERATIONAL_FLOW_TEST_SUPABASE_URL`, `OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY`,
`P2_13_FIXTURE_ACTOR_PASSWORD`, `NEXT_PUBLIC_APP_URL`.

The gate is **deliberately not wired into CI.** It needs a reachable Supabase
stack, the seeded P2-13 tenant state and real credentials; CI has none of those,
and a gate that cannot run there would either fail every build or be quietly
skipped into meaninglessness. It is an operator-run acceptance gate, and
`check:ci-workflow-integrity` validates workflow structure rather than requiring
every `check:*` script to appear in a workflow.

`NEXT_PUBLIC_APP_URL` is required because the product declares it required in
production (`deployment-boundary-registry.ts`) and `/api/ready` enforces it. It
is documented in `.env.example` but was absent from the local `.env.local`, and
the first production start of this increment consequently answered
`503 not_ready — missing: NEXT_PUBLIC_APP_URL`. That is the fail-closed contract
working, and it is reported here rather than papered over.

---

## 3. Results

### The observed run

The gate records what it actually saw and prints it once, at the end, as
`P0_LAUNCH_03_PRODUCTION_RUNTIME_EVIDENCE`. Every value below is also the subject
of an assertion — none of it is narration.

The block below is a verbatim capture from one full run of this gate against the
candidate tree. Pids, ports, build id, decision ids and the store path are
**per-run values and differ on every execution** — they are reproduced here to
show the shape of the evidence and the relationships between the values, not as
constants anyone should expect to see again.

```json
{
  "buildCommand": "npm run build",
  "buildOutput": ".next",
  "buildId": "RKqVltNZH18AEOC0YNftw",
  "startCommand": "npm run start -- --port 41765",
  "processModel": "npm(480750) -> sh -> next-server (v16.3.2)(480762)",
  "port": 41765,
  "healthyAfterMs": 21034,
  "oldPid": 480762,
  "authorityStore": "/tmp/pmfreak-p0-launch-03-SkxgSJ/authority.sqlite",
  "health": "200 ok (7 adapters)",
  "readiness": "200 ready (configuration=pass, governance_capability=pass, database=pass)",
  "governedOperation": "POST /api/operational-flow {operation:dispatch_material_action_to_task}",
  "actionId": "9ddc917e-a1f1-5fb2-a749-390767992af7",
  "allowDecisionId": "enforcement-decision-f4aca092-9096-4204-a173-28b3a36dcc9e",
  "nativeBindingMappedIntoServer": "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
  "activeProtocol": "@aoc/protocol@0.2.0-rc.1",
  "activeFrontera": "@aoc-enterprise/runtime@1.2.1",
  "shutdownMethod": "SIGTERM to the process group",
  "shutdownExitedAfterMs": 850,
  "shutdownSignal": "SIGTERM",
  "orphanProcesses": 0,
  "newPid": 480865,
  "postRestartAllowDecisionId": "enforcement-decision-395109b6-e9aa-48a3-92b9-ad394d705ccc",
  "denyDecision": "409 frontera_denied"
}
```

Read the two decision ids together: `oldPid` 480762 produced
`…f4aca092…`; a **different** process, `newPid` 480865, produced
`…395109b6…` from the same durable store it was handed only the path to; and that
same restarted process then answered `409 frontera_denied` after an operator
revoked out of process. `orphanProcesses: 0` is measured against every descendant
pid recorded before the signal, not assumed.

`25 tests, 25 pass, 0 fail` in ~777 s (the gate builds, and starts eight
production processes — seven that must become healthy, and one deliberately
denied the chance, as a control).

### Build, start, health, readiness

| Item | Result | Evidence |
|---|---|---|
| `A` clean install | PASS | `npm ci` exit 0; both vendored tarballs re-hashed to the frozen sha256 |
| `B` production build | PASS | `next build` exit 0; `.next/BUILD_ID` rewritten by *this* build (stale output is explicitly refused); `routes-manifest.json` carries `/api/health`, `/api/ready`, `/api/login`, `/api/operational-flow` |
| `C` production start | PASS | `npm run start` reaches healthy; the process serving HTTP is `next-server (v16.3.2)`, not npm and not the intermediate shell; startup log carries no dev-server banner |
| `D` liveness | PASS | `GET /api/health` → `200 {"status":"ok","app":"pmfreak", runtime.adapterCount > 0}` including `policyEvaluator` |
| `E` readiness | PASS | `GET /api/ready` → `200 {"status":"ready"}`, all three checks pass — **including a `database` check that reached the real Supabase endpoint**, not a mock |
| `F` database | PASS | authenticated tenant-scoped read returns tenant A's persisted Decisions through the running process |
| `G` auth dependency | PASS | unauthenticated read → `401`; `POST /api/login` → `307` + `sb-*-auth-token`; authenticated read → `200` |

Liveness and readiness are asserted **separately and are not interchangeable**.
`/api/health` answers `200` with the database unreachable; only `/api/ready`
probes it.

### The converged stack, in the running process

| Item | Result |
|---|---|
| `ACTIVE_PROTOCOL` | `@aoc/protocol@0.2.0-rc.1`, sha256 `b0d6ee6f…3a3f60` |
| `ACTIVE_FRONTERA` | `@aoc-enterprise/runtime@1.2.1`, sha256 `6b11e68e…6e0628` |
| `LOCAL_SOURCE_FALLBACK` | NONE — `src/aoc/protocol` and `src/aoc/enterprise` absent |
| `TYPESCRIPT_ALIAS_FALLBACK` | NONE — `tsconfig.json` `paths` is `{"@/*": ["./src/*"]}` only |
| `PRIVATE_FRONTERA_BYPASS` | NONE — no declaration section names a Frontera internal |
| `IN_MEMORY_AUTHORITY_FALLBACK` | NONE — see below |

`package-lock.json` containing the right versions is **not** what is claimed
here, and would not be sufficient. The linkage to the *running* process is:

1. **The native binding is mapped into the server's address space.** The durable
   authority store is opened through `better-sqlite3`, a native module.
   `/proc/<next-server pid>/maps` contains
   `node_modules/better-sqlite3/build/Release/better_sqlite3.node`. A process
   that merely *claimed* to use Frontera's durable store — or that used an
   in-memory one — would not have dlopen'd it.
2. **An operator revocation made OUT OF PROCESS is observed live.** This is the
   centrepiece and is described in the next section.

### `J` — the governed operation

`POST /api/operational-flow {"operation":"dispatch_material_action_to_task"}`
→ `dispatchGovernedMaterialActionToTask` → `authorizeFronteraDispatch` →
`createSqliteKernelAuthorityStore` + `createAocKernel` → decision.

| | Result |
|---|---|
| `ALLOW_DECISION` | `201` carrying `fronteraDecisionId` — a decision id minted by `AocKernel.evaluate()` against the durable, operator-provisioned authority world. PMFreak never mints one, so it cannot be produced without that evaluation returning `allowed`. A canonical Task was created. |
| `DENY_DECISION` | `409 {"disposition":"denied","failureClass":"frontera_denied"}` |

The DENY is the load-bearing one. The revocation is written **by a separate
process, directly to the store file, while the production server keeps running
and is never signalled or told anything**. The very next dispatch through that
same server flips from ALLOW to a policy denial.

A server consulting an in-memory authority world, a cached provider set, or any
store other than the configured one **cannot produce that transition**. It
establishes `H`, `I`, `R` and the DENY half of `J` at once.

The revocation happens **once, and last** — against the already-restarted
server. That ordering is not cosmetic. Frontera's revocation is **terminal by
design**: `decideKernelAuthorityAppend` refuses to re-provision a revoked entity
id, with

> `Revocation is terminal: provision a new entity id rather than reusing a revoked one.`

An earlier draft of this gate revoked before the restart and then tried to
re-provision the same grant, which the authority model correctly refused. The
gate was wrong, not the product — and the corrected ordering is stronger, because
durability is now proven **positively** (authority provisioned before the restart
still authorizes after it) and the live revocation lands on a process that has
already been restarted.

An outage is never banked as governance working: denials assert their exact
`failureClass`, and a mechanical control proves that a `frontera_unavailable`
response **fails** the policy-denial assertion — the same vacuity P0-LAUNCH-02's
review caught as its finding 6.

### `K`–`O` — shutdown, restart, survival

| Item | Result |
|---|---|
| `SHUTDOWN_METHOD` | `SIGTERM` to the process **group** (what a supervisor or `docker stop` does) |
| `CLEAN_SHUTDOWN` | PASS — process exits under SIGTERM in well under a second |
| `ORPHAN_PROCESSES` | **none** — every descendant pid recorded before the signal is gone afterwards |
| `PORT_RELEASED` | PASS — the port stops accepting connections |
| `DURABLE_STATE_INTACT` | PASS — the authority store's sha256 is unchanged across shutdown |
| `RESTART` | PASS — a genuinely new `next-server` pid; the original pid is gone. A same-process reopen would not satisfy this. |
| `POST_RESTART_HEALTH` / `READINESS` | PASS — including the real database check |
| `DURABLE_STATE_SURVIVES` | PASS — the new process was told only the store *path*, and the authority provisioned before the restart **still authorizes**; PMFreak's own Material Action created before the restart is still readable after it |
| `POST_RESTART_GOVERNED_OPERATION` | PASS — the restarted server allows with a **different** decision id (it evaluated afresh against the store rather than replaying), and then observes the out-of-process revocation as a `frontera_denied` |

Session cookies are *not* required to survive: the product does not promise that,
and requiring it would be inventing a contract.

### `P` / `T` — fail-closed configuration

Each control starts its own isolated production process on its own port. No
shared infrastructure is stopped, no credential is damaged, and no tracked file
is mutated — the entire negative-control surface is environment overrides.

| Control | Expected | Result |
|---|---|---|
| Required server secret absent (`SUPABASE_SERVICE_ROLE_KEY`) | `NOT_READY` | `503 not_ready`, `configuration` check fails **naming the variable**, and the response body carries no credential-shaped value |
| Declared dependency misconfigured (`PMFREAK_GOVERNANCE_CAPABILITY_ENABLED=true` with no claim secret) | `NOT_READY` | `503 not_ready`, `governance_capability` check fails |
| Frontera authority store unconfigured | `DEPENDENCY_UNAVAILABLE` | `409 frontera_unavailable` — never `ALLOW`, never a policy answer |
| Frontera authority store **malformed** (a text file, not a database) | legible refusal | `409 frontera_unavailable`; the malformed file is left byte-identical — the runtime does not "repair" it into a store |

> **Why overrides are empty strings, not deletions.** `next start` loads
> `.env.local` itself, and `@next/env` fills any name whose `process.env` value
> is `undefined`. Deleting a variable would therefore let `.env.local` quietly
> put it back and the control would test nothing. An empty string is *defined*,
> survives that merge, and is falsy everywhere the product checks it. This was
> verified against `@next/env`'s `processEnv` implementation.

The first control doubles as the proof that the process is genuinely in
**production mode**: `/api/ready` only demands `SUPABASE_SERVICE_ROLE_KEY` when
`NODE_ENV === "production"`, and it demands it. (`next start` does not export
`NODE_ENV` into the process environment — the value the application sees is
compiled in — so reading `/proc/<pid>/environ` for it would prove nothing either
way, and this gate does not pretend otherwise.)

### `S` — clean-environment reproducibility

The Frontera authority store configured in the developer's `.env.local` is a
leftover from an earlier session. Accepting against it would be accepting against
developer-machine residue, and would make "durable state survived" unfalsifiable.

Every run of this gate creates a **fresh** store under the OS temp directory,
provisions authority into it from scratch, and removes the directory afterwards.

---

## 4. Non-vacuity

Every assertion that could pass while the thing it claims is broken has a
mechanical control:

| Claim | Control | Behaviour |
|---|---|---|
| production start | a start given no chance to become healthy | reported as **not started**, never tolerated |
| health | a probe against a port with nothing listening | rejects |
| readiness fails on dependency loss | governance-capability control above | `503` |
| runtime identity / no local fallback | the same pure guards handed a poisoned tree (an `@aoc/protocol` tsconfig alias, a direct dependency on a Frontera internal, a resolution into `src/aoc/protocol`) | all **throw**; the genuine tree still passes |
| governed DENY is policy, not outage | a `frontera_unavailable` response | **fails** the policy-denial assertion |
| durable state survives restart | the same running product against an **empty** authority store | denies with `frontera_actor_unbound`, and the ALLOW assertion throws |

The local-fallback controls are expressed as *arguments to pure functions*, so no
file in the checkout is mutated to prove they work — nothing has to be restored,
and nothing can be left behind.

---

## 5. Scope and what this does not claim

**This is `LOCAL_PRODUCTION_LIKE_ACCEPTANCE`, not `REAL_PUBLIC_PRODUCTION_DEPLOYMENT`.**

The application was built and started on this machine and exercised against the
disposable local Supabase stack. Nothing was deployed to an internet-facing
environment, no real secret was touched, and no real production database was
contacted.

Known limitations and residual risks:

* **The deployment target is not exercised.** `next.config.ts` names
  `pmfreak-mu.vercel.app`, but there is no `vercel.json` and no deploy job in
  CI. Acceptance here covers the Node.js server path, not a Vercel deployment.
* **The Frontera authority store is a local SQLite file.** That model is sound
  for a long-lived Node.js server. It is *not* portable to an ephemeral
  serverless filesystem, so a Vercel deployment would need a different durable
  authority substrate. That is a deployment-architecture question this increment
  deliberately does not answer or change.
* **`assertProductionEnvSafety()` is never called at startup.** It is
  implemented and unit-tested, but has no caller in `src/` or `scripts/`, and
  there is no `src/instrumentation.ts`. `/api/ready` covers the same ground at
  probe time and fails closed, so this is a hardening gap rather than a
  P0-LAUNCH-03 blocker. Recorded as backlog; boot-time assertion belongs with
  P0-LAUNCH-04's failure/observability scope.
* **`SEC-DEPENDABOT-46`** — the accepted `exceljs` / transitive `uuid` moderate
  advisory — is untouched. `npm run check:beta-release` therefore reports
  **CONDITIONAL GO**, exactly as it did before this increment. This is not a
  plain GO and is not claimed as one.
* The `/proc`-based evidence (server pid identification, mapped native binding)
  requires Linux. Where `/proc` is unavailable the gate **fails** rather than
  skipping — an environment that cannot produce the evidence must never be
  reported as having produced it.

### Not claimed

Not GA-ready. Not production-certified. Not security-complete. Not full disaster
recovery. Not full observability. Not a public beta release. Nothing was
published, tagged, or released.

P0-LAUNCH-04 owns failure, recovery and observability depth.
