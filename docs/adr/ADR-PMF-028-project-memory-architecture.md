# ADR-PMF-028: Project Memory Architecture

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-009 (PR1.1) already ratified, at the domain level, that Project Memory is "governed, structured, traceable operational knowledge... distinct from Chat History." PR1 §24 found the current implementation (`project_memory_snapshots`) is genuinely distinct from chat already, but flagged that "no explicit correction/audit-trail mechanism confirmed" exists. PR4 must decide the *application-layer* architecture that would let a future PR close that gap correctly — specifically, how a Project Memory Record moves from raw source to canonical, governed knowledge, and what it must carry at every stage, so that the correction/audit-trail mechanism PR1 flagged as missing is designed once, not per-field as gaps are noticed.

## Decision

**Project Memory is a governed bounded context. A Project Memory Record moves through explicit stages (raw source → normalized event → evidence → observation → candidate record → approved record) and, once approved, is corrected only by superseding — never by destructive edit. Every record preserves source, actor, timestamp, workspace, project, provenance, lineage, confidence, validation status, retention, sensitivity, supersession, and revocation.** Full specification: `04-canonical-application-architecture.md` §29; bounded context detail: `04-bounded-context-catalog.md` §16.

## Domain Rules

1. Chat History is one ingestion source among several, never itself Project Memory (restating ADR-PMF-009).
2. The vector store and any embeddings are derived projections referencing the canonical Project Memory Record — never themselves the source of truth (§43 of the parent document).
3. An inference is never auto-elevated to a fact; a candidate record requires explicit approval (`ApproveMemoryRecord`) before it is canonical.
4. Correction of an approved record is by superseding entry, preserving full lineage — never by silent overwrite or deletion.
5. No Project Memory Record mixes data between Workspaces/clients under any circumstance.
6. Agent Orchestration consumes Project Memory only through a governed retrieval projection, never through direct access to internal candidate-stage records (§11 of `04-bounded-context-catalog.md`, anti-corruption layer requirement).

## Alternatives Considered

- **Treat the vector store as the primary Project Memory implementation**, since semantic retrieval is the most visible consumer-facing use case. Rejected: this is explicitly prohibited by `04-canonical-application-architecture.md` §29 ("vector store... is not a source of truth") — a vector store is lossy, unversioned by default, and cannot express supersession/lineage the way a governed record can; treating it as primary would make correction and audit structurally impossible.
- **Allow direct editing of approved memory records for simplicity.** Rejected: PR1 §24 already flags the absence of a correction/audit-trail mechanism as a gap; allowing destructive edit would make that gap permanent instead of closing it, and would violate the general auditability principle (§7.3 principle 24 of the parent document).
- **Skip the candidate stage and approve records automatically when confidence exceeds a threshold.** Rejected: this contradicts the "Evidence before Inference" and "Recommendation is not Decision" principles' spirit as applied to memory — an automatically-approved record is functionally an auto-elevated inference, which ADR-PMF-009 already prohibits.

## Positive Consequences

- Gives PR5 a precise, complete field list to design the schema against, directly closing the gap PR1 §24 flagged instead of leaving it to be rediscovered during implementation.
- Makes Project Memory a trustworthy input to both Agent Orchestration (§31–§33 of the parent document) and, eventually, Enterprise Intelligence elevation (§30) — both depend on Project Memory being genuinely governed, not just genuinely separate from chat.
- Preserves the current implementation's real strength (chat/memory separation, PR1 §24 "confirmed intact") while adding the missing governance layer around it.

## Negative Consequences

- A full stage-gated pipeline (raw source → ... → approved record) is more implementation work than the current snapshot-generation approach, which the evidence suggests is largely automatic/regenerable today.
- Requiring explicit approval for every candidate record could create a review bottleneck if source volume is high, similar to the approval-fatigue risk flagged in ADR-PMF-027.

## Risks

- **Regeneration-vs-correction risk:** PR1 §24 notes the current snapshot mechanism is "regenerable" rather than explicitly corrected; a future PR must decide how automatic regeneration interacts with this ADR's supersession-only correction rule for anything already approved — regeneration must not silently overwrite an approved, corrected record.
- **Retrieval-projection leakage risk:** if the governed retrieval projection Agent Orchestration consumes is not kept strictly separate from candidate-stage records, unapproved inferences could reach an Agent's context — the anti-corruption layer requirement (§11 of `04-bounded-context-catalog.md`) exists specifically to prevent this.

## Security and Data Implications

- Sensitivity classification is a mandatory field on every Project Memory Record (§29 of the parent document); this feeds directly into field-level access control at the Query layer (§15) and into what may ever be eligible for Enterprise Intelligence elevation (§30).
- Cross-client mixing is explicitly prohibited (rule 5 above), restating the Workspace isolation guarantee (§35) at the memory layer specifically.

## Application Implications

- Project Memory's application service (`ProjectMemoryApplicationService`, §17 of the parent document) exposes exactly `ProposeMemoryRecord`, `ApproveMemoryRecord`, `RejectMemoryRecord`, and `GetProjectMemory` — no other context calls its repository directly.

## Persistence Implications

- PR5 must design storage that supports append-only supersession (never destructive update) for approved records, and a distinct candidate-stage representation that is excluded from the governed retrieval projection until approved.

## API Implications

- PR6's Project Memory endpoints must expose validation status and confidence per record, never a flattened view that hides which stage a given piece of knowledge is at.

## UX Implications

- PR7's Project Memory screen (per PR3's screen catalog) must show provenance (source/actor/confidence/validation) per entry, consistent with PR2's Project Memory definition ("visible to: all users of a Project, with provenance... visible per entry once built").

## Migration Implications

None executed by this ADR. Designing the explicit correction/audit-trail mechanism for the existing `project_memory_snapshots` implementation is future-PR work (§24 of PR1.1's ratification document, "Required Future Migrations").

## Compatibility Implications

The current `project_memory_snapshots` implementation is compatible with this ADR's chat/memory separation requirement (PR1 §24, "confirmed intact") but does not yet implement the full stage-gated pipeline or supersession-based correction this ADR requires; this is recorded as a gap, not a violation requiring immediate remediation.

## Out of Scope

Designing the specific regeneration-vs-correction reconciliation mechanism (flagged as a risk above); choosing a vector store technology (§55 of the parent document).

## Validation

Validation criteria: (1) `04-canonical-application-architecture.md` §29's prohibited-list matches this ADR's rules 1–3 exactly; (2) the `ProjectMemoryRepository` contract in §18 specifies "never deleted — superseded/revoked states only"; (3) `04-ai-agent-application-architecture.md` §5 confirms Agent context assembly draws only from approved records.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §29, §62.7
- `docs/product-architecture/04-bounded-context-catalog.md` §16
- `docs/product-architecture/01-canonical-domain-model.md` §24 (Project Memory Position — current-state evidence)
- `docs/adr/ADR-PMF-009-project-memory-separation.md` (domain-level ratification this ADR builds on)
