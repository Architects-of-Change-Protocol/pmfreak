# ADR-PMF-039: Governed Project Memory Persistence

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-009 and ADR-PMF-028 established that Project Memory is governed, structured, traceable Project-scoped knowledge, distinct from raw Chat History, and that it must preserve source, actor, date, context, evidence, confidence, validation status, and lineage for every unit of knowledge, with corrections handled as supersession rather than silent overwrite. The current-state inventory shows `project_memories` (legacy, `company_id text`-scoped, later patched with `workspace_id`) and later `organizational_memory`/`personal_pm_memory`/`agent_memory_records` families, none of which implement the full governance metadata ADR-PMF-009 requires, and none of which use vector embeddings or pgvector — a deliberate, explicitly documented product decision visible in the current schema's own migration comments ("No AI, no embeddings, no automatic learning"). PR5 must decide how Project Memory is persisted going forward without contradicting either the governance requirements or that explicit current-state design stance, and without conflating candidate (unapproved) memory with approved, authoritative memory.

## Decision

**Project Memory is persisted as canonical, versioned records with an explicit candidate → approved → (superseded | revoked | expired) lifecycle. Chat History, embeddings, and retrieval documents are separate, derived artifacts that reference Project Memory Records by ID and version — they are never themselves the authoritative store of a memory fact.** Only approved Project Memory Records are retrievable as authoritative knowledge by agents or product surfaces, unless a surface explicitly and visibly labels content as an unapproved candidate.

## Persistence Rules

1. `project_memory_records` carries, at minimum: `memory_record_id`, `workspace_id`, `project_id`, `memory_type`, `status` (candidate/approved/rejected/superseded/revoked), `title`, `canonical_content`, `structured_content`, `confidence`, `sensitivity`, `source_count`, `approved_at`, `approved_by`, `effective_from`, `effective_until`, `superseded_by`, `revoked_at`, `revoked_by`, `revocation_reason`, `version`.
2. `project_memory_versions` preserves every version of a record's content, not just the current one — a correction creates a new version, never an in-place edit of a prior version's content.
3. `project_memory_evidence` links a memory record to the Evidence records that support it; a memory record with no evidence link is explicitly distinguishable from one with evidentiary support (confidence and evidence are separate fields, never conflated).
4. `project_memory_relationships` records supersession, contradiction, and derivation links between memory records (using the general `record_relationships` lineage model from §27 of the persistence architecture), so a memory record's history remains traceable.
5. `project_memory_embeddings` and `project_memory_retrieval_documents` are derived, rebuildable projections that reference a specific `memory_record_id` and `version` — they are never queried as if they were the memory record itself, and they are rebuilt (not hand-edited) if the embedding model or retrieval strategy changes.
6. Chat History (`context_conversations`/`context_messages` in current-state terms) may feed a `ProposeMemoryRecord` command as an ingestion source, but a chat message is never itself marked `status='approved'` — approval is a distinct, attributable governance act.
7. Only `status='approved'` (and not expired, not revoked, not superseded) memory records are returned by default to agent retrieval and product surfaces designed to show authoritative Project knowledge; a candidate record may only be shown where the surface explicitly labels it as an unapproved candidate.
8. This ADR does not authorize storing raw model weights, embeddings, or vector payloads as the primary representation of Project Memory — consistent with the existing, explicitly documented current-schema stance against implicit AI-derived memory; embeddings remain a retrieval aid, never the source of truth.

## Alternatives Considered

- **Store Project Memory purely as a vector index over Chat History, with no distinct governed record.** Rejected: this is exactly the "Chat History is not Project Memory" conflation ADR-PMF-009 and PR1.1 invariant 26 forbid, and it would make correction, revocation, and confidence tracking impossible since a vector index has no notion of approval status or supersession.
- **Allow in-place editing of a memory record's canonical content on correction.** Rejected: this would destroy the ability to answer "what did we know at the time," which ADR-PMF-009's lineage/corrections requirement and PR4's Project Memory application service (`ApproveMemoryRecord`/`RejectMemoryRecord`, no destructive-edit operation) both depend on.
- **Treat `organizational_memory`/`personal_pm_memory` (current-state tables) as already-canonical Project Memory without further governance metadata.** Rejected: the current-state inventory confirms these tables lack the full governance metadata set (validation status, lineage, corrections, confidence tied to evidence) ADR-PMF-009 requires — treating them as already-conformant would be declaring implemented what is, per this PR's own restriction, only a target.

## Positive Consequences

