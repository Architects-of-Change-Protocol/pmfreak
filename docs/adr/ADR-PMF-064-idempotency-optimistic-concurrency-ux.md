# ADR-PMF-064: Idempotency and Optimistic Concurrency UX

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-054 (PR6) already gives idempotency and optimistic concurrency a wire contract: an `Idempotency-Key` header for flagged Commands, and `ETag`/`If-Match`/`version` for versioned resources, with `ConflictError` and `StaleVersionError` as their respective failure signals. Neither ADR-PMF-054 nor any prior PR specifies what the frontend does with these mechanisms — whether a retry regenerates its key (defeating idempotency), whether a double-click is protected, or whether a version conflict is surfaced explicitly or silently overwritten. Left unspecified, a future implementation could easily reintroduce the exact double-submission and silent-overwrite risks PR6's wire contract was built to prevent, simply by using the mechanism incorrectly at the one layer (the browser) where a user can actually double-click or edit concurrently.

## Decision

**Every idempotency-flagged Command carries a client-generated `Idempotency-Key`, generated once per user-initiated attempt and reused across automatic retries of that attempt; every versioned resource's edit carries its current `version`/`ETag` as `If-Match`, and a `StaleVersionError` response is surfaced as an explicit, comparable conflict — never a silent overwrite and never auto-retried.** Full specification: `07-frontend-state-and-data-architecture.md` §11–§12, `07-command-query-and-error-experience.md` §5–§6.

## Frontend Rules

1. An `Idempotency-Key` is generated once per user-initiated attempt, reused across automatic network retries of that same attempt, and never reused across two distinct user-initiated submissions (`07-frontend-state-and-data-architecture.md` §11).
2. Double-submit protection (disabled submit controls, ignored duplicate rapid clicks) relies on the same idempotency key rather than a separate, parallel mechanism.
3. A versioned resource's Server State cache entry stores its `version`/`ETag` alongside the data; every edit Command for that resource submits it as `If-Match` (`07-frontend-state-and-data-architecture.md` §12).
4. A `StaleVersionError` renders the user's attempted change alongside the current server state and offers reapply-on-top or discard — never a silent overwrite, and never an automatic retry, matching `06-error-model.md` §3's "not retryable" classification (`07-command-query-and-error-experience.md` §6).
5. Commands with irreversible or sensitive effects are never rendered optimistically; their UI waits for the confirmed Response DTO (`07-frontend-state-and-data-architecture.md` §10).

## Alternatives Considered

- **Regenerate the idempotency key on every retry for "freshness."** Rejected: this defeats the entire mechanism ADR-PMF-054 defines — a regenerated key on retry would let a network-timeout retry double-execute the Command exactly as if no key had been sent at all.
- **Silently overwrite on `StaleVersionError` and let the last write win.** Rejected: this is precisely the silent-overwrite behavior ADR-PMF-054/`06-canonical-api-contracts.md` §18 exist to prevent — accepting it at the frontend would make the API's optimistic-concurrency contract cosmetic.

## Positive Consequences

- Makes network-retry safety and concurrent-edit safety consistent, auditable UI behaviors rather than per-implementer judgment calls.
- Gives every destructive/sensitive Command a documented reason it is never optimistic (§10 of `07-frontend-state-and-data-architecture.md`), closing a class of "looked successful, then silently failed" user-trust defects.

## Negative Consequences

- Requires every Feature dispatching a flagged Command to manage key lifecycle explicitly (generate once, persist across retry) rather than letting a generic HTTP client layer handle retries transparently.

## Risks

- **Key-lifecycle bug risk:** an incorrectly-scoped key (e.g., held in a variable that resets on component remount mid-retry) could still defeat idempotency in practice — mitigated by placing key generation in the Application Contracts layer's typed Command hook (`07-frontend-state-and-data-architecture.md` §8), not in each Feature independently.

## Security and Data Implications

- Prevents duplicate-execution of side-effecting Commands (e.g., a duplicate `RecordDecision`) that could otherwise corrupt an audit trail's accuracy (`04-canonical-application-architecture.md` §7.3 principle 24).

## Application Implications

- No change to PR4/PR5's idempotency-record model or version field; this ADR requires the frontend to use them correctly, not redesign them.

## Frontend Implications

- Establishes the retry and conflict UX every module's mutating Features must implement identically.

## Migration Implications

- Existing mutation code lacking idempotency-key/version handling is a named migration gap per Command, tracked in `07-frontend-migration-strategy.md`, prioritized by which Commands are flagged critical in `06-command-catalog.md`.

## Compatibility Implications

- Fully compatible with `06-canonical-api-contracts.md` §17–§18 and ADR-PMF-054 as already ratified.

## Out of Scope

- The exact idempotency-key TTL values and exact client-generation algorithm/library (implementation detail, not an architectural decision).

## Validation

Validation criteria: (1) every Command `06-command-catalog.md` flags idempotency-required has a documented frontend key-lifecycle in `07-frontend-state-and-data-architecture.md` §11; (2) every versioned-resource edit path in `07-command-query-and-error-experience.md` §6 shows the compare/reapply/discard flow with no silent-overwrite path.

## References

- `docs/product-architecture/07-frontend-state-and-data-architecture.md` §11–§12
- `docs/product-architecture/07-command-query-and-error-experience.md` §5–§6
- `docs/adr/ADR-PMF-054-idempotency-concurrency.md`
