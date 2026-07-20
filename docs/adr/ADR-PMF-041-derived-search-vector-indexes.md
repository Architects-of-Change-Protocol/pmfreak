# ADR-PMF-041: Derived Search and Vector Indexes

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PMFreak needs full-text search across Projects, Evidence, and Project Memory, and will plausibly need semantic (vector-based) retrieval to support Agent Orchestration's evidence and memory retrieval (PR4 §16, §17). The current-state inventory confirms no pgvector extension, no vector column type, and no embeddings exist anywhere in the current schema — and, notably, several current migrations explicitly and deliberately state the product does *not* use embeddings or automatic learning today. PR5 must decide how search and semantic retrieval are persisted going forward without contradicting §8.2's principle that "vector indexes are not canonical memory" and without letting a future search feature become an unlabeled second source of truth that silently drifts from the canonical records it was built from.

## Decision

**Full-text search indexes and semantic/vector indexes are derived, rebuildable projections that always reference a canonical record by ID and version, always carry scope and sensitivity classification, and are never treated as authoritative.** Adopting semantic/vector retrieval (e.g., via pgvector) is authorized as an implementation option when a concrete product need arises, but only under this ADR's persistence rules — this ADR does not itself mandate building a vector index now, and does not reverse the current schema's deliberate non-adoption of embeddings; it defines the contract that applies whenever vector retrieval is introduced.

## Persistence Rules

1. `search_documents` (full-text) carries: record ID, record type, title, text, scope (`workspace_id`/`project_id`/`enterprise_id` as applicable), classification, status, version — and is rebuildable from canonical records at any time.
2. `semantic_index_records` (vector/embeddings) carries: canonical record ID, canonical record version, embedding model identifier, embedding model version, chunk ID, text hash, scope, sensitivity, status, created at — retrieval never returns a bare vector match without its canonical record reference.
3. A retired, revoked, superseded, or hard-deleted canonical record must be removed from both search and semantic indexes — a stale index entry that outlives its canonical record is a data-quality defect (§57), not an acceptable staleness window.
4. Scope (Workspace/Project/Enterprise) and sensitivity classification are applied before search/retrieval results are returned to a caller — an index must never be queryable in a way that bypasses the same authorization a direct query against the canonical record would enforce.
5. A change in embedding model or embedding version requires re-indexing under a new `embedding_model_version` value — old and new versions may coexist during a rollout, but a caller must never receive a mixed-confidence result set without knowing which model produced which match.
6. Chunking of long content for embedding purposes must preserve a path back to the canonical record and, where applicable, the specific section/version chunked — a chunk with no provenance back to its source is not permitted.
7. Neither search nor semantic indexes are used as a workaround for classification, retention, or revocation rules that apply to the canonical record — an index respects the same lifecycle (archived, revoked, deleted) as its source.

## Alternatives Considered

- **Treat embeddings/vector similarity as the primary retrieval mechanism for Project Memory or Enterprise Intelligence, without a canonical relational record behind each match.** Rejected: this is exactly the "vector storage is not canonical memory," "vector indexes are not canonical memory" principle (§8.2, §8.3) this ADR exists to prevent — similarity is not validity, and a governance gate (ADR-PMF-039/040) cannot be implemented on top of an index with no queryable approval/ratification status.
- **Build search/vector indexes now regardless of demonstrated need, to "future-proof" retrieval.** Rejected: the current schema's explicit, repeated statements against ungoverned AI memory suggest this was a deliberate product stance, not an oversight; this ADR authorizes the pattern for when a real need arises rather than mandating premature adoption.
- **Never rebuild an index; treat it as permanent once written.** Rejected: this would make the index diverge from the canonical write model over time (model upgrades, corrected records, revocations) with no correction path — rebuildability is required precisely because the index is derived, not authoritative.

## Positive Consequences

