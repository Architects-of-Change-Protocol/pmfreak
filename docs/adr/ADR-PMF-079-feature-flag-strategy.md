# ADR-PMF-079: Feature Flag Strategy — Server-Evaluated Environment Flags

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

Both `07-canonical-frontend-architecture.md` §13 and `08-design-system.md` §6 leave feature-flag tooling as an open decision. PR9's reconnaissance found no existing feature-flag system in the product: the only `FEATURE_` string matches in the codebase are inside `src/lib/playbook-engine/conversation/decision-support/*`, explicitly documented as a proposed, never-activated flag. The sprint brief (Fase 13) requires `FEATURE_COMMAND_CENTER` and `FEATURE_AGENT_VIEW` so the new experience can be piloted, demoed, and rolled back without deploying a revert.

## Decision

**PR9 introduces `src/platform/feature-flags.ts`: a single `isFeatureEnabled(flag)` function reading `process.env.FEATURE_*` server-side, checked in each new route's layout/page before rendering** (`notFound()` when disabled). No client-side override store, no third-party flag provider/SDK, no database-backed flag table.

Two flags for this PR: `FEATURE_COMMAND_CENTER` (gates the entire `/w/[workspaceId]/p/[projectId]/*` route tree via its layout) and `FEATURE_AGENT_VIEW` (gates the two Agent routes specifically, nested inside the already-gated tree, since Agent Foundation is the least mature of the five modules).

## Frontend Rules

1. Flags are evaluated server-side only, inside a Server Component (`layout.tsx`/`page.tsx`), never read from client-side `process.env` or exposed to the browser bundle — consistent with `07-frontend-state-and-data-architecture.md` §6's rule that a feature-flag snapshot is Session/Server State, not a client-mutable value.
2. A disabled flag renders Next's standard `notFound()` — the route behaves as if it doesn't exist, rather than showing a "coming soon" placeholder, avoiding a stub-implementation smell for something not yet meant to be publicly visible.
3. `FEATURE_FLAGS` is a closed, typed union (`FeatureFlag`) — a typo in a flag name is a compile error, not a silently-always-false runtime check.

## Alternatives Considered

- **Adopt a third-party flag provider (LaunchDarkly, Flagsmith, etc.).** Rejected: no evidenced need yet for percentage rollouts, targeting rules, or remote config — the same "adopt infrastructure only with evidenced need" precedent `06-canonical-api-contracts.md` §4 already set for GraphQL. Two boolean env-var flags don't justify a new vendor dependency or its governance overhead.
- **Store flags in a database table with a UI toggle.** Rejected for this PR: over-engineered for a two-flag, pilot-stage need; revisit if per-Workspace flag targeting becomes a real requirement.
- **A client-side flag context/provider.** Rejected: flags gate whether a route exists at all (server-rendered), not a client-side conditional inside an already-rendered page — a client provider would be solving a problem this PR doesn't have.

## Positive Consequences

- Zero new dependencies. Toggling either flag is an environment-variable change with no code deploy, satisfying Fase 13's "pilotos, demos, rollback" requirement directly.
- The flag check sits at the layout level for `FEATURE_COMMAND_CENTER`, so a single toggle gates all five new modules at once — no per-screen flag-check duplication to keep in sync.

## Negative Consequences

- No support for per-Workspace or per-user targeting, gradual rollout percentages, or remote toggling without a deploy/restart (env vars are typically read at process start in most hosting setups) — acceptable for a pilot-stage flag, not for a general-purpose rollout mechanism.

## Risks

- **Restart-required risk:** depending on the hosting platform, changing an env var may require a redeploy/restart to take effect, unlike a remote-config-backed flag. Documented here so it isn't mistaken for a runtime-toggleable flag during a live demo.

## Security and Data Implications

- None — flags gate route visibility only; every underlying Query/Command still re-authorizes independently regardless of flag state (a disabled flag is not a security boundary, only a visibility one).

## Application Implications

- None — no new Command or Query.

## Frontend Implications

- Establishes the first real feature-flag seam in the frontend, per `07-canonical-frontend-architecture.md` §13's open decision — a future PR adopting a richer flag system can replace `isFeatureEnabled`'s implementation without changing any call site's shape.

## Migration Implications

- None — purely additive.

## Compatibility Implications

- None.

## Out of Scope

- Per-Workspace/per-user flag targeting.
- A remote config service or admin UI for toggling flags.
- Migrating the dormant `decision-support` flag references in `src/lib/playbook-engine` to this system (unrelated, pre-existing, and out of this PR's scope).

## Validation

- `tests/command-center-integration.test.mjs` asserts the new route layout checks `isFeatureEnabled("FEATURE_COMMAND_CENTER")` and calls `notFound()` when disabled.

## References

- `docs/product-architecture/07-canonical-frontend-architecture.md` §13
- `docs/product-architecture/08-design-system.md` §6
- `src/platform/feature-flags.ts`
