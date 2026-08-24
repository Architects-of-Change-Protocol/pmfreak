# P0-PKG-04 — PMFreak Consumes the Frozen Packaged AOC Artifacts

**Status: BLOCKED.** The packaged-artifact integration below is complete and verified — the
frozen artifacts are installed, pinned and executing, and the complete P2-14 Founder journey
re-ran and passed across them. The increment is nevertheless **not closed**: PMFreak still
contains active governance symbols whose ownership and public contract cannot yet be mapped
cleanly to the frozen Protocol / Frontera package surfaces.

**`THREE_REPOSITORY_INTEGRATION` is NOT claimed.** See
[`p0-pkg-04-blocker-symbol-ownership.md`](./p0-pkg-04-blocker-symbol-ownership.md) for the
exact blocker: the complete 44-symbol inventory, its classification, the `@pmfreak/*` alias
deviation, and the recommended follow-up increment. Everything recorded in this document
stands and is unaffected by that blocker.

---

## What changed

PMFreak's repository-local dependency declarations

```
"@aoc/protocol":            "file:src/aoc/protocol"
"@aoc-enterprise/runtime":  "file:src/aoc/enterprise"
```

are replaced by the exact frozen packaged artifacts produced and verified upstream:

| | `@aoc/protocol` | `@aoc-enterprise/runtime` |
| --- | --- | --- |
| Version | `0.2.0-rc.0` | `1.0.0` |
| Source repository | `Soberania-Protocol/Soberania_Protocol` | `Soberania-Protocol/Soberania-Enterprise` |
| Source commit | `dde34517d956156a0c735c18a805763a5e712879` | `11edd06e7d6ea38ae0bc037e91854444b84a50a7` |
| Merged via | PR #387 → `7ce27f1b` | PR #111 → `7d8b6baa` |
| Tarball | `vendor/aoc-protocol-0.2.0-rc.0.tgz` | `vendor/aoc-enterprise-runtime-1.0.0.tgz` |
| SHA-256 | `dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5` | `53d9e6ce4f3ba8fd82bbd90ebe5bc53f8bffb597b0d11bfd22d9a1ba5245a2de` |
| Exports fingerprint | `a67d65b17dcb34c7da84d9a07cb893e073e21e9edbbc621bcae649afa5cdeb45` (15 keys) | `2b0ee1e3afee7c02d600615771eac3fa8aeec680c27bf4189041715729a22438` (10 keys) |

Both tarballs were **independently reproduced byte-for-byte** in this increment from the
pinned source commits (git worktree detached at the commit → `npm ci` → `npm run build` →
`npm pack`, node v22.22.2 / npm 10.9.7 — the exact toolchain recorded in each upstream
manifest). SHA-256, SHA-512, npm integrity and exports fingerprints all matched the pins.

### Upstream verification notes

- **Enterprise:** `11edd06e` is an ancestor of merged `main` (`7d8b6baa` is PR #111's merge
  commit).
- **Protocol:** PR #387 was **squash-merged**, so `dde34517` is not an ancestor of `main`.
  The commit is retained on `origin/claude/soberania-protocol-rc-package-fg02tq`, and
  `main` (`7ce27f1b`) differs from it **only in `docs/release` evidence files** — no
  packaging input differs, and the tarball reproduced from `dde34517` matches the frozen
  checksum exactly. Artifact identity therefore remains pinned to `dde34517`, per the
  brief.

## The repository-local layer is re-homed, not deleted

The in-tree packages under `src/aoc/protocol` and `src/aoc/enterprise` previously
*claimed the upstream names*, and `tsconfig.json` aliased those names straight into the
source tree — so no import of `@aoc/protocol` or `@aoc-enterprise/runtime` ever crossed a
real package boundary. That is exactly the state the frozen
`aoc.cross-repository-integration@1.0.0` contract (shipped inside the protocol tarball)
classifies as *"repository-local source copy — not a packaged dependency; it proves
nothing about independent packaging."*

This increment:

1. **Installs the real artifacts under the real names.** The tsconfig aliases for
   `@aoc/protocol*` and `@aoc-enterprise/runtime*` are removed; those specifiers now
   resolve through `node_modules` into the frozen tarballs for `tsc`, Next.js and the
   test runners alike.
