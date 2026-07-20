# ADR-PMF-060: Contract-Driven Frontend Data Access

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`06-canonical-api-contracts.md` was written specifically so that a client — including PMFreak's own frontend — never needs to touch a table, SQL, or Supabase directly (§1: "The frontend must never know a table"). The current codebase already contains a working precedent for a typed contract client (`src/sdk/client.ts`'s `AocClient`, scoped today to the `src/aoc/` protocol/enterprise packages) alongside a persistence-adjacent `src/lib/db/` (`database-contract.ts`, `supabase-server.ts`) whose consumers are not yet verified against a "UI never touches persistence" rule. PR7 must decide whether every frontend data access — read or write — is required to go through a contract client consuming PR6's Command/Query API, or whether direct persistence access from a component remains an implicit possibility.

## Decision

**All frontend server data access, read or write, goes through a contract client consuming `06-canonical-api-contracts.md`'s Command and Query API; no component, hook, or server action queries Supabase, SQL, or any persistence technology directly.** Full specification: `07-frontend-state-and-data-architecture.md` §8, `07-frontend-module-boundaries.md` §1, §3.

## Frontend Rules

1. Only the Application Contracts layer (`07-frontend-module-boundaries.md` §1) is permitted to know an HTTP status code, header name, or DTO wire shape exists — every layer above it works exclusively with typed view models and typed error categories.
2. A component importing a database client, ORM type, or table name is a defect (`07-frontend-module-boundaries.md` §3 rule 2), not an accepted shortcut, regardless of how the current codebase's `src/lib/db/` is consumed today.
3. Two modules never independently implement a contract client for the same Command or Query — one contract client per Command/Query, shared through the Application Contracts layer (`07-frontend-module-boundaries.md` §3 rule 6).
4. The contract client is generated from or hand-maintained against PR6's catalogs — it never defines a DTO shape PR6 does not already name, mirroring `06-canonical-api-contracts.md` §29's SDK-strategy rule at the consuming end.

## Alternatives Considered

- **Allow direct Supabase access from server-rendered components as a performance shortcut.** Rejected: this is exactly the pattern PR5 §24 already flagged as a current-state gap ("direct Supabase access in places"), and formalizing it at the frontend layer would make PR6's entire API contract optional rather than mandatory.
- **A GraphQL client bypassing the REST contract client.** Rejected: GraphQL adoption is explicitly open and evidence-gated (`06-canonical-api-contracts.md` §33); no frontend data-access pattern is built against an unadopted transport.

## Positive Consequences

- Insulates the frontend from PR5's persistence migration phases entirely — the contract client's shape only changes when PR6's DTOs change, never when a table is renamed or split.
- Gives authorization review a fixed, enumerable frontend data-access surface (every contract client call maps to a cataloged Command/Query), mirroring `06-canonical-api-contracts.md` §45's fixed API surface benefit one layer up.

## Negative Consequences

- A genuine new frontend data need requires a new or extended Query/Command in PR6's catalog before frontend work can proceed — slower than an ad hoc fetch, by design.

## Risks

- **Existing-precedent risk:** `src/sdk/client.ts`'s `AocClient` is scoped to `src/aoc/` today; deciding whether it becomes (or informs) the product-wide contract client is a genuine open migration question (`07-frontend-migration-strategy.md`), not resolved by this ADR — treating it as already product-wide without verification would be premature.

## Security and Data Implications

- Eliminates the frontend as a place where Row-Level Security could be bypassed by a direct, unscoped Supabase query from client-adjacent code (`05-tenancy-rls-and-data-security.md` §3's defense-in-depth chain remains intact because the frontend never has an independent path around it).

## Application Implications

- No change to PR4's Command/Query handlers; this ADR only requires the frontend to consume them exclusively through PR6's API rather than any other path.

## Frontend Implications

- Establishes the single data-access seam every other `07-*` document assumes (`07-command-query-and-error-experience.md` §2, §8).

## Migration Implications

- `src/lib/db/`'s current consumers must be verified server-side/Application-Contracts-side during migration, not assumed compliant (`07-frontend-module-boundaries.md` §5); `src/sdk/` is evaluated as a candidate precedent, not adopted wholesale by this PR.

## Compatibility Implications

- Compatible with the current `src/sdk/` pattern continuing to operate for `src/aoc/` packages during migration; this ADR does not force an immediate consolidation.

## Out of Scope

- Whether `AocClient` becomes the product-wide contract client, or a new one is built (`07-frontend-migration-strategy.md`).
- OpenAPI/SDK generation tooling specifics (`06-canonical-api-contracts.md` §33, still open).

## Validation

Validation criteria: (1) `07-frontend-module-boundaries.md` §4's fitness function 3 (persistence-import check) is defined against this rule; (2) every data-fetching pattern in `07-frontend-state-and-data-architecture.md` §8 routes through the Application Contracts layer with no exception.

## References

- `docs/product-architecture/07-frontend-state-and-data-architecture.md` §8
- `docs/product-architecture/06-canonical-api-contracts.md` §1, §29
- `docs/adr/ADR-PMF-045-canonical-api-philosophy.md`
