# P0-PKG-09 — downstream convergence on repaired Protocol rc.1 and Frontera 1.2.1

PMFreak moves both upstream artifacts together, as one increment:

| | Before | After |
|---|---|---|
| `@aoc/protocol` | `0.2.0-rc.0` — **BURNED** | `0.2.0-rc.1` |
| `@aoc-enterprise/runtime` (Frontera) | `1.2.0` — superseded for downstream consumption | `1.2.1` |

No PMFreak product behaviour changed. No database, migration, RLS, auth or UI change. No upstream
source was copied into this repository, and neither upstream repository was modified.

---

## Why

### `@aoc/protocol@0.2.0-rc.0` is BURNED — UG-003

rc.0's canonical-JSON writer truncated the exponent of numbers rendered in exponential notation
with a fractional mantissa:

```
canonicalizeJSON(7.9e-10)  -> "7.9e-1"
canonicalizeJSON(7.9e-100) -> "7.9e-1"
```

Two distinct values, one canonical form, therefore one digest. The collision is wider than the
reported pair — `1.5e-300` collapsed to `"1.5e-3"`. Found by Live Data Rail while consuming the
rc.0 artifact and reported as **UG-003**.

This is not abstract for PMFreak. `src/lib/governance/authority/capability-claims.ts`
canonicalises claim material with `canonicalizeJSON`, so a canonical-form collision is digest
material two different claims could share.

