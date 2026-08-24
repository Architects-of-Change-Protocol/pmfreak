# P0-PKG-05 — PMFreak governance ownership resolution

**Status: BLOCKED — ownership resolved, acceptance not executable in this environment.**

The ownership blocker P0-PKG-04 handed forward is **closed**: all 44 symbols have a final
disposition, the pseudo-upstream trees are gone, and every static, build and test gate
passes from the committed state. What is **not** closed is the acceptance evidence.
`THREE_REPOSITORY_INTEGRATION` remains **NOT_CLAIMED**, because the P2-14 Founder browser
journey could not be re-run here and the claim requires it.

```
PROTOCOL_PACKAGE_INTEGRATION          = PASS   (preserved and re-verified)
FRONTERA_PACKAGE_INTEGRATION          = PASS   (preserved and re-verified)
PMFREAK_GOVERNANCE_OWNERSHIP_BOUNDARY = PASS   (this increment)
PMFREAK_FOUNDER_JOURNEY               = NOT_RE-RUN  (environment; see below)
THREE_REPOSITORY_INTEGRATION          = NOT_CLAIMED
```

**Source commit:** `6fb9d0739ad701769015debd23653b5e91665777`
**Ownership map digest (SHA-256):** `2f0594b9ad642f5ecd8343489c1fae542c6fbdb757a9448aa2421ec407f41431`

## Why acceptance could not be executed

P2-14 needs a live disposable PMFreak stack: a real Supabase project (auth, PostgREST, RLS)
plus the app, so a real invited actor can authenticate in a real browser. This environment
cannot provide one.

What was tried, in order:

| Step | Result |
|---|---|
| `OPERATIONAL_FLOW_TEST_*` env | Absent — the DB gates self-skip with an explicit message |
| Docker daemon | **Started successfully** (`dockerd` 29.3.1) |
| Supabase CLI | Installed (`2.115.0`) |
| `supabase start` | **Failed** — every image blob returns `403 Forbidden` |
| `curl https://pkg-containers.githubusercontent.com/` | `CONNECT tunnel failed, response 403` |
| `curl https://ghcr.io/v2/` | `401` (reachable; registry auth only) |
| Docker blob CDN `production.cloudfront.docker.com` | `403 Forbidden` |

The registry itself is reachable; the **image blob CDNs are not allowlisted by the agent
proxy**. `/root/.ccr/README.md` classifies this as report-don't-work-around, so no attempt
was made to disable TLS verification or bypass the proxy. Chromium and Playwright are both
present and ready — the missing piece is the database and auth stack, not the browser.

**This is an environment limitation, not a finding about the code.** No gate failed, no test
regressed, and no ownership question is unresolved. The acceptance simply has to run
somewhere a Supabase stack can start.

## What the acceptance must confirm before the claim is made

Run from this exact commit, on a stack with `OPERATIONAL_FLOW_TEST_*` configured:

```
npm ci
npm run seed:p2-13-founder
npm run check:p2-13-db
npm run check:p2-14-db
npm run check:operational-flow-db
npm run check:fresh-db-migrations     # with FRESH_DB_URL set
npm run test:e2e:p2-14                # 17/17 Founder checkpoints
```

The Founder journey is the load-bearing one. It exercises the renamed governance path end
to end: `evaluateGovernanceAction` → approval routing → `governance_approval_requests` →
action → task → outcome, through the packaged Protocol boundary. Unit and contract tests
cover the pieces; only the browser story proves the chain.

## Ownership resolution — the 44 decisions

Machine-readable: [`governance-ownership.lock.json`](../../governance-ownership.lock.json),
validated by `npm run check:governance-ownership`. Reasoning:
[ADR-PMF-075](../adr/ADR-PMF-075-pmfreak-governance-ownership.md).

| Disposition | Count |
|---|---|
| `CANONICAL_UPSTREAM` | 3 |
| `PMFREAK_DOMAIN` | 18 |
| `PMFREAK_PORT` | 10 |
| `PMFREAK_PERSISTENCE_PROJECTION` | 8 |
| `PMFREAK_IMPLEMENTATION` | 5 |
| `PMFREAK_ADAPTER` | 0 |
| `REMOVED_DEAD` | 0 |
| **TOTAL** | **44** — 0 unresolved |

`PMFREAK_ADAPTER` is 0 because PMFreak's adapter layer (`src/lib/aoc/adapters/`) already
existed and was never part of the blocker inventory. The 44 are what the pseudo-upstream
trees held.

