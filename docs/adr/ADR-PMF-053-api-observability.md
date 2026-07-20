# ADR-PMF-053: API Observability Contract

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4 §3 already established that every Command carries a `correlationId` and, where applicable, a `causationId`, inherited by every resulting event — this is the mechanism that makes a workflow reconstructable end to end (PR5 §20's workflow-persistence model depends on it too). PR5's current-state inspection found this discipline only partially applied today (`platform_events` carries `correlation_id`/`causation_id`; most other subsystems' parallel `*_events`/`*_audit*` tables do not, PR5 §24). None of this yet has an API-layer contract: what a request must carry in, what a response must carry out, and what must be logged regardless of outcome.

## Decision

**Every API request carries and logs a Correlation ID, Trace ID, Request ID, the resolved Actor (human/service account/Agent identity), the resolved Workspace, request latency, and response status — for every request, including failures and authorization denials, with the same fields never selectively omitted to save log volume on high-traffic endpoints.**

## API Rules

1. Every request that lacks a client-supplied Correlation ID is assigned one at the API command/query port; every request that supplies one uses it as-is, propagated through to the Command/Query and every resulting event.
2. Trace ID and Request ID are always server-generated, never client-supplied, to prevent a client from forging or colliding trace identity.
3. The resolved Actor is logged as its type and identifier (human user ID, service account ID, or Agent Run ID) — never merely "authenticated," which would be insufficient to reconstruct who did what.
4. The resolved Workspace (and Project, where applicable) is logged on every request, including requests that fail authorization before reaching a specific resource, to the extent scope was resolvable at all.
5. Latency and status are recorded for every request without exception — a request that errors, times out, or is rate-limited is logged exactly as completely as one that succeeds.
6. No observability field required by this ADR is stripped or downsampled specifically because an endpoint is high-traffic; volume-management (sampling, aggregation) applies uniformly across endpoints if applied at all, never selectively to hide a specific endpoint's behavior.

## Alternatives Considered

- **Log only failures and slow requests, skip successful fast requests to save volume.** Rejected: this would make it impossible to establish a request's absence as a fact (e.g., proving a Command was never called) and would bias observability data toward failure modes, undermining exactly the kind of "what actually happened" reconstruction PR5's audit and provenance principles (PR5 §17, §21) already require elsewhere.
- **Use a single generic "user ID" field for Actor, without distinguishing human/service-account/Agent.** Rejected: ADR-PMF-050's authentication model treats these as three distinct actor types with different scope and authorization implications — collapsing them in observability data would make incident investigation unable to distinguish "a human did this" from "an Agent, scoped to that human, did this."

## Positive Consequences

- Gives every API request the same traceability guarantee PR4 §3 already requires at the Command/Query level, closing the gap between what the domain layer promises and what the API layer actually delivers end to end.
- Makes incident investigation and the audit trail (PR5 §21) mutually reinforcing rather than two separately maintained systems that might disagree.

## Negative Consequences

- Full-fidelity logging of every request, including successful high-traffic reads, has real storage and processing cost.

## Risks

- **Correlation-ID trust risk:** a client-supplied Correlation ID (rule 1) is convenience, not a security boundary — nothing about accepting it authorizes anything; this ADR does not treat Correlation ID as an authentication mechanism, and no future implementation should either.
- **PII-in-logs risk:** logging the resolved Actor and Workspace at full fidelity on every request means observability data itself becomes a data-classification concern (PR5 §45) — access to raw request logs must be restricted commensurately, a requirement this ADR names but does not itself design the access-control mechanism for.

## Security and Data Implications

- Comprehensive per-request logging is itself a detective security control — an unauthorized-access attempt is captured with full context (rule 4) even when it fails before reaching a specific resource.
- Observability data containing resolved Actor/Workspace is subject to the same classification and access restrictions PR5 §45 already requires for other Confidential/Restricted data.

## Application Implications

- No change to Command/Query handler logic — the Correlation/Causation ID propagation this ADR requires at the API layer is the same mechanism PR4 §3 already requires at the application layer, now guaranteed to be present at the edge where requests originate.

## Frontend Implications

- PR7 can surface a Correlation ID or Request ID in error UI (e.g., "reference ID for support") without any new backend work, since every response already carries one per this ADR.

## Migration Implications

- None executed by this ADR. Bringing existing route handlers up to this observability standard, and consolidating the currently-inconsistent `correlation_id`/`causation_id` presence across parallel event/audit tables (PR5 §24), is PR9+ work.

## Compatibility Implications

- Additive — does not require changing any existing successful request/response shape, only what is logged server-side and which headers are echoed back.

## Out of Scope

- The specific observability/logging platform or tool.
- Exact log-retention periods for observability data (distinct from audit retention, PR5 §16, which this ADR does not modify).

## Validation

Validation criteria: (1) `06-canonical-api-contracts.md` §25 lists exactly the seven fields (Correlation ID, Trace ID, Request ID, Actor, Workspace, Latency, Status) this ADR requires; (2) no `06-*` document proposes selective omission of any of these fields for any endpoint; (3) the Actor field is documented as type-distinguishing (human/service account/Agent) consistently with ADR-PMF-050.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §3
- `docs/product-architecture/05-canonical-persistence-architecture.md` §21 (Audit Persistence)
- `docs/product-architecture/06-canonical-api-contracts.md` §25
