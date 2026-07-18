# ADR-PMF-009: Project Memory Is Governed, Structured Knowledge, Distinct From Chat History

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`, §23-24, §9) audited how PMFreak currently separates the several things a naive reading of the brief might expect to be conflated: raw conversational transcript versus curated operational knowledge. The brief's own framing warns explicitly against letting "chat history become memory automatically" — PR1 investigated this as a real risk and found, contrary to what a first read might expect, that **the risk has already been substantially avoided** at the current-state level (§24: "Confirmed distinct, well-separated systems — not conflated").

The evidence, re-stated precisely because this ADR must not overstate or understate it:

- **Project Memory** (`project_memory_snapshots`, `src/lib/memory/organization-memory.ts`) is Project-scoped, curated/derived: an extracted, structured summary covering objective, phase, milestones, blockers, risks, commitments, and dependencies (PR1 §9, §24).
- **Chat History** (`context_conversations`/`context_messages`) is scoped to exactly one of `workspace|pmo|project` — never mixed, enforced by a CHECK constraint plus a partial unique index (PR1 §9, §24, §32) — and is explicitly documented in the codebase as the *unprocessed* log that memory is derived from, not memory itself. PR1 characterizes this chat-to-memory boundary as "the correct, already-implemented guard against the exact failure mode the brief warns about" (§24).
- **Operational Memory** (`operational_memory_records`, `operational_intervention_records`) is a related but distinct, workspace/project-scoped, portfolio-scale analytical system with **real, implemented lineage**: a self-referencing `parent_record_id` FK, cycle-safe traversal, and a `buildCausalityChain()` function (PR1 §24, §29). This is the closest existing precedent in the codebase for what a lineage mechanism looks like when actually built, and is cited here as a pattern to learn from, not as something Project Memory already has.
- **Agent Memory** (`agent_memory_records`) is authoritative only for agent runtime/tool-execution state — not a domain-memory concept, and out of scope for this ADR (PR1 §24).
- **Personal Memory** (`src/lib/personal-memory/**`) is a fourth, orthogonal axis: per-PM, cross-project, derived — also out of scope for this ADR (PR1 §24).

PR1 also found a real, unresolved gap that this ADR does not close: Project Memory snapshots are derived/regenerable, so correction today happens implicitly through regeneration rather than through any explicit amendment or audit-trail workflow. No evidence of such a mechanism was found, which PR1 flags precisely as "unverified rather than confirmed absent" (§24) — a real gap against a governance requirement, not a confirmed absence, and in either case not something this documentation-only ADR fixes. Separately, PR1 (§27) found that no system today feeds Enterprise Intelligence, because Enterprise Intelligence has no elevation pipeline built at all — relevant because this ADR's rule on elevation must be read as constraining a pipeline that does not yet exist.

The Founder has ratified Project Memory's status as a first-class, governed domain concept, formally distinct from Chat History, as part of the full canonical hierarchy ratification (Enterprise → Workspace → PMO → Portfolio → Program → Project, with Project → Project Memory 1:1 logical). This ADR formalizes that ratified decision — D-09 — as a domain rule set, not as an open question.

## Decision

**Project Memory is structured, governed, and traceable operational knowledge, logically 1:1 with its owning Project. Chat History is a conversational source that can feed Project Memory but never automatically becomes it.**

Project Memory is ratified as the authoritative, curated layer of Project-scoped operational knowledge — the thing agents, executives, and future Enterprise Intelligence elevation are meant to trust. Chat History remains what PR1 already found it to be: a raw, unprocessed, scope-isolated transcript that is one *ingestion source* among several (chat, document upload, evidence, and — per PR1 §23 — eventually the not-yet-built Project Intelligence Feed), not itself a memory tier.

This decision ratifies the conceptual and governance shape of Project Memory. It does not authorize or execute any schema change, migration, or product-code change — see Out of Scope and Migration Implications.

## Domain Rules

1. Chat History can feed Project Memory. A conversation, or an extract from one, is a legitimate input to the process that produces or updates a Project Memory snapshot.
2. Chat History does not automatically become authoritative Project Memory. No message, thread, or transcript segment is itself a Project Memory record merely by having been said; it must pass through a structuring/curation step to become one.
3. Project Memory must preserve, for every unit of knowledge it holds: **source** (what produced this — a conversation, a document, an agent inference, a manual entry), **actor** (who or what asserted it), **date**, **context** (the surrounding situation, e.g. which phase/milestone it relates to), **evidence** (what backs the claim), **confidence**, **validation status**, **lineage** (what this knowledge was derived from, and what it has fed), and **corrections** (a record of amendments, superseding the original rather than silently overwriting it).
4. Project Memory can be consumed by agents (e.g., the Cost and Quality Governance Agents, and any future named agent per PR1 §25) as a trusted input, distinct from and preferred over raw Chat History for the same purpose.
5. Only governed information — information that has passed through Project Memory's structuring and validation, not raw Chat History or unvalidated inference — can be elevated to Enterprise Intelligence. Because PR1 (§27) confirms no elevation pipeline exists yet, this rule constrains the *design* of any future pipeline; it does not describe running behavior today.
6. Conversations (Chat History) may be deleted or retained under policies distinct from, and independently configurable from, the retention/deletion policies governing Project Memory as an operational record. Deleting a conversation must not silently delete the governed knowledge already curated from it into Project Memory, and deleting or amending a Project Memory record must not rewrite the Chat History it was originally sourced from.
7. Project Memory must distinguish, as separate categories rather than a single undifferentiated blob: **facts** (directly evidenced), **inferences** (derived, not directly stated), **decisions** (a choice that was made), and **outcomes** (what actually happened as a result). Inference is never to be presented, stored, or consumed as if it were evidence (consistent with the ratified invariant "inference ≠ evidence").

## Alternatives Considered

- **Treat Chat History as Project Memory directly (no separate curated layer).** Rejected: this is precisely the failure mode the brief warned against and that PR1 confirmed is already avoided in the current implementation (§24). Collapsing the two would erase a distinction PMFreak has already built correctly, would make every conversational aside permanently authoritative, and would make correction impossible without deleting conversational history.
- **Make Project Memory fully auto-generated with no governance metadata (source/actor/confidence/etc.), relying only on regeneration for correction.** Rejected: this is close to today's actual state and is the gap PR1 flagged (§24) — regeneration-as-correction has no explicit audit trail, no way to distinguish a validated correction from a re-run that happened to change, and no way to know who or what authorized a change. Rule 3 and rule 7 exist specifically to close this gap in a future implementation.
- **Allow any Chat History message to be elevated to Enterprise Intelligence directly, bypassing Project Memory, if it looks sufficiently important.** Rejected: this would violate the ratified invariant that only governed knowledge elevates to Enterprise, and would reintroduce exactly the ungoverned-conversation-becomes-fact risk this decision exists to prevent. Rule 5 forecloses this path explicitly.
- **Model Project Memory as N:1 or N:N with Project (e.g., multiple competing snapshots per Project with no canonical one).** Rejected: the ratified cardinality is Project→Project Memory 1:1 logical — there is exactly one authoritative curated memory per Project at any point in time. Multiple *historical* versions (via corrections/lineage, rule 3) are expected and required; multiple simultaneously-authoritative snapshots are not.
- **Reuse Operational Memory's existing lineage mechanism (`parent_record_id`, `buildCausalityChain()`) as-is for Project Memory, treating the two as one system.** Rejected: Operational Memory and Project Memory answer different questions — Operational Memory is portfolio-scale analytical/intervention tracking; Project Memory is the curated operational-knowledge-of-record for one Project. PR1 (§24) already found them to be correctly separate systems. However, Operational Memory's lineage implementation is explicitly named in this ADR (Context, and Migration Implications) as the pattern a future Project Memory lineage/correction mechanism should draw on, since it is the one part of rule 3 that already has a working precedent elsewhere in the codebase.

## Positive Consequences

- Formalizes, rather than leaves implicit, a separation PR1 found the current implementation already gets right — converting an audit observation into a durable, ratified contract that future PRs cannot silently erode.
- Gives agents (present and future, PR1 §25) an explicit, named, trustable input (Project Memory) distinct from noisy raw transcript, consistent with the already-documented "agents observe/recommend, never treat unvalidated input as fact" philosophy (PR1 §25, §27).
- Establishes the precise governance metadata (rule 3) and knowledge-type taxonomy (rule 7) that a future implementation PR must build toward, closing the ambiguity PR1 flagged as "unverified rather than confirmed absent" (§24) by turning it into an explicit requirement.
- Creates the necessary precondition for any future Enterprise Intelligence elevation pipeline (rule 5) to be designed safely from the start, rather than retrofitted onto whatever happened to accumulate in Project Memory.
- Decouples conversation retention/deletion policy from operational-record retention policy (rule 6), which is required for any sane data-lifecycle and export/sovereignty story (PR1 §36) and for eventual compliance requirements that treat "what we knew and decided" differently from "what was chatted about."

## Negative Consequences

- Ratifying rule 3's full metadata set (source, actor, date, context, evidence, confidence, validation status, lineage, corrections) is a materially larger data model than the current `project_memory_snapshots` table implements today (PR1 §9 describes it as a curated extracted summary, not a per-fact governed record); this ADR creates a gap between ratified intent and implemented reality that a future PR must close.
- Rule 6's independent retention/deletion policies add operational complexity: a future implementation must ensure a deleted conversation doesn't strand unexplainable Project Memory entries with no way to inspect the original source, while also not being forced to retain conversations indefinitely just to preserve traceability.
- Rule 7's fact/inference/decision/outcome taxonomy did not previously exist as an explicit categorization in the current schema (PR1 §9 describes Project Memory as a single structured summary object, not four typed categories); introducing it is new modeling and migration surface area.

## Risks

- **Gap-persistence risk:** the correction/audit-trail gap PR1 flagged (§24) is *not* fixed by this ADR — it is a documentation-only ratification. If a future implementation PR is not scoped explicitly against rule 3's corrections requirement, this gap could persist indefinitely under the false impression that "we already decided this," since the decision (this ADR) will exist before the implementation does.
- **Elevation-pipeline risk:** rule 5 constrains a pipeline that does not exist yet (PR1 §27). There is a real tension, already identified in PR1 §27, between the vision's evidence→pattern→Enterprise Intelligence elevation chain and the current architecture's absolute RLS-enforced isolation-instead-of-governance posture. This ADR does not resolve that tension (it belongs to the Enterprise Intelligence ADR, D-14); it only ensures that whichever elevation design is eventually chosen, it will draw solely from governed Project Memory, not raw Chat History.
- **Retrofitting risk:** because Chat History and Project Memory are already separate systems today, there is a temptation for a future implementation PR to treat rule 3's metadata as a lightweight annotation layer bolted onto the existing `project_memory_snapshots` regeneration process rather than a genuine governed-record model with real corrections; this would satisfy the letter of this ADR without its intent.
- **Category-boundary risk (rule 7):** distinguishing "inference" from "fact" reliably, at the point of ingestion, is a real design and possibly product-judgment problem (e.g., an agent-derived risk assessment is an inference even if it is later validated as correct); this ADR mandates the distinction exist but does not resolve how it is drawn.

## Security and Data Implications

- Project Memory remains Project-scoped and inherits tenancy from its owning Project, which inherits from Workspace/PMO per the already-RLS-verified pattern (PR1 §16, §17, §35). Nothing in this ADR relaxes or bypasses that boundary.
- Rule 5 is itself a security/governance control: it ensures that if and when a cross-boundary Enterprise Intelligence elevation mechanism is built (PR1 §27, ADR for D-14), the only thing that can cross is knowledge that has already passed through Project Memory's governance gate — never unvalidated raw conversation. This directly narrows the attack/leak surface for the "no knowledge crosses clients" invariant.
- Rule 6's independent retention/deletion policies have a data-sovereignty dimension: a workspace's export/deletion rights (PR1 §36, `data-export-sovereignty-architecture.md`) must be able to address Chat History and Project Memory as separately governed data classes, not a single undifferentiated bucket, once implemented.
- Corrections and lineage (rule 3) are themselves sensitive audit data — a future implementation must ensure the correction/lineage trail is protected by the same RLS/tenancy boundary as the Project Memory record it corrects, not treated as a separate, potentially less-guarded log.

## Migration Implications

No migration is executed by this ADR. A future implementation PR (PR2 or later, separately scoped and separately reviewed) would need to:

- Extend `project_memory_snapshots` (or introduce a companion table) to carry, per unit of knowledge, the governance metadata required by rule 3: source, actor, date, context, evidence reference, confidence, validation status.
- Design an explicit correction/amendment mechanism for Project Memory, replacing today's implicit "correction via regeneration" — likely by recording superseding entries rather than overwriting, so history remains inspectable. Operational Memory's self-referencing `parent_record_id` FK and cycle-safe `buildCausalityChain()` (PR1 §24, §29) are the closest existing implemented precedent and should be evaluated as a starting pattern, adapted to Project Memory's per-fact rather than per-record granularity.
- Add an explicit typed distinction for facts, inferences, decisions, and outcomes (rule 7) — either as a category/enum column on the extended Project Memory model, or as genuinely separate sub-structures within it; this ADR does not choose between those implementation shapes.
- Define, but not yet build, the ingestion boundary that turns a Chat History message (or extract) into a candidate Project Memory entry — consistent with PR1 §23's proposed Feed lifecycle (Raw Source → Normalized Event → Evidence → Proposed Entity → Approved Record), which already positions Project Memory as the curated layer that lifecycle should terminate into.
- Ensure any future Enterprise Intelligence elevation pipeline (out of scope here, belongs to D-14) reads only from the governed Project Memory model described above, never directly from `context_conversations`/`context_messages`.
- None of the above is scheduled, sequenced, or estimated by this ADR; it is a requirements list for whichever future PR takes on Project Memory's data-model implementation.

## UX Implications

- None are executed by this ADR. It is documentation-only.
- A future implementation/UX PR will need a way to surface provenance (source, actor, confidence, validation status) to users reviewing Project Memory, so "the system believes X" is visibly distinguishable from "the system inferred X" or "a user said X in chat once" — this ADR mandates the underlying data exists (rule 3) but does not design the surface.
- Any future UI that lets a user browse or edit Project Memory must present facts, inferences, decisions, and outcomes (rule 7) as visibly distinct, not as one undifferentiated list, to avoid recreating the conflation this ADR exists to prevent.
- Any future UI or copy must not imply that deleting a conversation deletes the operational knowledge already curated from it (rule 6), and must not imply that editing Project Memory rewrites the original chat — both would violate the independence rule 6 establishes.

## Compatibility Implications

- No breaking change to any existing table, route, API, or UI is made by this ADR — it is a decision record only.
- `project_memory_snapshots` and `context_conversations`/`context_messages` continue to function exactly as they do today until a future implementation PR extends them; nothing in this ADR removes or alters existing read/write paths.
- This decision is compatible with, and does not require re-litigating, the already-confirmed current-state separation PR1 documented (§24): Chat History's `workspace|pmo|project` CHECK-constrained scoping, and Project Memory's Project-scoped, curated nature both remain as-is.
- This decision is compatible with, and does not resolve, PR1's separately-flagged Enterprise Intelligence elevation-pipeline tension (§27, D-14); rule 5 only pre-constrains that future decision's inputs.
- Operational Memory, Agent Memory, and Personal Memory (PR1 §24) are unaffected, unmerged, and unmodified by this ADR; it addresses only the Project Memory / Chat History boundary.

## Out of Scope

- No schema change, migration, table creation, or index is executed by this ADR.
- No product code, route, component, API, or navigation change is executed by this ADR.
- The design of any future Enterprise Intelligence elevation pipeline is out of scope — this ADR only constrains its future input (rule 5); the pipeline itself is a separate decision (D-14) and a separate ADR.
- Operational Memory's own lineage/causality model is not modified, extended, or redefined by this ADR; it is referenced only as an implementation precedent for a future Project Memory correction mechanism.
- Agent Memory (agent runtime/tool-execution state) and Personal Memory (per-PM, cross-project) are out of scope; this ADR addresses only Project Memory and Chat History.
- The exact taxonomy boundaries for distinguishing "inference" from "fact" in practice (rule 7) are not defined here; this ADR mandates the distinction exist, not how every borderline case is classified.
- Retention/deletion policy specifics (durations, legal-hold behavior, export formats) for either Chat History or Project Memory are not defined here; rule 6 mandates only that the two policies be independently definable.

## Validation

- This decision is validated against, and does not contradict, the ratified canonical hierarchy and cardinalities supplied for PR1.1, in particular: Project → Project Memory 1:1 logical.
- This decision is validated against, and directly implements, the ratified invariants: chat history ≠ Project Memory (rules 1-2); inference ≠ evidence (rule 7); only governed knowledge elevates to Enterprise (rule 5); Enterprise Intelligence preserves Workspace+Project provenance (rule 3's lineage requirement is the mechanism that would make such provenance possible once elevation exists); no knowledge crosses clients (reinforced by rule 5 in conjunction with the existing RLS isolation model, PR1 §27, §35).
- This decision is validated against the current-state evidence in `docs/product-architecture/01-canonical-domain-model.md` §9, §23, §24, §27, §29, §32: it does not claim rule 3's full governance metadata, rule 6's independent retention policies, or rule 7's fact/inference/decision/outcome typing already exist in `project_memory_snapshots` today — they do not (§24's flagged gap). It does correctly claim, and does not contradict, that the Chat History/Project Memory *separation itself* (rules 1-2) is already substantially true today.
- Correctness check for a future implementation PR: after Project Memory is extended per Migration Implications, re-running PR1's method (inspecting `project_memory_snapshots` and any companion tables directly) should show, per entry, a non-null source, actor, date, evidence reference, confidence, and validation status, plus a inspectable correction/lineage trail — not merely a regenerable extracted summary.
- No test suite, migration, or code exists yet to validate against, consistent with this being a ratification-only document; validation here is conceptual (consistency with the ratified hierarchy and invariants) rather than executable.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — §9 (Current Entity Inventory: Project Memory, Operational Memory, Chat History rows), §23 (Project Intelligence Feed Position), §24 (Project Memory Position), §27 (Enterprise Intelligence Position), §29 (Aggregate Map: Project Memory, Operational Memory), §32 (Invariants: Chat History scope CHECK constraint).
- `docs/product-architecture/01.1-domain-ratification.md` — PR1.1 ratification document (authored in parallel with this ADR).
- `supabase/migrations/` — existing `context_conversations`/`context_messages` scope-CHECK migration and the `operational_memory_records` lineage (`parent_record_id`) migration, cited in PR1 §24/§29 as the current-state evidence and precedent respectively for this ADR's rules.