## Behavioural and persistence parity — mechanically proven

Not asserted; verified by comparing the committed source against `HEAD~1`:

- **Governance evaluation and authority policy.** Applying only the recorded identifier
  renames to the old `governance-core.ts` and diffing against the new file yields **no
  difference**. `GOVERNANCE_POLICY_REGISTRY`, the guard order, every denial reason, the
  approval-routing rules and the audit emission are byte-identical. No allow/deny outcome
  can have changed.
- **Persisted claim vocabulary.** All six claim version strings and the `aoc-local` default
  trust domain are byte-identical, including the deprecated `pmfreak-capability-claim-v*`
  values that keep already-stored claims verifiable.
- **Persisted audit vocabulary.** All 18 `GovernanceAuditEventType` member strings are
  byte-identical.
- **No database surface touched.** No migration, schema, RLS policy or `.sql` file appears
  anywhere in the diff.

```
DATABASE_SCHEMA_CHANGED   = NO
MIGRATION_ADDED           = NO
RLS_CHANGED               = NO
SERIALIZED_VALUES_CHANGED = NO
AUDIT_HISTORY_REWRITTEN   = NO
EVENT_VOCABULARY_CHANGED  = NO
```

## Verification executed from the committed state

| Check | Result |
|---|---|
| `npm ci` | PASS — no `--force`, no `--legacy-peer-deps`, no `npm link` |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; 620 pre-existing warnings, unchanged) |
| `npm test` | **PASS — 13,308 tests, 13,291 pass, 0 fail, 17 skipped** (baseline 13,281/13,264/0/17) |
| `npm run build` | PASS |
| `npm run check:governance` | PASS (full chain) |
| `npm run check:packaged-aoc-artifacts` | PASS — reports both trees `absent (removed)` |
| `npm run check:package-purity` | PASS |
| `npm run check:release-readiness` | PASS |
| `npm run check:runtime-hardening` | PASS |
| `npm run check:db-contract` | PASS (static) |
| `npm run check:fresh-db-migrations` | PASS (static); fresh-apply SKIPPED — no `FRESH_DB_URL` |
| `check:p2-13-db`, `check:p2-14-db`, `check:operational-flow-db` | **SKIPPED — no live stack** |
| `npm run test:e2e:p2-14` | **NOT EXECUTED — no live stack** |

Test count rose by 27: 25 new negative controls plus 2 boundary tests that became 4 when
re-expressed. Nothing was removed or weakened.

## Artifact provenance at the final commit

| | `@aoc/protocol` | `@aoc-enterprise/runtime` |
|---|---|---|
| Version | `0.2.0-rc.0` | `1.0.0` |
| Expected SHA-256 | `dbe8a08f…d10445e5` | `53d9e6ce…45a2de` |
| Actual SHA-256 | `dbe8a08f…d10445e5` ✓ | `53d9e6ce…45a2de` ✓ |
| Exports fingerprint | `a67d65b1…` ✓ | `2b0ee1e3…` ✓ |
| Resolved path | `node_modules/@aoc/protocol/dist/contracts/index.js` | `node_modules/@aoc-enterprise/runtime/dist/src/index.js` |

Neither upstream repository was modified. No public export was widened.

## Source-tree cleanup

```
src/aoc/protocol                      ABSENT
src/aoc/enterprise                    ABSENT
tsconfig paths -> src/aoc/*           0
@pmfreak/aoc-protocol-internal        0
@pmfreak/aoc-enterprise-internal      0
active src/aoc references in code     0
```

`src/aoc/` retains only `runtime-consumer/` and `runtime/adapters/` — PMFreak's genuine AOC
integration layer. Neither declares, aliases or resolves a canonical package name.

## Every import from the canonical packages

| File | Specifier | Declared export key | Purpose |
|---|---|---|---|
| `src/lib/governance/authority/capability-claims.ts:12` | `@aoc/protocol/canonical` | `./canonical` | `canonicalizeJSON` — canonical serialization profile for claim signing |
| `src/lib/governance/authority/persistence/records.ts:18` | `@aoc/protocol` | `.` | `WorkspaceId`, `ProjectId`, `AgentId` |
| `src/lib/aoc/protocol/types.ts:15` | `@aoc/protocol` | `.` | re-export of the same three identifiers |
| `scripts/check-packaged-aoc-artifacts.mjs:283` | `@aoc/protocol/canonical` | `./canonical` | gate: load-and-execute verification |
| `scripts/check-packaged-aoc-artifacts.mjs:296` | `@aoc-enterprise/runtime/runtime` | `./runtime` | gate: entrypoint presence verification |

