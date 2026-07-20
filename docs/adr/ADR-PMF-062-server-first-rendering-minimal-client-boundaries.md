# ADR-PMF-062: Server-First Rendering and Minimal Client Boundaries

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

AGENTS.md governing this repository already flags that the installed Next.js version has breaking changes versus prior conventions and directs engineers to the vendored framework documentation before writing code — a signal that this codebase's rendering model cannot be assumed from generic Next.js familiarity. `03-canonical-information-architecture.md` §5 shows PMFreak's fifty canonical screens are dominated by read-heavy, tenant-scoped Command Centers, Registers, and Feeds rather than highly interactive, client-state-heavy surfaces. PR7 must decide the default rendering posture — server-rendered by default with narrow client boundaries, or client-rendered by default with server rendering as the exception — before module and state architecture (ADR-PMF-058, ADR-PMF-059) can be applied consistently.

## Decision

**Server Components and server-rendered data are the default; a Client Component boundary exists only where genuine interactivity, browser APIs, or client-local state require it.** Full specification: `07-canonical-frontend-architecture.md` §3 principle 2, §5.

## Frontend Rules

1. A Screen (composition root for one canonical screen, `07-frontend-module-boundaries.md` §1) is a Server Component by default; it opts a subtree into a Client Component boundary only for the specific interactive piece that needs it (a form, a floating action, a live filter).
2. Data fetching for initial render happens server-side through the Application Contracts layer (ADR-PMF-060) — a screen never client-side-fetches data it could have received already-resolved from the server render.
3. A Client Component boundary is never adopted merely because it is the more familiar mental model — it requires a genuine interactivity or browser-API justification, mirroring `07-canonical-frontend-architecture.md` §2's "Client Components are not forbidden... never used as the default simply because it is the more familiar mental model."
4. Tenant-context resolution (ADR-PMF-061) happens server-side, consistent with this ADR's server-first default — a Client Component never independently re-resolves tenancy.

## Alternatives Considered

- **Client-rendered-by-default (traditional SPA data-fetching pattern).** Rejected: would duplicate tenant/session resolution work in the browser for screens that are, per `03-canonical-information-architecture.md` §5, overwhelmingly read-heavy and already benefit from server-side session availability; also widens the surface for the tenant-authority risks ADR-PMF-061 exists to close.
- **No default posture — decided per-screen with no governing rule.** Rejected: this is closest to the current, unformalized state and provides no consistent test for whether a new screen's rendering choice is correct.

## Positive Consequences

- Reduces the amount of tenant-scoped data and DTO-shaped state that ever needs to exist in the browser, narrowing the blast radius of a client-side bug.
- Gives every future Screen a default answer ("Server Component, narrow client islands") rather than a per-implementer judgment call.

## Negative Consequences

- Requires deliberate justification for every Client Component boundary — slightly more design overhead than defaulting everything to client-rendered.

## Risks

- **Over-broad Client Component risk:** a Screen adopting `"use client"` at its root "for convenience" would silently widen the client boundary far past what this ADR intends — mitigated by the module boundary rule that Screens are Server Components by default (`07-frontend-module-boundaries.md` §1) and by treating a root-level Client Component as a fitness-function-checkable smell during migration.

## Security and Data Implications

- Keeps sensitive-classification data (`05-tenancy-rls-and-data-security.md` §10) resolved and rendered server-side by default, reducing exposure in client-side bundles/state.

## Application Implications

- No change to PR4's application layer; server-rendered Screens consume the same Application Contracts layer (ADR-PMF-060) any Client Component would.

## Frontend Implications

- Establishes the rendering default every module in `07-frontend-module-boundaries.md` §2 is expected to follow for its Screens layer.

## Migration Implications

- Existing client-heavy routes are reclassified during migration (`07-frontend-migration-strategy.md`) toward this default, not converted all at once.

## Compatibility Implications

- Requires the Next.js version currently installed to support the App Router's Server/Client Component model as documented in its vendored docs (per AGENTS.md's own instruction to consult `node_modules/next/dist/docs/` before implementation) — no framework version change is made by this ADR.

## Out of Scope

- The exact criteria for "genuine interactivity" beyond the illustrative examples above (left to implementation-time judgment within the stated principle).

## Validation

Validation criteria: (1) every Screen in the module catalog (`07-frontend-module-boundaries.md` §2) is documented as Server-Component-first; (2) every documented Client Component boundary in future implementation states its interactivity/browser-API justification.

## References

- `docs/product-architecture/07-canonical-frontend-architecture.md` §3, §5
- `AGENTS.md`
- `docs/product-architecture/03-canonical-information-architecture.md` §5
