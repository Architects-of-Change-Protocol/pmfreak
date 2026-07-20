# ADR-PMF-052: Outbound Webhook Strategy

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-026 (Domain/Integration Events) left webhooks explicitly as "a PR6+ decision, informed by which events this ADR's catalog already marks as Integration candidates." ADR-PMF-051 has now fixed that the fourteen PR4-flagged Integration Events are the only events eligible for external delivery. What remains is the delivery mechanism itself: how an external subscriber registers interest, how deliveries are authenticated by the receiver, how failures are retried, and what happens to a delivery that never succeeds. The current system already has some inbound webhook handling (e.g., billing) but no outbound webhook subscription system at all (PR5 §24 current-state: "Webhooks — Some inbound webhook receivers exist... no outbound webhook subscription system").

## Decision

**Outbound webhooks deliver the fourteen-event Integration Event allowlist to Workspace-scoped subscriptions, each bound to an explicit event-type allowlist. Every delivery is HMAC-signed over payload and timestamp; delivery is at-least-once with bounded exponential-backoff retry; exhausted deliveries land in an inspectable, manually replayable per-subscription dead-letter queue; ordering is best-effort per-aggregate only; every payload carries the same `event_version` as its source event.**

## API Rules

1. A subscription is created, paused, and revoked only by Workspace Owner/Admin, is itself audited, and is bound to an explicit event-type allowlist drawn from the fourteen-event set — never "subscribe to everything."
2. Every delivery includes an HMAC-SHA256 signature over `timestamp + "." + raw_payload`, using a per-subscription secret issued at creation and rotatable on demand; secrets are never echoed back in any API response after initial issuance.
3. A successful delivery (2xx response) is never retried; a failed delivery is retried with exponential backoff up to a bounded attempt count, after which it moves to the dead-letter queue.
4. Dead-lettered deliveries are retained for a bounded, documented period, inspectable via a dedicated endpoint, and manually replayable — never silently dropped or purged without the fact of purge itself being recorded.
5. Ordering is guaranteed only best-effort, per-aggregate, in outbox sequence order — no cross-aggregate global ordering guarantee is made, and subscribers are expected to use payload sequence/timestamp fields to reorder if strict ordering matters to them.
6. A breaking payload-shape change ships as a new `event_version`, delivered only to subscriptions that have explicitly opted into it — existing subscribers continue receiving the version they subscribed to until that version's own deprecation.

## Alternatives Considered

- **Poll-based integration (subscribers periodically query a "recent events" endpoint) instead of push webhooks.** Rejected: push delivery is lower-latency and lower-overhead for both PMFreak and subscribers at the event volumes anticipated; a polling endpoint remains a possible future addition (the "event history" endpoint ADR-PMF-037/ADR-PMF-051 leave open) but does not replace push delivery as the primary integration mechanism.
- **Guarantee strict global event ordering across all aggregates.** Rejected: this would require either a single global sequence bottleneck or complex distributed-ordering machinery disproportionate to the actual integration need; per-aggregate best-effort ordering matches how PR5's outbox already orders records and is sufficient for every currently anticipated consumer.
- **No dead-letter queue — drop deliveries that exhaust retries.** Rejected: silent, unrecoverable event loss for an external integration is an unacceptable operational and trust failure, especially for Integration Events tied to Decisions, Outcomes, and Enterprise Knowledge ratification.

## Positive Consequences

- Gives external integrations (and, eventually, a future Marketplace/partner ecosystem, `06-canonical-api-contracts.md` §33) a concrete, implementable delivery contract instead of an open question.
- Signature and replay-timestamp verification (§3.2 of `06-event-catalog.md`) gives subscribers a standard, well-understood security model (matching common industry webhook-signing conventions) rather than a bespoke scheme.

## Negative Consequences

- Operating a reliable webhook delivery pipeline (retry, dead-letter, secret rotation) is nontrivial infrastructure that does not exist today and must be built from scratch.
- Per-subscription secret management and dead-letter inspection add an ongoing operational surface.

## Risks

- **Subscriber-abuse risk:** a malicious or misconfigured subscriber URL could be used to probe internal network topology (SSRF) if delivery targets are not validated — this ADR does not itself specify the target-URL validation mechanism, only requires that outbound delivery infrastructure address it as part of implementation.
- **Dead-letter growth risk:** a permanently unreachable subscriber accumulates dead-lettered deliveries indefinitely without a retention policy — rule 4 requires a bounded retention period, but the exact value remains open (`06-canonical-api-contracts.md` §33).

## Security and Data Implications

- HMAC signing and timestamp-based replay protection are the primary security controls for this integration surface (`06-api-security-model.md` §7).
- Payloads are restricted to the fourteen-event allowlist (ADR-PMF-051) — bounding what any webhook delivery, even to a compromised subscriber endpoint, could ever leak.
- Delivery-target URL validation (SSRF prevention) is a required implementation concern flagged by this ADR's Risks section, not separately re-litigated here.

## Application Implications

- The webhook delivery pipeline is a new outbound adapter (ADR-PMF-031 outbound port: Event Publisher/Outbox's external-delivery extension) — application-layer Command handlers are unaffected; they continue to write outbox records exactly as before.

## Frontend Implications

- Workspace Owner/Admin-facing subscription management (create/pause/revoke, view dead-letter queue) is a new PR7 surface, informed by this ADR's endpoints but not designed here.

## Migration Implications

- None executed by this ADR. The entire outbound webhook pipeline is new infrastructure, built in PR9+, gated on the outbox itself existing first (PR5 §24 current-state gap).

## Compatibility Implications

- Additive — does not affect the existing inbound webhook receivers (e.g., billing), which remain a separate, already-functioning concern.

## Out of Scope

- Exact retry backoff schedule and dead-letter retention period values (`06-canonical-api-contracts.md` §33).
- SSRF-prevention implementation mechanics for subscription target-URL validation.

## Validation

Validation criteria: (1) `06-event-catalog.md` §3 documents subscription, signature, retry, dead-letter, ordering, and version exactly as this ADR fixes them; (2) no webhook delivery is proposed for an event outside the fourteen-event Integration allowlist; (3) every delivery is documented as signed and replay-protected.

## References

- `docs/adr/ADR-PMF-026-domain-integration-events.md`
- `docs/adr/ADR-PMF-051-event-publication-model.md`
- `docs/product-architecture/06-event-catalog.md` §3
