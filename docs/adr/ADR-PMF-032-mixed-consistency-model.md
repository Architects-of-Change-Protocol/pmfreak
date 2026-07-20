# ADR-PMF-032: Mixed Consistency Model

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR3's Command Center architecture and screen catalog establish that PMFreak surfaces both authoritative records (Decisions, Recommendations) and derived summaries (Health dashboards, the Project Intelligence Feed) side by side in the same operational experience. PR4 must decide whether every one of these surfaces is held to the same consistency guarantee — which would mean either accepting slow, contention-heavy strongly-consistent reads everywhere, or weakening authoritative records like Decision status to an eventually-consistent read for the sake of dashboard performance — or whether different categories of data are deliberately allowed to make different tradeoffs, with the boundary between them explicitly documented so no future PR has to guess which category a new piece of data belongs to.

## Decision

**PMFreak uses strong consistency for domain invariants and authority (authorization, Workspace/Project membership, Decision/Recommendation/Action status), and eventual consistency for projections, search, analytics, and derived processing (Command Center projections, Health aggregation, notifications, Enterprise Intelligence projections).** Full specification: `04-canonical-application-architecture.md` §24.

## Domain Rules

1. Authorization, Workspace ownership, Project membership, Decision status, Recommendation approval, and Action creation are always read and written with strong consistency — no read of these six ever tolerates staleness.
2. Command Center projections, search indexes, Health aggregation, notifications, and Enterprise Intelligence *projections* (not the ratification gate itself, which is strongly consistent, §30) may be eventually consistent.
3. Audit event persistence is strong/durable — an audit record must never be lost or eventually-arrive; "eventual" here would defeat the record's purpose.
4. A Command never depends on a Query's freshness for its own correctness (restating ADR-PMF-025 rule 4) — this is what makes mixing consistency levels safe: the strongly-consistent write path never trusts an eventually-consistent read as an input to a decision.
5. Every eventually-consistent read model exposes a staleness indicator or rebuild strategy (§42 of the parent document) so a user or downstream system is never misled into treating a stale projection as current authoritative state.

## Alternatives Considered

- **Strong consistency everywhere.** Rejected: this would require every Command Center projection, Health rollup, and search query to block on synchronous recomputation, which does not scale with the cross-entity aggregation PR3's Command Center architecture requires (a Portfolio Health rollup touching every Project beneath it cannot reasonably be computed synchronously on every read without unacceptable latency).
- **Eventual consistency everywhere, including Decision/Recommendation status.** Rejected: a stale read of "is this Decision revoked" is not a performance tradeoff, it is a correctness and safety defect — ADR-PMF-030's human-authority guarantee depends on the current Decision state being exactly, not approximately, known at the moment a downstream Action is created.
- **Per-screen consistency choice, left to each future PR's discretion.** Rejected: this would recreate ambiguity for every future PR to individually resolve, exactly the kind of undocumented judgment call that produced the Command Center naming collisions in the domain layer (PR1 §22) — a fixed, documented boundary (§24 of the parent document) removes that repeated decision.

## Positive Consequences

- Lets Command Center dashboards, feeds, and search stay fast and horizontally scalable without threatening the correctness of the six strongly-consistent areas that actually require it.
- Gives PR5 a direct signal for which aggregates need synchronous, transactional writes (the strong-consistency list) versus which read paths can be served from asynchronously-updated projections (§42).
- Makes the "eventually consistent" tradeoff a deliberate, documented choice per area instead of an accidental property of whatever implementation happens to be built.

## Negative Consequences

- Requires engineers to know, for any new read, which consistency category it falls into — a wrong classification (treating a strongly-consistent-required read as eventually consistent, or vice versa) is a subtle bug class this ADR does not itself prevent mechanically.
- Two consistency models operating simultaneously add conceptual and testing complexity versus a single uniform guarantee.

## Risks

- **Misclassification risk:** a future PR adding a new query without carefully checking §24's table could default it to whichever consistency model is easier to implement rather than the one this ADR requires — this is a review-discipline risk, not one this ADR resolves mechanically.
- **Staleness-indicator omission risk:** rule 5's staleness-indicator requirement is easy to skip under implementation time pressure; if skipped, users could mistake a stale Health projection for current state, which is a real (if lower-severity) product risk even though the underlying data model is technically compliant with this ADR.

## Security and Data Implications

- Authorization's strong-consistency requirement (rule 1) is the single most security-critical consequence of this ADR — `04-canonical-application-architecture.md` §7.3 principle 25 ("Fail Closed for Authorization and Governance") depends on authorization checks never operating against stale data.
- Audit's strong/durable requirement (rule 3) is what makes Audit and Compliance's tamper-evidence guarantee (§41, §36) meaningful — an eventually-consistent audit log could be queried before a relevant write "arrives," creating a false negative in a compliance investigation.

## Application Implications

- Command Handlers (§15 of the parent document) always operate against strongly-consistent aggregate state, regardless of which consistency model any read path serving the same data uses.

## Persistence Implications

- PR5 must design the strongly-consistent aggregates (§12 of the parent document) with synchronous, transactional writes, and design the eventually-consistent projections (§42) as separately, asynchronously rebuildable structures — never conflate the two into one table serving both roles.

## API Implications

- PR6's endpoints for the six strong-consistency areas (§24) must not be served from a cache or CDN layer that could introduce staleness; endpoints serving projections may be.

## UX Implications

- PR7 must surface a staleness indicator (per rule 5) on any Command Center widget, Health dashboard, or feed backed by an eventually-consistent projection, consistent with `04-canonical-application-architecture.md` §42's read-model requirement.

## Migration Implications

None executed by this ADR. No current implementation is being changed.

## Compatibility Implications

Not applicable; this is a forward-looking architectural constraint on implementation not yet built.

## Out of Scope

Choosing the specific caching or projection-rebuild technology (§55 of the parent document); defining the exact staleness-indicator UI treatment (deferred to PR7/PR8).

## Validation

Validation criteria: (1) every area listed as "Strong" in `04-canonical-application-architecture.md` §24 corresponds to an aggregate in §12, never a projection in §42; (2) every read model in §42 lists "Eventual" or a mixed strong/eventual split matching this ADR's rules; (3) the Audit read model and Audit Record repository (§18) are both marked strong/durable, with no eventual-consistency exception.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §24, §42
- `docs/product-architecture/03-canonical-information-architecture.md` §11 (Command Center Architecture — the experience-layer motivation for mixed consistency)
- `docs/adr/ADR-PMF-025-command-query-separation.md` (companion decision this ADR's rule 4 depends on)
