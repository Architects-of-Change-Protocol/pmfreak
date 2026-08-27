# P0-LAUNCH-02 — integrated Founder launch acceptance

Proves a real Founder launch journey on the converged Protocol → Frontera → PMFreak stack.

This is **not** a packaging increment. The artifact identities below were frozen by P0-PKG-09
(`docs/release/p0-pkg-09-downstream-convergence.md`) and are consumed here unchanged — no pin
moved, no upstream repository was touched.

| | |
|---|---|
| PMFreak baseline | `6fd1ee0d019a5fa939220d007a1b1148c1214dc2` |
| `@aoc/protocol` | `0.2.0-rc.1` · `b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60` |
| `@aoc-enterprise/runtime` | `1.2.1` · `6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628` |
| Integration contract | `aoc.cross-repository-integration@1.0.1` |

---

## What already existed, and what was actually missing

The pieces of this story were already proven — but in three places, at three layers:

- `tests/frontera-enforcement-boundary.test.ts` — ALLOW, DENY, cross-organization isolation,
  SQLite durability and external revocation, against the real packaged runtime.
- `tests/e2e/p2-14-founder-story.spec.ts` — the authenticated two-tenant Founder browser journey.
- `npm run check:packaged-aoc-artifacts` — the installed tree matches `vendor/aoc-consumer.lock.json`.

What no single command proved is that **the same process performing the governed decisions is the
one resolving the pinned artifacts**. "The launch stack is converged" was an inference across three
commands rather than one claim. That gap — not a missing capability — is what this increment closes.

No parallel harness was built. `tests/p0-launch-02-founder-acceptance.test.ts` composes the existing
operator-side provisioning surface (`scripts/frontera-authority-provisioning.mjs`, including the
`revokePmfreakDispatchAuthority` primitive that already existed) and the real product enforcement
path (`authorizeFronteraDispatch`). Nothing stubs a decision: every ALLOW and DENY is produced by the
genuine `AocKernel` reading a genuine durable `KernelAuthorityStore`.

---

## Acceptance matrix

| | Item | Where proven | Result |
|---|---|---|---|
| A | Authenticated Founder | P2-14 browser journey, STEP 01/02 | PASS |
| B | Tenant binding | P2-14 browser journey, STEP 04/05 | PASS |
| C | Authority provisioning through the packaged surface | integrated acceptance | PASS |
| D | Positive authorization (ALLOW) | integrated acceptance + browser STEP 11 | PASS |
| E | Negative authorization (DENY) | integrated acceptance + browser NEGATIVE tests | PASS |
| F | Tenant isolation | integrated acceptance + browser Tenant A/B, both directions | PASS |
| G | Revocation → subsequent denial | integrated acceptance | PASS |
| H | Audit / evidence **retrieved** from the durable trail | integrated acceptance + browser STEP 17 lineage/audit export | PASS |
| I | Persistence across store restart | integrated acceptance (file-backed SQLite) | PASS |
| J | Runtime package identity | integrated acceptance | PASS |

### The Founder journey, executed

Run in the documented order against real infrastructure — real Supabase authentication, a real
seeded scenario, and real operator-side Frontera provisioning:

```
npm run seed:p2-13-founder -- preflight   EXIT 0
npm run seed:p2-13-founder -- reseed      EXIT 0
npm run seed:p2-13-founder -- verify      EXIT 0
npm run provision:founder-frontera        EXIT 0
npm run test:e2e:p2-14                    37 passed (4.1m)
```

The provisioning step bound a real principal to a real Frontera actor, with minimum authority:

```
organization      a766e43a-…   (PMFreak workspace)
external subject  pmfreak:a9c84de6-…
frontera actor    actor-a766e43a-…-a9c84de6-…
trust domain      trust-domain-a766e43a-…
action            execute.material-action
resource scope    project:060659c6-…
tenant B          NONE — dispatches nothing; isolation is the point
```

The Frontera actor id is **not** the PMFreak user id. The binding is explicit, and the integrated
acceptance asserts that inequality so an identity pun could never satisfy it.

### Revocation and post-revocation denial

The integrated acceptance provisions, asserts ALLOW, revokes through the packaged operator surface,
and asserts the **same** action is then denied. The pre-revocation ALLOW is asserted inside the
revocation test itself — a revocation test that never saw an allow proves nothing.

### Persistence

The authority store is a file-backed SQLite database under the OS temp directory, opened and closed
around every decision. An in-memory store would make durability a fiction, so the test asserts the
file exists before claiming the property.

### Runtime package identity

Asserted from the acceptance process's own module resolution, not from a separate gate: installed
name and version match the consumer lock, the vendored tarballs re-hash to the recorded SHA-256, the
installed `integration-contract.json` agrees with the lock at `1.0.1`, both packages resolve inside
`node_modules/`, `src/aoc/protocol` and `src/aoc/enterprise` do not exist, and no private
`@aoc-enterprise/*` implementation package is a direct PMFreak dependency.

The Protocol assertion additionally excludes `0.2.0-rc.0` **by name**. Equality against the lock
alone would still pass if the lock itself regressed to the burned candidate.

---

## Review hardening (PR #588)

Seven P2 findings, all against this acceptance gate rather than the product. Each was reproduced
before anything was changed. No product code, database, migration, RLS, auth implementation or
package pin was touched; the browser journey and the upstream artifacts stayed frozen.

Every finding was the same species of defect: **a way for the gate to pass vacuously.**