All five are declared public export keys. **Zero deep or private imports.**

### Known limitation: Frontera has no product consumer

**No PMFreak source file imports `@aoc-enterprise/runtime`.** The artifact is installed,
checksum-pinned, loaded and gate-verified, but only the verification gate touches it.

P0-PKG-05 deliberately did not manufacture a consumption point. The nearest Frontera
surfaces — `evaluateEnforcementPipeline`, `enforceEnforcementPipeline`,
`orchestrateAuthorization` — take `AuthorizationGrantInput` (`requestId`, `actorId`,
`capability: CapabilityToken`, `consentGrants`, `access`, `tenantId`, `orgId`) and return
`{ allowed, reasonCodes, audit }`, verified directly against the installed artifact.
PMFreak's pipeline takes a route-level `GovernanceEvaluationInput` and returns a decision
with `decisionId`, `trace`, `riskLevel` and approval routing. Binding them to make the
dependency look real is exactly the defect this increment removes.

This is worth stating plainly: `FRONTERA_PACKAGE_INTEGRATION=PASS` means the artifact is
correctly installed, pinned and loadable — **not** that PMFreak's product code depends on
it. Closing that gap is real follow-up work and is not in scope here.

## Gates added, with negative controls

| Gate | Proves | Controls |
|---|---|---|
| `check:aoc-packages` | No manifest, alias, workspace or directory impersonates a canonical name; neither removed tree returns | 9 |
| `check:governance-collisions` | A canonical name may be imported but never declared locally | 6 |
| `check:governance-ownership` | All 44 decisions present, unambiguous, and true of the source | 10 |
| `check:packaged-aoc-artifacts` | Pre-existing P0-PKG-04 gate | 14 (preserved) |

**39 negative controls total**, in `tests/packaged-aoc-artifact-gate.test.mjs` (14,
unchanged) and `tests/governance-ownership-gate.test.mjs` (25, new). The P0-PKG-04 gate's
fixture was made self-contained — it used to read the real `src/aoc/*/package.json`, which
no longer exist — so its legacy-copy controls still fire if a copy is ever reintroduced.

The collision gate found three ambiguities on its **first run**, outside the original 44:
`CapabilityPermission` and `CapabilityResourceType` in `src/lib/security/capability-flow.ts`
(narrower duplicates of PMFreak's own vocabularies) and `AgentId` in
`src/lib/pmo/pmo-tenant-types.ts` (a `"scope" | "timeline" | …` union, not an identifier).
All three renamed; member sets unchanged.

## Removed publication path

`src/aoc/protocol` and `src/aoc/enterprise` carried `publishConfig` and a workflow that ran
`npm publish` from those directories on an `aoc-v*` tag. With the directories gone that
workflow would have published *PMFreak source under the canonical names*. Removed:

- `.github/workflows/aoc-packages-publish.yml`, `.github/workflows/aoc-packages-version-check.yml`
- `build:aoc`, `build:aoc:protocol`, `build:aoc:enterprise`, `check:publish-integrity`,
  `check:build-reproducibility`, `publish:dry-run`, `check:publish-ready`
- `scripts/publish-dry-run.mjs`, `scripts/check-build-reproducibility.mjs`,
  `scripts/validate-publish-ready.mjs`

Nothing was published. No tag was created. No release was created.

## Deferred P2-15 debt (untouched)

`auth-session-continuity.spec.ts › no GET of /logout ends the session` — this Next.js
runtime answers `307` to append `_rsc` before the `405`. Reproduced identically on the
pre-integration baseline. P2-15-owned, not touched here and not worsened.

## Semantic invariants

Unaffected by this increment — no evaluation logic changed:

```
Recommendation            != Decision
Decision                  != Material Action
Action                    != Task
Task completion           != Outcome achievement
DEMO_FIXTURE              != LIVE
correlation               != causation
PMFreak persistence projection != canonical Protocol contract   (now enforced by name)
```

The last line is new, and is the point of the increment: `CapabilityGrantRecord` can no
longer be mistaken for `CapabilityGrant`, and the collision gate keeps it that way.