2. **Renames the in-tree layer** to `@pmfreak/aoc-protocol-internal` /
   `@pmfreak/aoc-enterprise-internal`, marked `NON_CANONICAL_LEGACY_COPY`. The internal
   layer keeps PMFreak's application-shaped governance surface
   (`GovernanceEvaluationInput`, `GOVERNANCE_POLICY_REGISTRY`, ports, actor model) that
   the packaged artifacts deliberately do not carry — the upstream canonical shapes
   (`resource:*` permission vocabulary, camelCase contracts) are the *migration target*
   tracked by `docs/architecture/protocol-migration-candidates.md`, not a drop-in
   replacement. Nothing app-facing changed semantically.
3. **Adopts packaged runtime behavior where the semantics already align.** Capability
   claim canonicalization (`src/aoc/protocol/contracts/capability-claims.ts`) now
   delegates to `canonicalizeJSON` from `@aoc/protocol/canonical`
   (profile `aoc-canonical-json/1`), with a JSON round-trip preserving the legacy
   undefined-dropping behavior so existing stored claim signatures stay byte-identical.
   Every claim signing/hash on the enforcement path now executes code from the frozen
   artifact.
4. **Enforces the consumer obligations** of the frozen contract via
   `scripts/check-packaged-aoc-artifacts.mjs` (`npm run check:packaged-aoc-artifacts`,
   wired into `check:governance`):
   - deps must be packed tarballs (`file:vendor/*.tgz`), never a source-tree path;
   - tarball SHA-256s must match `vendor/aoc-consumer.lock.json` (the consumer lock
     recording repository, commit, version, checksums, fingerprints);
   - the installed protocol package must carry
     `aoc.cross-repository-integration@1.0.0`, status `frozen`;
   - installed exports fingerprints must match the pinned values;
   - runtime entrypoints must load and execute through declared export keys only
     (`@aoc/protocol/canonical` smoke-executed; `@aoc-enterprise/runtime/runtime`
     enforcement pipeline entrypoints present).

## Local-source fallback is structurally impossible

The retained copies are `RETAINED_NON_CANONICAL`. Making that a fact rather than a
statement took removing every route by which the canonical names could reach them:

| Route | State |
| --- | --- |
| npm dependency (`file:src/aoc/*`) | **Removed.** Neither copy is a dependency of anything. `npm ci` creates no `node_modules/@pmfreak/*`, and the regenerated lockfile contains no `src/aoc` entry at all. |
| npm dependency under another name | Rejected: the gate fails on a forbidden `file:`/`link:`/`workspace:` local-source specifier under **any** package name, not just the two upstream ones. |
| TypeScript alias | `tsconfig.json` declares no path for `@aoc/protocol*` or `@aoc-enterprise/runtime*`; the gate fails if one returns. |
| Nested manifest | `src/aoc/enterprise` no longer depends on `src/aoc/protocol`. Its build reaches the sibling copy through `tsconfig.build.json` paths mapped at the sibling's **built declarations**, so the emitted layout is unchanged and no install is involved. |
| Deep import into the artifacts | Rejected: every import of an upstream name must be a declared export key. |
| Frontera-private workspaces | Rejected: no direct dependency and no import of `@aoc-enterprise/governed-authority`, `…/governed-authorization`, `…/identity`, `…/scoped-access`. They reach PMFreak only as the artifact's own `bundleDependencies`. |

`vendor/aoc-consumer.lock.json` records `localSourceFallback.allowed: false` with the
forbidden specifiers, resolution roots and TypeScript aliases enumerated; the gate fails
if that flag is ever flipped.

### Negative controls

A gate that has only seen a healthy repository proves nothing. `tests/packaged-aoc-artifact-gate.test.mjs`
builds synthetic repository roots, poisons exactly one thing in each, and asserts rejection
— **14/14 pass**:

