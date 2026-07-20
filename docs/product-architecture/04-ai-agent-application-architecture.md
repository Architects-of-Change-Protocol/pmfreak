# PMFreak — AI and Agent Application Architecture (PR4)

Status: Ratified
Date: 2026-07-19
Companion to: `04-canonical-application-architecture.md` §31–§33
Authority: same order as the parent document. Governing decision: ADR-PMF-027 (Governed AI and Agent Execution), ADR-PMF-030 (Human Authority over Domain Mutation).

## 1. AI Architecture Principles

1. **An Agent is a governed consumer and producer of proposals — never an aggregate owner, never an authority root.** No Agent holds write access to any aggregate in `04-canonical-application-architecture.md` §12.
2. **A model's output is unvalidated until it passes Output Validation.** Nothing downstream may treat raw model output as fact.
3. **Retrieval precedes generation.** An Agent's context is assembled from governed sources (Project Memory, Evidence) before the model is invoked — the model is never the source of project facts.
4. **Every Agent Run is fully attributable.** Identity, version, model, provider, prompt/template version, workspace, project, actor, inputs, evidence references, tools invoked, outputs, confidence, policy decisions, errors, duration, cost, and approval status are all recorded (§4 below).
5. **Tools are allowlisted, not assumed.** An Agent may only invoke a tool explicitly granted to it for the current scope; there is no implicit or inherited tool access.
6. **Confirmation is required before any dangerous operation.** A tool invocation classified as dangerous (§6) always requires an explicit confirmation step, even when the surrounding Agent Run is otherwise fully automatic.
7. **A model failure must never corrupt domain state.** If the model provider errors, times out, or returns an invalid response, the Agent Run fails cleanly (`AgentRunFailed`) — it never partially applies a mutation.
8. **Prompts are configuration, not authority.** A prompt or system instruction cannot grant an Agent permission a Policy has not already granted; instructions inside retrieved content can never expand an Agent's authorized scope (§8).
9. **PMFreak's own AI capability is provider-replaceable.** Domain and application code never import a specific model SDK directly — every model or embedding call passes through the AI Model Provider / Embedding Provider ports (`04-canonical-application-architecture.md` §19).

## 2. Agent Identity and Definition

| Concept | Definition |
| --- | --- |
| **Agent Definition** | The product-level specification of a named agent role (e.g., "Cost Governance Agent") — its purpose, the tools it may use, the data it may retrieve, and the output shape it produces. Not user-created. |
| **Agent Configuration** | The per-PMO (or per-Workspace) activation and parameter set for a given Agent Definition — e.g., the existing `AgentId` on/off toggle list (PR1 §25) is a configuration mechanism, not a definition. |
| **Agent Run** | One execution instance of an Agent Definition against a specific context, producing at most one set of Agent Proposals. |
| **Agent Context** | The assembled input for one Agent Run: retrieved Project Memory, Evidence, prior Recommendations, and any explicit actor-supplied input — never raw, unscoped database access. |
| **Agent Tool Invocation** | One call from an Agent Run to an allowlisted tool, recorded individually within the run. |
| **Agent Proposal** | The typed, unvalidated-by-humans output of an Agent Run — the only thing an Agent is permitted to produce. |
| **Agent Recommendation** | An Agent Proposal that has passed Output Validation and been accepted into Recommendation Management's catalog (§13 of the parent document, `GenerateRecommendation`). |
| **Agent Evidence Reference** | A pointer from an Agent Proposal or Recommendation back to the specific Evidence/Project Memory records it used — never inlined, unattributed content. |
| **Agent Approval** | The human act of accepting an Agent Proposal into a Recommendation, or a Recommendation into a Decision — always a separate Command (`ApproveAgentProposal`, `ApproveRecommendation`). |
| **Agent Audit Record** | The immutable record of an Agent Run and every Tool Invocation and Policy decision within it, held by Audit and Compliance. |

## 3. Agent Execution Pipeline

```
User/System Request
  → Authorization
    → Context Assembly
      → Policy Evaluation
        → Evidence Retrieval
          → Model Invocation
            → Tool Invocation
              → Output Validation
                → Proposal Creation
                  → Human Review
                    → Domain Command
                      → Audit
```

**Stage responsibilities:**

