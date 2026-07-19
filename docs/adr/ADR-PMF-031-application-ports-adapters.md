# ADR-PMF-031: Application Ports and Adapters

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

AGENTS.md governing this repository already flags that the underlying Next.js version has "breaking changes" versus training-data assumptions and directs engineers to read framework documentation before writing code — a reminder that frameworks change under a codebase over time. PR1's inspection additionally found the current implementation calling the Supabase SDK, and presumably specific AI provider SDKs, directly from feature code, with no abstraction layer between domain/application logic and any specific infrastructure technology. PR4 must decide whether future implementation work is permitted to continue that pattern (fast to write, hard to change later) or must be built against a boundary that makes the underlying database, AI provider, queue, and every other piece of infrastructure genuinely replaceable — which several of this PR's other decisions (ADR-PMF-023's modular monolith, ADR-PMF-027's model-provider abstraction) already assume exists.

## Decision

**The domain and application layers depend only on ports — abstract interfaces they define. Persistence, AI, search, integrations, and every other external provider are adapters implementing those ports; none of them may be depended on directly by domain or application code.** Full specification: `04-canonical-application-architecture.md` §19; layering restated in §9 and §48.

## Domain Rules

1. Every outbound capability the application layer needs (persistence, transaction management, event publishing, queues, object storage, search, vector retrieval, AI model/embedding providers, email/calendar/notification, identity, billing, audit sink, observability, secrets, feature configuration) is declared as a named port with documented purpose, failure semantics, timeout, retry, idempotency, and security classification (§19 of the parent document).
2. Every inbound entry point (web, API, background job, scheduled task, CLI, webhook, agent-triggered request) is a named inbound port whose only job is to translate its caller's request into a Command or Query and translate the result back — it contains no business logic of its own (§9.3).
3. No domain or application code imports a concrete infrastructure SDK type directly (§7.3 principle 21, §48's prohibited dependency list).
4. An adapter may be swapped for a different implementation of the same port without any change to domain or application code — this is the test for whether a port's contract is actually abstract enough.

## Alternatives Considered

- **No ports — let application services call Supabase/AI SDKs directly, matching current practice.** Rejected: this is exactly the pattern that makes "Frameworks Are Replaceable" (§7.3 principle 22) untestable and makes every other infrastructure-adjacent decision in this PR (§51's build-vs-buy boundaries, §55's deliberately-open provider choices) meaningless, since nothing would actually be swappable in practice.
- **A single generic "infrastructure gateway" object exposing every capability through one interface.** Rejected: this reproduces the "generic abstraction over tables" anti-pattern §18 of the parent document explicitly prohibits for repositories, at the infrastructure layer instead — a single God-interface is not meaningfully more replaceable than no abstraction at all, since swapping one capability still risks touching the shared interface.
- **Ports only for persistence, treating AI/search/integrations as acceptable direct dependencies given their specialized nature.** Rejected: AI providers are explicitly named as replaceable infrastructure (§51 of the parent document) and are the single most likely category to actually change (new model providers, new embedding providers) — carving them out of the port discipline would remove ports exactly where replaceability is most likely to be exercised in practice.

## Positive Consequences

- Makes the "Replaceable Infrastructure" list in `04-canonical-application-architecture.md` §51 (identity provider, email, queue, storage, vector database, AI provider, observability, billing, search engine) an actual architectural guarantee rather than an aspiration.
- Lets PR5 choose a database technology, and later PRs choose an AI provider or queue technology, without requiring a rewrite of domain or application logic — only the adapter changes.
- Gives testing a natural seam: domain and application logic can be tested against fake/in-memory adapters implementing the same ports, without needing real infrastructure.

## Negative Consequences

- Every infrastructure capability requires an explicit interface definition before it can be used — more up-front design work than calling an SDK directly.
- A poorly-designed port (too narrow, too coupled to one provider's specific API shape) can still leak vendor-specific assumptions through the "abstraction," requiring careful design review, not just the existence of an interface.

## Risks

- **Leaky-abstraction risk:** the mere existence of an interface named `AIModelProviderPort` does not guarantee it is actually provider-agnostic if its method signatures mirror one specific provider's SDK too closely — a future PR designing these ports must apply the swap test (rule 4) explicitly, not just declare a port and assume abstraction.
- **Overhead-versus-benefit risk:** for infrastructure PMFreak is extremely unlikely to ever swap (e.g., the identity provider, given how deeply Identity and Access is depended upon), the port discipline still adds a layer of indirection whose benefit may be primarily architectural clarity rather than realistic swappability — this ADR accepts that cost uniformly rather than special-casing "unlikely to change" infrastructure.

## Security and Data Implications

- Every port in §19 of the parent document carries a security classification; ports touching Confidential or Highly Confidential data (Object Storage, Vector Retrieval, AI Model Provider, Identity Provider, Billing Provider, Audit Sink, Secrets) require adapters that enforce that classification's handling requirements regardless of which concrete provider implements them.
- Centralizing infrastructure access behind ports makes a future security review of "everywhere this system touches an external system" tractable — the port list in §19 is close to a complete inventory of that surface by construction.

## Application Implications

- Application services (§17 of the parent document) declare which ports they depend on explicitly; a service depending on a port it does not need is a signal of scope creep worth flagging in review.

## Persistence Implications

- PR5 must design the Persistence and Transaction Manager ports (§19) before or alongside choosing a specific database technology, so the choice of database is genuinely an adapter decision, not a foundational assumption baked into repository contracts (§18).

## API Implications

- PR6's inbound adapters (web/API/webhook handlers) are themselves inbound ports per rule 2 — they translate HTTP (or whatever transport is chosen, §55) into Commands/Queries and back, containing no business logic of their own.

## UX Implications

None directly — this is a backend/application architecture decision invisible to end users.

## Migration Implications

None executed by this ADR. Introducing actual port interfaces around the current codebase's direct Supabase/SDK usage is future-PR work, tracked as a gap in `04-canonical-application-architecture.md` §52 ("Repositories: Dependent on current state... Contract gap... PR5").

## Compatibility Implications

The current codebase's direct SDK usage from feature code does not conform to this ADR; this is a recorded gap, not a retroactive endorsement of the current pattern as an acceptable long-term shape.

## Out of Scope

Choosing any specific adapter's underlying technology (database, AI provider, queue, etc. — all explicitly left open at §55 of the parent document); designing the exact interface signatures for each port (deferred to PR5/PR6 implementation work).

## Validation

Validation criteria: (1) every capability listed in `04-canonical-application-architecture.md` §19's outbound-ports table has a named port; (2) §48's prohibited dependency list includes "Domain → database SDK" and "Application → concrete provider"; (3) §51's Replaceable Infrastructure list matches the set of outbound ports whose adapters are expected to vary.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §9, §19, §48, §51
- `AGENTS.md` (repository-level reminder that framework internals change under the codebase over time — the concrete motivation for keeping domain/application code framework-agnostic)
