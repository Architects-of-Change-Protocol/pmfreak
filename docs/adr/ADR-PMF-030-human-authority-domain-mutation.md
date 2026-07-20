# ADR-PMF-030: Human Authority over Domain Mutation

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-008 (PR1.1) already ratifies, at the domain level, that a Recommendation "never equals" a Decision — the two are separate concepts with a required human/governed act between them. PR4 must decide whether that separation is merely a naming convention (two different labels a UI could still let a user click through in one step) or a binding application-layer authorization rule that no future Command Handler, workflow, or Agent may bypass regardless of implementation convenience. Without this ADR, a future PR under time pressure could implement "one-click approve-and-execute" as a UX shortcut, which would be technically consistent with the *vocabulary* PR2 ratified while violating its *intent*.

## Decision

**Authoritative, sensitive mutations require human authority or a previously-approved explicit policy. A Recommendation never automatically equals a Decision; a Decision never automatically equals an Action; an Action never automatically equals an Outcome.** This restates and binds ADR-PMF-008 at the application layer, governing every Command in `04-canonical-application-architecture.md` §13 marked "human approval required," and is the authorization backbone behind the Human-in-the-Loop Matrix (`04-ai-agent-application-architecture.md` §9).

## Domain Rules

1. `ApproveRecommendation` and `RecordDecision` are always two separate Commands, issued at separate times, by an actor holding the authority the target action class requires — never collapsed into one handler.
2. `RecordDecision` and `CreateActionFromDecision` are always separate Commands; an Action is never auto-created the instant a Decision is recorded.
3. `CreateActionFromDecision` completion and `RecordOutcome` are always separate; completing an Action is never treated as proof of its Outcome (restating §28 of the parent document).
4. A "previously-approved explicit policy" (the one alternative to a live human act) must itself have been established through a governed process with its own audit trail — it is not a loophole for silently pre-authorizing broad categories of future mutation without scrutiny.
5. This rule applies uniformly regardless of whether the upstream trigger was a human-authored Recommendation or an Agent Proposal (§27) — the human-authority requirement does not weaken because the suggestion came from a person instead of a model, nor strengthen because it came from a model instead of a person; the gate is the same either way.

## Alternatives Considered

- **Allow "trusted" actors (e.g., PMO Admins) to combine ApproveRecommendation and RecordDecision into one click for efficiency.** Rejected: this would make the domain-level separation (ADR-PMF-008) cosmetic rather than binding — the whole point of a distinct RecordDecision Command with its own DecisionAuthorityPolicy check is that recording authority is evaluated on its own terms, not inherited from an unrelated prior approval.
- **Allow a pre-configured policy to auto-convert low-risk Recommendations into Decisions.** Rejected as an unconditional default; rule 4 leaves room for a *future*, separately-governed policy mechanism, but this ADR does not itself define or authorize any such auto-conversion — that would require its own ADR and its own audit design, not an implicit carve-out here.
- **Apply this rule only to Agent-originated Recommendations, treating human-authored ones as inherently pre-approved.** Rejected: a human-authored Recommendation is still a Recommendation, not a Decision (PR2's canonical definitions do not distinguish Recommendation's status by its author) — collapsing the gate for human-authored suggestions would just relocate the same risk (skipped scrutiny) to a different trigger.

## Positive Consequences

- Converts PR1.1's domain-level vocabulary ratification into an enforceable application-layer authorization rule, closing the gap between "these are different words" and "these are different, separately-authorized acts."
- Gives PR6 an unambiguous rule for which endpoints may never be combined into a single API call, preventing a well-intentioned "streamlined UX" implementation from silently reintroducing auto-approval.
- Directly supports auditability (§7.3 principle 24 of the parent document): every stage of Recommendation → Decision → Action → Outcome has its own actor, timestamp, and authority recorded, rather than one combined event that obscures which human made which specific call.

## Negative Consequences

- Every authoritative mutation chain requires more clicks/steps than a one-shot "approve and execute" flow would — this is the direct cost of the safety guarantee, not an oversight.
- Legitimate low-risk, high-volume workflows (e.g., routinely approving many similar minor Recommendations) may feel unnecessarily heavy under this rule until a future, separately-governed policy mechanism (rule 4) is designed to handle them.

## Risks

- **Policy-loophole risk:** rule 4's "previously-approved explicit policy" carve-out is the one place this ADR could be weakened by a future PR that defines an overly permissive policy; any such policy must itself be reviewed against this ADR's intent (human scrutiny proportionate to the action's authority requirement), not treated as an automatic exemption.
- **UX-pressure risk:** product pressure to reduce approval friction is the most likely source of future violations of this ADR — PR7 implementers must treat "combine these two steps for a smoother flow" requests as a conflict with this ADR requiring explicit reconsideration, not a routine UX optimization.

## Security and Data Implications

- This ADR is the primary authorization-layer backstop behind `04-canonical-application-architecture.md` §7.3 principle 6 ("Human Authority over Autonomous Execution") and is directly referenced by the Human-in-the-Loop Matrix (`04-ai-agent-application-architecture.md` §9).
- `DecisionAuthorityPolicy` (§16 of the parent document) fails closed if an actor's authority level cannot be confirmed — this ADR requires that policy to be evaluated fresh at `RecordDecision` time, never cached from an earlier approval step.

## Application Implications

- Recommendation Management, Decision Management, and Action and Outcome Management (`04-bounded-context-catalog.md` §13–§15) remain three distinct bounded contexts specifically so that no single application service could technically combine these steps even if asked to.

## Persistence Implications

- PR5 must ensure the Decision aggregate's schema records its own authority/actor/timestamp independent of whatever Recommendation (if any) preceded it — never a foreign key alone standing in for "this was approved."

## API Implications

- PR6 must expose `ApproveRecommendation`, `RecordDecision`, `CreateActionFromDecision`, and `RecordOutcome` as four distinct endpoints/operations; no composite endpoint may perform more than one of these in a single call.

## UX Implications

- PR7 may design a visually streamlined multi-step flow (e.g., a guided wizard) that walks an actor through Approve → Record Decision → Create Action as sequential, individually-confirmed steps — but may not collapse them into a single confirmation that produces all three Commands from one click.

## Migration Implications

None executed by this ADR — no code implements any of this today.

## Compatibility Implications

Not applicable; no existing implementation to reconcile with.

## Out of Scope

Designing the future governed policy mechanism referenced in rule 4; defining specific authority-level role mappings (deferred to `04-canonical-application-architecture.md` §34 and a future PR).

## Validation

Validation criteria: (1) every "Yes" in the Human Approval column of `04-canonical-application-architecture.md` §13 corresponds to a Command that is never triggered as a side effect of another Command; (2) `04-ai-agent-application-architecture.md` §9's Human-in-the-Loop Matrix contains no "Automatic" entry for RecordDecision, CreateActionFromDecision (beyond drafting), knowledge elevation, or knowledge revocation; (3) no workflow in `04-application-workflows.md` auto-advances a human governance stage.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §7.3 (principle 6), §13, §26–§28
- `docs/product-architecture/04-ai-agent-application-architecture.md` §8–§9
- `docs/adr/ADR-PMF-008-project-intelligence-feed.md` (domain-level ratification this ADR binds at the application layer)
- `docs/adr/ADR-PMF-027-governed-ai-agent-execution.md` (companion decision specific to AI/agent-originated proposals)
