# ADR-PMF-061: Explicit Tenant Context in the Frontend

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-034 (PR5) already requires every operational persistent record to belong to exactly one Workspace, identifiable without depending solely on multi-hop joins for sensitive-scope resolution, and its own API-facing implication already anticipates that the API layer must resolve tenancy server-side rather than trust a client-supplied field. `06-canonical-api-contracts.md` §16 makes that implication binding: the API resolves `enterprise_id`/`workspace_id`/`project_id` entirely server-side, never from a client-supplied field. Neither ratifies what the frontend itself is permitted to trust when rendering a route's tenant-scoped content. Without an explicit rule, a future implementation could reasonably (and incorrectly) treat a route's `[workspaceId]` segment, a `localStorage` value, or a client-set cookie as sufficient authority to render tenant-scoped data, reintroducing at the UI layer the exact trust boundary ADR-PMF-034 and `06-canonical-api-contracts.md` §16 already closed at the persistence and API layers.

## Decision

**Every frontend route's Enterprise/Workspace/Project context is resolved and re-validated server-side, from the authenticated session and the resource's own parent chain, on every request; a route's URL segment is a request for that scope, never an authority the client can use to widen its own access, and `localStorage`/client-set cookies are never treated as tenancy authority.** Full specification: `07-route-layout-and-navigation-architecture.md` §5.

## Frontend Rules

1. No route handler, layout, or Screen trusts a client-supplied `workspace_id`/`project_id` value as authoritative — the server re-resolves and re-authorizes on every navigation (`07-route-layout-and-navigation-architecture.md` §5 rule 1).
2. Workspace is the tenancy boundary at the route layer, exactly as at the persistence layer (ADR-PMF-002) — an Enterprise-scoped route never implies automatic access to any specific Workspace's data.
3. A route whose resolved scope cannot be established renders Unauthorized behavior (`07-route-layout-and-navigation-architecture.md` §7), never a partial or best-guess render.
4. The Workspace switcher is the only sanctioned way a route's active Workspace changes — never an implicit change triggered by a screen transition (`03-navigation-contracts.md` §6).
5. The active-Workspace selection is Session State (server-issued, client-mirrored for render decisions only), never URL state or `localStorage` (`07-frontend-state-and-data-architecture.md` §6).

## Alternatives Considered

- **Trust a client-side `workspace_id` cookie/`localStorage` value to avoid a server round-trip on every navigation.** Rejected: this is precisely the trust-boundary violation ADR-PMF-034 and `06-canonical-api-contracts.md` §16 were written to prevent one layer down — accepting it at the frontend would make those two ADRs' guarantees optional in practice.
- **Resolve tenancy once at login and cache it client-side for the whole session with no re-validation.** Rejected: a Workspace switch, a revoked membership, or an expired session mid-session would then render stale/incorrect scope until an unrelated full reload — fail-closed re-validation on every request is required instead (`05-tenancy-rls-and-data-security.md` §3).

## Positive Consequences

- Closes the one remaining layer (frontend) where PR5/PR6's tenancy-resolution discipline could otherwise be silently bypassed by a convenient client-side shortcut.
- Makes a Workspace switch a well-defined, auditable event (full remount of tenant-scoped state, `07-frontend-state-and-data-architecture.md` §14) rather than an in-place patch that could momentarily leak cross-tenant state.

## Negative Consequences

- Requires a server round-trip for tenant-scope resolution on every navigation rather than an optimistic client-side render — a deliberate latency-for-safety tradeoff.

## Risks

- **Session-mirror staleness risk:** the client's minimal session mirror (§6 of `07-frontend-state-and-data-architecture.md`) could theoretically be used for a render decision after a server-side revocation — mitigated by never using the mirror for an authorization decision, only for UI display, with every actual Command/Query re-authorizing independently.

## Security and Data Implications

- Directly closes a class of cross-tenant leakage risk `05-tenancy-rls-and-data-security.md` §18's threat model already names for the persistence layer, extended to the frontend's own request-construction logic.

## Application Implications

- No change to PR4's authorization model; this ADR requires the frontend to invoke it on every request rather than assume a prior resolution still holds.

## Frontend Implications

- Establishes the tenant-context-resolution flow (`07-route-layout-and-navigation-architecture.md` §5) every route and layout in the canonical route map depends on.

## Migration Implications

- Any current route relying on a client-side tenancy shortcut is a defect to close during migration (`07-frontend-migration-strategy.md`), not a pattern to preserve.

## Compatibility Implications

- Compatible with Supabase Auth's current session/JWT model (`06-canonical-api-contracts.md` §14) — this ADR does not require a new authentication mechanism, only a rule about what the frontend trusts.

## Out of Scope

- The exact session-cookie/JWT implementation details (owned by Supabase Auth, unchanged by this ADR).

## Validation

Validation criteria: (1) every route in `07-route-layout-and-navigation-architecture.md` §2 resolves tenancy per §5's flow with no documented exception; (2) `07-frontend-state-and-data-architecture.md` §6 confirms active-Workspace selection is Session State, not URL/`localStorage`.

## References

- `docs/product-architecture/07-route-layout-and-navigation-architecture.md` §5
- `docs/product-architecture/06-canonical-api-contracts.md` §16
- `docs/adr/ADR-PMF-034-workspace-scoped-operational-persistence.md`
