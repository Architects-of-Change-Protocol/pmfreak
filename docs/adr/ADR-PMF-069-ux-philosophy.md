# ADR-PMF-069: UX Philosophy — Optimize Decisions, Not Tasks

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1–PR7 fixed what PMFreak is, says, shows, and how it is built, stored, invoked, and rendered — but none of them fixed the governing question PMFreak's interface answers for its user. Left unfixed, a future implementation PR would default to the shape every project-management tool defaults to: a list of items the user filters, sorts, and manually interprets. PMFreak's own domain model already rejects this shape — `01-canonical-domain-model.md`'s Recommendation → Decision → Action → Outcome chain and `04-ai-agent-application-architecture.md`'s Agent Run → Proposal → Approval → Command chain exist because PMFreak is meant to surface what a user should decide, not merely what exists. PR8 makes that intent an explicit, binding UX standard before any screen is built.

## Decision

**PMFreak's interface optimizes decisions, not tasks — every screen's primary question is "what needs my judgment," not "what items exist."** Full specification: `08-ux-principles.md` §1–§5.

## Frontend Rules

1. Every screen composing more than one kind of information prioritizes Risks, Pending Decisions, Blockers, and Recommendations ahead of completed or steady-state items — never presents them at equal visual weight to an undifferentiated list (`08-ux-principles.md` §4).
2. No canonical screen's default (landing) state is an unranked, unfiltered register — every register screen (`03-canonical-information-architecture.md` §5) opens filtered to attention-worthy items by default.
3. No claim, health value, or AI output is shown without a reachable path (never more than one interaction away) to the evidence it is based on (`08-ux-principles.md` §2 Principle 3; `08-ai-interaction-patterns.md` §5).
4. Recommendation, Decision, Action, and Outcome are never visually or interactively conflated — restated a fourth time across this codebase because it is this ADR's single most consequential rule (`08-ux-principles.md` §2 Principle 4).
5. Every label, heading, and microcopy string uses `02-canonical-product-language.md`'s canonical vocabulary exactly; no PR8-derived artifact introduces a synonym for a governed term.

## Alternatives Considered

- **Ship PR8 as a component style guide only, without a stated philosophy.** Rejected: a component catalog with no governing question would let PR9+ implementation default back to the list-and-filter shape this ADR exists to reject — the same accretion failure mode `07-canonical-frontend-architecture.md` §1 already diagnosed at the module-structure level would recur at the interaction-design level.
- **Adopt a generic "modern SaaS" design philosophy (density, speed, minimalism) with no decision-centric framing.** Rejected: minimalism and speed are consequences of good UX, not a substitute for the specific claim that PMFreak's job is surfacing decisions — a fast, minimal list is still a list, and still fails the "what needs my judgment" test.

## Positive Consequences

- Gives every future screen a falsifiable test: does this screen answer "what needs my attention/judgment," or does it merely enumerate data? A screen that fails the test is out of conformance with this ADR, not merely a matter of taste.
- Makes the Recommendation/Decision/Action/Outcome distinction a UX law in addition to a domain and frontend rule, closing the most likely place a future "streamlined approval" UI would silently violate it.

## Negative Consequences

- Requires every register-style screen (Tasks, Milestones, Risks, etc.) to implement attention-based default filtering rather than a simpler unfiltered list — additional design and implementation work at PR9+.

## Risks

- **Over-filtering risk:** a screen that hides too aggressively in the name of "attention-first" could bury information a user needs but that doesn't meet the attention threshold — mitigated by `08-ux-principles.md` §2 Principle 5 (reduce cognitive load through hierarchy, not omission) and the requirement that a full, unfiltered view remains one interaction away, never removed.

## Security and Data Implications

- None — this ADR governs prioritization and visual hierarchy, not data access or authorization boundaries.

## Application Implications

- None — this ADR is scoped entirely to the frontend's presentation and interaction layer; it introduces no new Command, Query, or entity.

## Frontend Implications

- Establishes the philosophy every other PR8 ADR (069–074) and companion document derives its specific rules from; `08-command-center-experience.md`'s zone ordering and `08-ai-interaction-patterns.md`'s disclosure shape are direct applications of this ADR's Frontend Rules.

## Migration Implications

- Existing screens are evaluated against the "decisions, not tasks" test during migration (`07-frontend-migration-strategy.md`) alongside their module/route reclassification — attention-first prioritization is a criterion a screen is judged against when migrated, not a separate later project.

## Compatibility Implications

- Compatible with any component-library or visual-design implementation chosen later (`08-design-system.md` §6, open) — this ADR fixes the standard a screen's information hierarchy must satisfy, not any specific visual treatment.

## Out of Scope

- Exact attention-threshold logic (what severity/age qualifies an item as "attention-worthy") — an implementation-time decision, not fixed here.
- Any specific screen's layout — `08-ux-principles.md` and its sibling companions fix the standard; PR9+ applies it per screen.

## Validation

Validation criteria: (1) every register screen named in `03-canonical-information-architecture.md` §5 has a documented default-filter rule consistent with `08-ux-principles.md` §4's priority order; (2) no PR8 companion document contradicts the Recommendation/Decision/Action/Outcome distinction stated here and in ADR-PMF-030.

## References

- `docs/product-architecture/08-ux-principles.md`
- `docs/product-architecture/08-canonical-ux-design-architecture.md` §4
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
