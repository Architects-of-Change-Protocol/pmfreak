# ADR-PMF-022: Screen Ownership Model

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-017 ratified that every screen traces to exactly one ratified entity or projection (IA Principle 5, "One Entity, One Home"). It did not separately ratify *who* is allowed to create, edit, read, observe, or govern each entity that owns a screen, nor which entities Agents may act on versus merely observe. PR1 found that entity ownership in the current codebase is inconsistent in exactly the way naming was: Decisions are recorded across six-plus fragmented tables with no unified ownership model; Recommendations and Decisions are not always kept distinct in the UI; and nothing in the current architecture states, as a checkable rule, that an Agent can produce a Recommendation but never record a Decision.

PR2's glossary and ADR-PMF-016's copy standards establish that Recommendation/Decision/Action/Outcome must never be collapsed in copy. This ADR is the ownership-layer counterpart: it establishes, for every canonical screen's governing entity, exactly who owns, creates, edits, reads, observes, and — critically — which actions Agents may perform, closing the gap between "the pipeline stages must look distinct" (ADR-PMF-016) and "the pipeline stages must actually be *governed* distinctly" (this ADR).

## Decision

**Every screen ratified in ADR-PMF-017 has an explicit Entity Ownership row — Owner, Creator, Editors, Readers, Observers, System, and Agents — documented exhaustively in `docs/product-architecture/03-canonical-information-architecture.md` §12, cross-referenced against a Visibility Matrix (§13) stating exactly which of PM / PMO / Enterprise / Consultant / Executive / Admin / Guest can see each entity.** The single hardest constraint in this model, restated here as binding: **Agents may create Recommendations and nothing else** — they never create, edit, or own a Decision, Action, or Outcome, and this is enforced as an ownership rule, not merely a copy-style rule (ADR-PMF-016 governs how it must *look*; this ADR governs who is actually *allowed* to do it).

## Alternatives Considered

- **Leave entity ownership implicit, inferred from each entity's existing RLS policy rather than separately documented.** Rejected: RLS policies express *data access* (who can query a row), not *product ownership* (who is the accountable creator/editor in the product's mental model, and what an Agent is and isn't allowed to do as a matter of product design, independent of whether a database permission would technically allow it). The two are related but not identical, and PR1 found real gaps between them (e.g. the Decision-fragmentation problem is not a data-access defect, it's an ownership-model defect — nothing coordinates the six-plus Decision tables as "the same kind of thing" today).
- **Allow Agents to record Decisions when a governance policy pre-authorizes the action (e.g. an auto-approval threshold).** Rejected: this directly contradicts the existing, explicit constraint PR1 found already documented in the codebase's own architecture notes for the two existing Agents (Cost Governance, Quality Governance) — "blocking autonomous external execution." An Agent recording a Decision, even under a pre-authorized policy, is autonomous execution of a governance act; this ADR keeps that boundary absolute rather than introducing a conditional exception.
- **Give PMO a blanket "owns everything in its Workspace" ownership row instead of entity-by-entity specificity.** Rejected: this would recreate the "PMO Brain" over-reach pattern PR1 flagged as informal jargon inconsistent with the ratified model — PMO governs and reads broadly, but Project-level entities (Task, Decision, Action) are owned at the Project level, with PMO as a Reader/Observer, not a Creator/Editor, consistent with ADR-PMF-006's Project-execution-aggregate ruling.

## Positive Consequences

- Gives every one of the fifty canonical screens (ADR-PMF-017) an explicit, checkable ownership row instead of leaving "who can do what here" to be inferred per screen during implementation.
- Makes the Agent boundary a first-class, table-level rule (§12's Entity Ownership Matrix, "Agents" column reads "Never — Agents cannot record Decisions" for the Decision row) rather than only a prose statement in ADR-PMF-007's Context section — giving engineering a direct, per-entity checklist.
- Resolves, at the ownership-model layer, PR1's Decision-fragmentation finding: while this ADR does not merge the six-plus underlying tables (that remains explicitly out of scope, per PR1 §13), it does establish that all of them share one ownership model going forward — Project Manager creates, never edited only superseded, never Agent-created — giving a future schema-consolidation PR a single target ownership shape to consolidate toward.
- Extends the Visibility Matrix to Guest for the first time in this ADR series, closing a gap: no prior ADR specified exactly what a Guest can and cannot see across every entity type.

## Negative Consequences

- The Entity Ownership Matrix and Visibility Matrix are large, dense reference tables (§12–§13 of the parent IA document) that will need active maintenance as new entities (Portfolio, Enterprise) move from ratified-but-unimplemented to real.
- Because ownership is specified per canonical entity, not per underlying database table, a future schema-consolidation of the fragmented Decision tables (flagged but not resolved by PR1) will need to verify its new consolidated table's RLS/ownership model actually matches this ADR's ownership row — this ADR sets the target but does not itself perform or force that consolidation.

## Risks

- **Enforcement risk:** like the navigation and Command Center ADRs in this series, there is no automated check that a future implementation actually respects "Agents can create Recommendations and nothing else" at the code/RLS layer — this ADR states the rule; a future PR must enforce it (e.g. via RLS policy or application-layer guard on any Decision/Action/Outcome write path).
- **Stakeholder-entity risk:** the Stakeholder row in the Entity Ownership Matrix assigns ownership to "Project Manager" for an entity that, per PR1 §9, has no dedicated table today (it is embedded JSON in agent-handoff tables). This ADR's ownership ruling for Stakeholder is therefore aspirational in the same way the Stakeholders screen itself is aspirational (ADR-PMF-017) — flagged, not resolved.

## UX Implications

Every screen's primary actions (§5 of the parent IA document) are now traceable to an explicit ownership rule — e.g. the "Approve Recommendation" action is available to Contributor+ because Readers of a Recommendation may act on it, while "Record Decision" requires Project Manager because only the Owner/Creator role for Decision may perform that action. Buttons and actions that would violate this ownership model (e.g. an "Agent-approved Decision" affordance) must never be designed, consistent with ADR-PMF-016's forbidden-language rules.

## Implementation Implications

No code, RLS policy, or permission check is changed by this ADR. A future implementation PR must verify (and where necessary, add) an application-layer or RLS-layer guard preventing any Agent-authored write to a Decision, Action, or Outcome table, and should treat this ADR's Entity Ownership Matrix as the target shape for any future Decision-table consolidation.

## Future Evolution

As Stakeholder, Portfolio, and Enterprise move from ratified-but-aspirational to schema-backed, their ownership rows in §12/§13 become directly enforceable without requiring a new ownership-model decision — the rules are already specified. Any future entity not covered by this matrix requires an explicit addition to it before a corresponding screen may be built, maintaining ADR-PMF-017's "One Entity, One Home" discipline at the ownership layer.

## Compatibility Implications

Backward compatible: no existing RLS policy, permission check, or table is changed by this ADR.

## Out of Scope

- Consolidating the six-plus fragmented Decision tables (explicitly out of scope per PR1 §13; flagged as future engineering debt).
- Building the Stakeholder aggregate table (domain decision, outside this PR's authority).
- RLS/application-layer enforcement of the Agent-cannot-record-Decisions rule (future implementation PR).
