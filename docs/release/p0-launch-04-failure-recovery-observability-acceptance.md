# P0-LAUNCH-04 — Failure, Recovery & Observability Acceptance

Prompt 4 of 6 in the P0-LAUNCH series. Predecessor: [P0-LAUNCH-03 — Production
Runtime & Deployment Acceptance](./p0-launch-03-production-runtime-acceptance.md)
(PR #590).

```
BASE_MAIN        da98079f5ca574ca6976c9d14f6f225aec443f08
PRODUCTION_RUNTIME  npm run build -> npm run start (next build 16.3.2 -> next start)
FOCUSED_GATE     npm run check:failure-recovery-observability
CLAIM            LOCAL_PRODUCTION_LIKE_FAILURE_RECOVERY_ACCEPTANCE
```

Frozen package identities, unchanged by this increment:

| Package | Version | SHA-256 |
| --- | --- | --- |
| `@aoc/protocol` | 0.2.0-rc.1 | `b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60` |
| `@aoc-enterprise/runtime` | 1.2.1 | `6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628` |

Integration contract: `aoc.cross-repository-integration@1.0.1`.

---

## 1. What question this answers, and why it is not P0-LAUNCH-03 again

P0-LAUNCH-03 proved the supported production runtime can be built, started,
operated, stopped, restarted and validated, and that it fails closed when a
dependency is absent. Every claim it makes is about a runtime whose dependencies
are in a **fixed state for the life of the process**: its database-outage control
is a process *born* with its database unreachable, its fail-closed controls are
processes *born* misconfigured, and its restart is a clean, cooperative SIGTERM.

P0-LAUNCH-04 asks what that leaves open:

> When something operationally meaningful **breaks under a running process**,
> does PMFreak fail in the right way, expose enough truthful evidence to diagnose
> **what** broke, and **recover** when the dependency returns — without silently
> degrading governance or needing its durable state repaired by hand?

Nothing P0-LAUNCH-03 already proved is re-asserted here. What is genuinely new:

| # | New claim | Why P0-LAUNCH-03 could not make it |
| --- | --- | --- |
| 1 | `READY → lost → NOT READY → restored → READY` across **one pid**, both directions timed | Its outage is decided at preload time from an env var; the process can never get the dependency back |
| 2 | An **isolated authentication** outage — database held UP | PostgREST and GoTrue sit behind one gateway on one host:port, so a socket-level outage cannot separate them |
| 3 | An authority backing that is **unavailable rather than absent**, then restored, with contents proven byte-identical | Its store controls are *unconfigured* and *malformed* — neither can be recovered from, because there is nothing to restore |
| 4 | **Abnormal** termination (SIGKILL), then a new process governing with the state the killed one left | Its restart is a graceful SIGTERM with shutdown hooks running |
| 5 | The four-way governed matrix on one store: ALLOW → `frontera_unavailable` → ALLOW → `frontera_denied` | It proves the endpoints of that matrix, never the transitions between them |
| 6 | Failure signals asserted **distinguishable from one another** | It asserts individual failure classes, never that an operator can tell them apart |
| 7 | Redaction proven with **marker secrets the redaction layer does not recognise** | Its redaction assertion is one credential-*shaped* pattern in one readiness body |

The gate reuses P0-LAUNCH-03's lifecycle rather than reimplementing it — see §7.

---

## 2. Failure-injection method, and the isolation guard

`tests/acceptance/support/dependency-outage-shim.cjs`, installed into one
production server via `NODE_OPTIONS=--require`. Availability is a **control file**
the harness creates and deletes while the server runs, re-read on every attempt,
so an outage can be switched in both directions inside a single process.

Two scopes, for one reason: the local Supabase stack puts PostgREST (`/rest/v1`)
and GoTrue (`/auth/v1`) behind **one gateway on one host:port**.

* **Socket scope** — refuses every outbound TCP connection to that host:port, the
  way a stopped service refuses one. This is P0-LAUNCH-03's mechanism, and its
  `destinationOf` normalisation is reused unchanged, including the ARRAY case
  `net.createConnection` (and therefore undici, and therefore `fetch`) actually
  calls with. A shim that missed that case would pass every `fetch` straight
  through and the outage would be imaginary.
* **Path scope** — refuses `fetch` for `/auth/v1` only, rejecting with the shape
  undici produces for an unmakeable connection. Supabase's auth client turns that
  into `AuthRetryableFetchError` with **status 0** — a transport failure, not a
  401 — which is exactly the distinction the product's own auth paths branch on.
  Separate containers behind one gateway is the real deployment shape, and one of
  them failing while the other serves is the real failure this reproduces.

The Frontera authority outage uses neither: the store's **directory** is made
unreadable (`chmod 000`), so SQLite cannot open the file or create its sidecars,
and the store's bytes are provably untouched on the other side.

Abnormal termination is `SIGKILL` to the process group, delivered through the
same `shutdownProductionServer` path every other process in both gates uses, so
orphan and zombie accounting stays honest.

Every refusal announces itself on stderr, so the harness proves from the
**server's own log** that the dependency was reached for and refused — rather
than that some earlier check happened to fail first and the outage was never
exercised at all.

### Local isolation, before the first privileged access

This gate opens a service-role admin client **and deliberately breaks the
reachability of the Supabase host it is pointed at**. Doing either against a
hosted project would be unacceptable, so the repository's canonical guard
(`scripts/p2-13/isolation-guard.mjs`, SEED mode) runs first: literal loopback
host, the disposable local API port, equality with the URL the application is
configured with, and an independent refusal of known hosted host shapes. It is a
pure function over the environment, so "before any network access" is a property
of the call's position, not a hope about timing.

### Environment the gate requires

```bash
set -a && . ./.env.local && set +a
export NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000   # absent from .env.local; see P0-LAUNCH-03 §2
npm run seed:p2-13-founder                          # operator, out of band
npm run check:failure-recovery-observability
```

Requires `OPERATIONAL_FLOW_TEST_SUPABASE_URL`,
`OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY`, `P2_13_FIXTURE_ACTOR_PASSWORD`,
`NEXT_PUBLIC_APP_URL`, plus the P2-13 isolation-guard variables already present in
the canonical `.env.local`. Linux is required: the `/proc`-based process evidence
**fails** rather than skips where `/proc` is unavailable — an environment that
cannot produce the evidence must never be reported as having produced it.

```
NON_ROOT_LINUX_REQUIRED=YES
```

**The gate refuses to run as root**, checked before any privileged access. The
Frontera authority outage is a *permission* denial (`chmod 000` on the store's
directory); under UID 0 that denies nothing — root traverses the directory and
opens the file — so a root run would assert `frontera_unavailable` against a
perfectly readable store. Independent review raised this for root-run containers.
The response is to refuse such an environment rather than build a second outage
mechanism for it, applying the same rule this gate already applies to `/proc`: an
environment that cannot produce the evidence must not be reported as having
produced it. **No root-container portability is claimed.** The production child
inherits the uid, so the parent check covers it.

The socket scope normalises host comparison for **IPv6 loopback**: a URL carries
it bracketed (`[::1]`) while Node reports the socket destination as bare `::1`, so
an exact comparison would accept such an environment and then silently match
nothing — blocking and resetting no sockets while the gate believed an outage was
installed. Only brackets and case are normalised; a pure control proves `[::1]`
matches `::1` and that unrelated hosts stay apart.

One `next build` serves every scenario. Several isolated processes run from that
one validated build, so a failure is attributable to runtime behaviour rather
than to compilation drift between scenarios.

---

## 3. Startup env safety — the P0-LAUNCH-03 carry-forward, resolved

P0-LAUNCH-03 recorded that `assertProductionEnvSafety()`
(`src/lib/security/environment.ts:142`) is implemented and unit-tested but has
**no caller**, and handed the boot-time question to this increment.

```
STARTUP_ENV_SAFETY_CONTRACT        READINESS_IS_CURRENT_PILOT_GUARD
ASSERT_PRODUCTION_ENV_SAFETY_WIRED NO
ASSERT_PRODUCTION_ENV_SAFETY_STATUS DEFERRED_GOVERNANCE_CONTRACT_DECISION
```

**It is not wired, and the reason is not a technical one.** The technical
obstacles were investigated and are absent:

* `src/instrumentation.ts` `register()` **is** the supported Next 16.3.2 startup
  hook — called once per server instance, completing before requests are served
  (`node_modules/next/dist/server/next-server.js:578`).
* It is **not** run during `next build`:
  `node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js`
  returns early when `NEXT_PHASE === 'phase-production-build'`, with that exact
  comment. So wiring it could not break a build.
* CI would be unaffected: `.github/workflows/ci-governance.yml` runs neither
  `npm run build` nor `next start`.

What blocks it is that the repository holds **two adopted, mutually inconsistent
positions** about what production requires:

| Source | Position |
| --- | --- |
| `src/lib/security/deployment-boundary-registry.ts:61`, `environment.ts:97` (Perilla 10) | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **required in production** |
| `docs/release/pilot-capability-set.md` (**Adopted**, Founder-owned) | Closed **free** pilot, participants on the **free plan**, no billing surface |

`getRuntimeEnvironment()` returns `"production"` for any `NODE_ENV=production`
with `VERCEL_ENV` unset — which is exactly what `next start` is. So wiring the
guard unchanged would refuse to start a closed-free-pilot deployment, and the
local production-like runtime P0-LAUNCH-03 accepted, over billing secrets neither
has any use for. `.env.local` carries no `STRIPE_SECRET_KEY` and no
`STRIPE_WEBHOOK_SECRET`.

The function's checks also split across two enforcement points, and the
repository's documentation names both: the server secrets are runtime-resolved
and belong at startup, while the `NEXT_PUBLIC_*` checks concern values Next
**inlines at build time**, which is why `pilot-operational-runbook.md` claimed a
*build* hard-fail. No caller exists at either point.

**Founder decision:** this is a configuration-contract decision, not a runtime
defect. `/api/ready` remains the intended runtime fail-closed guard for the
pilot path, and §4 proves it fails closed under real dependency, configuration
and process failures. Carried to P0-LAUNCH-05 / P0-LAUNCH-06 as
`RR-BOOT-ENV-GUARD`. `PRODUCTION_REQUIRED_SERVER_SECRETS` is **not** narrowed
here, and no `src/instrumentation.ts` is added here.

Corrected as part of this increment: `pilot-operational-runbook.md` §2 claimed
"production build hard-fails on localhost values (`assertProductionEnvSafety`)".
Nothing rejects a localhost value today — `/api/ready` checks only that
`NEXT_PUBLIC_APP_URL` is *present*. The checklist now says to verify the public
URLs by hand and points here.

What no caller covers today, recorded so it is not mistaken for covered:
`STRIPE_*` presence, `NEXT_PUBLIC_APP_URL` validity and localhost rejection, and
platform-injected secret-shaped `NEXT_PUBLIC_*` names (that last is covered
statically over `src/**` by `tests/production-deployment-boundary.test.mjs`, but
not against values the hosting platform injects).

`assertServerOnlyEnvBoundary()` — the sibling runtime tripwire in the same file,
which the Perilla-10 documentation describes as "the belt to the source-scan's
suspenders" — has **no product caller either**, only the same unit test. It
belongs to the same deferred decision and is recorded here so P0-LAUNCH-05/06
resolves both together rather than discovering the second one later.

---

## 4. Scenario results

### The observed run

The gate records what it actually saw and prints it once, at the end, as
`P0_LAUNCH_04_FAILURE_RECOVERY_EVIDENCE` and
`P0_LAUNCH_04_OPERATOR_SIGNALS`. Every value below is also the subject of an
assertion in the gate — none is narrated.

```
isolation                 LOCAL_ISOLATED, 127.0.0.1:54321
dependency under test     127.0.0.1:54321
production processes      6 started, 0 orphaned, 0 unreaped
focused gate              27 cases, 27 PASS
```

#### A — the healthy control state

| | |
| --- | --- |
| liveness | `200 ok` |
| readiness | `200 ready` (`configuration=pass, governance_capability=pass, database=pass`) |
| governed operation | ALLOW, with a real `fronteraDecisionId` |

This is a control, not a claim: it exists so every transition below has a
"before".

#### B / C — database loss and recovery, on ONE pid

| Step | Observed |
| --- | --- |
| T0 READY | `200 ready`, database `pass` |
| T1 dependency lost | socket outage installed; established sockets **reset** and new connections refused |
| T2 NOT READY | `503 not_ready`, `checks.database = fail / "unreachable"`, `checks.configuration` still `pass` — **detection 85 ms** |
| T2 liveness | `200 ok` — unchanged, on the same pid |
| T2 governed write | refused, `HTTP 401`, no Task created, no Frontera decision id |
| T3 dependency restored | flag cleared |
| T4 READY | `200 ready`, database `pass` — **recovery 808 ms** |
| T4 governed write | ALLOW, fresh `fronteraDecisionId` |

`PID_T0 == PID_T4` (pid 110325 in the recorded run). No restart, no redeploy, no
signal: the process that reported NOT READY is the process that became READY.
The 85 ms / 808 ms figures are evidence that failure and recovery are
**bounded**; they are not SLOs and must not be read as any.

Correlation was proven on the failure itself, not in the abstract: a
caller-supplied `x-request-id` was echoed on the `503` **and** appears on the
server's own `readiness_check_failed` record, whose `checks` name the database.
An operator holding a failed request can find the reason for **that** request.

#### D — an isolated authentication outage, and recovery

The database was held **up** throughout (readiness stayed `200 ready` with
`database=pass`), so every result below is attributable to authentication alone.
`/auth/v1` was reached for and refused — proven from the server's own log.

| Claim | Observed |
| --- | --- |
| no new authentication | login refused; **no session cookie established** |
| no unauthenticated access | anonymous read `401`; anonymous governed write refused |
| no authority for an existing session | governed write refused, `HTTP 401` |
| not mistaken for policy | `failureClass` is **not** `frontera_denied` |
| a forged session is not a way in | a **fabricated** session cookie was redirected away from the protected page |

**Operator classification — the claim independent review corrected.**
Fail-closed was never the question; being able to tell WHY was. A bare `401` is
exactly what an ordinary unauthenticated caller receives, so
`PRODUCT_HTTP` does **not** distinguish "nobody is logged in" from "nobody CAN
be verified" — and this document does not pretend otherwise.

`getAuthUser()` now records `auth_dependency_unavailable` when auth-js returns
its **transport error class**. The classification is on the class, not the status
code, and that detail is the whole of it: `AuthSessionMissingError` carries status
**400**, so the widely-copied "not 401/403 means network" test — which
`src/lib/supabase/proxy.ts` and `src/lib/auth/runtime-auth-continuity.ts` both
still use — treats *every* anonymous request as a network error and therefore
cannot make this distinction at all. Keying on the class makes the signal quiet:
it cannot fire on ordinary anonymous traffic.

Reproduced against one process, with availability as the only variable, and a
caller holding a **verifiable session**:

| Dependency | HTTP | `auth_dependency_unavailable` |
| --- | --- | --- |
| up | `200` | absent |
| down | `401` | present, `error_code=AuthRetryableFetchError`, `operation=getAuthUser` |

The signal survives stripping every `P0_LAUNCH_04_*` line from the capture, so it
is PMFreak's own evidence and not the harness's. The shim's
`P0_LAUNCH_04_PATH_OUTAGE_BLOCKED` marker proves the failure was *injected* and is
explicitly **not** accepted as product observability.

**The honest limit of that claim.** A caller with **no session** is still not
distinguishable, and cannot be: auth-js answers `AuthSessionMissingError`
*locally* and never issues a request, so the product has no dependency failure to
classify. Nothing is concealed by this — no authority is conferred either way. So
the supported claim is not "auth outages are diagnosable" but **"auth outages are
diagnosable on any request that requires verifying a session"**, which is the
operationally meaningful case.

The two page-fallback rows above are the other nuance that matters. `src/proxy.ts` and
`runtime-auth-continuity.ts` deliberately fall back to an unexpired **local**
session on a transport error, so a momentary Supabase hiccup does not bounce a
genuinely authenticated user to `/login`. That is product behaviour with a stated
rationale at both call sites, it is page-routing only, it announces itself, and
it requires a session that already exists. The API and governed paths resolve
their principal through `getUser()` **only** and have no such fallback — which is
why an established session still loses governed authority. A forged cookie gains
nothing.

Recovery: a **new** login succeeded, the tenant-scoped read returned `200`, and
the governed dispatch returned ALLOW. The gate does not require the *old* session
to survive, because the product contract does not promise that and asserting it
would be inventing a guarantee.

#### E / F — the governed four-way matrix, one store, in order

| State | Governed result | `failureClass` |
| --- | --- | --- |
| healthy | ALLOW | — |
| authority backing **unavailable** (`chmod 000` on its directory) | `409 denied` | `frontera_unavailable` |
| backing **restored** | ALLOW | — |
| policy **revoked** out of process | `409 denied` | `frontera_denied` |

Store digest `917a62a7…` was identical **before** the outage and **after** the
restore: availability was lost and regained without the contents changing, so
"the same durable authority became usable again" is distinguishable from "the
authority was quietly re-provisioned". The digest for the recovery step is read
after the restore and *before* the dispatch, because a successful evaluation is
entitled to write to Frontera's own store — comparing after a dispatch would
confuse the two claims.

Operator side, from the server's own structured log: the outage was recorded with
`failureClass=frontera_unavailable`, reason code
`FRONTERA_EVALUATION_UNAVAILABLE`, the governed action id and the tenant context.
The policy denial was recorded with `failureClass=frontera_denied` and Frontera's
own evaluation reason codes. Neither crosses the HTTP boundary — a caller gets
the narrow failure class and nothing further.

Revocation is last because Frontera's revocation is **terminal** by design: a
revoked entity id can never be re-provisioned, so a gate that revoked earlier and
then expected the grant back would be asserting against semantics the authority
model deliberately forbids.

#### G — abnormal termination

| | |
| --- | --- |
| signal | `SIGKILL` to the process group — no shutdown hook, nothing flushed |
| old pid | 110406 |
| new pid | 110454 |
| port | released by the killed process, reused by the replacement |
| durable store digest | **unchanged** across the kill |
| post-crash liveness | `200 ok` |
| post-crash readiness | `200 ready` |
| post-crash authentication | login succeeded, session established |
| post-crash governed operation | ALLOW, fresh `fronteraDecisionId` |
| manual repair | **none** — the harness performs no store operation between the kill and the recovery |
| process residue | 0 orphans, 0 unreaped |

That the ALLOW came from surviving state rather than from a governed path that
would have allowed anyway is established by the empty-store control (§6): a real
but empty Frontera store cannot produce an ALLOW.

#### H — broken production-required configuration

Two independent defects in one process: a production-required server secret
absent, and the authority backing unconfigured. Per the §3 contract the expected
behaviour is `STARTS_BUT_NOT_READY`, and that is what was observed.

| Claim | Observed |
| --- | --- |
| deterministic and bounded | reached a settled state inside the startup deadline; no hung process, no hung request |
| liveness truthful | `200 ok` — independent of configuration readiness |
| legible reason | `503 not_ready`, `checks.configuration = fail / "missing: SUPABASE_SERVICE_ROLE_KEY"` |
| the **name**, never the value | no credential-shaped value anywhere in the readiness body |
| fails closed | anonymous read `401` |
| **no silent substitution** | the governed path reported `frontera_unavailable` rather than degrading to an in-memory authority it could have satisfied |
| no residue | process stopped cleanly through the shared shutdown path |

#### K — secret safety of failure output

**The redaction-control child is sanitized, and that is a correction.**
Independent review found that `productionEnv()` spreads `process.env`, so this
child inherited the harness's own real `OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY`
and `P2_13_FIXTURE_ACTOR_PASSWORD`. The capture is only searched for the
synthetic marker, so a failure path that logged one of those inherited values
would have passed unnoticed — while this document claimed no real credential was
present. It was not true as written.

The four acceptance-only credentials the product never reads are now blanked in
that child (emptied, not deleted, so `.env.local` cannot refill them), verified
from the child's **own** `/proc/environ` rather than from the object handed to
`spawn`, and the parent's real values are additionally proven absent from the
child's entire environment block under any name. The capture is then checked for
both the marker **and** those real values. Values are compared, never printed.

The truthful boundary for the whole gate: **no production credential is used and
no production database is contacted.** Local *disposable* acceptance credentials
ARE used by the harness — that is what makes it a real acceptance run — and the
redaction-control child is the one process from which they are removed, because
it is the process whose output is being certified.

The marker shape is deliberately one the product's redaction layer does **not**
recognise — not `sk_live_`, not `whsec_`, not JWT-shaped, not `Bearer`, not
`service_role`. The claim therefore rests on the product **never echoing a secret
value**, rather than on shape-based scrubbing catching it afterwards.

Result: the marker appears in **none** of the four captured surfaces — the
server's stdout+stderr, the `/api/health` body, the `/api/ready` body, or the
governed failure body. The other half of the contract — that a *missing* variable
is still **named**, because a fail-closed answer that names nothing is not
actionable — is proven by H above. Names are not secrets; values are.

---

## 5. The observability contract

Seven material classes, each required to produce a signal, and each signal
required to be **distinguishable from every other**. Seven classes that all
surfaced as "503" would satisfy a presence check and tell an operator nothing.

Every signal declares its SOURCE, and the source is asserted. A shim marker in
the server log proves the harness **injected** a failure; it says nothing about
what PMFreak shows an operator in production. So a class whose only evidence is
`HARNESS_CONTROL` is **not** diagnosable, and a control proves that rule fires.

| Class | Source | Signal an operator can act on |
| --- | --- | --- |
| `DATABASE_UNAVAILABLE` | `PRODUCT_HTTP` + `PRODUCT_LOG` | readiness `503 not_ready`, `checks.database.status=fail`, `detail="unreachable"`; logged as `readiness_check_failed` carrying the request id |
| `AUTH_UNAVAILABLE` | `PRODUCT_LOG` | `auth_dependency_unavailable` with `error_code=AuthRetryableFetchError` from `getAuthUser`, while HTTP stays a bare `401` and readiness stays `200` with `database=pass` |
| `FRONTERA_UNAVAILABLE` | `PRODUCT_HTTP` + `PRODUCT_LOG` | governed `409 denied`, `failureClass=frontera_unavailable`; logged with `FRONTERA_EVALUATION_UNAVAILABLE` and the action id |
| `POLICY_DENIED` | `PRODUCT_HTTP` + `PRODUCT_LOG` | governed `409 denied`, `failureClass=frontera_denied`; logged with Frontera's own evaluation reason codes |
| `STARTUP_CONFIGURATION_FAILURE` | `PRODUCT_HTTP` | readiness `503 not_ready`, `checks.configuration.status=fail` naming the missing **variable**, never its value, while liveness stays `200` |
| `PROCESS_TERMINATION` | `PRODUCT_PROCESS` | the process group exits on the signal, the listening port is released, and the replacement answers on a **different pid** |
| `RECOVERY_COMPLETE` | `PRODUCT_HTTP` | readiness `200 ready` with `database=pass`, and a governed dispatch returning a fresh `fronteraDecisionId` |

The gate asserts pairwise distinctness AND that every class carries at least one
`PRODUCT_*` source, so a future change that collapsed two of these into one
answer — or that left a class provable only from harness evidence — would fail it.

`AUTH_UNAVAILABLE` is the only class resting on a single source. That is
deliberate: distinguishing it over HTTP would mean telling an unauthenticated
caller something about the state of the authentication dependency, so the status
code stays a bare `401` and the classification lives in the log.

### Operator diagnosability

| Failure | What failed | What exposed it | What restored it | Same state, or restart? |
| --- | --- | --- | --- | --- |
| Database loss | Supabase reachability | readiness `503` + `readiness_check_failed` log | restoring reachability | **same process**, no restart |
| Authentication loss | GoTrue reachability | login failure + `401` on every protected path + fallback warning in the log | restoring reachability | **same process**, new login |
| Authority backing loss | Frontera SQLite availability | governed `409` `frontera_unavailable` + server log | restoring readability | **same process**, same store |
| Policy revocation | operator decision, not a fault | governed `409` `frontera_denied` + server log | *nothing* — revocation is terminal by design | n/a |
| Broken configuration | production-required variable | readiness `503` naming the variable | correcting the configuration | restart (configuration is read at start) |
| Abnormal termination | the process | port closed, health unanswerable | starting a new process | **restart**, durable authority intact |

This is evidence sufficient to *write* an operator runbook. It is not itself a
runbook — human procedures belong with P0-LAUNCH-05's operational readiness
scope.

### What this increment did NOT change about observability

No OpenTelemetry, no dashboards, no alerting, no external observability platform,
no new logging architecture. `RR-MONITOR` (no external monitoring/alerting
integration) is untouched and remains open.

---

## 6. Non-vacuity

Ten mechanical controls, each requiring an assertion this gate depends on to
**fail** when the thing it claims is broken. All ten pass.

| # | Control | What it would catch |
| --- | --- | --- |
| 1 | With no outage installed, the same probe reports the database **reachable**, and both control flags are proven absent | An "outage" that was really a broken probe |
| 2 | With the database genuinely blocked, waiting for READY **fails**, boundedly | A readiness observer that returned success regardless — which would make both the failure and the recovery claim vacuous |
| 3 | An anonymous governed write during the auth outage is refused, and the fail-closed assertion is shown to **reject** a successful dispatch | An authentication bypass passing unnoticed |
| 4 | `asGovernedInfrastructureFailure` **rejects** `frontera_denied`, and rejects an ALLOW | An outage banked as governance working |
| 5 | `asGovernedPolicyDenial` **rejects** `frontera_unavailable` | A policy denial and an outage collapsing into one class |
| 6 | The same-pid assertion is shown to reject `OLD_PID == NEW_PID` | A "restart" that never restarted |
| 7 | A **real but empty** Frontera store produces no ALLOW | "Durable state survived" being true of a governed path that would allow regardless |
| 8 | The redaction assertion **fails** on deliberately poisoned output, and still accepts clean output | An absence assertion that cannot detect a presence |
| 9 | `boundedFetch` against a socket that **accepts and never answers** fails inside its deadline | An unbounded wait hanging exactly when the dependency is broken |
| 10 | The process-residue detector sees a live process and then sees it go | Every orphan count being zero for the wrong reason |
| — | Zero orphaned and zero unreaped processes across **every** production process, with the long-lived server stopped and accounted for BEFORE the ledger is read | The gate itself leaking process-table residue — and, as independent review found, the ledger being read before the last shutdown had happened at all |

### Closures from independent review of PR #591

Five threads were raised on the pushed head; all five are closed here, grouped.

| Finding | Closure |
| --- | --- |
| **P1** — the residue ledger was read BEFORE the long-lived server was stopped, so a leak from that shutdown would be appended after the test had already passed. The claim covered five of six processes and said six. | The long-lived server is now stopped inside the residue test, through the same shared `shutdownProductionServer`, awaited, its own orphans/unreaped asserted, `server` cleared so `after()` cannot double-stop it — and only then is the ledger read. **The same defect was present in P0-LAUNCH-03 and is closed there identically**, since both share the lifecycle. |
| **P2** — the redaction-control child inherited the harness's REAL service-role key and fixture password, so a claim in this document was false. | The child environment is sanitized; see §4/K. |
| **P2** — `chmod 000` denies nothing under UID 0, so a root run would assert an outage against a readable store. | The gate refuses to run as root; see §2. No root portability is claimed. |
| **P2** — bracketed IPv6 loopback (`[::1]`) would never match Node's bare `::1`, so the outage would install nothing while the gate believed it had. | Host comparison is normalised, with a pure control; see §2. |
| **P2** — the page-level fallback signal was recorded either way, so its absence failed nothing while this document reported it as observed. | **Removed from the acceptance claim.** That path already carries `RR-AUTH-ERROR-MISCLASSIFICATION` and belongs to P0-LAUNCH-05; `AUTH_UNAVAILABLE` rests solely on the asserted product signal. The forged-cookie negative is kept, because it proves absence of a bypass. |

### Two defects this found in its own harness

**The auth-distinction test compared the wrong two cases.** Its first version put
an *anonymous* caller on both sides of the comparison and asserted the product
would classify the outage. It failed, correctly: with no session cookie auth-js
resolves `AuthSessionMissingError` **locally** and never issues a request, so
neither side reaches the dependency and there is nothing to classify. The test now
holds a **verifiable session** constant and varies only availability, which is
both the provable case and the operationally meaningful one. Recorded because the
first version would have "passed" had the product logged indiscriminately — the
failure is what established that the signal is quiet.

### A defect this found in its own injection mechanism

Run 1 of this gate **failed** case B: readiness correctly reported the database
unreachable while a governed dispatch in the **same process** succeeded and
created a Task.

The cause was the injection, not the product. `Socket.prototype.connect` is
called once per TCP connection, and undici keeps connections **alive** per origin
and reuses them, so refusing `connect` leaves every already-established socket
fully working — the readiness probe needed a new connection and was refused,
while the Supabase client reused a pooled one. During that "outage" the database
was still, demonstrably, reachable.

A service that stops does both things: it refuses new connections **and** drops
the ones it was holding. The shim now tracks established sockets to the blocked
destination and resets them when the outage is switched on, and case B asserts
from the server's own log that the reset enforcement actually ran. Classified
`HARNESS_DEFECT`; recorded here because it is exactly the vacuity this section
exists to catch, and because P0-LAUNCH-03's shim has the same limitation — which
is harmless there only because its process is *born* with the block, so no
connection is ever established.

---

## 7. What changed in the repository

```
PRODUCT_CODE_CHANGED          YES  (src/lib/auth.ts only — see below)
STARTUP_WIRING_CHANGED        NO
DATABASE_SCHEMA_CHANGED       NO
MIGRATIONS_CHANGED            NO
RLS_CHANGED                   NO
AUTH_ARCHITECTURE_CHANGED     NO
PACKAGE_PINS_CHANGED          NO
UPSTREAM_REPOS_CHANGED        NO
NEW_DEPENDENCIES_ADDED        NO
OBSERVABILITY_PLATFORM_ADDED  NO
```

**One product file changed: `src/lib/auth.ts`, +29 lines of which 8 are code.**

Independent review found that the auth-outage claim rested on fail-closed
behaviour alone, with no product-visible way to tell an unreachable dependency
from an ordinary unauthenticated caller — an `OBSERVABILITY_DEFECT`, since the
harness marker proves only injection. The narrowest closure was taken: one
import, one destructured `error`, and one guarded `logger.error` in
`getAuthUser()`.

What did **not** change: the return value, so authentication and authorization
semantics, tenant scoping and every fail-closed path are untouched, and a
transport failure still cannot read as an authenticated user. Nothing branches on
the new value. Only the error class and status are recorded — never the
provider's message — and the logger redacts regardless. `src/proxy.ts` does not
import `src/lib/auth.ts`, so the edge bundle is unaffected. P0-LAUNCH-03 was
re-run **after** this change and still passes 30/30.

Everything else in the increment is test harness, one `package.json` script, and
documentation.

| Path | Change |
| --- | --- |
| `tests/acceptance/support/runtime-acceptance.ts` | **new** — the production-runtime lifecycle, `/proc` evidence and governed-decision vocabulary, **extracted verbatim** from P0-LAUNCH-03 |
| `tests/acceptance/support/dependency-outage-shim.cjs` | **new** — the toggleable, two-scope dependency outage |
| `tests/acceptance/p0-launch-04-failure-recovery-observability.test.ts` | **new** — the failure/recovery/observability gate |
| `tests/acceptance/p0-launch-03-production-runtime-acceptance.test.ts` | −551/+28 — declarations replaced by imports; **no assertion changed** |
| `src/lib/auth.ts` | **+29/-0** — `getAuthUser()` classifies an auth-dependency transport failure; return value unchanged |
| `package.json` | +1 script: `check:failure-recovery-observability` |
| `docs/release/p0-launch-04-…-acceptance.md` | **new** — this document |
| `docs/release/pilot-operational-runbook.md` | corrected the false build-hard-fail claim (§3) |
| `docs/release/startup-readiness.md` | records that `/api/ready` is the runtime guard and points here |
| `docs/release/residual-risk-register.md` | **+4 rows**: `RR-BOOT-ENV-GUARD`, `RR-AUTH-NOT-IN-READINESS`, `RR-AUTH-ERROR-MISCLASSIFICATION`, `RR-READINESS-NOT-A-GOVERNED-GATE` |

### Why P0-LAUNCH-03 was touched at all

P0-LAUNCH-04 needs the same process lifecycle and the same decision vocabulary.
Copying ~500 lines into a second acceptance file would give the two gates two
subtly diverging definitions of "the production process came down cleanly" —
precisely the drift these gates exist to catch. One definition, two callers.

The extraction is **mechanical and verifiable**: 519 moved lines are
byte-identical to what P0-LAUNCH-03 was accepted with, apart from the `export`
keyword and one added accessor (`productionProcessesStarted()`, so a caller
cannot capture the process count at import time and report zero). No assertion,
message or deadline was altered. No production code imports the support module,
and nothing in it reads test state — every function is pure or parameterised by
its caller. P0-LAUNCH-03 still passes 30/30.

---

## 8. Scope, and what this does not claim

**This is `LOCAL_PRODUCTION_LIKE_FAILURE_RECOVERY_ACCEPTANCE`.**

The strongest claim the evidence above supports:

> PMFreak's locally accepted production runtime has passed failure, recovery and
> observability acceptance across the converged Republika stack. Material
> database, authentication, Frontera-authority, configuration and process
> failures fail closed with distinguishable operator-visible signals; supported
> dependency restoration or process restart returns the runtime to a
> healthy/ready governed state without silent development fallback or loss of
> contractually durable authority.

### Not claimed

Not high availability. Not disaster-recovery certified. Not zero downtime. Not
full observability. Not production SLA ready. Not a public production
deployment. Not GA ready. Nothing was published, tagged or released.

### Known limitations and residual risks

* **One machine, one process, one local stack.** Every failure was injected into
  a single `next start` process on this machine against the disposable local
  Supabase stack. Nothing was deployed to an internet-facing environment, no
  production credential was used, and no production database was contacted. Local
  disposable acceptance credentials ARE used by the harness. Multi-instance
  behaviour, load-balancer interaction and platform-level failover are untested.
* **The detection and recovery timings are bounds, not SLOs.** 85 ms and 808 ms
  are evidence that the transitions complete inside a deadline on an idle local
  machine. They are not performance commitments and no load was applied.
* **Readiness is advisory, not a governed gate** — `RR-READINESS-NOT-A-GOVERNED-GATE`.
  A `NOT READY` instance still serves. Governed writes failed closed in every
  state exercised here because the failing dependency was *on* their path, not
  because readiness gated them.
* **An authentication-only outage does not fail readiness** —
  `RR-AUTH-NOT-IN-READINESS`. This matches the documented dependency set and
  fails closed, but a load balancer following readiness alone would keep routing
  to an instance that can authenticate nobody.
* **No boot-time environment rejection** — `RR-BOOT-ENV-GUARD`, §3.
* **A pre-existing auth-error misclassification was found and deliberately NOT
  fixed.** `src/lib/supabase/proxy.ts` and
  `src/lib/auth/runtime-auth-continuity.ts` both treat "status is not 401/403" as
  "network error". `AuthSessionMissingError` carries status **400**, so every
  ordinary anonymous request takes the network-error branch — costing a redundant
  `getSession()` call and logging `missing_session` identically for an outage and
  for a caller who simply is not logged in. This increment routes around it
  (classifying on the error class instead) rather than changing those call sites:
  they sit on the page-routing session-fallback path, and altering that is auth
  behaviour, not observability. Recorded for P0-LAUNCH-05.
* **An auth outage is not diagnosable for a caller with no session** — by
  construction, not by omission. See §4/D.
* **`AUTH_UNAVAILABLE` has no HTTP signal**, deliberately: distinguishing it by
  status code would disclose dependency state to unauthenticated callers.
* **The Frontera authority store is a local SQLite file.** Sound for a long-lived
  Node server, and this increment proves it survives an abnormal kill. It is not
  portable to an ephemeral serverless filesystem. Unchanged and out of scope here.
* **The deployment target is not exercised.** No `vercel.json`, no deploy job in
  CI. This covers the Node.js server path, not a Vercel deployment.
* **`/proc`-based evidence requires Linux.** Where `/proc` is unavailable the gate
  **fails** rather than skipping — an environment that cannot produce the evidence
  must never be reported as having produced it.
* **`SEC-DEPENDABOT-46`** — the accepted `exceljs` / transitive `uuid` moderate
  advisory — is untouched. `npm run check:beta-release` therefore reports
  **CONDITIONAL GO**, exactly as it did before this increment. This is not a plain
  GO and is not claimed as one.
* **`RR-CRLF-LOCAL`** — on this Windows/WSL checkout 8 pre-existing
  source-scanning tests fail on CRLF line endings, independent of this increment.
  Known, documented, and unrelated to anything here.

P0-LAUNCH-05 owns beta onboarding and operational readiness. P0-LAUNCH-06 owns
the final beta rehearsal and the GO/NO-GO decision.
