# ADR-PMF-059: Server, URL and Local State Separation

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`04-canonical-application-architecture.md` §9.5 already named the risk of a projection becoming an accidental second source of truth at the application layer (the `pmo_command_center_snapshots`/`operational_command_centers` split, PR1 §12 C-3). The same risk exists one layer up: a frontend that copies a fetched Query result into an independent client store creates a second, independently-updatable copy of server-owned data with no invalidation guarantee. PR7 must decide whether the frontend formally separates server-owned state from client-owned state, or leaves that boundary to be redrawn ad hoc per component, which is how the current codebase's minimal `src/hooks/` (two files) alongside a 145-entry `src/lib/` suggests state ownership has not yet been formalized.

## Decision

**Five state kinds — Server, URL, Local, Form, and Session — are formally separated, each with exactly one legitimate home; global client state is exceptional and requires explicit justification.** Full specification: `07-frontend-state-and-data-architecture.md`.

## Frontend Rules

1. Server state (a Query result) is never duplicated into a global client store — the Query cache (`07-frontend-state-and-data-architecture.md` §4, §9) is the only copy.
2. URL state (filters, pagination, sort, selected tab) lives in the URL wherever the underlying data is safe to share at that URL — never only in memory where shareability is otherwise safe.
3. Local state (open/closed, hover, pre-submission draft) is scoped to its owning component by default and is never promoted to global state without a documented reason.
4. A global client store entry must name what it holds, why it cannot be URL/Session/Server state, and which modules legitimately read it (`07-frontend-state-and-data-architecture.md` §7).

## Alternatives Considered

- **A single global store (Redux/Zustand-style) holding all fetched data and UI state uniformly.** Rejected: this is precisely the pattern that produces an accidental second source of truth for server data, mirroring the projection-ownership defect PR4 §9.5 already named once.
- **No formal taxonomy — state lives wherever a given implementation finds convenient.** Rejected: this is the current, unformalized state, and it is what produces the "which store has the current value" ambiguity a formal taxonomy exists to eliminate.

## Positive Consequences

- Gives every future state-related bug a fixed diagnostic question: which of the five kinds is this, and is it in its correct home.
- Makes global-state usage an exception requiring justification rather than a default, keeping the eventual choice of state library (open, §13) low-stakes.

## Negative Consequences

- Requires more upfront classification discipline per piece of state than an ungoverned "just add a store field" approach.

## Risks

- **Kind-ambiguity risk:** some values (e.g., a multi-step wizard's draft) plausibly fit more than one kind — mitigated by the explicit precedence and justification requirement in `07-frontend-state-and-data-architecture.md` §7 rather than leaving the call undocumented.

## Security and Data Implications

- URL state is explicitly restricted from carrying data above the "Internal" classification (`07-frontend-state-and-data-architecture.md` §14) — a shareable link never leaks Confidential-or-above data by construction.

## Application Implications

- Server state's shape is exactly the Response/Summary/Projection DTO shape PR6 defines (`07-frontend-state-and-data-architecture.md` §2 rule 3) — the frontend never reshapes a DTO into an independent client model that could drift from the API contract.

## Frontend Implications

- Establishes the taxonomy every other `07-*` document assumes when referring to "state" — `07-command-query-and-error-experience.md` and `07-ai-memory-and-intelligence-experience.md` both build on it.

## Migration Implications

- Existing state-handling code is classified against this taxonomy during migration (`07-frontend-migration-strategy.md`); no existing state is moved by this PR.

## Compatibility Implications

- Compatible with any specific state/data-fetching library chosen later (§13, open) — this ADR fixes the taxonomy, not the implementation.

## Out of Scope

- The exact state-management and server-state libraries (`07-canonical-frontend-architecture.md` §13).

## Validation

Validation criteria: (1) every state-handling pattern described in `07-frontend-state-and-data-architecture.md` maps to exactly one of the five kinds; (2) every documented global-state use case in §7 of that document states what it holds and why it qualifies as exceptional.

## References

- `docs/product-architecture/07-frontend-state-and-data-architecture.md`
- `docs/product-architecture/04-canonical-application-architecture.md` §9.5, §24
