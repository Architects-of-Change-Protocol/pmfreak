# Package Boundary Governance

> **P0-PKG-04:** `@aoc/protocol` and `@aoc-enterprise/runtime` now name the frozen
> upstream packaged artifacts installed from `vendor/*.tgz` (see
> `docs/release/p0-pkg-04-packaged-artifact-integration.md` and
> `vendor/aoc-consumer.lock.json`). The repository-local packages formerly published
> under those names are renamed `@pmfreak/aoc-protocol-internal` /
> `@pmfreak/aoc-enterprise-internal`; every rule below applies to them under their new
> names. Imports of the upstream names must go only through their declared export keys,
> enforced by `npm run check:packaged-aoc-artifacts` and the consumer boundary audit.

## Allowed dependency direction
- `@pmfreak/aoc-protocol-internal` is the canonical contract layer and has no dependency on `@pmfreak/aoc-enterprise-internal`.
- `@pmfreak/aoc-enterprise-internal` may depend on the protocol layer **only through package exports** (`@pmfreak/aoc-protocol-internal`, `.../contracts`, `.../ports`, `.../actor-model`).
- The internal protocol layer may consume the packaged `@aoc/protocol` through its declared export keys (today: `@aoc/protocol/canonical` on the capability-claim signing path).
- PMFreak app code consumes protocol/runtime through package exports and must not import package source internals.

## Forbidden imports
- Relative cross-package source imports (`../../protocol/*`) from enterprise runtime.
- Alias/source bypasses (`@/aoc/protocol/*`, `src/aoc/protocol/*`) inside package code.
- Deep imports into unpublished internals not listed in package `exports`.

## Ownership
- Protocol package: actor model, contracts, protocol ports.
- Enterprise package: runtime composition and governance execution implementation.
- App package: adapters and application-specific policy, audit, and infra concerns.

## Evolution rules
- New public entrypoints require explicit `exports` entries.
- Internal files must remain unexported and inaccessible through deep imports.
- Boundary checks are enforced in CI via `check:forbidden-imports` and package purity checks.