| Control | Asserted |
| --- | --- |
| POSITIVE — unpoisoned fixture | no failures |
| **`file:src/aoc/protocol` reintroduced** | **FAILS** |
| **`file:src/aoc/enterprise` reintroduced** | **FAILS** |
| local-source specifier under any other package name | FAILS |
| `link:` / `workspace:` into local source | FAILS |
| tsconfig alias mapping an upstream name into local source | FAILS |
| legacy copy reclaiming `@aoc/protocol` | FAILS |
| legacy copy dropping its `NON_CANONICAL_LEGACY_COPY` marker | FAILS |
| deep/private import (`/dist/…`, `/src/…`) into either artifact | FAILS |
| POSITIVE — declared export key import | accepted |
| import of a Frontera-private workspace package | FAILS |
| direct dependency on a Frontera-private workspace | FAILS |
| lock that stops forbidding local-source fallback | FAILS |
| wrong pinned tarball in the manifest | FAILS |

## Installed resolution proof

`npm ci` runs clean — no `--force`, no `--legacy-peer-deps`. Captured by
`scripts/capture-aoc-artifact-provenance.mjs` immediately before the final browser run
(`artifacts/p2-14/aoc-artifact-provenance.json`), from a clean tree at the integration
source commit:

| Name | Installed | Resolved entrypoint | Under `src/aoc/`? |
| --- | --- | --- | --- |
| `@aoc/protocol` | `0.2.0-rc.0` | `node_modules/@aoc/protocol/dist/contracts/index.js` | **no** |
| `@aoc-enterprise/runtime` | `1.0.0` | `node_modules/@aoc-enterprise/runtime/dist/src/index.js` | **no** |

`node_modules/@pmfreak` does not exist. Resolution is asked of the module system through
each package's declared **root export**, not a constructed path.

## Validation

Every check below ran with the packaged artifacts installed, from the integration source
commit `9685b5fdd3324466098d49c864b0adea3a6d642f`:

| Check | Result |
| --- | --- |
| `npm ci` | PASS (clean; no force, no legacy-peer-deps) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors) |
| `npm test` | PASS — 13,273 tests, 0 failures |
| `npm run build` | PASS |
| `npm run build:aoc` | PASS (legacy copies still build, uninstalled) |
| `npm run check:aoc-boundaries` | PASS |
| `npm run check:no-local-auth-bypass` | PASS |
| `npm run check:runtime-contract-drift` | PASS |
| `npm run check:db-contract` | PASS |
| `npm run check:package-exports` | PASS |
| `npm run check:compatibility` | PASS |
| `npm run check:lifecycle` | PASS |
| `npm run check:typescript-package-isolation` | PASS |
| `npm run check:forbidden-imports` | PASS |
| `npm run check:package-purity` | PASS |
| `npm run check:packaged-aoc-artifacts` | PASS |
| `npm run check:governance` | PASS |

### Database gates

Disposable local stack: Postgres 16 on 54322, GoTrue v2.196.0 and PostgREST v16.2 behind a
loopback gateway on 54321. This sandbox cannot pull the Supabase Docker images, so the
equivalent native services were stood up; the P2-13 isolation guard classified the target
`LOCAL_ISOLATED` before anything ran, and all 161 migrations applied from empty.

| Gate | Result |
| --- | --- |
| `seed:p2-13-founder preflight` | `LOCAL_ISOLATED`, all signals ok |
| `seed:p2-13-founder reseed` / `verify` | `COMPLETE` |
| `check:p2-13-db` | PASS |
| `check:p2-14-db` | PASS — 38 assertions |
| `check:operational-flow-db` | PASS |
| `check:fresh-db-migrations` | PASS (fresh apply from an empty database, 433 tables) |

## Founder browser acceptance

Real Chromium via Playwright against the production build of the integration source commit,
after artifact provenance was captured. **30/30 tests in the Founder story pass**, covering
all 17 required checkpoints:

