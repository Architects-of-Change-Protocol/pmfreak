# ADR-PMF-048: API Versioning and Deprecation Strategy

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PMFreak's API will have consumers beyond the first-party frontend once integrations, agents, and (per the open decisions in `06-canonical-api-contracts.md` §33) a possible public developer surface exist. PR5's migration strategy (ADR-PMF-044) is explicitly designed to be invisible to API consumers ("PR6's API contracts should be designed to be insulated from which underlying phase a given migration unit is currently in") — that guarantee only holds if the API itself has a disciplined versioning contract that does not leak internal schema changes as breaking API changes, and does not leave consumers guessing when a contract is about to change under them.

## Decision

**Breaking changes to a resource's shape or a Command/Query's contract require a URI version increment (`/v1/`, `/v2/`, ...). Additive, non-breaking evolution within a major version is delivered via optional new fields and optional header-based opt-in, never a URI change. Every deprecation carries an explicit `Deprecation` header and a published sunset date before removal; removal never happens without both having been communicated first.**

## API Rules

1. A breaking change (removing a field, changing a field's type or meaning, removing an endpoint, changing required-ness of a request field) requires a new major URI version.
2. A non-breaking, additive change (new optional response field, new optional endpoint, new optional request field with a safe default) does not require a URI version increment.
3. Every version follows the maturity model in `06-canonical-api-contracts.md` §30 (Experimental → Preview → GA → Deprecated → Sunset → Removed) — no version skips a stage.
4. A Deprecated version continues to function unchanged until its published Sunset date; a Sunset version continues to function until that date; only a Removed version stops responding.
5. Webhook payload versions (`event_version`, `06-event-catalog.md`) follow the same discipline independently of URI versioning — a webhook subscriber pinned to an event version is not forced to migrate merely because the REST API version changed, and vice versa.
6. Every published deprecation names its replacement, if one exists, at the time of the deprecation notice — a consumer is never told "this is deprecated" without being told what to move to.

## Alternatives Considered

- **No formal versioning — evolve the API in place and expect consumers to adapt continuously.** Rejected: this is incompatible with any external consumer (integration, future public API) having a stable contract to build against, and would recreate PR5's persistence-accretion problem at the API layer.
- **Version every single field independently (fine-grained field-level versioning).** Rejected: far higher operational complexity than the product's current maturity justifies; resource/endpoint-level URI versioning with additive-only minor evolution is sufficient for the scale PMFreak operates at today, and finer-grained versioning can be adopted later with evidence if needed.
- **Break compatibility freely under a "beta" umbrella indefinitely, avoiding formal GA.** Rejected: an indefinite beta provides no real guarantee to any consumer and defeats the purpose of a maturity model; §30's GA stage exists precisely to draw this line explicitly.

## Positive Consequences

- Consumers can build against a GA version with a documented, honored stability guarantee.
- Insulates the API from PR5's internal persistence-migration phases exactly as ADR-PMF-044 anticipated.

## Negative Consequences

- Maintaining multiple concurrent major versions during a deprecation window adds operational and testing surface.

## Risks

- **Version-proliferation risk:** without discipline, breaking changes could be introduced too casually if "just bump the version" feels cheap — this ADR does not by itself prevent that, only names the mechanism; product judgment on when a breaking change is truly necessary remains a governance decision outside this ADR's scope.

## Security and Data Implications

- A deprecated/sunset version must not become a security blind spot — it receives the same authentication/authorization enforcement (ADR-PMF-050) as the current version until the moment it is actually removed.

## Application Implications

- Application-layer Command/Query handlers are versioned implicitly through their DTO contracts, not duplicated per API version where the underlying Command/Query itself hasn't changed.

## Frontend Implications

- PR7, as a first-party consumer, is expected to track GA versions closely and is not bound by the same conservative migration timeline external consumers might need — but is still subject to the same Deprecated/Sunset notice periods to avoid silent breakage.

## Migration Implications

- None executed by this ADR. The first API version's exact numbering starts with PR9+ implementation.

## Compatibility Implications

- This ADR's discipline applies from the first versioned release forward; it does not retroactively version the current ad hoc, unversioned route handlers.

## Out of Scope

- Exact deprecation/sunset notice period lengths (`06-canonical-api-contracts.md` §33, open).
- Whether a future public API uses the same versioning cadence as the first-party API.

## Validation

Validation criteria: (1) `06-canonical-api-contracts.md` §20 documents both URI and header versioning mechanisms consistently with this ADR; (2) the maturity model in §30 matches this ADR's stage sequence exactly; (3) no `06-*` document proposes a breaking change without a version increment.

## References

- `docs/product-architecture/06-canonical-api-contracts.md` §20, §30
- `docs/adr/ADR-PMF-044-incremental-expand-contract-migration.md` (API Implications)
