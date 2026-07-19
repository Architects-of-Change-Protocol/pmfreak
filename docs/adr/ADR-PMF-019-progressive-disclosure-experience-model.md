# ADR-PMF-019: Progressive Disclosure Experience Model

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-012 ratified the domain-level rule that the UI may hide complexity without eliminating the enterprise domain, and named five illustrative segment configurations (Independent PM, Small Team, PMO, Enterprise, Consultancy) as non-exhaustive examples of how a tenant's revealed hierarchy depth can vary. It deliberately did not specify exact screen-by-screen disclosure rules, entry flows, or the additional segment shapes (Government, Large Program, Portfolio Office, Multi-workspace Enterprise) this PR's brief requires — that was out of scope for a domain-ratification ADR and was left for the experience-architecture layer.

This ADR is that experience-layer completion. It takes ADR-PMF-012's domain-level ruling as fixed and unchanged, and ratifies the concrete screen-visibility model built on top of it: which of the fifty canonical screens (ADR-PMF-017) each segment sees by default, the nine required entry flows, and the explicit rule (already implied by ADR-PMF-006 Rule 11, restated here at the disclosure-experience layer) that no onboarding gate may block a lower hierarchy level's creation behind a higher one.

This ADR does not reopen ADR-PMF-012's domain ruling, and it does not create new plan tiers — the four additional segment configurations it defines (Government, Large Program, Portfolio Office, Multi-workspace Enterprise) are explicitly IA-level compositions of already-ratified entities and the already-existing `capability-reveal`/`pilot-capability-set` engine, not new domain or billing decisions.

## Decision

**Progressive disclosure is governed by a segment-to-screen-visibility model with nine illustrative configurations, all built on the same, single `capability-reveal` engine (five ordered stages, thirteen gated domains, four role profiles, three plan tiers) that already exists in the codebase — no parallel gating system is introduced, and no segment implies a mandatory sequence through the levels it doesn't use.** Hiding an entity from a segment's UI is never a claim that the entity doesn't exist; the full canonical hierarchy exists conceptually for every tenant at all times. The full model — which screens each of the nine segments sees, and the entry flow for each of nine user profiles — is documented in `docs/product-architecture/03-canonical-information-architecture.md` §7 and §9.

## Alternatives Considered

- **Build a new, dedicated screen-visibility gating system separate from `capability-reveal`.** Rejected: ADR-PMF-012 already ruled that any future gating of Enterprise/Portfolio/Program visibility must extend the existing engine, never build a parallel one. This ADR is bound by that ruling and extends it rather than replacing it.
- **Ratify Government, Large Program, Portfolio Office, and Multi-workspace Enterprise as new, formal plan tiers alongside `free/pro/pmo`.** Rejected for this ADR: doing so would be a billing/product-tier decision outside an IA ADR's authority. Instead, these four are ratified only as IA-level *configurations* — different default landing screens and navigation emphasis over the identical entity set the PMO/Enterprise segments already use. Formal tier-ratification is left as an explicit open question (§34 of the parent IA document), not decided here.
- **Make each segment's screen set mutually exclusive** (e.g. a "PMO segment" tenant structurally cannot see Portfolio screens even if a Portfolio exists). Rejected: this would contradict ADR-PMF-012's core rule that segment configuration is illustrative, not a mandatory or exclusive path — "a tenant may occupy any point on the hierarchy... no segment configuration implies passing through the ones listed before it."

## Positive Consequences

- Gives PR4 a concrete, screen-by-screen visibility table (§7 of the IA document) instead of only the five illustrative, non-exhaustive segment descriptions ADR-PMF-012 provided — closing the gap between domain-level ratification and buildable UI specification.
- Extends coverage to four additional segment shapes the founder's brief explicitly required (Government, Large Program, Portfolio Office, Multi-workspace Enterprise) without introducing any new domain concept, entity, or plan tier — keeping this ADR strictly additive to ADR-PMF-012.
- Makes explicit, for the first time at the experience layer, that Government/Portfolio Office/Large Program are compositions, not new products — preventing a future PR from building bespoke, parallel navigation systems for what are structurally PMO/Portfolio/Program-segment tenants with different emphasis.
- Restates and extends ADR-PMF-006 Rule 11 (no onboarding gate above Project) as a first-class Entry Flow / Navigation Contract rule, giving it a second, independent enforcement point beyond the original domain ADR.

## Negative Consequences

- Nine segment configurations is a larger surface than the five ADR-PMF-012 named; keeping all nine mutually consistent as the product evolves will require more ongoing documentation discipline than the original five did.
- Because Government/Portfolio Office/Large Program are not formally distinct plan tiers, a future billing/growth decision to make them so will require a new ADR anyway — this document's four additional configurations are useful IA scaffolding but do not by themselves resolve the underlying open product question of whether they should be formal tiers.

## Risks

- **Configuration-sprawl risk:** without a formal tier boundary, "Government" and "Portfolio Office" could accumulate ad hoc UI differences over time that are never reconciled with the PMO/Portfolio segments they're built from, recreating a milder version of the PMO enum/blob/table fragmentation PR1 found. Mitigated by this ADR's explicit statement that they compose existing screens only, never introduce new ones.
- **Gate-regression risk:** the current onboarding wizard already violates the no-gate-above-Project rule (PR1.1 §23); until a future implementation PR removes it, this ADR's ratification and the running product will disagree — flagged, not fixed, by this document, consistent with how ADR-PMF-006 and ADR-PMF-007 already flagged the same defect without executing the fix.

## UX Implications

Every segment's default landing screen, visible navigation items, and entry flow are specified in `03-canonical-information-architecture.md` §7 and §9. No segment's UI may present a level (PMO, Portfolio, Program, Enterprise) as mandatory to reach a level below it.

## Implementation Implications

No code is changed by this ADR. A future implementation PR must: extend `REVEAL_DOMAIN_ORDER`/role profiles in `capability-reveal` for any new segment-specific emphasis (rather than building a parallel system); remove the current PMO-before-Project onboarding gate; verify the Government/Portfolio Office/Large Program configurations render using only already-gated domains.

## Future Evolution

If Government or Portfolio Office configurations prove to need UI behavior the existing `capability-reveal` domains/roles/tiers cannot express, that is itself evidence a formal plan-tier decision is needed — to be raised as a new, explicit product-ratification question, not solved by silently extending this ADR's scope.

## Compatibility Implications

Backward compatible: no existing gating code, role profile, or plan tier is changed by this ADR.

## Out of Scope

- Formal ratification of Government/Portfolio Office/Large Program/Multi-workspace Enterprise as billing/plan tiers (open question).
- Removing the current onboarding gate (future implementation PR).
- Exact visual treatment of "revealed" vs. "hidden" states (PR4).