Soberanía Protocol declared the candidate **burned** rather than repacking its bytes under the
same identity, and cut `0.2.0-rc.1` from commit `eec79cdd4019dd42e1767909c5bd4e26d04c6f0f`
(PR #388), carrying its frozen integration contract from `1.0.0` to `1.0.1`.

### Frontera `1.2.0` is superseded for downstream consumption — **not defective**

`SUPERSEDED_FOR_DOWNSTREAM_CONSUMPTION_DUE_TO_BURNED_PROTOCOL_INPUT`.

Frontera 1.2.0 is a valid historical artifact. Its compiled output is byte-identical to 1.2.1's:
`dist/`, the public export map, the bundled internals, the frozen v1 HTTP surface and every store
schema identifier are unchanged between them. What the burn invalidated is its **compatibility
evidence** — it was validated and handed off against an input later declared burned.

The burned artifact is the Protocol candidate. Frontera 1.2.0 is neither burned nor defective.

Frontera 1.2.1 exists because repinning its own validation input to rc.1 edits `package.json`,
which ships inside the npm tarball, so the packed bytes moved even though no compiled output did.
PMFreak had already vendored and checksum-pinned 1.2.0, so that identity could not name two
different tarballs. 1.2.1 is a patch **derived by artifact identity**, not a semantic change.

---

## What is consumed now

### `@aoc/protocol@0.2.0-rc.1`

| | |
|---|---|
| Source repository | `Republika-Network/Soberania_Protocol` |
| Artifact-producing commit | `eec79cdd4019dd42e1767909c5bd4e26d04c6f0f` |
| Merged via | PR #388 (`e1ba3032989d9778e5575d727eeee33d38c83f95`) |
| SHA-256 | `b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60` |
| npm integrity | `sha512-iJqgwo9ZLewWhY4HWOX1owfplgOzcjk2CuPOcI7ne8ZhwM8dekDaztaBhkfgos0IQ9mSH6fmefNA2yix8DO2bA==` |
| Size / files | 280149 bytes / 407 |
| Integration contract | `aoc.cross-repository-integration@1.0.1` |
| Exports fingerprint | `a67d65b17dcb34c7da84d9a07cb893e073e21e9edbbc621bcae649afa5cdeb45` — **unchanged from rc.0**, 15 keys |

### `@aoc-enterprise/runtime@1.2.1`

| | |
|---|---|
| Source repository | `Republika-Network/Frontera` |
| Artifact-producing commit | `bbce6472e6a4bc20e234505b083b203ea6fdc963` |
| Merged via | PR #114 (`27fadddac36e3037b4b659093ada75b65155cb76`) |
| SHA-256 | `6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628` |
| npm integrity | `sha512-k3YmQ/GX6cHLLGjNzzYKHSIUT19U342jJF76l+qIbr2TKZTJJhvIQSjLIRuwfbeLZS1EqKOUNDrgPzdu0s5K3A==` |
| Size / files | 3390104 bytes / 6366 |
| Exports fingerprint | `2b0ee1e3afee7c02d600615771eac3fa8aeec680c27bf4189041715729a22438` — 10 keys |

The merge commit is recorded, but the artifact is attributed to `bbce6472`: the closure commit
`8a3d701f` and the merge add only handoff-lock and candidate-manifest records, and neither is a
packed input (`files` is `["dist"]`; the packed entries outside `dist/` and the bundled internals
are exactly `package.json`, `README.md` and `LICENSE`).

### Both were reproduced here, not taken on trust

Each tarball was rebuilt from its pinned source commit through the **upstream repository's own
governed tooling**, in a clean checkout on a genuine **ext4** filesystem, and re-hashed again from
the vendored copy after being placed in `vendor/`.

> **Reproducibility caveat.** Canonical identities must be derived on POSIX/ext4. Packing the same
> content from a `/mnt/c` DrvFs checkout produces a different digest because DrvFs cannot represent
> Unix permissions and stamps every tar entry `0755` instead of `0644`. That is environmental
> metadata drift, not tampering — extracting both artifacts shows identical file lists and zero
> differing files. Do not adopt a DrvFs digest as canonical identity.

---

## The pair belongs together

Read from the **packed** Frontera 1.2.1 artifact, not from upstream source:

- its `devDependencies["@aoc/protocol"]` is `file:./vendor/aoc-protocol-0.2.0-rc.1.tgz` — 1.2.1 was
  validated against rc.1;
- its `peerDependencies["@aoc/protocol"]` remains `>=0.1.0 || >=0.2.0-rc.0`, which already admits
  `0.2.0-rc.1`, so it was deliberately left unchanged;
- it contains **zero** `node_modules/@aoc/protocol` entries — Protocol is external, never bundled;
- the four private Frontera modules are bundled as designed.

And read from the packed **Protocol rc.1** artifact: `integration-contract.json` names rc.1 as the
current candidate, records rc.0 as the burned candidate with its checksum, and declares
`contractVersion 1.0.1`.

PMFreak vendors the **same rc.1 bytes** Frontera validated against, so there is no split-brain.

---

## Repair proved through PMFreak's own installed artifact

`tests/protocol-canonicalization-repair.test.mjs` exercises `node_modules/@aoc/protocol` through
the declared public `./canonical` export — a subpath PMFreak already consumes in `src/` and already
records in `vendor/aoc-consumer.lock.json`, so no allowlist was widened.

```
canonicalizeJSON(7.9e-10)  = "7.9e-10"     round-trip PASS
canonicalizeJSON(7.9e-100) = "7.9e-100"    round-trip PASS
canonicalizeJSON(1.5e-300) = "1.5e-300"    round-trip PASS
outputs distinct: true      digests distinct: true
```

It does not reimplement canonicalization; Protocol keeps ownership of the algorithm. It asserts a
consumption fact only PMFreak can assert, and its never-rc.0 guard is an inequality against the
literal burned version so it cannot mutate into a passing assertion when the pin moves again.

---

## A stale gate this increment reproduced and repaired

`scripts/check-tarball-purity.mjs` hard-coded the two tarball filenames and checksums inline.
After the repin it **still exited 0** — because the retired rc.0 and 1.2.0 tarballs happened to
still sit in `vendor/`, it kept checksumming those, reported "checksum verified", and never noticed
that nothing installed them any more. A purity gate that validates artifacts nobody consumes is
worse than no gate, because it reads as assurance.

Both it and `scripts/check-package-exports.mjs` now derive artifact identity from
`vendor/aoc-consumer.lock.json`, which is the single source of truth the gate battery already
treats as authoritative. Neither was weakened: mutating the lock's `sha256` or `version` makes each
fail with the expected message, verified before and after the change. The required-export lists in
`check-package-exports.mjs` stay hard-coded on purpose — they are a deliberate *minimum* surface
this repository depends on, not a restatement of what the artifact declares.

---

## `vendor/` is active-only

The retired `aoc-protocol-0.2.0-rc.0.tgz` and `aoc-enterprise-runtime-1.2.0.tgz` were removed.
This follows the repository's own precedent rather than a preference: `vendor/` was created in a
single commit holding exactly the two then-active artifacts, Frontera `1.1.0` was consumed but its
tarball was never vendored, and the lock's `supersedes` records carry `{version, sourceCommit,
sha256, status, reason}` with **no tarball path**. History in this repository is recorded by
identity in the lock, not by retained files — and both burned/superseded identities remain recorded
there in full.

---

## Consumer lock

`vendor/aoc-consumer.lock.json` top-level `contractVersion` moved `1.0.0` → `1.0.1`. That field is
not a PMFreak-specific schema version: `scripts/check-packaged-aoc-artifacts.mjs` compares it
against the `integration-contract.json` shipped **inside the installed Protocol artifact**, so it
tracks the active Protocol integration contract and had to move with it. The gate now reports
`integration contract aoc.cross-repository-integration@1.0.1 (frozen) verified`.

`governance-ownership.lock.json` was deliberately **not** touched. Its `upstream` block is
descriptive provenance, not an enforced pin — nothing reads it, and it still records Frontera
`1.0.0` from when it was written, having been left unchanged through the 1.2.0 adoption. Advancing
it here would invent a practice this repository does not have.

---

## Explicitly not claimed

- Protocol rc.1 is a **release candidate**, not GA.
- Frontera 1.2.1 is **not published** — no registry, no dist-tag, no tag, no GitHub Release.
- This increment does **not** close all security risk. The accepted dependency-security residual
  risk is unchanged and still disclosed; `check:beta-release` remains **CONDITIONAL GO**, and the
  standing Dependabot advisory is untouched because this repin does not move the affected
  dependency.
- rc.0 existed and was consumed. Its identity and burn reason stay recorded.
- Frontera 1.2.0 was **not** broken.
- P0-LAUNCH-01 remains closed; nothing in it was reopened or modified.