| # | Checkpoint | Test | Result |
| --- | --- | --- | --- |
| — | seed boundary holds; P2-14 owns nothing yet | PRECHECK | PASS |
| 01–02 | real invited actor authenticates; session established | STEP 01/02 | PASS |
| 03 | hard refresh preserves the principal and scope | STEP 03 | PASS |
| 04–05 | correct Tenant A Workspace and Project resolve | STEP 04/05 | PASS |
| 06 | DEMO/FIXTURE context remains honest | STEP 06 | PASS |
| 07–08 | Recommendation visible; provenance inspectable | STEP 07/08 | PASS |
| 09–10 | human Decision recorded; does NOT auto-create a Material Action | STEP 09/10 (+09b refresh) | PASS |
| 11 | governed Material Action explicitly proposed and authorized | STEP 11 (+11b replay) | PASS |
| 12 | Action dispatches exactly one Task; retry adds none | STEP 12 | PASS |
| 13 | Internal Execution completes through the canonical lifecycle | STEP 13 | PASS |
| 14 | Task completion ≠ Outcome achievement | STEP 14 | PASS |
| 15 | expected Outcome exists and remains non-achieved | STEP 15 | PASS |
| 16 | LIVE input → LIVE Evidence → Observation | STEP 16 (+16a, 16a-mirror, 16b) | PASS |
| 17 | Outcome Review / complete lineage / audit export | STEP 17 (+FINAL consistency) | PASS |

### Security and tenancy negative controls

| Control | Result |
| --- | --- |
| Tenant A → B read and write deny | PASS |
| Tenant B → A read and write deny, no cached context leak | PASS |
| viewer may read, cannot mutate | PASS |
| PM insufficient authority for a terminal Decision | PASS |
| governance negative (`knowledge_elevation` denied by the real contract) | PASS |
| logged-out access to a protected path refused | PASS |
| IDOR / cross-tenant object access | PASS (within the tenancy negatives) |
| DEMO_FIXTURE ≠ LIVE (both directions) | PASS (STEP 16a, 16a-mirror) |
| retry / idempotency (Action, Task, Outcome, Observation) | PASS |
| hard-refresh continuity | PASS (STEP 03, 09b, continuity spec ×3) |
| responsive at 390px / 768px / 1440px | PASS |
| accessibility (keyboard reach, visible focus, no duplicate ids) | PASS |

### Semantic invariants held

Recommendation ≠ Decision · Decision ≠ Material Action · Action ≠ Task · Task completion ≠
Outcome achievement · DEMO_FIXTURE ≠ LIVE · correlation ≠ causation.

## Known pre-existing failure — deferred to P2-15

One test outside the Founder story fails:
`auth-session-continuity.spec.ts › no GET of /logout ends the session`. It expects a
synthesized `RSC: 1` prefetch GET to answer `405` directly; this Next.js runtime first
answers `307` to append its `_rsc` cache parameter.

**Reproduced on the untouched pre-integration baseline.** A worktree at `1490dd6` — before
any P0-PKG-04 change, still declaring `@aoc/protocol: file:src/aoc/protocol` (npm resolved
it to `src/aoc/protocol`, the exact state this increment eliminates) — was installed, built
and served, and the same test failed identically there:

```
BASELINE 1490dd6:  GET /logout rsc-prefetch → 307   plain → 405   /pricing rsc-prefetch → 307
PACKAGED 9685b5f:  GET /logout rsc-prefetch → 307   plain → 405   /pricing rsc-prefetch → 307
```

The `307` applies to every route probed with an `RSC` header, including `/pricing` and
`/api/ready`, which do not touch the AOC packages. Following the redirect yields the `405`,
and the session is never mutated — the route performs no sign-out on GET at all, so the
security property the test protects holds. This is P2-15-owned debt (state-changing GET
`/logout`), explicitly out of scope for this increment and left untouched.

## Claims

```
PROTOCOL_PACKAGE_INTEGRATION=PASS
FRONTERA_PACKAGE_INTEGRATION=PASS
PMFREAK_FOUNDER_JOURNEY=PASS
THREE_REPOSITORY_INTEGRATION=NOT_CLAIMED
```

The first three are established by the evidence above. The fourth is **withheld**: the
artifacts are real, pinned and executing, and the Founder journey passes across them, but
PMFreak's governance layer has not been shown to sit cleanly on either side of the package
boundary — and that is part of what the claim would assert. The blocker, its complete
symbol inventory and the recommended follow-up increment are in
[`p0-pkg-04-blocker-symbol-ownership.md`](./p0-pkg-04-blocker-symbol-ownership.md).

**Also not claimed:** semantic migration of PMFreak's governance surface onto the upstream
canonical contracts; removal of the legacy copies; any publication, registry configuration,
tag, release or merge authority — both artifacts remain `private: true` internal tarballs,
exactly as their upstream evidence records.
