# ADR-PMF-055: API Transport and Application Security Model

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR5's ADR-PMF-042 already ratified a five-layer defense-in-depth chain (Authentication → Application Authorization → Scoped Repository → RLS → Database Constraints) and documented real prior incidents this architecture must not repeat: a self-referential RLS recursion incident, a fail-open billing policy that let authenticated users overwrite Stripe fields via the REST API bypassing webhook signature checks, and a plaintext bearer secret readable through an overly permissive column grant. ADR-PMF-042's own binding API Implication is explicit: "PR6's API layer must not expose any direct-database-access pattern to end clients that would rely on RLS as the sole authorization mechanism without an accompanying application-layer authorization check." This ADR fixes the API-layer transport and application security controls needed to honor that, and to prevent the specific incident patterns PR5 already documented from recurring at the API boundary.

## Decision

**The API layer is the outermost of PR5's five defense-in-depth layers, performing Authentication and invoking (never reimplementing) Application Authorization before any request reaches the Scoped Repository/RLS/Database Constraints layers beneath it. CSRF protection applies to session-authenticated browser requests; every authenticated request undergoes full JWT validation; every signed request (webhooks, service-to-service) is replay-protected via nonce/timestamp; secrets never appear in any request/response body, query string, or log; every service account and Agent identity is scoped to least privilege.**

## API Rules

1. No endpoint's authorization decision may be satisfied by RLS alone — the API layer's Application Authorization check (ADR-PMF-050) is mandatory and independent of whatever RLS additionally enforces beneath it.
2. Session-authenticated (cookie-based) browser requests require CSRF protection; bearer-token-authenticated service/Agent calls are exempt from CSRF but subject to full token validation instead.
3. Every authenticated request's JWT is validated for signature, expiry, issuer, and audience before the request is translated into a Command or Query.
4. Every signed request (webhook deliveries, service-to-service calls) is rejected if its timestamp is stale, regardless of signature validity, to prevent replay.
5. No API response, log entry, or error message (§4 of ADR-PMF-049) ever includes a secret, credential, or provider token — restated as a binding API-layer rule, not merely a persistence-layer one.
6. Every service account and Agent identity's granted scope is reviewed against the principle of least privilege, scoped no more broadly than its stated purpose requires — mirroring ADR-PMF-031's per-outbound-port security classification discipline, now applied to inbound API credentials.

## Alternatives Considered

- **Rely on RLS as the sole tenant-isolation control for API requests, skipping a separate application-layer check for performance.** Rejected: this is precisely the pattern ADR-PMF-042's own API Implication prohibits, and precisely the kind of single-layer reliance that PR5's own incident history (the fail-open billing policy) shows is insufficient in practice.
- **Use the same authentication mechanism (session cookie) for both browser and service-to-service/Agent calls.** Rejected: session cookies are inherently tied to CSRF risk and browser context; service accounts and Agent identities need a bearer-token mechanism that does not depend on cookie/browser semantics, consistent with ADR-PMF-050's three-actor-type model.
- **Defer replay protection to each individual signed-request consumer's discretion.** Rejected: given PR5's documented billing-webhook-signature-bypass incident, replay/signature verification is treated as a mandatory platform-level control for every signed request, not an optional per-integration choice.

## Positive Consequences

- Directly closes the gap ADR-PMF-042 flagged as a binding but previously unaddressed API Implication.
- Gives every future implementation PR a concrete checklist (CSRF, JWT validation, replay protection, secret handling, least privilege) instead of a general "be secure" instruction.

## Negative Consequences

- Full JWT validation and replay-protection checks add latency to every request, though negligible compared to typical database round-trip time.
- Maintaining least-privilege scopes for service accounts and Agent identities requires ongoing review discipline as new integrations and Agent capabilities are added.

## Risks

- **Scope-creep risk:** a service account or Agent identity initially scoped narrowly can accumulate broader access over time if scope changes aren't reviewed with the same rigor as initial issuance — this ADR names least privilege as a requirement but does not itself build a periodic-review mechanism.
- **CSRF-exemption risk:** incorrectly classifying a request as "bearer-token, CSRF-exempt" when it is actually browser-originated could reopen a CSRF vector — rule 2's distinction must be enforced precisely at the transport layer during implementation.

## Security and Data Implications

- This ADR is the API-layer half of PR5's defense-in-depth chain; ADR-PMF-042 remains authoritative for the persistence-layer half (RLS, database constraints, service-role restrictions) — the two are designed to compose, not duplicate each other's responsibility.
- Directly addresses PR5's documented incident patterns: rule 1 addresses the fail-open billing-policy incident class; rule 4 addresses the webhook-signature-bypass incident class; rule 5 addresses the plaintext-bearer-secret incident class.

## Application Implications

- No change to application-layer authorization logic itself — this ADR requires the API layer to invoke it, not modify what it decides.

## Frontend Implications

- PR7's browser-originated requests continue to rely on session-cookie authentication and must carry CSRF tokens per rule 2 — no new authentication flow for the human-actor path.

## Migration Implications

- None executed by this ADR. Bringing existing route handlers up to this security standard, including remediating any remaining single-layer-reliance patterns, is PR9+ work informed by PR5's incident history.

## Compatibility Implications

- Fully compatible with continued operation of the current Supabase Auth session mechanism; adds new bearer-token paths for service accounts and Agent identities without displacing it.

## Out of Scope

- Specific CSRF token implementation mechanics (double-submit cookie, synchronizer token, etc.) — implementation detail.
- Specific JWT library/validation tooling choice.

## Validation

Validation criteria: (1) `06-api-security-model.md` §6–7 documents the five-layer chain and this ADR's six rules consistently; (2) no `06-*` document proposes an endpoint whose sole authorization mechanism is RLS; (3) every incident pattern named in PR5's tenancy/RLS document (self-referential RLS, fail-open billing policy, plaintext bearer secret) has a corresponding preventive rule in this ADR.

## References

- `docs/adr/ADR-PMF-042-defense-in-depth-rls.md`
- `docs/product-architecture/05-tenancy-rls-and-data-security.md`
- `docs/product-architecture/06-api-security-model.md` §6–7
