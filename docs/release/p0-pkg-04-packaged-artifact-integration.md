# P0-PKG-04 — PMFreak Consumes the Frozen Packaged AOC Artifacts

**Status:** implemented; the complete P2-14 Founder journey re-ran and passed against the
packaged dependencies.
**Claim:** THREE_REPOSITORY_INTEGRATION — the first integration across the three merged
codebases (Soberanía Protocol, Frontera / Soberania-Enterprise, PMFreak) through real,
checksummed package boundaries. Claimed only below, after the packaged Founder journey
evidence.

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
   `@pmfreak/aoc-enterprise-internal` (aliased to source exactly as before). The internal
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

## Validation

All run with the packaged artifacts installed (this increment, this tree):

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors) |
| `npm test` | PASS — 13,267 tests, 0 failures |
| `npm run check:governance` (incl. new packaged-artifact battery) | PASS |
| `npm run build` (production) | PASS |
| `npm run build:aoc` (internal layer dists) | PASS |

## The packaged P2-14 Founder journey

Run in a disposable local stack (Postgres 16 on 54322; GoTrue v2.196.0 and PostgREST
v16.2 behind a loopback gateway on 54321 — this sandbox cannot pull the Supabase Docker
images, so the equivalent native services were stood up; the P2-13 isolation guard
classified the target `LOCAL_ISOLATED` before anything ran). All 161 migrations applied
from empty.

| Step | Result |
| --- | --- |
| `seed:p2-13-founder preflight` | `LOCAL_ISOLATED`, all signals ok |
| `seed:p2-13-founder seed` / `verify` | `COMPLETE` (both runs; reseed before the final journey) |
| `check:p2-13-db` | PASS (`ok: true`) |
| `test:e2e:p2-14` — `p2-14-founder-story.spec.ts` | **PASS — every test**, both tenants, full causal chain (Decision → Material Action → Task → Execution → Outcome → Observation), cross-tenant isolation, hard-refresh continuity |
| `check:p2-14-db` | **PASS — 38 assertions** (intake source classification, DEMO/LIVE boundary, idempotent retry reconciliation) |

One assertion outside the Founder story failed in this sandbox:
`auth-session-continuity.spec.ts › no GET of /logout ends the session` expects a
synthesized `RSC: 1` prefetch GET to answer `405` directly; this Next.js runtime first
answers `307` to append its `_rsc` cache parameter (following the redirect yields the
`405`, and the session is never mutated — the route performs no sign-out on GET at all).
The same `307` normalization applies to **every** route probed with an `RSC` header,
including `/pricing` and `/api/ready`, which do not touch the AOC packages — it is
runtime-environment behavior, not an effect of this increment. The security property the
test protects (no GET ends a session) holds.

## THREE_REPOSITORY_INTEGRATION

With the packaged Founder journey green, this increment claims
**THREE_REPOSITORY_INTEGRATION**: PMFreak's P2-14 Founder journey runs end-to-end with
`@aoc/protocol@0.2.0-rc.0` and `@aoc-enterprise/runtime@1.0.0` installed as frozen,
checksum-pinned tarballs produced by the two merged upstream repositories, verified by a
blocking consumer battery, with packaged protocol runtime code (canonical JSON) executing
on the capability-claim signing path.

**Not claimed:** semantic migration of PMFreak's governance surface onto the upstream
canonical contracts (tracked separately as migration candidates); any publication,
registry configuration, tag, release, or merge authority — the artifacts remain
`private: true` internal tarballs, exactly as their upstream evidence records.