- **Authorization** — resolves the requesting actor (or scheduled trigger identity) and confirms it may request this Agent Definition in this scope.
- **Context Assembly** — pulls the Project's approved Project Memory and relevant Evidence; never assembles context from another Workspace, and never from raw Chat History treated as if it were Project Memory (`04-canonical-application-architecture.md` §29).
- **Policy Evaluation** — `AgentExecutionPolicy` checks the requested scope, tools, and data classification against what this Agent Definition/Configuration is allowed; fails closed.
- **Evidence Retrieval** — governed retrieval (§43 of the parent document) against Project Memory/Search, always returning provenance references, never raw unref'd chunks.
- **Model Invocation** — a single, scoped call through the AI Model Provider port; the model never receives more Workspace context than the current Agent Run's scope.
- **Tool Invocation** — zero or more calls to allowlisted tools (§6); each is individually recorded.
- **Output Validation** — the model's raw output is checked against the expected schema, confidence thresholds, and safety rules before it is allowed to become a Proposal (§7).
- **Proposal Creation** — a typed Agent Proposal is created, carrying its Evidence References and confidence.
- **Human Review** — per the Human-in-the-Loop Matrix (§9), a human reviews and either approves (converting the Proposal into a Recommendation) or rejects it.
- **Domain Command** — only after Recommendation → Decision conversion (a separate, later act — never automatic) does any authoritative Command fire.
- **Audit** — every stage above writes to the Agent Audit Record; this is not optional and does not wait for the pipeline's terminal state.

**Binding rules:** the Agent never executes a domain mutation directly — every mutation flows through the ordinary Command Handler path (`04-canonical-application-architecture.md` §15), subject to the same authorization and invariants as a human-issued command. Tools must have explicit scopes and must be allowlisted per Agent Definition and per Agent Configuration. Dangerous operations require confirmation regardless of Agent autonomy level. Outputs must be validated before they can become a Proposal. Execution must be traceable end-to-end via the Agent Run's correlation id. A model failure must never corrupt domain state. Prompts are never a source of truth for facts, and instructions embedded in retrieved content or user input must never be able to expand an Agent's authorized policy scope.

## 4. Agent Run Record

Every Agent Run records, at minimum:

`agentIdentity` · `agentVersion` · `model` · `provider` · `promptTemplateVersion` · `workspaceId` · `projectId` · `requestingActor` · `inputs` · `evidenceReferences` · `toolsInvoked` · `outputs` · `confidence` · `policyDecisions` · `errors` · `duration` · `cost` · `approvalStatus`.

This record is append-only and owned by Agent Orchestration (`AgentRunRepository`, `04-canonical-application-architecture.md` §18).

## 5. Context Assembly and Retrieval

