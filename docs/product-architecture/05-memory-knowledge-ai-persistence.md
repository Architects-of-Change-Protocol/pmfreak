# Memory, Knowledge, and AI Data Persistence

Companion to `05-canonical-persistence-architecture.md`. Documentary only — no migration, table, embedding pipeline, or code is created by this document.

## 1. Project Memory Records

Project Memory is governed, structured, traceable Project-scoped knowledge, distinct from Chat History (ADR-PMF-009, ADR-PMF-028, ADR-PMF-039). Persisted lifecycle: **candidate → approved | rejected → (superseded | revoked | expired)**.

`project_memory_records` fields: `memory_record_id`, `workspace_id`, `project_id`, `memory_type`, `status`, `title`, `canonical_content`, `structured_content`, `confidence`, `sensitivity`, `source_count`, `approved_at`, `approved_by`, `effective_from`, `effective_until`, `superseded_by`, `revoked_at`, `revoked_by`, `revocation_reason`, `version`.

## 2. Candidate vs. Approved Memory

A candidate record (produced by `ProposeMemoryRecord`, typically system/agent-initiated) is never presented to an agent or product surface as authoritative Project knowledge. Only `status='approved'` (and not expired/revoked/superseded) records are retrievable by default as authoritative; a candidate may be shown only where the surface explicitly and visibly labels it as unapproved (PR1.1 invariant 31, applied at Project scope).

## 3. Memory Versions

`project_memory_versions` preserves every version of a record's content. A correction is a new version, never an in-place edit of a prior version — consistent with ADR-PMF-036's non-destructive-history principle applied to governed knowledge rather than only to Decisions/Audit.

## 4. Evidence

`project_memory_evidence` links a memory record to the Evidence records supporting it. A memory record's confidence is distinct from whether it has evidentiary support — inference is not evidence (PR1.1 invariant 27); a memory record with no evidence link is visibly distinguishable from one with strong evidentiary support, never conflated into a single opaque confidence number.

## 5. Provenance and Lineage

