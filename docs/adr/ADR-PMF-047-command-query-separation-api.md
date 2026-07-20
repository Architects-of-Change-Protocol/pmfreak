# ADR-PMF-047: Command/Query Separation at the Wire Boundary

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-025 already ratified Command/Query separation at the application layer and stated its own binding API Implication: "any transport PR6 chooses must preserve the same semantic guarantee (no read-shaped call may mutate)." That ADR did not itself fix how the guarantee is carried across the wire — which HTTP verbs, which endpoint shapes, and how a client is expected to reason about safety and cacheability. Without an explicit wire-level rule, the same risk ADR-PMF-025 named at the application layer (a "read" that quietly writes) could simply reappear one layer up, at the API boundary, where PR7 and external integrations have even less visibility into what a call actually does.

## Decision

**Every Command maps to `POST`, `PUT`, `PATCH`, or `DELETE`; every Query maps to `GET`. No `GET` endpoint may trigger a Command, directly or as a side effect, including telemetry writes. Every mutating endpoint documents its resulting events; every `GET` endpoint documents that it has none.** This ADR applies ADR-PMF-025's existing decision to the wire boundary — it does not reopen or modify that decision.

## API Rules

1. A Query is always `GET`, always safe to cache, always safe to retry, always safe to prefetch — a client library may assume this without per-endpoint special-casing.
2. A Command is never `GET` — even a Command with narrow, well-understood effects (e.g., `ReviewRecommendation`) uses a mutating verb.
3. Action-oriented Command endpoints (`06-canonical-api-contracts.md` §4) use `POST`, distinguishing them from resource-shaped `PATCH`/`PUT` used for direct field updates where the Command catalog permits them.
4. No endpoint response format differs based on whether the call was cached or freshly executed in a way that would let a client infer mutation had occurred through a `GET` — cache transparency must not become an implicit side-channel.
5. Every Command endpoint's documented event list (`06-command-catalog.md`) is exhaustive — an implementation emitting an event not listed for that Command is a contract defect, not an acceptable variance.

## Alternatives Considered

- **Allow "smart" `GET` endpoints that lazily create a resource if missing (get-or-create).** Rejected: ADR-PMF-025 rule 5 already requires this pattern be split into an explicit Query followed by a conditional Command — the API layer does not get to reintroduce the ambiguity at the wire boundary.
- **Use HTTP verb semantics loosely (e.g., `POST` for both reads and writes) for implementation convenience.** Rejected: this would immediately defeat REST's native cacheability (ADR-PMF-046) and reintroduce exactly the "impossible to tell what mutates" problem ADR-PMF-025's Context section describes.

## Positive Consequences

- Makes the wire contract mechanically verifiable: any `GET` handler found writing to the database is a detectable, name-able defect.
- Lets PR7's data layer treat HTTP verb as a reliable signal for cache/invalidate behavior (already anticipated by ADR-PMF-025's UX Implications).

## Negative Consequences

- Some simple, single-field toggle operations feel heavier as an explicit `POST`/`PATCH` Command than an implicit `GET`-with-side-effect would.

## Risks

- **Verb-drift risk:** without a fitness function, nothing mechanically prevents a future `GET` handler from acquiring an unintended write — same risk ADR-PMF-025 already named and left unenforced; this ADR does not build that enforcement either.

## Security and Data Implications

- A `GET`-only Query surface cannot itself be a write-privilege-escalation vector even if over-permissioned — narrowing the blast radius of a misconfigured read-authorization rule (restated from ADR-PMF-025's own Security Implications, now applied at the wire boundary).

## Application Implications

- No change — application-layer Command/Query handlers are exactly as ADR-PMF-025 already defined them; this ADR only fixes their wire-level rendering.

## Frontend Implications

- PR7 may treat every `GET` response as cache-safe and every mutating-verb response as cache-invalidating for the resources it touches, without per-call-site special-casing (restated from ADR-PMF-025, now guaranteed at the transport PR6 actually chose).

## Migration Implications

- None executed by this ADR. Existing route handlers not yet conforming to this verb mapping are migrated in PR9+.

## Compatibility Implications

- Fully compatible with continued operation of non-conforming existing routes during migration; this ADR governs the target contract.

## Out of Scope

- The specific per-Command/Query endpoint shapes — see `06-command-catalog.md` and `06-query-catalog.md`.

## Validation

Validation criteria: (1) every Command in `06-command-catalog.md` maps to a non-`GET` verb; (2) every Query in `06-query-catalog.md` maps to `GET`; (3) no endpoint in either catalog has an ambiguous or dual classification.

## References

- `docs/adr/ADR-PMF-025-command-query-separation.md`
- `docs/product-architecture/06-command-catalog.md`
- `docs/product-architecture/06-query-catalog.md`