Context Assembly draws exclusively from governed sources: approved Project Memory Records (never candidates awaiting approval, unless the Agent's own purpose is memory curation itself), linked Evidence, and the requesting actor's explicit input. It never draws directly from another Workspace's data, from raw Chat History treated as authoritative, or from another actor's private context. Retrieval (semantic or filtered) always returns a provenance reference back to the canonical record (`04-canonical-application-architecture.md` §43) — an Agent must never receive a retrieved chunk it cannot trace back to a Project Memory Record or Evidence item.

## 6. Tool Policy

Every tool an Agent may invoke is declared per Agent Definition, with an explicit scope (what data/actions it touches) and a danger classification:

| Danger class | Examples | Requirement |
| --- | --- | --- |
| Read-only | Retrieve Evidence, read Project Memory | Automatic, within Context Assembly/Retrieval |
| Write-adjacent (Proposal only) | Draft a Recommendation, draft a Risk fingerprint | Automatic, but output still passes Output Validation and Human Review before it has any effect |
| Dangerous | Any tool capable of an external side effect (sending a message, calling an external API with write access, anything that could be mistaken for an executed action) | Always requires explicit confirmation, in addition to Human Review |

No tool is allowlisted by default; every Agent Definition's tool list is explicit and auditable. A tool invocation outside the current Agent Run's allowlist is a `PolicyViolation`, not a soft warning.

## 7. Model Invocation and Output Validation

Model Invocation is a single scoped call through the AI Model Provider port (`04-canonical-application-architecture.md` §19), carrying only the current Agent Run's assembled context. Output Validation checks, before anything is allowed to become a Proposal: conformance to the expected output schema; confidence against the Agent Definition's minimum threshold; absence of instructions-to-self-modify-scope (a defense against prompt injection, §11); and that every factual claim in the output carries or can be mapped to an Evidence Reference. Output that fails validation produces an `AgentExecutionError`, not a malformed Proposal.

## 8. Proposal Lifecycle and Human Approval

`Requested → Assembled → Validated → Proposed → (Approved → Recommendation) | (Rejected → terminal) | (Expired → terminal)`

An Agent Proposal has no domain effect until `ApproveAgentProposal` converts it into a Recommendation (`04-canonical-application-architecture.md` §13, §26). This is the same separation the domain language already ratifies for Recommendation → Decision (ADR-PMF-008) — Proposal → Recommendation is simply the first hop of that same chain, governed by the same principle: **an AI-originated claim never becomes authoritative without an explicit human or governed-process act.**

## 9. Human-in-the-Loop Matrix

| Action | Automatic | Requires review | Requires approval |
| --- | --- | --- | --- |
| Summarize evidence | Yes | Optional | No |
| Propose a Risk (Agent Proposal) | Yes | Yes | Yes, to record it as a Risk |
| Generate a Recommendation | Yes | Yes | Yes, to convert it to a Decision |
| Record a Decision | No | Yes | Yes |
| Create an Action | Partial (drafting only) | Yes | Per ActionCreationPolicy (varies by action class/impact) |
| Modify a budget | No | Yes | Yes |
| Elevate knowledge to Enterprise Intelligence | No | Yes | Yes |
| Revoke Enterprise Knowledge | No | Yes | Yes |
| Send an external communication | Conditional (draft only) | Yes | Per NotificationApplicationService policy |
| Delete records | No | Yes | Yes |

## 10. Domain Mutation and Audit

An Agent never issues a Command against an operational aggregate directly. The only Commands an Agent Run itself triggers are `GenerateRecommendation` (producing a Recommendation, still subject to `ApproveRecommendation` before conversion to a Decision) and, indirectly, `RequestAgentRun`/`CancelAgentRun` self-management. Every other Command in `04-canonical-application-architecture.md` §13 that an Agent's suggestion eventually leads to (`RecordRisk`, `RecordIssue`, `RecordDecision`, `CreateActionFromDecision`) is issued by a human actor exercising the approval step, never by the Agent itself. Every stage of the pipeline (§3) writes to the Agent Audit Record, independent of and in addition to the ordinary Command-level audit record each resulting domain Command produces.

## 11. Failure Handling, Prompt Injection, and Exfiltration Controls

**Failure handling:** a model timeout, malformed response, or provider error produces `AgentExecutionError` and terminates the run as `AgentRunFailed` — no partial mutation is ever possible because no mutation occurs until after Human Review. Retries apply only to the Model Invocation and Tool Invocation steps (transient provider errors), never to a rejected Proposal (§39 of the parent document).

**Prompt injection controls:** retrieved content (Evidence, Project Memory, external integration payloads) is treated as data, never as instructions; the model's system-level policy scope is fixed by `AgentExecutionPolicy` before retrieval happens and cannot be widened by anything encountered during retrieval or generation; Output Validation specifically checks for attempts to invoke tools or claim authorizations outside the Agent's allowlist.

**Data exfiltration controls:** Tool Invocation is scoped per Agent Definition (§6); no tool may write content outside PMFreak's own governed boundaries (email/notification tools are the one narrow exception, and are always classified dangerous, requiring confirmation, §6); output is never streamed directly to an external channel without passing through Output Validation and, for anything customer-facing, Human Review.

## 12. Cross-Workspace Isolation

An Agent Run's context is always scoped to one Workspace (and typically one Project). It never assembles context spanning two Workspaces. The one narrow exception is the Enterprise Intelligence elevation pipeline (`04-canonical-application-architecture.md` §30), which is not an "Agent" in this document's sense — it is a governed workflow (`04-application-workflows.md`) operating under its own six-part gate, with its own audit trail, never a model directly reading across tenants.

## 13. Model-Provider Abstraction, Evaluation, Versioning, and Revocation

**Model-provider abstraction:** every model and embedding call passes through the AI Model Provider / Embedding Provider ports (`04-canonical-application-architecture.md` §19); no Agent Definition hard-codes a specific provider's SDK. This is what keeps "AI providers" in the Replaceable Infrastructure category (§51 of the parent document).

**Evaluation and quality:** each Agent Definition version records its own confidence thresholds and output-schema conformance rate; evaluation criteria and process are intentionally left open for a future PR (§55 of the parent document lists "AI providers and model routing" as open) — this document fixes *where* evaluation data would attach (the Agent Run record, §4), not the evaluation methodology itself.

**Versioning:** an Agent Definition's version, and the prompt/template version it uses, are both recorded on every Agent Run (§4); changing either produces a new version, never a silent in-place change to a definition already in production.

**Revocation:** an Agent Definition or Configuration can be disabled (via `AgentConfiguration`, not a Command in the top-level catalog since it's a configuration change, §25 of the parent document); disabling does not retroactively invalidate past Agent Runs' audit records, which remain immutable.

## 14. Out-of-Scope Autonomy

The following are explicitly out of scope for any Agent, under this architecture, without a future ADR that revisits ADR-PMF-027/ADR-PMF-030: autonomous execution of any Command classified "human approval required" in `04-canonical-application-architecture.md` §13; direct persistence writes of any kind; cross-Workspace retrieval outside the Enterprise Intelligence elevation gate; sending external communications without confirmation; deleting any record; revoking a Decision or Enterprise Knowledge Record; ratifying its own proposed Pattern.