Every Project Memory Record answers: source, actor, date, context, evidence, confidence, validation status, lineage, corrections (ADR-PMF-009's explicit list). `project_memory_relationships` records supersession, contradiction, and derivation links using the general lineage model (`05-canonical-persistence-architecture.md` §15).

## 6. Embeddings and Retrieval Documents

`project_memory_embeddings` and `project_memory_retrieval_documents` are derived, rebuildable projections referencing a specific `memory_record_id` and `version` (ADR-PMF-041). They are never queried as if they were the memory record itself, and are rebuilt — not hand-edited — when the embedding model or retrieval strategy changes. This document does not mandate adopting embeddings for Project Memory now; it defines the contract that applies whenever they are adopted, consistent with the current schema's own explicit, repeated statement that it deliberately has "no embeddings, vector payloads, LLM hidden memory, or automatic learning artifacts" today.

## 7. Chat History Is Not Memory

Chat History (`context_conversations`/`context_messages` in current-state terms) is scoped to exactly one of Workspace/PMO/Project (CHECK-constrained in the current schema, never mixed) and may feed a `ProposeMemoryRecord` command as an ingestion source. A chat message is never itself marked `status='approved'` — approval is a distinct, attributable governance act performed by an authorized actor, not an automatic consequence of a conversation happening (PR1.1 invariant 26).

## 8. Contradiction, Expiration, Revocation

A memory record can be contradicted by another record (tracked via `project_memory_relationships`), can expire (`effective_until`), and can be revoked (`revoked_at`/`revoked_by`/`revocation_reason`). Expired or revoked records are excluded from default agent retrieval immediately — retrieval-layer enforcement, not merely a display-layer filter that a different code path could bypass.

## 9. Enterprise Intelligence: Pattern Candidate

`enterprise_pattern_candidates` (+ `_evidence`, `_reviews`) hold pre-ratification state. A candidate pattern is never queryable by the same path that serves ratified Enterprise Knowledge and is never labeled authoritative to end users or agents (PR1.1 invariant 32).

## 10. Enterprise Intelligence: Aggregation

Aggregation occurs at Program/Portfolio/PMO scope, within one Workspace, from Project-level evidence and approved Project Memory — never blending evidence from different Enterprises at any stage, and never discarding per-source Workspace/Project references during aggregation (provenance must survive summarization).

## 11. Enterprise Intelligence: Review

A reviewed candidate pattern accumulates a review record (`enterprise_pattern_reviews`) before proceeding toward ratification — review is a distinct, recorded step, not folded into the ratification act itself.

## 12. Enterprise Intelligence: Workspace and Enterprise Ratification

Ratification is a two-tier act — Workspace ratification, then Enterprise ratification — each a separate, attributable, recorded decision. `RatifyEnterpriseKnowledge` executes only once the six-part gate (evidence, confidence, review, lineage, applicability, ratification) is satisfied and recorded; no stage has a default-pass.

## 13. Enterprise Knowledge

`enterprise_knowledge_records` (+ `_versions`, `_scope`, `_contradictions`, `_revocations`) fields: `knowledge_record_id`, `enterprise_id`, `status`, `knowledge_type`, `title`, `canonical_content`, `confidence`, `applicability`, `effective_from`, `effective_until`, `ratified_at`, `ratified_by`, `revoked_at`, `revoked_by`, `revocation_reason`, `version`.

## 14. Applicable Scopes

Every Enterprise Knowledge Record carries an explicit `applicability` — the scope(s) (Workspace types, industries, methodologies) it is valid for. Agents and product surfaces must filter by applicability; a record ratified from one client's context is never assumed generally applicable without an explicit applicability declaration.

## 15. Contradiction, Revocation, Expiration (Enterprise Scope)

Same discipline as Project Memory (§8), at Enterprise scope: contradiction, revocation, and expiration are first-class lifecycle states; revoked knowledge never appears in authoritative retrieval.

## 16. Originating Workspaces (Provenance Preservation)

Every Enterprise Knowledge Record retains a reference to its originating Workspace(s) and Project(s) — elevation never discards or generalizes away the source (PR1.1 invariant 5). Cross-Workspace elevation additionally requires explicit, recorded per-Workspace consent from each originating Workspace's data owner before ratification is attempted (PR4 Workflow 12) — the highest security-stakes workflow in the entire catalog, requiring dedicated security review before any implementation.

## 17. Agent Definition, Version, Configuration

`agent_definitions` (product-level spec, not user-created) → `agent_versions` → `agent_configurations` (per-PMO/Workspace activation and parameters). None of these are mutated by an Agent Run itself; they are configuration inputs to a run, owned by Agent Orchestration's application service.

## 18. Agent Run

`agent_runs` fields: `agent_run_id`, `agent_definition_id`, `agent_version_id`, `enterprise_id`, `workspace_id`, `project_id`, `requested_by`, `started_at`, `completed_at`, `status`, `model_provider`, `model_name`, `model_version`, `prompt_version`, `policy_version`, `input_hash`, `output_hash`, `correlation_id`, `cost`, `token_usage`, `error_code`. Immutable after completion (append-only, per the mutability matrix in the main architecture document).

## 19. Tool Invocation

`agent_tool_invocations` fields: tool, scope, input fingerprint, result, side-effect classification, approval, duration, error, audit reference. Every tool call is individually recorded, not summarized into an aggregate "tools used" list — this is what makes an Agent Run auditable step by step. No secrets or credentials are ever stored in a tool-invocation payload.

## 20. Proposals

`agent_proposals` is the only thing an Agent Run may produce that has any downstream effect — a typed, unvalidated-by-humans output. Lifecycle: `Requested → Assembled → Validated → Proposed → (Approved→Recommendation) | (Rejected→terminal) | (Expired→terminal)`.

## 21. Approvals

`agent_run_approvals` records the human act converting a validated Proposal into a Recommendation (or a Risk record, or another governed artifact) — always a separate Command, never an automatic consequence of the Proposal existing (ADR-PMF-030, PR4's Human-in-the-Loop Matrix).

## 22. Model Metadata

Every Agent Run and Recommendation records `model_provider`, `model_name`, `model_version`, `prompt_version` — this is what lets a future audit or reproducibility investigation answer "what exactly produced this output," and lets a model/prompt upgrade be understood as a versioned change, not an invisible behavior shift.

## 23. Costs

`agent_run_costs` records token usage and monetary cost per run, supporting operational cost tracking and future budget/quota enforcement — persisted per run, not only aggregated after the fact.

## 24. Retention (Memory/Knowledge/AI-Specific)

| Category | Default retention approach | Notes |
|---|---|---|
| Project Memory Records (approved) | Retained for the life of the Project, subject to Workspace policy | Revocation/expiration are lifecycle states, not deletion |
| Project Memory Records (candidate/rejected) | Shorter default retention, configurable | Never promoted silently after expiry |
| Enterprise Knowledge Records | Retained per Enterprise policy; ratification/revocation are lifecycle states | Cross-Workspace consent records retained alongside |
| Agent Run inputs/outputs | Retained per Workspace/Enterprise policy, may be shorter than the aggregate history it informed | Subject to legal hold if the run informed a disputed Decision |
| Embeddings/retrieval documents | Fully derived — retention tied to rebuild capability, not independent policy | Deleted immediately on source revocation/deletion |
| Agent costs/token usage | Retained per operational/financial reporting policy | Not evidentiary; ordinary operational retention applies |

Exact periods remain an open decision (`05-canonical-persistence-architecture.md` §29).

## 25. Privacy

Agent inputs/outputs and Project Memory content may contain personal or sensitive information originating from Evidence or Chat History; classification (per `05-tenancy-rls-and-data-security.md` §10) applies to these records the same as any other, and export/deletion requests must reach into Agent Run and Memory records, not stop at "obviously personal" tables only.

## 26. Security

Agent Run and Tool Invocation records never store secrets or credentials (§19). Enterprise Intelligence's cross-Workspace elevation is the single highest-security-stakes pipeline in this architecture and requires dedicated security review before implementation (§16; ADR-PMF-040).

## 27. Deletion

Deleting a Project does not silently delete its approved Project Memory Records without passing the deletion pipeline (`05-tenancy-rls-and-data-security.md` §15) — Memory Records may be subject to independent retention obligations (e.g., they informed a ratified Enterprise Knowledge Record whose lineage must remain intact). Deleting a Memory Record that has already contributed to ratified Enterprise Knowledge requires the lineage/provenance reference to remain resolvable (even if only to a tombstone record), not silently broken.

## 28. Diagrams

```mermaid
flowchart LR
    Source --> Evidence --> Candidate[Candidate Memory] --> Approved[Approved Memory] --> Version --> Retrieval[Retrieval Index]
```

```mermaid
flowchart LR
    ProjEvidence[Project Evidence] --> Candidate2[Pattern Candidate] --> Review[Review] --> WSRatify[Workspace Ratification] --> EntRatify[Enterprise Ratification] --> Knowledge[Enterprise Knowledge]
```

```mermaid
flowchart LR
    AgentDef[Agent Definition] --> AgentVer[Agent Version] --> AgentConfig[Agent Configuration] --> AgentRun[Agent Run] --> Tools[Tool Invocations] --> Proposal --> Approval --> Recommendation
```

## Scope of This Document

No embeddings pipeline, vector store, or agent execution table is created by this document. It defines the persistence contract for Project Memory, Enterprise Intelligence, and Agent Run data so that when these are implemented (PR9+), they conform to ADR-PMF-039/040 and PR1.1's governance invariants from the start, rather than accumulating the kind of ungoverned, duplicated structure the current-state inventory found in adjacent subsystems (Decision, Recommendation, Risk/Issue).
