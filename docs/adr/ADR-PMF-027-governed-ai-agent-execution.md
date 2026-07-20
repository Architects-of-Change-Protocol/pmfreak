# ADR-PMF-027: Governed AI and Agent Execution

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 §25 found that PMFreak's vision names thirteen agents but only two are implemented (Cost Governance, Quality Governance), both deterministic pure functions that "consume Project-scoped baselines/snapshots and produce a typed assessment object... never write directly to `project_decisions` or any other authoritative table." PR1 also found the recommendation-only boundary explicitly and repeatedly documented elsewhere in the codebase (`autonomous-intervention-runtime.md`: "Deterministic recommendation-only intervention intelligence... blocking autonomous external execution"). PR4 must decide whether to formalize this already-correct boundary as binding application architecture for every future agent — including the eleven not yet built, and including any future LLM-based (non-deterministic) agent, which the two existing agents are not — or leave agent governance to be reinvented ad hoc as each new agent is added.

## Decision

**Agents are governed consumers and producers of proposals. They are never aggregate owners and never authority roots. An Agent's only output is an Agent Proposal, routed through Recommendation Management, which a human must explicitly approve before it has any domain effect.** Full specification: `04-ai-agent-application-architecture.md`; ownership rule restated at `04-canonical-application-architecture.md` §12 rule 4.

## Domain Rules

1. No Agent holds direct write access to any aggregate in `04-canonical-application-architecture.md` §12.
2. Every Agent Run passes through the full pipeline (Authorization → Context Assembly → Policy Evaluation → Evidence Retrieval → Model Invocation → Tool Invocation → Output Validation → Proposal Creation → Human Review → Domain Command → Audit) — no stage may be skipped, regardless of how deterministic or "safe" a given Agent Definition is believed to be.
3. Tool access is explicitly allowlisted per Agent Definition; there is no default or inherited tool access.
4. Dangerous tool operations require explicit confirmation regardless of the surrounding run's autonomy level.
5. A model or tool failure must never partially apply a domain mutation — no mutation is possible before Human Review completes, which structurally guarantees this.
6. This rule applies identically to the two currently-implemented deterministic agents and to any future non-deterministic (LLM-based) agent — determinism does not earn an exception to the governance pipeline.

## Alternatives Considered

- **Grant deterministic agents (like the two existing ones) direct write access, reserving the full governance pipeline only for non-deterministic/LLM agents.** Rejected: this would create two classes of agent with different trust models, and "deterministic" is a property of today's implementation, not a permanent guarantee — a future change to a deterministic agent's logic could silently cross into non-deterministic territory without triggering a corresponding governance upgrade. One uniform rule is safer and matches what the codebase already, independently, documents as its own design philosophy.
- **Allow agents to write directly to a "staging" table that a separate approval step then promotes.** Rejected: this is functionally identical to the Proposal → Recommendation → Decision chain this ADR already specifies, just renamed and without the explicit multi-stage audit trail; formalizing the existing three-stage vocabulary (already ratified at the domain level via ADR-PMF-008) is clearer than inventing a parallel staging concept.
- **Let PMO configuration (the existing `AgentId` toggle list) serve as the sole governance mechanism.** Rejected: PR1 §25 found this configuration list is currently unwired to any actual analysis function — a toggle alone is not a governance pipeline; this ADR requires the full pipeline regardless of how an agent is activated.

## Positive Consequences

- Formalizes, rather than reinvents, a boundary the codebase's own internal documentation already states as a design commitment — this ADR closes the gap between stated philosophy and binding architecture.
- Gives every future agent (11 more named in the product vision, plus any not yet named) one governance contract to build against, instead of each new agent needing its own bespoke safety review.
- Makes "the model hallucinated" a contained failure: since nothing downstream of Output Validation can become authoritative without Human Review, a bad model output can produce, at worst, a rejected Proposal — never a corrupted aggregate.

## Negative Consequences

