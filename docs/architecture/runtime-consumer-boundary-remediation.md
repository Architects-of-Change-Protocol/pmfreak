# Runtime Consumer Boundary Remediation

This remediation removes two runtime-consumer boundary violations without changing unrelated Governance Gate contracts.

## Imports removed

- App/API routes no longer import `@/lib/security/access-guards` directly for `AccessDeniedError` checks.
- `src/aoc/runtime-consumer/runtime-federated-ingestion.ts` no longer imports `@/lib/live-federation/ingestion/event-normalizer`.

## Boundary introduced

- `AccessDeniedError` has a single canonical owner in `src/aoc/enterprise/runtime/access-guards-bridge.ts`; `@/aoc/runtime-consumer` re-exports that class for app routes, and `src/lib/security/access-guards.ts` imports and re-exports the same class identity.
- Runtime federated ingestion defines a minimal `RuntimeFederatedOperationalEvent` contract in the boundary instead of depending on live federation internals.

## Why app routes use the runtime-consumer boundary

App and API routes make runtime authority decisions that must stay decoupled from low-level security implementation modules. Routing the shared access-denial contract through `@/aoc/runtime-consumer` keeps response semantics intact while ensuring route-level authorization behavior flows through the approved runtime authority boundary. The low-level guard module also reuses the canonical enterprise bridge class, so `instanceof AccessDeniedError` remains reliable across runtime authority and route error handling.

## Why runtime-consumer avoids live federation internals

The runtime-consumer layer is a sovereignty boundary. Importing live federation implementation details from inside the boundary would make runtime consumers a backdoor into ingestion internals. The boundary now owns only the minimal event shape it needs to project ingestion signals into runtime surfaces.

## Remaining non-scope Governance Gate failures

This PR intentionally does not modify stale workspace, upload, imprint, navigation, compression, removed-feature, or intentional-redesign contracts. Any remaining Governance Gate failures in those categories are outside this remediation scope.
