# PR8 Companion — AI Interaction Patterns

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `04-ai-agent-application-architecture.md` (all sections), ADR-PMF-027, ADR-PMF-029, ADR-PMF-030, `07-ai-memory-and-intelligence-experience.md` §1, §5–§6, `06-command-catalog.md` (four-Command approval chain, four-Command Agent surface), `08-ux-principles.md` §2 Principles 3, 4, 6, 7

Purpose: fix the exact visual and interaction shape of PMFreak's most differentiating surfaces — the Decision object, the AI Recommendation, the Agent Card, the Agent Run, and the Evidence Panel every one of them depends on — so that no screen ever presents unreviewed AI output with a human decision's authority, and no claim is ever shown without a reachable path to what it is based on.

## 1. The Decision Is a Central Object, Not a Row

A Decision (`01-canonical-domain-model.md`) is never rendered as a table row with a status pill. It is a composed record with five required parts, matching what `04-canonical-application-architecture.md` already persists for it:

```
Decision #234

Problem
  Vendor delay impacts timeline

AI Analysis
  3 possible options considered

Recommendation
  Option B

Impact
  +2 weeks saved

Evidence
  12 documents  →  Evidence Panel (§5)

Approval
  Pending · awaiting <role>
```

- **Problem** — the Risk, Issue, or condition that made a Decision necessary; always the first thing shown, because a Decision with no visible problem statement reads as arbitrary.
- **AI Analysis** — present only if an Agent Run informed this Decision; states how many options were considered, never hides the alternative options that were not chosen (§3 below).
- **Recommendation** — the option a Recommendation record actually names, styled per §2, always distinguishable from the Decision itself even when they are shown on the same screen (`08-ux-principles.md` §2 Principle 4).
- **Impact** — the Recommendation's stated expected effect (`04-ai-agent-application-architecture.md`'s Agent Proposal impact field), never fabricated by the frontend if the underlying record has none.
- **Evidence / Approval** — §5 and §4.

A Decision, once recorded, is never rendered as editable in place — its card shows the recording actor and timestamp, and the only available action is `RevokeDecision`, itself requiring the confirmation `07-command-query-and-error-experience.md` §4 mandates for destructive/governance Commands.

## 2. AI Recommendation Disclosure Shape (Mandatory)

Every Recommendation the frontend renders — on a Command Center (`08-command-center-experience.md` §1), a Decision card (§1), or the Recommendations register (`03-canonical-information-architecture.md` §5) — carries all five parts below, in this order, every time. A Recommendation rendered as a bare directive ("AI says: do X") is a defect, not a simplification: it is exactly the pattern `08-ux-principles.md` §2 Principle 6 and 7 exist to forbid, because an unexplained directive cannot be evaluated and destroys the trust the rest of this document is built to earn.

```
AI Recommendation

Why
  Detected schedule risk in critical path

Evidence
  Based on:
  - Project timeline
  - Resource capacity
  - Previous decisions
  → Evidence Panel (§5)

Confidence
  87%  (qualified — see §2.1)

Expected Impact
  Reduce delay by 14 days

[ Human approval required ]
```

1. **Why** — the detected condition, in the same governed vocabulary the Risk/Issue it responds to uses (`02-canonical-product-language.md`), never a raw model rationalization.
2. **Evidence** — an enumerated, named list of inputs, each a link into the Evidence Panel (§5) — never a vague "based on project data."
3. **Confidence** — §2.1.
4. **Expected Impact** — a stated, falsifiable claim (a number, a date, a duration) wherever the underlying Recommendation record has one; never omitted silently if present in the record.
5. **Approval control** — always present, always visually the most prominent element on the card, never a low-contrast afterthought (`08-ux-principles.md` §2 Principle 7).

### 2.1 Confidence Is Never a Bare Number

