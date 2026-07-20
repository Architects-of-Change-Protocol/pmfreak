# ADR-PMF-071: Human-AI Interaction Model — Mandatory Disclosure Shape

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-030 and ADR-PMF-066 already establish that an Agent Proposal is not a Recommendation, and that Human Authority governs every domain mutation — but neither fixes the exact visual disclosure an AI-originated claim must carry to be trustworthy rather than merely present. Left unfixed, a future implementation PR could satisfy the letter of "human approval required" with a bare "AI says: do X" and a single button — technically gated, but not earning trust, and not answerable to "why" the way an enterprise buyer evaluating PMFreak against Palantir- or ServiceNow-caliber AI products would expect. PR8's sprint brief names this as the single most important differentiator PMFreak has; this ADR makes the disclosure shape binding rather than aspirational.

## Decision

**Every AI Recommendation, Agent Proposal, and Decision the frontend renders discloses its basis, confidence, and expected impact, in a fixed order, before offering any approval control — and no control ever performs more than one step of the Recommendation → Decision → Action → Outcome or Agent Run → Proposal → Approval → Command chains.** Full specification: `08-ai-interaction-patterns.md` §1–§6.

## Frontend Rules

1. Every AI Recommendation card discloses, in order: Why (the detected condition), Evidence (an enumerated, linked list of inputs — never "based on project data"), Confidence (qualified, never a bare percentage), Expected Impact (a stated, falsifiable claim where the record has one), then the approval control (`08-ai-interaction-patterns.md` §2).
2. A confidence value is never rendered without what it is confidence *in* and what it is derived from adjacent to it, and never mapped to color alone (`08-ai-interaction-patterns.md` §2.1; `08-accessibility-guidelines.md` §4).
3. A Decision is rendered as a five-part composed object (Problem, AI Analysis, Recommendation, Impact, Evidence, Approval) — never a table row with a status pill (`08-ai-interaction-patterns.md` §1).
4. An Agent Proposal is never styled identically to a Recommendation — a Proposal is explicitly unreviewed; a Recommendation has passed `ApproveAgentProposal` (`08-ai-interaction-patterns.md` §3, restating ADR-PMF-030/066).
5. Every AI-generated text block carries a visible "AI-generated" label distinct from its Proposal/Recommendation review-status badge (`08-ai-interaction-patterns.md` §3, restating `07-ai-memory-and-intelligence-experience.md` §6).
6. Every claim's evidence is reachable within one interaction via the Evidence Panel, which never inlines a source document beyond the viewer's authorized classification (`08-ai-interaction-patterns.md` §5).
7. No control performs more than one step of `RequestAgentRun → Agent Run → Agent Proposal → [ApproveAgentProposal → Recommendation | RejectAgentProposal] → ApproveRecommendation → RecordDecision → CreateActionFromDecision → RecordOutcome` (`08-ai-interaction-patterns.md` §3).

## Alternatives Considered

- **A single-line AI suggestion with a one-click "Apply" action.** Rejected explicitly by the sprint brief and by this ADR: this is the exact pattern ("AI says: Do X") the brief identifies as destroying trust, and it would let one control conflate multiple steps of the governed approval chain, violating ADR-PMF-030.
- **Show confidence as a bare percentage with no basis, deferring "why" to a secondary click.** Rejected: `08-ux-principles.md` §2 Principle 6 requires confidence to be a qualified signal in the same view, not one interaction removed — an unqualified number invites the user to trust or dismiss it without evaluating it, which is the opposite of PMFreak's differentiation goal.
- **Suppress low-confidence Recommendations rather than flagging them.** Rejected: suppressing a Recommendation for low confidence is itself an undisclosed inference the human reviewer cannot see or challenge — `08-ai-interaction-patterns.md` §2.1 requires flagging, not hiding.

## Positive Consequences

- Makes "why should I trust this Recommendation" answerable from the same view every time, directly supporting the enterprise-trust differentiation the sprint brief names as PR8's central goal.
- Closes the most likely place a future "streamlined" AI feature would silently blur Agent output into human decision authority, by making the four/six-step chain's one-control-one-step rule explicit and reusable (`ApprovalFlow`, `08-design-system.md` §3).

## Negative Consequences

- Requires every AI-surfacing screen to carry more visual structure (five disclosure elements plus an approval control) than a minimal "suggestion + button" pattern would — a deliberate trade of simplicity for trustworthiness and auditability.

## Risks

- **Disclosure fatigue risk:** a user facing many Recommendations, each with a full five-part disclosure, could experience friction reviewing them at volume — mitigated by `08-ux-principles.md` §4's ranking (Recommendations shown after Risks/Decisions, not competing for equal attention) and explicitly out of scope for PR8: no bulk-approval Command exists yet (`08-ai-interaction-patterns.md` §6), so this risk is not compounded by a false efficiency shortcut.

## Security and Data Implications

- Evidence disclosure is bounded by the viewer's authorized classification (`05-tenancy-rls-and-data-security.md`) — the Evidence Panel links into the Document/Evidence screen's own authorization check rather than inlining content the frontend would otherwise need to separately re-check.

## Application Implications

- None — this ADR introduces no new Command, Query, or entity; it governs the presentation of Recommendation, Agent Proposal, Decision, and Evidence records `04-ai-agent-application-architecture.md` and `01-canonical-domain-model.md` already define.

## Frontend Implications

- Establishes the mandatory shape `08-ai-interaction-patterns.md` specifies in full, consumed by `08-command-center-experience.md`'s AI Recommendations zone and every Decision/Agent screen in `03-screen-catalog.md`.

## Migration Implications

- Any current-state AI-surfacing UI lacking this disclosure shape is a named migration target (`07-frontend-migration-strategy.md`), evaluated against this ADR as a conformance gate.

## Compatibility Implications

- Compatible with any future Agent added to the thirteen-Agent catalog (`04-ai-agent-application-architecture.md`) — this ADR fixes the disclosure shape every Agent's output must satisfy, not a per-Agent presentation.

## Out of Scope

- Exact confidence-band numeric thresholds (`08-ai-interaction-patterns.md` §2.1, open).
- Bulk-approval interaction — no composite Command exists in `06-command-catalog.md`.

## Validation

Validation criteria: (1) every Recommendation/Agent Proposal disclosure in a future implementation includes all four required elements (Why, Evidence, Confidence, Expected Impact) before its approval control; (2) no single control in a future implementation dispatches more than one Command from the six-step chain in Frontend Rule 7.

## References

- `docs/product-architecture/08-ai-interaction-patterns.md`
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
- `docs/adr/ADR-PMF-066-governed-ai-agent-experience.md`
- `docs/product-architecture/07-ai-memory-and-intelligence-experience.md`