| # | Defect | Fix |
|---|---|---|
| 1 | Identity was compared only against the mutable consumer lock, so pins and lock moving together were accepted | An **immutable `LAUNCH_BASELINE` literal** owned by this increment; the lock is checked *against* it, not trusted as the source of truth |
| 2 | Hashing the tarball and separately resolving `node_modules` never proved the install came from those bytes | The installed tree is **content-fingerprinted** against an extraction of the verified tarball |
| 3 | The private-package guard read only `dependencies` and `devDependencies` | Every declaration section is guarded, including `optionalDependencies` and `peerDependencies` |
| 4 | "H covered" rested on a non-empty decision id — correlation, not evidence | The **durable authority audit trail is read back** from a reopened store |
| 5 | Redaction was asserted on an *unbound* principal, which returns before the actor is ever loaded | Redaction is asserted on the **bound Founder's policy denial**, against the known provisioned identifier **values** |
| 6 | Every negative case accepted any `allowed === false`, so an outage satisfied them | Each denial asserts its **exact failure class and reason codes** |
| 7 | "Minimum authority" checked only that ids came back | The **persisted grant and capability token are read** and their effective capability set asserted exactly |

A second review round on the hardened commit found two more of the same species, both fixed:

| # | Defect | Fix |
|---|---|---|
| 8 | `package-lock` integrity was compared against the consumer lock — two mutable values that agree when changed together, while `npm ci` rejects the install with `EINTEGRITY` | The SRI is **derived from the verified tarball bytes** and both records are checked against it and against the immutable baseline |
| 9 | Durability closed and reopened the store **inside one process**, which cannot distinguish a durable store from module-level state that merely created the file | The post-provision authorization is repeated in a **fresh child process** that receives nothing but the store path |

Finding 8 was reproduced exactly as described: with the integrity falsified coherently in both locks the
acceptance still passed, while `npm ci` failed with `EINTEGRITY`.

### Exact denial semantics, established empirically

Probed against the real runtime before being asserted, so the test encodes the product's actual
contract rather than an assumption:

| Case | `failureClass` | `reasonCodes` |
|---|---|---|
| ALLOW | — | `ACTION_ALLOWED` |
| Ungranted project scope | `frontera_denied` | `AUTHORITY_CAPABILITY_MISSING`, `POLICY_ACTION_PROHIBITED` |
| Tenant isolation | `frontera_actor_unbound` | `FRONTERA_ACTOR_UNBOUND` |
| Post-revocation | `frontera_denied` | `AUTHORITY_CAPABILITY_REVOKED`, `POLICY_ACTION_PROHIBITED` |
| **Induced outage** | `frontera_unavailable` | `FRONTERA_EVALUATION_UNAVAILABLE` |

The last row is asserted as a **negative control**: an outage must never satisfy an authorization
criterion. Before the fix, it would have satisfied E, F and G.

### Minimum authority, as actually persisted

Read from the store rather than inferred from behaviour, because the adapter only ever asks for one
action — a grant broadened to ten would answer identically:

```
authority-grant  grant-…  capability material-action.dispatch
                          actions        ["execute.material-action"]      exactly
                          resourceScopes ["project:<PROJ_A>"]             exactly
capability-token cap-…    same capability, actions and scopes
```

Exact set equality, no wildcard, no reach into the second project, and no third authority record.

### Durable evidence, actually retrieved

`listEvents` on a **reopened** store returns the immutable, sequenced audit trail for each entity:
the provisioning event (crediting the operator, describing the governed action and scope) and,
after revocation, the revocation event — with the original provisioning still present, because the
trail is append-only.

The enforcement-decision audit *export* remains owned by P2-14 STEP 17 against PMFreak's canonical
store; it is referenced, not duplicated here.

### Negative controls

Each broken deliberately, the acceptance confirmed to FAIL, then restored:

| Broken condition | Result |
|---|---|
| Protocol pin moved off rc.1 | FAILS |
| Protocol lock moved to **rc.2** (a coordinated forward drift) | FAILS |
| Frontera lock regressed to **1.2.0** | FAILS |
| Integration contract moved to **1.0.2** | FAILS |
| `node_modules` content altered while name and version stay correct | FAILS |
| Private Frontera package declared via **`optionalDependencies`** | FAILS |
| Provisioning **broadened** with one extra action | FAILS |
| Local fallback `src/aoc/protocol` reintroduced | FAILS |
| Vendored tarball checksum altered | FAILS |
| Store made unavailable | **does not count as a denial** |
| Integrity falsified **coherently in both locks** | FAILS |
| Child process pointed at a non-existent store | FAILS |

Tenant isolation and revocation remain structurally non-vacuous in addition: each is paired with a
positive assertion in the same file that would fail first if the capability were absent — the
revocation test asserts the ALLOW before revoking.

---

## Scope

No database, migration, RLS, auth-implementation, UI or package-pin change. The only repository
changes are the new acceptance test, its npm script, and this document.

## Residual risks, unchanged

`check:beta-release` remains **CONDITIONAL GO** on the accepted dependency-security residual risk;
SEC-DEPENDABOT-46 is deliberately untouched by this increment. `npm run lint` reports 620 warnings
and 0 errors, all pre-existing.

## Not claimed

Protocol rc.1 remains a release candidate, not GA. Frontera 1.2.1 remains unpublished. This
increment does not close all security risk, and it is not a GA readiness claim — it is evidence that
one integrated Founder journey runs truthfully on the converged stack.