A confidence score (`08-design-system.md` §3's `ConfidenceScore` component) is always rendered adjacent to what it is confidence *in* and what it is derived from — never as an isolated percentage with no context, and never mapped to color alone (`08-accessibility-guidelines.md` §4, color independence). Confidence bands (illustrative, exact thresholds are a `08-design-system.md` governance decision, §7 below): below a low-confidence threshold, the Recommendation is visually flagged as low-confidence rather than hidden — PMFreak never suppresses a Recommendation for having low confidence, because suppressing it silently would itself be an undisclosed inference the human reviewer cannot see or challenge.

## 3. What "AI Analysis" Never Does

Per `04-ai-agent-application-architecture.md` and ADR-PMF-030, an Agent's output never appears with the visual authority of a human Decision at any point in this chain. Concretely:

- An Agent Proposal (§4 below) is never styled identically to a Recommendation — a Proposal is explicitly unreviewed; a Recommendation has passed `ApproveAgentProposal` and entered normal Recommendation review.
- No control ever performs more than one step of `RequestAgentRun → Agent Run → Agent Proposal → [ApproveAgentProposal → Recommendation | RejectAgentProposal] → ApproveRecommendation → RecordDecision → CreateActionFromDecision → RecordOutcome` (`07-ai-memory-and-intelligence-experience.md` §1, §5–§6; ADR-PMF-027, ADR-PMF-030).
- Every AI-generated text block carries a visible "AI-generated" label distinct from its Proposal/Recommendation review-status badge (`07-ai-memory-and-intelligence-experience.md` §6) — the label says *what produced this text*; the badge says *what has happened to it since*.

## 4. Agent Card and Agent Run

An Agent (`04-ai-agent-application-architecture.md`'s Agent Definition) is presented as a governed capability, not a chatbot persona:

```
Risk Analyst Agent

Status
  Active

Capabilities
  ✓ Risk detection
  ✓ Schedule analysis
  ✓ Recommendation generation

Last run
  2 hours ago  →  view Agent Run
```

- **Status** reflects the Agent's Configuration state (enabled/disabled per PMO/Workspace, `04-ai-agent-application-architecture.md` §2) — never the state of any individual run.
- **Capabilities** are read directly from the Agent Definition's declared allowed-tools/output-shape; the frontend never infers capabilities from observed behavior.
- **Last run** links to that run's own Agent Run view, never inlines full run detail on the card (progressive disclosure, `08-ux-principles.md` §2 Principle 5).

An individual Agent Run is rendered as an auditable execution trace, not a chat log:

```
Agent Run — Risk Analyst Agent

Input
  Project Alpha

Actions
  1. Read schedule
  2. Analyze dependencies
  3. Compare baseline

Output
  3 Agent Proposals produced

Human approval
  Required — 3 pending
```

Actions are listed as the ordered, named steps the Agent Run actually executed (Authorization → Context → Policy → Retrieval → Model → Tools → Validation, `07-ai-memory-and-intelligence-experience.md` §5, collapsed here to the tool/data-access steps a reviewer needs) — never a free-text log dump. Output is always stated as a count of Agent Proposals, never phrased as though the Agent already decided or acted; "Human approval: Required" is present on every Agent Run with unreviewed output, with the same visual prominence §2's approval control requires.

## 5. Evidence Panel

Every Recommendation, Decision, Project Memory record, and Enterprise Knowledge record's "why" is answerable from the same Evidence Panel shape, reachable in exactly one interaction from wherever the claim is shown (`08-ux-principles.md` §2 Principle 3):

```
Evidence Panel

Source Documents
  12 documents  →  Document/Evidence screen

Historical Data
  Similar delays: 3 prior projects

Metrics
  Schedule variance: -8 days
  Resource utilization: 94%

Agent Reasoning
  Chain of inference from Agent Run <id>

Confidence
  87%  (see §2.1)
```

An Evidence Panel never inlines a full source document — it links into the canonical Document/Evidence screen (`03-canonical-information-architecture.md` §5.8) — and never exceeds the viewing user's authorized classification (`07-ai-memory-and-intelligence-experience.md` §2, §8; `05-tenancy-rls-and-data-security.md`). Where a claim has no Agent Reasoning section (a Decision recorded without any Agent involvement), that subsection is omitted, not rendered empty — the panel's presence is conditioned on what evidence actually exists, per the Empty-state rule in `08-command-center-experience.md` §5.

## 6. Approval as a First-Class Flow

`ApproveAgentProposal`, `RejectAgentProposal`, `ApproveRecommendation`, and `RecordDecision` share one interaction pattern (the `ApprovalFlow` component, `08-design-system.md` §3): the item under review, its full disclosure shape (§2 or Agent Proposal equivalent), and exactly two primary actions (approve / reject), each requiring the confirmation `07-command-query-and-error-experience.md` §4 already mandates for governance-relevant Commands, each submitted with the `Idempotency-Key` `06-canonical-api-contracts.md` requires for flagged Commands. Bulk approval (approving N Recommendations in one interaction) is out of scope for PR8 — no such composite Command exists in `06-command-catalog.md`, and PR8 introduces none (§9 of `08-canonical-ux-design-architecture.md`, Open Decisions).

## Validation Notes

Every chain, Command name, state, and component reference in this document (`RequestAgentRun`, `ApproveAgentProposal`, `RejectAgentProposal`, `ApproveRecommendation`, `RecordDecision`, `CreateActionFromDecision`, `RecordOutcome`, `RevokeDecision`) is taken verbatim from `06-command-catalog.md`, `04-ai-agent-application-architecture.md`, ADR-PMF-027, ADR-PMF-030, and `07-ai-memory-and-intelligence-experience.md`. No new Command, Query, entity, or endpoint is introduced; this document fixes disclosure shape and interaction sequencing only. No code, route, or component was created or modified to produce it.
