# P0-LAUNCH-05 — Founder/Tenant Beta Onboarding & Operational Readiness

Prompt 5 of 6 in the P0-LAUNCH series. Predecessor: [P0-LAUNCH-04 — Failure,
Recovery & Observability Acceptance](./p0-launch-04-failure-recovery-observability-acceptance.md)
(PR #591).

```
BASE_MAIN        336772f2029a91f13a89b7b8cee5a877b316edca
PRODUCTION_RUNTIME  npm run build -> npm run start (next build 16.3.2 -> next start)
FOCUSED_GATE     npm run check:beta-onboarding-operational-readiness
CLAIM            LOCAL_CLOSED_BETA_ONBOARDING_OPERATIONAL_READINESS_ACCEPTANCE
FOCUSED_GATE     npm run check:beta-onboarding-operational-readiness
BETA_ENTRYPOINT  npm run start:closed-free-beta
CLOSED_BETA_AUTHORITY_MODEL  INVITATION_CONTROLLED_TENANT_AUTHORITY
FOCUSED_ACCEPTANCE           40/40_PASS
SUPPORTED_OPERATOR_INVITE_CREATION   PASS
INVALID_OR_DUPLICATE_INVITE_REFUSAL  PASS
FIXTURE_ONLY_INVITE_CREATION         NOT_CLAIMED
PLATFORM_SIGNUP_IS_DISABLED          NOT_CLAIMED
INVITE_ERROR_PRECEDENCE              RESOLVED
```

Frozen package identities, **unchanged** by this increment and re-verified by
`sha256sum` against the working tree at reconciliation time:

| Package | Version | SHA-256 |
| --- | --- | --- |
| `@aoc/protocol` | 0.2.0-rc.1 | `b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60` |
| `@aoc-enterprise/runtime` | 1.2.1 | `6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628` |

Integration contract: `aoc.cross-repository-integration@1.0.1`.

---

## 1. What question this answers, and why it is not P0-LAUNCH-04 again

P0-LAUNCH-04 proved that the accepted production runtime *fails closed and
recovers*. It did not ask whether a **tenant can be brought into the beta and
taken back out again** under governed authority, nor whether the runtime can be
started in a configuration that matches the **adopted closed-free-beta posture**
rather than the billing-bearing production posture the code still declares.

This increment answers three questions the predecessor explicitly deferred to it:

1. **Auth error classification** — `RR-AUTH-ERROR-MISCLASSIFICATION`, assigned to
   P0-LAUNCH-05 by name.
2. **Whether an auth-dependency probe joins the declared readiness set** —
   `RR-AUTH-NOT-IN-READINESS`, "decide in P0-LAUNCH-05".
3. **The boot-time environment contract** — `RR-BOOT-ENV-GUARD`, assigned to
   P0-LAUNCH-05 / P0-LAUNCH-06.

It also adds the missing **offboarding** boundary, without which "onboarding"
acceptance would be a one-way claim.

---

## 2. Focused gate results

```bash
set -a && . ./.env.local && set +a
export NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
npm run check:beta-onboarding-operational-readiness
```

```
# tests 40
# pass 40
# fail 0
EXIT=0
```

Assertions 1-21 are source-contract assertions covering auth-error classification
against the **installed** `@supabase/auth-js` classes, the beta environment
contract, invite/acceptance tenant binding, the protected journey, and the
offboarding decision function. Assertions 22-40 run against a **real server
started through the canonical supported entrypoint**, on one fresh build.

**Non-vacuity.** Assertions 2 and 4 prove an ordinary no-session error is not
accepted as a dependency outage and vice versa. Assertion 13 carries a
wrong-mapping control. Assertion 25 proves the two start refusals are caused by
their injected faults rather than by beta being unstartable. Assertion 30 proves
the auth outage is *scoped* — the database check still passes — so the readiness
transition is attributable to auth alone. Assertion 40 asserts that signup
closure is **not** claimed. Assertions 12, 19, 20 and 23 are `doesNotMatch` or
structural guards that fail if a forbidden construct reappears.

### Evidence-capture integrity

An earlier run reported 38 failures while the background wrapper showed exit 0.
That was an **`EVIDENCE_CAPTURE_DEFECT`, not a harness or gate defect**: the
capture command was a `;`-chain ending in `tail`, so the compound status was
`tail`'s. No pipe or `tee` was involved, so `pipefail` was not the remedy. The
gate itself was always correct — `tsx --test` exited 1 and the persisted log
recorded `EXIT=1` faithfully. The capture shape now propagates `$rc`, and the
acceptance suite was **not** altered to accommodate the wrapper. Both directions
of the invariant have since been observed on real runs:

```
FOCUSED_GATE_HAS_TEST_FAILURES -> PROCESS_EXIT_NONZERO   (observed: 39/40, exit 1)
FOCUSED_GATE_ALL_PASS          -> PROCESS_EXIT_ZERO      (observed: 40/40, exit 0)
```

## 3. Predecessor regression

Reruns were **required, not optional**: `tests/acceptance/support/runtime-acceptance.ts`
is a shared executable harness, and `src/lib/workspace-team.ts` is shared domain
code. Both changed in this increment. The change to the harness is additive and
default-preserving (`script` defaults to `"start"`), but "additive" is a claim
about intent, so it was verified rather than assumed. Reruns were deliberately
deferred until the executable candidate was stable, so they were paid once.

| Gate | Command | Result | Ran against |
| --- | --- | --- | --- |
| Founder launch | `check:founder-launch-acceptance` | 21/21 PASS | not rerun — see below |
| P0-LAUNCH-03 production runtime | `check:production-runtime-acceptance` | **30/30 PASS** | candidate before the invite-precedence patch |
| P0-LAUNCH-05 focused | `check:beta-onboarding-operational-readiness` | **40/40 PASS** | **final candidate** |
| P0-LAUNCH-04 failure/recovery/obs | `check:failure-recovery-observability` | **28/28 PASS** | **final candidate** |

Every result above was read from a TAP summary whose process exit status was
captured directly (`rc=$?` immediately after the gate, nothing between), and all
four agreed: `# fail 0` with `EXIT=0`.

**Founder launch was NOT rerun, and the reason is mechanical rather than
judged.** `tests/p0-launch-02-founder-acceptance.test.ts` contains zero
references to `/api/ready`, `workspace-team`, `workspace_invitations`, the
invitation domain, seat gating, or the shared `runtime-acceptance` harness — it
imports the Frontera enforcement adapter and the operator store. No executable
surface this increment changed is reachable from it, so its 21/21 stands.

**P0-LAUNCH-03 was not rerun after the invite-precedence patch**, for the same
kind of reason: the patch touches only `src/lib/workspace-team.ts`, and both
predecessor suites contain **zero** references to that module, the invitation
domain, seat gating or invitations of any kind. P0-LAUNCH-04 ran after the patch
regardless, so the readiness and failure-recovery contracts are re-proven on the
exact frozen candidate.

### An earlier BLOCKED run, recorded so it is not mistaken for a regression

Before the local Docker stack was available, gates 03 and 04 reported 0/30 and
0/28. All 58 failures carried a **single** cause — `listUsers failed: fetch
failed` — raised in the `before` hook while resolving the real principal, so no
subtest assertion ever executed. The isolation guard itself passed. Those runs
are superseded and are **not** evidence about the code.

## 4. The closed-free-beta profile, proven at runtime

Everything below was produced by one run of the focused gate against a server
started with `npm run start:closed-free-beta`, with
`PMFREAK_OPERATING_PROFILE=closed-free-beta` confirmed in the **running
process** via `/proc` environ — not asserted from source.

```
isolation            LOCAL_ISOLATED @ 127.0.0.1:54321
buildId              IwzTY5OUsnEKrQJiinn9M   (fresh; stale builds are refused)
betaEntrypoint       npm run start:closed-free-beta
runningProfile       closed-free-beta
BETA_PREFLIGHT       ENFORCED — missing_beta_environment; next start never reached
SERVER_ONLY_ENV_BOUNDARY  ENFORCED — refused a secret-shaped NEXT_PUBLIC_ name
VALID_BETA_ENV       STARTS  (healthy after 82.6 s)
STRIPE_REQUIRED      NO — started and live with both Stripe secrets BLANK
```

Stripe variables are blanked rather than deleted: `next start` loads
`.env.local` itself and `@next/env` fills any name whose value is `undefined`, so
a deletion would let the dotenv file put the value back and the control would
prove nothing.

`assertServerOnlyEnvBoundary()` is now **mechanically attributable**. Both it and
the beta contract reject a secret-shaped `NEXT_PUBLIC_` name, so the preflight's
output previously could not show which one ran. `assertClosedFreeBetaEnvSafety`
now tags each throw with a structural `guard` field — no prose matching — and the
preflight reports it. Output stays name-only: guard identity, violation codes,
and a message naming offending variables. **No environment value is echoed.**

## 5. AUTH_IS_BETA_READINESS_DEPENDENCY, exercised

With the beta profile active, using the existing P0-LAUNCH-04 bounded outage
mechanism (path-scoped to `/auth/v1`) — the full P0-LAUNCH-04 failure matrix was
**not** replayed:

| Transition | Observation |
| --- | --- |
| `AUTH_HEALTHY -> READY` | `200 ready (auth=pass)`, four declared checks |
| `AUTH_UNAVAILABLE -> NOT_READY` | `503 not_ready (auth=unreachable)` |
| `AUTH_RECOVERED -> READY` | `200 ready` — **same pid 54964**, no restart |
| liveness throughout | `200 ok` in the same pid, concurrently NOT READY |

Liveness and readiness stay distinct. A non-vacuity control shows the
**database** check still passing during the auth outage, so the readiness
transition is attributable to the auth dependency alone rather than to a general
failure. The probe uses the anon key against GoTrue's anonymous
`/auth/v1/health`: no service-role key, no login transaction — a readiness probe
that logged in would mint sessions as a side effect of being scraped.

Outside the beta profile the check is **absent from `checks` entirely** — the
profile gate is at the call site, not inside `checkAuth`. That detail was got
wrong first time and the full battery caught it: the check was originally wired
unconditionally and returned a passing `auth` entry outside the profile. The
readiness *verdict* was unaffected, but the declared dependency **set** silently
widened for every non-beta consumer, and
`tests/observability-readiness.test.mjs:115` — which pins that set — failed. The
fix was to make the code match the claim rather than to relax the test. So
P0-LAUNCH-04's recorded `authFailureReadiness: 200 ready` remains accurate and
the predecessor contract really is preserved, not merely described as preserved.

## 6. CLOSED_BETA_AUTHORITY_MODEL = INVITATION_CONTROLLED_TENANT_AUTHORITY

The accepted semantic distinction is
**`ACCOUNT_CREATION != BETA_ADMISSION != TENANT_AUTHORITY`**.

**`PLATFORM_SIGNUP_IS_DISABLED` is NOT claimed, because it is not true.**
Platform identity creation remains available under the pre-existing product
posture. `PMFREAK_OPERATING_PROFILE` has exactly two consumers in the tree — the
readiness probe and the environment contract — and gates no signup behaviour.
What P0-LAUNCH-05 claims is narrower and stronger: creating an identity confers
no beta admission, no tenant membership, no role, and no governed authority.

Proven mechanically with a real non-invited identity, through the running server:

| Step | Observation |
| --- | --- |
| identity exists and authenticates | created, logs in |
| no tenant membership | zero `workspace_memberships` rows |
| no tenant role | none resolved |
| tenant read denied | **403** authorization |
| governed tenant operation denied | **403** authorization |
| supported operator invite | `beta:invite-participant` → inspectable pending invitation, role `pm` |
| operator boundary refuses invalid state | duplicate, `owner` role, and non-member inviter all refused |
| real `acceptWorkspaceInvite()` | membership + role `pm` bound from the invite record |
| authority appears | **same session**, tenant read `403 -> 200`, no re-login |
| offboarding | membership removed, tenant read `200 -> 403`, `auth.users` row intact |

The `403 -> 200 -> 403` transition on one unchanged session cookie is the load
bearing evidence: authority is re-derived per request from authoritative
membership, not cached at sign-in.

### Choosing an endpoint that actually discriminates

The probe is `GET /api/execution-tasks?projectId=…`, chosen after verifying all
three states live against this build: anonymous `401`, authenticated non-member
`403`, member `200`. Two candidates were **rejected for proving nothing**, and
the reasons are recorded in the test so the choice is not re-litigated blindly:

* `/api/workspace-team/members` answers **403 even to the workspace OWNER** — its
  governance action is project-scoped but the route threads no `projectId`.
* `/api/portfolio` answers **200 to an authenticated NON-member**, because it
  scopes by the caller's own memberships rather than gating on the requested
  tenant. Had this been used, the gate would have gone green while proving nothing.

## 7. The supported operator invite boundary

No operator boundary for invitations existed — nothing under `scripts/` touched
`workspace_invitations`. `inviteWorkspaceMember` could not be reused directly
because `requireGovernancePermission` and the seat snapshot resolve an
authenticated **HTTP** user and cannot run outside a request.

So the invitation **domain** was extracted, and both callers now share it.
The prior direct-row fixture insertion is **removed, not merely supplemented** —
`FIXTURE_ONLY_INVITE_CREATION=NOT_CLAIMED`. No fixture path supports
`PARTICIPANT_ONBOARDING`:

```
UI / server action (team/actions.ts)
        └─> inviteWorkspaceMember ──┐
                                    ├─> createWorkspaceInvitationRecord
        operator script ────────────┘      (role gate, duplicate rejection,
        (beta:invite-participant)           token generation + hashing, TTL,
                                            persistence, audit event)
```

The operator script reimplements **none** of those rules — verified by absence:
no `token_hash`, no `createWorkspaceInviteToken`, no `hashWorkspaceInviteToken`,
no `resolveInviteTtlHours`, no role helpers, no duplicate message. Its only
contact with `workspace_invitations` is a read-back `select` for inspectability.
Actor authority comes from the product's own `requireWorkspaceInviteActor`.

```bash
npm run beta:invite-participant -- --workspace <uuid> --email <address> \
  --role <pm|admin|viewer> --inviter <email|uuid> [--emit-accept-path]
```

Verified refusals: missing arguments, duplicate active invitation, `--role owner`
(never invitable through this domain), and an inviter with no membership in the
target workspace. It runs the repository's isolation guard **before any
privileged access**, so it cannot be pointed at a hosted target. It writes no
SQL and repairs nothing. The plaintext token exists exactly once and is
**withheld unless `--emit-accept-path`** is passed.

```
SUPPORTED_OPERATOR_INVITE_CREATION   PASS
INVALID_OR_DUPLICATE_INVITE_REFUSAL  PASS
FIXTURE_ONLY_INVITE_CREATION         NOT_CLAIMED
```

Shared domain ownership, in `createWorkspaceInvitationRecord` and nowhere else:
workspace/tenant resolution, role validation, duplicate and invalid invite
rejection, token generation and hashing, persistence, and the `invitation_sent`
audit event.

### INVITE_ERROR_PRECEDENCE = RESOLVED

Extracting the domain silently inverted an existing product behaviour, and it is
recorded here rather than absorbed. On the baseline commit the request path
checked for a duplicate invitation **before** consulting seat accounting; moving
the duplicate check into the shared domain forced the seat check above the domain
call, so a workspace that was both at its seat limit and already holding an
active invitation for that address began answering `Seat limit reached (N)`
where it had answered `An active invitation already exists for this email.`

That is not a cosmetic difference. `requireSeatAvailability`
(`src/lib/feature-gates.ts`) emits a `logGateEvent("exceeded_seat_limit", …)`
governance event when it refuses, so the inverted order also fired a **spurious
seat-limit gate event**, plus a redundant governance permission check and two
count queries, on a path the baseline never reached at all.

Classified **`INCIDENTAL_REFACTOR_REGRESSION`** — no test, runbook, product
contract, UI string or acceptance assertion depended on the new order (the
message is thrown straight through `team/actions.ts` to the user, and the only
assertions naming it are a source-contract regex and an operator-path refusal,
neither order-sensitive), and nothing in the change claimed the precedence was
meant to move.

The fix keeps the domain single-owner. `createWorkspaceInvitationRecord` takes an
optional `assertRequestScopedPreconditions` callback — an injection point exactly
parallel to the client injection it already accepted — invoked **after** the
duplicate rejection and **before** token generation. The request path supplies
the seat check as that callback; the operator boundary passes nothing and
therefore runs nothing, so `FIXTURE_ONLY_INVITE_CREATION=NOT_CLAIMED` and the
documented operator/request difference above are both unchanged. Duplicate
detection is still implemented once, and request-scoped seat state stays outside
the shared domain.

Restored order, identical to the baseline commit:

```
requireWorkspaceInviteActor -> role gate -> requireGovernancePermission
  -> [domain] duplicate -> request-scoped preconditions (seat) -> token/insert/audit
```

**One documented difference from the request path:** the governance-pipeline
permission check and the seat snapshot do not run on the operator path, because
both resolve an authenticated HTTP user. The operator boundary authorises through
the workspace actor role instead. This is stated, not implied.

## 8. What changed in the repository

| Path | Change |
| --- | --- |
| `src/lib/auth/auth-error-classification.ts` | **new** — typed auth-js classification |
| `scripts/check-beta-environment.mjs` | **new** — beta preflight; structural `guard` attribution, name-only output |
| `scripts/beta-invite-participant.mjs` | **new** — supported operator admission boundary |
| `tests/acceptance/p0-launch-05-…test.ts` | **new** — the 40-assertion focused gate |
| `docs/release/p0-launch-05-…md` | **new** — this document |
| `src/lib/security/environment.ts` | beta env contract; wires `assertServerOnlyEnvBoundary`; tags guard attribution |
| `src/lib/workspace-team.ts` | extracts `createWorkspaceInvitationRecord` (+ `assertRequestScopedPreconditions` hook preserving duplicate-before-seat precedence); offboarding decision fn + `removeWorkspaceMember` |
| `src/app/api/ready/route.ts` | profile-gated auth readiness probe |
| `src/app/api/workspace-team/members/route.ts` | `DELETE` offboarding endpoint |
| `src/lib/supabase/proxy.ts`, `src/lib/auth/runtime-auth-continuity.ts` | class-based auth classification |
| `tests/acceptance/support/runtime-acceptance.ts` | optional `script` selector on `startProductionServer` (defaults to `start`) |
| `docs/release/residual-risk-register.md`, `pilot-operational-runbook.md` | reconciled |
| `package.json` | `check:beta-environment`, `start:closed-free-beta`, `check:beta-onboarding-operational-readiness`, `beta:invite-participant` |
| `tests/proxy-routing.test.mjs`, `tests/release-gate-01-…mjs` | typed error doubles; new-contract assertions |

No migration. No schema change. No package version change. No deployment
configuration. No admin UI. `startProductionServer` gained one optional argument
that defaults to the previous behaviour, so every predecessor caller is
unchanged — but because it is a **shared executable harness**, P0-LAUNCH-03 and
P0-LAUNCH-04 were rerun rather than assumed.

## 9. Scope, and what this does not claim

**This is `LOCAL_CLOSED_BETA_ONBOARDING_OPERATIONAL_READINESS_ACCEPTANCE`.**

> A tenant can be admitted to, and removed from, a PMFreak closed free beta
> under governed authority: creating a platform identity confers no beta
> admission, membership, role or governed authority; admission occurs only
> through a supported operator/invitation boundary that binds tenant and role
> server-side; and offboarding removes effective authority while the underlying
> identity may persist. The runtime starts through a supported closed-free-beta
> entrypoint that enforces an environment contract requiring no billing surface,
> refuses to start on an invalid one, and declares authentication a readiness
> dependency whose loss and recovery move readiness while liveness stays truthful.

### Not claimed

Not a beta launch. Not a rehearsal. Not GO. Not high availability. Nothing
deployed, published or tagged. No hosted Supabase contacted. No production
credential or production data used. No participant onboarded.
**`PLATFORM_SIGNUP_IS_DISABLED` is explicitly NOT claimed.**

### Known limitations and residual risks

Dispositions use the normalised vocabulary in `residual-risk-register.md`.

* **`RR-PRODUCTION-ENV-GUARD` — `DEFERRED_TO_P0_LAUNCH_06_WITH_EXPLICIT_REASON`.**
  `assertProductionEnvSafety()` still has **no caller** and is **not wired**;
  this increment does not claim otherwise. Wiring it unchanged would refuse to
  start the accepted beta posture, since it requires Stripe secrets the closed
  free beta deliberately does not have. Split out of `RR-BOOT-ENV-GUARD` so the
  beta contract and the full-production contract carry separate dispositions.
* **`RR-BETA-PREFLIGHT-BYPASSABLE` — `DEFERRED_TO_P0_LAUNCH_06_WITH_EXPLICIT_REASON`.**
  The supported local start boundary *does* enforce the preflight (assertion 22).
  The remaining bypass is a bare `next start`, a deployment topology this
  increment does not claim; the runbook marks it **UNSUPPORTED**.
* **`RR-BETA-PLATFORM-SIGNUP-OPEN` — `ACCEPTED_FOR_CLOSED_BETA`.** Release
  implication: **none** for the accepted authority model.
* **The operator invite path skips the request-scoped governance and seat
  checks**, by necessity — both resolve an authenticated HTTP user. Documented in
  §7, not implied away.
* **One machine, one local stack.** No multi-instance, load-balancer or
  platform-failover behaviour is covered. Local disposable credentials are used
  by the harness.
* **`SEC-DEPENDABOT-46`** is untouched, so `check:beta-release` remains
  **CONDITIONAL GO**, as at P0-LAUNCH-04. Not a plain GO and not claimed as one.
* **`RR-CRLF-LOCAL` — no longer a limitation; RESOLVED.** This was previously
  registered as a real, reproducible problem: 8 source-scanning tests failed on a
  CRLF working copy, and P2-15 proved it independent of any code change. It is
  **not** being claimed that the issue never existed. It is no longer
  reproducible on this checkout because the prescribed mitigation is already
  present on `main` — `.gitattributes` with `* text=auto eol=lf`, landed in
  P0-LAUNCH-01 (`40a7c222`). The final full battery ran the whole
  `tests/*.test.mjs tests/*.test.ts` glob, which contains all 8, with zero
  failures, and the working tree holds zero CRLF-terminated tracked source files.

```
LOCAL_NPM_TEST        PASS   (13366 tests, 13349 pass, 0 fail, 17 skip, exit 0)
RR_CRLF_LOCAL         RESOLVED
NEW_TEST_FAILURES     0
```

  The 17 skips are unrelated PMF-004 concurrency tests requiring a local
  Postgres admin socket; each carries its own enablement disclosure.

## 10. Candidate identity: technical freeze vs documentation head

The executable candidate was frozen and proven **before** the documentation was
reconciled, and the reconciliation that followed was doc-only. Those are two
different identities and this document does not conflate them.

```
TECHNICAL_FREEZE      the executable candidate the final battery ran against
                      14 executable paths + package-lock.json + 2 vendor tarballs
                      byte-identical before and after the doc reconciliation
                      (17 hashes compared, 0 differences)

DOCUMENTATION_HEAD    the post-battery documentation state; supersedes the docs
                      hashes recorded at freeze time, which are stale by design
                      because RR-CRLF-LOCAL was reconciled only AFTER the
                      battery mechanically disproved its premise

TECHNICAL_CANDIDATE_CHANGED   NO
DOC_ONLY_RECONCILIATION       YES
LOCAL_FINAL_BATTERY_RERUN     NOT_REQUIRED
```

The final battery therefore remains authoritative for the executable candidate:
no product, test, harness, script or configuration byte changed after it ran, and
`package-lock.json`, both vendored tarballs, and the migration tree are untouched.

P0-LAUNCH-06 owns the final beta rehearsal and the GO/NO-GO decision. It should
**rehearse** the proven beta profile and re-confirm the authority boundary, not
be the increment that first proves either.