- Makes "why does the agent believe X about this Project" answerable via a real, queryable governance trail rather than an opaque embedding similarity score.
- Keeps the explicit, already-documented product stance against ungoverned AI memory intact and formalized, rather than accidentally reintroducing it through a future embeddings-first shortcut.
- Cleanly separates a fast-changing derived layer (embeddings, retrieval documents, which may need to be rebuilt as models change) from the slow-changing, governed canonical layer.

## Negative Consequences

- Requires an explicit governance workflow (Project Memory Promotion, PR4 Workflow 7) rather than allowing memory to accumulate automatically from every conversation, which is more product and engineering effort than an automatic, ungoverned pipeline.
- Versioned records with supersession add query complexity (resolving "current effective version") versus a single mutable row per memory fact.

## Risks

- **Candidate-leak risk:** a retrieval or UI code path that forgets to filter by `status='approved'` could surface unapproved candidate memory as if it were authoritative — this is exactly the failure mode rule 7 exists to prevent and must be tested as a data-quality/access-control invariant (§57).
- **Embedding-drift risk:** if `project_memory_embeddings` is not consistently rebuilt when its source record's approved version changes, retrieval could serve stale or superseded content — reconciliation (§58) must check embedding-to-record version alignment.

## Security and Data Implications

- Project Memory Records carry `sensitivity` classification (§45) so retrieval and agent consumption can respect data-classification rules, distinct from and in addition to Workspace/Project scope enforcement (ADR-PMF-034).
- Revocation (`revoked_at`/`revoked_by`/`revocation_reason`) must immediately remove a record from agent-retrievable results, which is a testable authorization/retrieval invariant, not just a display-layer filter.

## Application Implications

- The Project Memory application service (per ADR-PMF-028) exposes exactly `ProposeMemoryRecord`, `ApproveMemoryRecord`, `RejectMemoryRecord`, `GetProjectMemory` — no other bounded context queries the `project_memory_records` table directly, consistent with PR4's aggregate-ownership rule (ADR-PMF-024).
- Agent Orchestration consumes Project Memory only via the governed retrieval projection (an ACL, per PR4 §16), never by querying candidate-stage records directly.

## API Implications

- PR6's Project Memory endpoints must distinguish "get approved memory" from any future "get candidate memory for review" endpoint — they are not the same query and must not share a response shape that omits status.

## UX Implications

- PR7/PR8 must visually distinguish candidate/unapproved memory from approved memory wherever both might appear in the same surface (e.g., a memory review queue), consistent with PR1.1 invariant 31 ("candidate pattern is not ratified pattern," applied here at the Project scope).

## Migration Implications

- Existing `project_memories`/`organizational_memory`/`personal_pm_memory` tables are current-state artifacts to be evaluated during the expand-contract migration (ADR-PMF-044); none is declared canonical by this ADR without further gap analysis, per `05-persistence-migration-strategy.md`.

## Operational Implications

- Rebuilding `project_memory_embeddings`/`project_memory_retrieval_documents` must be a supported, monitorable operation (e.g., on embedding-model upgrade) without touching the canonical `project_memory_records`/`project_memory_versions` tables.

## Compatibility Implications

- Consistent with the current schema's explicit non-adoption of pgvector/embeddings as a primary store; if/when a vector store is introduced, it is introduced strictly as a derived index per ADR-PMF-041, not a change to this ADR's governance model.

## Out of Scope

- The exact embedding provider, chunking strategy, or vector index technology — deferred to ADR-PMF-041 and implementation.
- Exact confidence-scoring algorithm — left as a product/ML decision outside PR5's scope.

## Validation

Validation criteria: (1) `05-memory-knowledge-ai-persistence.md` documents the candidate→approved→superseded/revoked/expired lifecycle exactly as stated here; (2) no document produced under PR5 describes an embedding or vector table as the authoritative store of a Project Memory fact; (3) the current-state table classification in `05-persistence-migration-strategy.md` explicitly evaluates `project_memories`/`organizational_memory`/`personal_pm_memory` against this ADR's governance-metadata requirements rather than assuming conformance.

## References

- `docs/adr/ADR-PMF-009-project-memory-separation.md`
- `docs/adr/ADR-PMF-028-project-memory-architecture.md`
- `docs/product-architecture/01.1-domain-ratification.md` §8 (invariant 26)
- `docs/product-architecture/05-memory-knowledge-ai-persistence.md`
- `docs/adr/ADR-PMF-041-derived-search-vector-indexes.md`
