# ADR-PMF-066: Governed AI and Agent Experience

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-027 (PR4) and ADR-PMF-030 (PR4) already ratify, at the application layer, that an Agent's only output is an Agent Proposal with no domain effect until a human explicitly approves it, and that Recommendation, Decision, Action, and Outcome are never collapsed into fewer than four distinct human/governed acts. `04-ai-agent-application-architecture.md` §2 separately ratifies Agent Definition, Agent Configuration, and Agent Run as three distinct concepts. None of these prior ratifications says how a frontend screen is required to *present* an Agent Proposal, an unreviewed Agent Run, or the boundary between them — leaving open the risk that a future implementation, purely as a UX convenience, renders an Agent Proposal with the same visual weight as an already-approved Recommendation, or offers a single control that both approves a Proposal and records a Decision in one click, silently reintroducing the "one-click approve-and-execute" shortcut ADR-PMF-030 exists to prevent.

## Decision

**No frontend surface presents an unapproved Agent Proposal with a Recommendation's visual or interactive authority; Agent Definition, Agent Configuration, and Agent Run remain three distinct, non-conflated surfaces; and no single control performs more than one stage of Agent Run → Proposal → Approval → Command.** Full specification: `07-ai-memory-and-intelligence-experience.md`.

## Frontend Rules

1. An Agent Proposal renders in a visually distinct "AI-suggested, unreviewed" state, never styled identically to an approved Recommendation (`07-ai-memory-and-intelligence-experience.md` §6).
2. The only actions available on an unreviewed Proposal are `ApproveAgentProposal` and `RejectAgentProposal` — never a composite action that also records a Decision.
3. Agent Definition (read-only catalog), Agent Configuration (per-PMO/Workspace activation), and Agent Run (one execution instance, append-only record) are three distinct frontend surfaces, never merged into one "Agent settings" screen that blurs which is being edited (`07-ai-memory-and-intelligence-experience.md` §5).
4. Every Recommendation, Agent Proposal, Project Memory record, and Enterprise Knowledge record the frontend renders shows its provenance (source, confidence where available, timestamp) — never optional chrome behind an extra click (`07-ai-memory-and-intelligence-experience.md` §8).
5. Any AI-generated text, summary, or suggestion anywhere in the frontend carries a visible "AI-generated" label at its point of display, independent of its approval status (`07-ai-memory-and-intelligence-experience.md` §9).
6. A Tool Invocation classified dangerous always renders its own explicit confirmation, even mid-Agent-Run, never silently auto-confirmed (`04-ai-agent-application-architecture.md` §1 principle 6, restated in `07-ai-memory-and-intelligence-experience.md` §7).

## Alternatives Considered

- **Style Agent Proposals identically to Recommendations "for a cleaner UI."** Rejected: this would visually erase the exact distinction ADR-PMF-027/030 exist to preserve — a user could not tell, from the UI alone, whether something had passed human review.
- **A single "Agent Center" screen that merges Definition, Configuration, and Run history into one undifferentiated list.** Rejected: this would make "what is this Agent allowed to do" (Definition), "is it currently active" (Configuration), and "what did it actually do" (Run) indistinguishable, undermining the auditability `04-ai-agent-application-architecture.md` §1 principle 4 requires of every Agent Run.

## Positive Consequences

- Makes the human-authority boundary (ADR-PMF-030) visually self-evident to every user, not just documented in an architecture doc a UI implementer might not have read.
- Gives generated-content labeling (§9 of `07-ai-memory-and-intelligence-experience.md`) a uniform, auditable rule applied regardless of which module renders AI output.

## Negative Consequences

- Requires more distinct visual states and interaction patterns for AI-adjacent content than a single generic "suggestion" component would need.

## Risks

- **Label-omission risk:** a future component reusing a generic card pattern for AI-generated content could forget the required label — mitigated by placing the label at the Domain Presentation layer for any AI-sourced view model (`07-frontend-module-boundaries.md` §1), not left to each Feature to remember individually.

## Security and Data Implications

- Cross-tenant isolation for Agent context is preserved at the UI layer — no frontend surface offers a control that would let an Agent Run's displayed context span two Workspaces (`07-ai-memory-and-intelligence-experience.md` §11).

## Application Implications

- No change to PR4's Agent Execution Pipeline or ADR-PMF-027/030's rules; this ADR requires the frontend to represent them faithfully, not reinterpret them.

## Frontend Implications

- Establishes the Agent/Recommendation/Decision/Action/Outcome presentation rules every module touching AI output or the approval chain must follow (`07-ai-memory-and-intelligence-experience.md` §1, §6).

## Migration Implications

- Existing `capabilities`, `intelligence`, `copilot`, and `escalation-guide` routes are evaluated against this ADR's separation rules during migration (`07-frontend-migration-strategy.md`), not assumed compliant.

## Compatibility Implications

- Fully compatible with `04-ai-agent-application-architecture.md` and ADR-PMF-027/030 as already ratified — no application-layer change required.

## Out of Scope

- The exact visual design system used to distinguish Proposal/Recommendation/Decision states (`07-canonical-frontend-architecture.md` §13, design-system implementation is open).

## Validation

Validation criteria: (1) `07-ai-memory-and-intelligence-experience.md` §1 and §6 document no control that performs more than one stage of the approval chain; (2) every AI-generated content type in scope has a documented labeling rule (§9 of the same document).

## References

- `docs/product-architecture/07-ai-memory-and-intelligence-experience.md`
- `docs/product-architecture/04-ai-agent-application-architecture.md`
- `docs/adr/ADR-PMF-027-governed-ai-agent-execution.md`
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