- Every agent-originated change requires a human approval step before taking effect, which is slower than autonomous execution — this is an intentional tradeoff (§7.3 principle 6 of the parent document: "Human Authority over Autonomous Execution"), not an oversight.
- Building the full pipeline (§3 of `04-ai-agent-application-architecture.md`) for even a simple agent is more implementation work than a direct-write shortcut would be.

## Risks

- **Approval fatigue risk:** if every agent proposal requires human review, a high-volume agent could produce more proposals than reviewers can meaningfully evaluate, degrading the quality of review to a rubber stamp — this ADR does not solve reviewer-capacity planning, which is future-PR/product work.
- **Tool-allowlist drift risk:** as agents gain new tools over time, an allowlist not actively maintained could accumulate overly broad grants; this ADR requires the allowlist model but does not itself audit any specific agent's tool list.

## Security and Data Implications

- This ADR is the primary architectural control against the "unauthorized agent action" and "tool abuse" threats catalogued in `04-canonical-application-architecture.md` §36.
- Prompt injection and data exfiltration controls (`04-ai-agent-application-architecture.md` §11) depend on this ADR's no-direct-write rule holding — if it were ever weakened, those controls would need to be substantially redesigned.

## Application Implications

- Agent Orchestration (`04-bounded-context-catalog.md` §18) is the only context permitted to run this pipeline; Recommendation Management is the only downstream consumer of its output.

## Persistence Implications

- PR5 must design the Agent Run and Agent Proposal aggregates (§12, §18 of the parent document) as append-only/audit-preserving records, never as mutable staging rows an agent can revise after the fact.

## API Implications

- PR6's agent-related endpoints (`RequestAgentRun`, `CancelAgentRun`, `ApproveAgentProposal`, `RejectAgentProposal`) are the only agent-facing mutation surface; no endpoint may allow an agent identity to call a Command outside this set.

## UX Implications

- PR7's Agent Center screen (per PR3's screen catalog) must surface Proposals awaiting review distinctly from already-approved Recommendations, preserving the same Recommendation-is-not-Decision visual distinction PR2/PR3 already require for human-originated Recommendations.

## Migration Implications

None executed by this ADR. Wiring the existing `AgentId` PMO-configuration list to an actual governance pipeline, and building the 11 not-yet-implemented named agents, are both future-PR work.

## Compatibility Implications

The two existing deterministic agents (Cost Governance, Quality Governance) are already compatible with this ADR's no-direct-write rule per PR1 §25's own findings; no immediate remediation is implied for them. The unwired `AgentId` configuration list is flagged as a gap, not retroactively treated as sufficient governance.

## Out of Scope

Designing the 11 not-yet-built named agents; choosing a model provider (§55 of the parent document); building the approval-fatigue mitigation referenced under Risks.

## Validation

Validation criteria: (1) `04-canonical-application-architecture.md` §12 lists no aggregate with Agent Orchestration as its mutation authority beyond Agent Run and Agent Proposal; (2) every Command in §13 issuable by an Agent identity is limited to `RequestAgentRun`/`CancelAgentRun`, `ApproveAgentProposal` is restricted to human actors and mutates only the Agent Proposal aggregate, and the Recommendation aggregate is created solely by Recommendation Management's own `CreateRecommendationFromProposal`, never by a command Agent Orchestration issues against it directly; (3) `04-ai-agent-application-architecture.md` §3's pipeline includes a Human Review stage between Proposal Creation and any Domain Command.

## References

- `docs/product-architecture/04-ai-agent-application-architecture.md`
- `docs/product-architecture/04-canonical-application-architecture.md` §12, §31–§33, §36
- `docs/product-architecture/01-canonical-domain-model.md` §25 (Agent Position — current-state evidence)
- `docs/adr/ADR-PMF-008-project-intelligence-feed.md` (ratifies Recommendation ≠ Decision at the domain level, the foundation this ADR builds on)
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md` (companion decision on human authority generally)
