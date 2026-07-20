# ADR-PMF-054: API Idempotency and Optimistic Concurrency Contract

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR5's persistence architecture already ratified both mechanisms this ADR must expose at the wire boundary: an idempotency-record model for Commands (PR5 §21, ADR-PMF-037) and optimistic concurrency via a `version` field for a defined set of aggregates (PR5 §14, PR5 §18). Neither has an API contract yet — no header names, no conflict semantics, no client-facing rules for when each applies. Without one, a client retrying a timed-out Command has no safe way to know whether retrying will double-execute it, and a client updating a resource concurrently modified by another actor has no way to detect the conflict before silently overwriting it.

## Decision

**Commands PR5's idempotency-record model requires accept a client-supplied `Idempotency-Key` header, scoped to `(actor or service account, Command, resolved tenant scope, key)`; a replay with an identical payload within the record's TTL returns the original result without re-execution, and a replay with a different payload returns `ConflictError`. Resources backed by a PR5-versioned aggregate expose their `version` via `ETag`; mutating requests supply `If-Match`, and a mismatch returns `StaleVersionError` rather than a silent overwrite.**

## API Rules

1. Every Command `06-command-catalog.md` marks idempotent accepts `Idempotency-Key`; a client omitting the header on such a Command is not treated as an error, but the request is not protected against duplicate execution on retry — the header is required for protection, not required to be present to succeed.
2. The idempotency scope always includes the resolved tenant scope (§16 of `06-canonical-api-contracts.md`) — the same key under a different Workspace or a different actor is a distinct record, never collided.
3. A replayed request within TTL, identical payload, returns the original response verbatim (same status, same body) without re-invoking the Command handler's side effects.
4. A replayed request within TTL, different payload, returns `ConflictError` — never a silently different result and never a silent overwrite of the original.
5. Every resource in PR5 §14's versioned-aggregate list exposes `ETag`; every mutating request to such a resource requires `If-Match`; a version mismatch returns `StaleVersionError`, and the client is expected to refetch and reapply, never to retry blindly.
6. Append-only/versioned-by-supersession resources (Decision history, Audit) do not use `If-Match` for their protection — their protection is against concurrent conflicting creation, matching PR5 §14's own distinction, not overwrite protection on a mutable field.

## Alternatives Considered

- **Server-generated idempotency keys instead of client-supplied.** Rejected: a server-generated key cannot protect against the exact failure mode idempotency exists to solve — a client that never received the original response (e.g., due to a network timeout) needs to supply the *same* key on retry, which only the client can guarantee across a lost response.
- **Last-write-wins concurrency (no `ETag`/`If-Match`, simply accept every update).** Rejected: this is the "silent overwrite" PR5 §14 explicitly warns against for optimistic-concurrency-required aggregates; it would let a concurrent PM's Task update and Task assignee's Task update destroy each other's changes with no detection.
- **Pessimistic locking (server-side locks held across a request) instead of optimistic concurrency.** Rejected: PR5 already chose optimistic concurrency for the aggregates in question (PR5 §14) for its own reasons (no long-held locks, better concurrency under normal contention); this ADR applies that existing decision at the wire boundary rather than reopening it.

## Positive Consequences

- Gives clients a safe, well-understood retry strategy for network failures on mutating Commands, without needing bespoke per-endpoint retry logic.
- Makes concurrent-edit conflicts (e.g., two PMs editing the same Project context) detectable and resolvable instead of silently lost.

## Negative Consequences

- Every idempotency-protected Command requires server-side storage of idempotency records for the duration of their TTL — additional persistence and cleanup burden (PR5 §21).
- `If-Match` requires every client to track and resend the current `ETag`, adding minor client-side state management for versioned resources.

## Risks

- **TTL-too-short risk:** if a Command's idempotency-record TTL (exact values open, `06-canonical-api-contracts.md` §33) expires before a legitimately delayed retry arrives, the retry is treated as new and could double-execute — this ADR fixes the mechanism but not the TTL values, which must be chosen with this failure mode in mind during implementation.
- **Client non-compliance risk:** nothing prevents a client from omitting `Idempotency-Key` or `If-Match` where recommended but not enforced (rule 1) — such a client accepts the corresponding risk (duplicate execution, silent overwrite) knowingly, but the API cannot force compliance without breaking otherwise-valid simple clients.

## Security and Data Implications

- Idempotency-key scoping to `(actor, Command, tenant scope, key)` (rule 2) prevents one actor's idempotency key from ever colliding with, or being replayable by, another actor or Workspace — this is a tenancy-isolation property, not just a correctness one.

## Application Implications

- Application-layer Command handlers already implement idempotency-record checks per PR5's model (ADR-PMF-037); this ADR requires the API layer to correctly plumb the client-supplied key through, not reimplement the check itself.

## Frontend Implications

- PR7's mutation client code is expected to generate and retain an `Idempotency-Key` per user-initiated mutation attempt (not per HTTP retry — the same key across automatic retries of the same logical action) and to handle `StaleVersionError` by refetching and prompting the user to reconcile, rather than silently discarding the user's edit.

## Migration Implications

- None executed by this ADR. Idempotency-record and `version` field coverage across the current schema is a PR5 §14/§21 migration gap (optimistic concurrency found in only four subsystems today) — this ADR's API contract applies as each aggregate's persistence-layer support is delivered.

## Compatibility Implications

- Fully compatible with clients that do not yet supply `Idempotency-Key`/`If-Match` — they simply forgo the corresponding protection, per rule 1's non-enforcement stance, rather than being rejected outright.

## Out of Scope

- Exact idempotency-key TTL values per Command (`06-canonical-api-contracts.md` §33).
- Whether `Idempotency-Key` becomes strictly required (rejecting requests without it) for a future API major version — left for evidence-based reconsideration, not decided here.

## Validation

Validation criteria: (1) `06-api-security-model.md` §4–5 documents the idempotency and concurrency contracts exactly as fixed by this ADR; (2) every Command in `06-command-catalog.md` marked "Idempotent: Yes" is cross-referenced against PR5's idempotency-record model; (3) every resource in PR5 §14's versioned list appears with `ETag`/`If-Match` support in `06-canonical-api-contracts.md` §18.

## References

- `docs/adr/ADR-PMF-037-transactional-outbox-idempotent-inbox.md`
- `docs/product-architecture/05-canonical-persistence-architecture.md` §14, §21
- `docs/product-architecture/06-api-security-model.md` §4–5
