# ADR-PMF-056: SDK and Contract Generation Strategy

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR7 (frontend), any future integration, and any future Agent-authoring surface all need a typed way to call the API this PR defines, without each hand-writing request/response shapes from documentation prose and risking drift from the actual Command/Query/DTO catalogs (`06-command-catalog.md`, `06-query-catalog.md`). At the same time, `06-canonical-api-contracts.md` §28 already establishes that OpenAPI is a derived artifact, never a source of truth — any SDK strategy must be consistent with that ordering, not treat OpenAPI (or an SDK) as the place contracts actually get decided.

## Decision

**A TypeScript SDK is the primary generated/derived client target, built directly from the Command/Query/DTO contracts this PR's companion catalogs define — never independently hand-designed. A future Python SDK and a future CLI, if built, derive from the same contract rather than reinventing it. OpenAPI, where generated, is likewise a derived artifact from the same catalogs, never the place a new endpoint or DTO shape is first decided.**

## API Rules

1. The SDK's method surface is generated or hand-maintained in lockstep against `06-command-catalog.md`/`06-query-catalog.md` — an SDK method exists if and only if a corresponding Command or Query exists in those catalogs.
2. No SDK introduces a convenience method that performs more than one Command in a single call — this would silently violate ADR-PMF-030's binding "no composite endpoint" rule at the client-library layer, even if the API itself is compliant.
3. SDK-generated types mirror the Request/Response/Summary/Projection/Search/Feed/Command/Error DTO shapes (`06-canonical-api-contracts.md` §9) exactly — an SDK type is never independently designed to be "more convenient" in a way that diverges from the wire contract.
4. Any OpenAPI document, wherever and whenever generated, is produced from the same catalogs the SDK is generated from — the two representations (SDK, OpenAPI) must never independently drift from the canonical Command/Query/DTO source.
5. SDK versioning tracks API versioning (ADR-PMF-048) — an SDK major version corresponds to an API major version; SDK minor/patch releases may ship additive typings for non-breaking API evolution without a major SDK bump.
6. A future Python SDK or CLI, when built, is derived from the same source catalogs as the TypeScript SDK — never designed as a parallel, independently maintained contract.

## Alternatives Considered

- **Hand-write and hand-maintain a TypeScript client library independent of the catalog documents, updated ad hoc as endpoints are added.** Rejected: this is exactly the kind of parallel, independently-drifting representation this ADR's rule 4 exists to prevent, and would recreate at the client layer the same accretion risk PR5's persistence inspection found in the schema.
- **Generate the SDK directly from a hand-authored OpenAPI document, treating OpenAPI as the source of truth.** Rejected: `06-canonical-api-contracts.md` §28 already fixed OpenAPI as a derived artifact; making it the SDK's source would implicitly promote it to source-of-truth status, contradicting that decision.
- **No SDK at all — require every consumer to hand-write raw HTTP calls against the documented contract.** Rejected: for a first-party frontend (PR7) and any future integration ecosystem, a typed SDK meaningfully reduces contract-drift risk and integration effort; the absence of one would push every consumer to informally re-derive the same types PR6 already specifies.

## Positive Consequences

- Gives PR7 typed, contract-accurate client code without hand-maintaining request/response shapes separately from the API documentation.
- Keeps SDK and any future OpenAPI document from silently diverging from each other or from the actual Command/Query catalogs, since both derive from the same source.

## Negative Consequences

- Generation tooling (or a strict hand-maintenance discipline, if generation isn't adopted immediately) adds a build-time dependency and a step that must stay synchronized with catalog changes.

## Risks

- **Generation-lag risk:** if SDK generation is not wired into the same change process as catalog updates, the SDK can lag behind newly added Commands/Queries — this ADR fixes the sourcing discipline but not the automation that keeps it current, which is implementation detail.
- **Convenience-method creep risk:** without review discipline, a well-intentioned SDK contributor could add a composite convenience method that silently reintroduces the exact multi-Command-in-one-call pattern ADR-PMF-030 prohibits (rule 2) — flagged here as a specific, foreseeable violation pattern to review against.

## Security and Data Implications

- An SDK that mirrors DTO shapes exactly (rule 3) cannot itself become a channel for leaking a field the API's own authorization/classification model would have redacted — the SDK has no independent data access path outside the API contract it wraps.

## Application Implications

- No change to application-layer Command/Query handlers — the SDK is a client-side artifact with no runtime presence in the application layer.

## Frontend Implications

- PR7 is the SDK's primary first consumer; PR7's data-fetching layer is expected to be built against the generated/derived SDK rather than raw `fetch` calls with hand-written types, once the SDK exists.

## Migration Implications

- None executed by this ADR. SDK generation tooling selection and the first SDK release are PR9+ implementation work.

## Compatibility Implications

- Fully compatible with PR7 using raw HTTP calls during any interim period before the SDK exists — this ADR does not block frontend progress on SDK availability, only fixes the target strategy.

## Out of Scope

- Exact SDK generation tooling (e.g., OpenAPI-generator, a custom code-generation script, or hand-maintenance) — `06-canonical-api-contracts.md` §33.
- Exact SDK release/versioning cadence beyond the major-version tracking rule (rule 5).
- Python SDK and CLI timing/prioritization.

## Validation

Validation criteria: (1) `06-canonical-api-contracts.md` §28–29 documents OpenAPI-as-derived and SDK-as-derived consistently with this ADR; (2) no `06-*` document proposes an SDK convenience method combining more than one Command; (3) SDK versioning is documented as tracking API major versions per ADR-PMF-048.

## References

- `docs/product-architecture/06-canonical-api-contracts.md` §28–29
- `docs/adr/ADR-PMF-048-api-versioning-strategy.md`
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