- Lets PMFreak adopt semantic retrieval when a concrete need is demonstrated (e.g., Agent Orchestration's governed retrieval of Project Memory) without redesigning the persistence contract at that time — the contract already exists.
- Keeps search/vector infrastructure entirely optional and reversible: because it is derived and rebuildable, removing or replacing a search/vector provider never risks losing canonical data.
- Prevents a plausible future failure mode where a fast, convenient vector-similarity shortcut quietly becomes the de facto memory or knowledge store, undermining ADR-PMF-039/040's governance gates.

## Negative Consequences

- Requires index-rebuild tooling and a documented rebuild strategy for every index (§39 read-model requirement extended to search/vector), which is additional operational surface versus treating an index as a fire-and-forget cache.
- Model/version-aware chunking and re-indexing add complexity versus a naive "embed everything once" approach.

## Risks

- **Silent-authority risk:** if a product surface or agent retrieval path is ever built to trust a vector match's content directly (inlining chunk text as fact) rather than re-fetching or cross-checking the canonical record's current status, a revoked or superseded record could still influence output — retrieval code must always resolve back to current canonical status before treating a match as authoritative.
- **Reindex-lag risk:** a revoked record not yet removed from the index (rule 3) during the window before a rebuild job runs could be briefly retrievable — this must be minimized with prompt, event-driven index invalidation (via the outbox, ADR-PMF-037) rather than relying solely on periodic full rebuilds.

## Security and Data Implications

- Rule 4's requirement that indexes enforce the same scope/sensitivity rules as direct queries is the primary security control preventing an index from becoming a bypass route around RLS/authorization (ADR-PMF-042).
- Embeddings of highly sensitive or restricted content (§45 classification) may themselves require restricted storage or exclusion from certain embedding providers — this is a data-classification decision to apply per record, not a blanket rule this ADR resolves.

## Application Implications

- Search and Discovery (PR4's bounded context #24) owns index build/rebuild logic and exposes it as a derived read path; it does not own any canonical aggregate.
- Agent Orchestration's retrieval calls resolve a semantic match back to its canonical record and current status before including it in an Agent Context (per PR4 §7, Agent Context assembly).

## API Implications

- PR6's search/retrieval endpoints must include the canonical record reference and version in every result, never a bare text snippet with no traceable source.

## UX Implications

- Search results and agent-cited sources should be presented with a visible link back to the canonical record, supporting the provenance/traceability expectations PR3 and PR7/PR8 establish for evidence-based product surfaces.

## Migration Implications

- No search or vector infrastructure exists in the current schema; introducing it is new, additive infrastructure in an expand phase (ADR-PMF-044), not a retrofit.

## Operational Implications

- Index rebuild jobs (full-text and semantic) must be monitorable, resumable, and safe to run repeatedly (idempotent) without duplicating index entries.

## Compatibility Implications

- If pgvector is adopted, it is compatible with the existing PostgreSQL/Supabase platform choice (ADR-PMF-033) with no new database technology required; a fully external vector store remains an option but is not mandated.

## Out of Scope

- Whether pgvector, a managed vector database, or another mechanism is used — left open (§67) pending a concrete product need and implementation-time evaluation.
- Exact chunking, embedding model choice, and re-ranking strategy — product/ML decisions outside PR5's scope.

## Validation

Validation criteria: (1) every search/vector index described in `05-canonical-persistence-architecture.md` §41 references a canonical record ID and version; (2) no document produced under PR5 describes a vector or search index as authoritative source of truth for any fact; (3) revocation/deletion propagation from canonical record to derived index is explicitly documented as a required behavior, not an optional cleanup step.

## References

- `docs/product-architecture/05-canonical-persistence-architecture.md` §8.2, §8.3, §41
- `docs/adr/ADR-PMF-039-governed-project-memory-persistence.md`
- `docs/adr/ADR-PMF-040-ratified-enterprise-knowledge-persistence.md`
- `docs/adr/ADR-PMF-037-transactional-outbox-idempotent-inbox.md`
