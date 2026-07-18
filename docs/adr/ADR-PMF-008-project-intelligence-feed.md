# ADR-PMF-008: Project Intelligence Feed Is a Composite Projection, Not a Source of Truth

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`, §23) audited the codebase for any implementation of a "Project Intelligence Feed" and found that **the concept does not exist today**: no `Feed`, `ProjectFeed`, `IntelligenceFeed`, or `ActivityStream` type or table was found anywhere in the repository. The only literal string match is a UI heading, "Executive Intelligence Feed," on the `/projects` list page (`src/app/(protected)/projects/page.tsx:216`), which is not backed by any distinct data model — it is decorative UI copy, not an entity.

Since the concept could not be designed in a documentation-only PR, §23 *positioned* it rather than building it, and reached a tentative conclusion (confidence "Medium," because nothing is built yet to be fully certain): the Feed is "best framed as a projection/read-model, composed by re-reading events already owned by other bounded contexts (Chat, Evidence, RAID, Decision, Task, Milestone), not as a new source of truth," and that Project Memory (§24, `project_memory_snapshots` — a real, built, curated/derived table) is "the curated, authoritative layer the Feed should ultimately summarize into." This was recorded as open decision D-11 in PR1's decision backlog (§33): "Is Project Intelligence Feed an aggregate or a projection?" — tentative answer "Projection," blocking status "Yes (blocks feed design)."

The closest structural analogs already present in the codebase are `PlatformEventRow` (used inside `DecisionLineage.events`, a normalized-event shape) and project-scoped `context_conversations`/`context_messages` (the raw chat log). Neither is a Feed; both are raw material a future Feed projection could read from. PR1 also found that only 2 of 13 named specialized agents exist today (Cost Governance, Quality Governance — §25), both deterministic, recommendation-only, and never writing directly to authoritative tables — directly relevant here because the Feed's "Recommendations" stage depends on agent output that mostly does not exist yet.

This ADR formalizes decision D-08 from the founder's ratification: it takes PR1's tentative D-11 recommendation and makes it final, product-ratified policy, and it fixes the Feed's composition, pipeline, and invariants as a target-state contract for a future implementation PR (PR2). Nothing in this ADR builds the Feed.

## Decision

**The Project Intelligence Feed is a composite experience that presents operational information about the Project chronologically and semantically.** It is a **projection over existing bounded contexts** (Chat, Evidence, RAID, Decision, Task, Milestone) — not a new aggregate, not an independent source of truth, and not permitted to be treated by any consumer as authoritative in its own right. Structured, authoritative state continues to live in the canonical entities and tables each bounded context already owns; the Feed only re-presents it.

The Feed's composite content includes: events, activity, ingested information, evidence, structured records, recommendations, decisions, actions, and outcomes. It may include chat, but chat history is explicitly not the Feed, and the Feed is not simply chat history (see ADR-pending on chat/memory distinction and PR1 §24, D-12).

The Feed's underlying pipeline — every item surfaced in the Feed must be traceable to a stage in this sequence — is:

```
Raw Source → Normalized Event → Evidence → Proposed Record → Approved Record
  → Recommendation → Decision → Action → Outcome
```

This is the ratified target lifecycle first positioned in PR1 §23 (there enumerated as Raw Source → Normalized Event → Evidence → Proposed Entity → Approved Record → Recommendation → Decision → Action → Outcome → Pattern Candidate). Pattern Candidate (§27) sits downstream of Outcome and is governed separately (candidate pattern ≠ ratified pattern is a cross-cutting invariant, not specific to the Feed).

This PR does not implement the Feed, its projection logic, its storage (if any is needed for materialized views), or any UI change to the current "Executive Intelligence Feed" heading. It ratifies what the Feed *is* and *is not*, so that PR2 has an unambiguous target.

## Domain Rules

1. The Feed is a **projection**, not an aggregate. It has no independent transactional consistency boundary; consistency is owned by the bounded context each underlying event, evidence item, or record belongs to.
2. Structured information lives in canonical entities and records — `raid_items`, `project_decisions` (and its related tables), `execution_tasks`, `project_evidence`, milestone and chat tables — never duplicated into a Feed-owned table as a competing source of truth.
3. Events surfaced in the Feed preserve provenance: each item must be traceable to its originating Raw Source and, where applicable, its Normalized Event record, so a user or auditor can answer "where did this come from" for any Feed entry.
4. Inferences do not automatically become facts. An inference (e.g., a pattern detected across chat or events) is presented as an inference until it is promoted through Evidence/Proposed Record/Approved Record stages by an explicit, attributable action.
5. Recommendations do not automatically become decisions. A Recommendation (from a governance agent, per PR1 §25) is a distinct object in the pipeline; a Decision requires a separate act, human or governed, that the Feed must represent as a separate step, never collapsed into the recommendation that preceded it.
6. Decisions do not automatically become actions. An Action is a distinct downstream object; the Feed must not represent a Decision as if it were already executed.
7. Actions do not automatically become outcomes. An Outcome is recorded separately, and the Feed must represent the gap between "an action was taken" and "an outcome was observed and recorded" rather than assuming the two are simultaneous.
8. The Feed may include chat as one of its composite inputs, but is not simply chat history. Chat is Raw Source material; the Feed is expected to distinguish chat-derived items from the rest of its composite content, consistent with the ratified invariant that chat history ≠ Project Memory.
9. The Feed belongs primarily to the Project. Every Feed entry is scoped to exactly one Project, consistent with the ratified invariant that every Project belongs to exactly one Workspace.
10. Program, Portfolio, and PMO may in the future have their own aggregated feeds or projections composed by rolling up multiple Project-level feeds. Such higher-level feeds, if built, are additive and derivative — they do not replace, and are not a substitute for, the Project's own feed.
11. The Feed does not cross client/tenant boundaries. As a projection over Project-scoped bounded contexts, it inherits the Workspace-rooted isolation already RLS-verified in PR1 (§4); no Feed implementation may aggregate content across Workspaces without a separately ratified elevation mechanism (PR1 §27, D-14 — not decided by this ADR).

## Alternatives Considered

- **Treat the Feed as its own aggregate with a dedicated table** (e.g., a `feed_items` table that other bounded contexts write into). Rejected: this would create a second, competing source of truth for information that Chat, Evidence, RAID, Decision, Task, and Milestone already own, reintroducing exactly the kind of duplicated-representation problem PR1 documented for PMO (Contradiction C-1, ADR-PMF-003) and Portfolio. It would also require every writing bounded context to keep a projection table in sync, adding write-path coupling with no corresponding benefit over reading events at query time.
- **Treat the Feed as equivalent to chat history**, i.e., collapse "the Feed" into `context_conversations`/`context_messages`. Rejected: PR1 §24/D-12 already confirms chat history is distinct from Project Memory, and this ADR's rule 8 extends that same distinction to the Feed. Chat is one input among several (events, evidence, recommendations, decisions, actions, outcomes); treating it as the whole Feed would materially understate what the Feed is ratified to represent.
- **Allow inferences, recommendations, or decisions to auto-promote to the next pipeline stage** for a smoother, more "autonomous" feel. Rejected: this directly contradicts the ratified cross-cutting invariants (inference ≠ evidence; recommendation ≠ decision; decision ≠ action) and would remove the human/governance checkpoints the pipeline exists to preserve. It would also be premature given only 2 of 13 specialized agents exist today, both deterministic and recommendation-only — there is no governance maturity yet to justify auto-promotion even if it were desired.
- **Position the Feed at Program/PMO/Portfolio scope first, deferring Project-level scope.** Rejected: PR1 §23 flagged Feed scope as an open question with no codebase evidence pointing either way; this ADR resolves it by ratifying Project as the primary scope (rule 9) and permitting higher-level aggregation only as a future, additive layer (rule 10), consistent with the founder's ratified hierarchy where Project is the leaf entity closest to actual execution data.

## Positive Consequences

- Resolves PR1's open decision D-11 (§33) as final, ratified policy: "projection, not aggregate" is no longer a tentative Medium-confidence recommendation but a fixed target for PR2.
- Gives every future Feed implementation a single, unambiguous pipeline vocabulary (Raw Source → Normalized Event → Evidence → Proposed Record → Approved Record → Recommendation → Decision → Action → Outcome) to build against, reducing the risk of another fragmented, multiply-represented concept like PMO or Portfolio.
- Explicitly protects the governance checkpoints (inference≠fact, recommendation≠decision, decision≠action) at the domain-rule level before any Feed code is written, rather than relying on implementation-time discipline.
- Establishes a clear, provenance-preserving contract (rule 3) that supports auditability from day one of any future implementation.
- Leaves room for legitimate future work (Program/Portfolio/PMO aggregated feeds, rule 10) without requiring the Project-level Feed to be redesigned when that work happens.

## Negative Consequences

- No Feed exists after this ADR; users continue to see only the current "Executive Intelligence Feed" heading with no distinct data model behind it until PR2 is scoped and executed.
- Because the Feed is defined as a projection with no dedicated storage of its own, a future implementation must solve read-time composition performance (joining/reading across Chat, Evidence, RAID, Decision, Task, Milestone) without the option of a simpler single-table denormalized feed — a materialized-view or caching strategy will likely be required, which this ADR does not design.
- The pipeline's later stages (Recommendation, Decision, Action, Outcome as agent-originated) are currently thin in practice: only 2 of 13 specialized agents exist, both deterministic and recommendation-only. The ratified pipeline will look sparsely populated in any near-term implementation, not because the model is wrong, but because upstream agent capability has not caught up yet.

## Risks

- **Read-path complexity risk:** composing a chronological, semantic view across six-plus bounded contexts at query time, without a dedicated table, risks becoming a performance or complexity burden if not designed carefully in PR2. This ADR fixes the target shape but not the technical approach (e.g., materialized view vs. on-demand query vs. event-sourced read model).
- **Provenance-loss risk:** rule 3 requires traceability to originating Raw Source, but PR1 found no existing Normalized Event store beyond `PlatformEventRow` usage inside `DecisionLineage.events`, which is not a general-purpose event log. If PR2 does not first establish a proper Normalized Event layer, provenance preservation could be implemented inconsistently across source types (chat vs. evidence vs. integration webhook).
- **Premature-scope risk:** rule 10 (future Program/Portfolio/PMO feeds) could be misread as authorizing that work now. It does not — it only preserves the option. Implementing higher-level feeds is out of scope for this ADR and undecided pending Program's and Portfolio's own hierarchy ADRs.
- **Governance-lag risk:** because only 2 of 13 agents exist, a future PR2 implementation could be tempted to relax rule 5/6/7's non-auto-promotion rules "temporarily" to make the Feed look more complete. This ADR forecloses that temptation at the policy level; PR2 reviewers should treat any such relaxation as a violation of this ADR, not a pragmatic shortcut.

## Security and Data Implications

- No new tables, columns, or RLS policies are introduced by this ADR. If a future PR2 introduces a materialized projection table, that table must inherit Project/Workspace-scoped RLS consistent with the tenant isolation PR1 verified (408/409 tables RLS-enabled, 10/10 cross-tenant smoke tests passed) — this ADR requires that as a constraint on PR2, but does not implement it.
- Rule 11 (no cross-client knowledge) means any future Feed implementation must not read or aggregate events across Workspace boundaries. This is consistent with, and does not modify, the existing absolute-isolation posture PR1 documented for Operational Memory and Enterprise Intelligence (§27).
- Provenance preservation (rule 3) has a security dimension: because the Feed will surface information originally captured for audit/evidence purposes (`project_evidence`, decision lineage), any future implementation must not weaken existing access controls on that underlying data by re-exposing it through a less-restricted Feed read path.

## Migration Implications

None of the following is executed by this ADR. They describe what a future implementation PR (PR2) would need to do:

- Design and build a Normalized Event layer (or extend `PlatformEventRow`/`DecisionLineage.events` into one) sufficient to support rule 3's provenance requirement across all Raw Source types (chat, evidence upload, integration webhook, etc.).
- Design the projection/read-model composition strategy (on-demand query, materialized view, or event-sourced read model) that reads from Chat, Evidence, RAID, Decision, Task, and Milestone without duplicating their data into a new source of truth.
- Define how each pipeline stage (Proposed Record, Approved Record, Recommendation, Decision, Action, Outcome) maps onto existing tables (`raid_items`, `project_decisions` and its related tables, `execution_tasks`, `project_evidence`) versus any new join/view structures needed purely for presentation.
- Replace or reconcile the current decorative "Executive Intelligence Feed" heading on `/projects` (`src/app/(protected)/projects/page.tsx:216`) with an implementation backed by this ADR's model, once built.
- Define the relationship, if any, between the future Feed projection and Project Memory's regeneration process (`project_memory_snapshots`), consistent with §24's finding that Memory is the curated layer the Feed should summarize into.
- Scope whether/when Program-, Portfolio-, or PMO-level aggregated feeds (rule 10) get built, as a separate, later decision — not assumed by this ADR to be imminent.

## UX Implications

- No UI copy, route, navigation, or component is changed by this ADR. It is documentation-only.
- The existing "Executive Intelligence Feed" heading on `/projects` (PR1 §23, `src/app/(protected)/projects/page.tsx:216`) remains, unmodified, a UI label not yet backed by the model this ADR ratifies. Its continued presence should not be read by future contributors as evidence the Feed already exists in the form described here.
- Any future Feed UI (PR2) must visually or structurally distinguish pipeline stages (e.g., recommendation vs. decision vs. action vs. outcome) rather than presenting them as a single undifferentiated activity stream, consistent with rules 4-7's non-auto-promotion requirements — a flattened, stage-blind feed UI would violate the intent of this ADR even if the underlying data model is correct.
- Because the Feed may include chat but is not chat (rule 8), any future Feed UI should make clear which entries are chat-derived and which are derived from other bounded contexts, rather than rendering chat and structured events in an undifferentiated stream.

## Compatibility Implications

- No existing code path, table, or API is broken, deprecated, or altered by this ADR. `PlatformEventRow`, `DecisionLineage.events`, `context_conversations`/`context_messages`, `raid_items`, `project_decisions`, `execution_tasks`, and `project_evidence` all continue to function exactly as before.
- The current "Executive Intelligence Feed" UI heading continues to render unchanged; this ADR creates no immediate compatibility break and requires no immediate code change.
- Any future PR2 Feed implementation should be written against the pipeline and rules fixed here from the outset, so that early implementation work does not need to be re-litigated against a later, conflicting Feed ADR.

## Out of Scope

- Building any part of the Feed — projection logic, storage, UI, or agent integration (future PR2).
- Designing the Normalized Event layer's schema or the specific query/materialization strategy for the projection (future PR2).
- Deciding whether, when, or how Program/Portfolio/PMO aggregated feeds (rule 10) get built — a separate future decision, not this ADR.
- Resolving the D-14 knowledge-elevation governance question (automatic vs. governed-promotion vs. no elevation) referenced by PR1 §27 — this ADR assumes no auto-promotion within the Feed's own pipeline (rules 4-7) but does not resolve the broader Enterprise Intelligence elevation question.
- Modifying `src/app/(protected)/projects/page.tsx` or any other UI file; this ADR does not touch product code.
- Portfolio's, Program's, or Enterprise's own domain semantics — covered by their own ADRs within this PR, independent of the Feed's positioning here.

## Validation

This ADR is a documentation/ratification artifact; it has no code to test. Its validation criteria are:

- Consistency with the founder-ratified cardinalities: Project→Intelligence Feed 1:1 UI projection; Project→Agent Recommendations 1:N; Recommendation→Decision 0..1; Decision→Action 0..N; Action→Outcome 0..N — confirmed, this ADR's Domain Rules and pipeline description restate exactly these relationships in prose and in the pipeline diagram.
- Accuracy of all current-state claims against `docs/product-architecture/01-canonical-domain-model.md` — every factual claim in Context traces to a specific section (§23 Feed positioning and pipeline, §24 Project Memory, §25 agent inventory, §33 D-11/D-12) and was re-read from the source file before being restated here.
- No contradiction introduced with the ratified cross-cutting invariants (chat history ≠ Project Memory; inference ≠ evidence; recommendation ≠ decision; decision ≠ action; action ≠ outcome; candidate pattern ≠ ratified pattern; every Project belongs to exactly one Workspace; no knowledge crosses clients) — this ADR's Domain Rules restate and apply each of these directly (rules 4-9, 11).
- Future PR2 acceptance test (not executed here): a Feed implementation can be reviewed against this ADR's pipeline and rules without requiring a new source-of-truth table, and every surfaced Feed item can be traced to a canonical record in its owning bounded context.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1 canonical domain model audit; primary current-state evidence source (§23 Project Intelligence Feed Position, §24 Project Memory Position, §25 specialized agent inventory, §33 decision backlog D-11/D-12).
- `docs/product-architecture/01.1-domain-ratification.md` — PR1.1 ratification document, authored in parallel with this ADR, recording the founder's full set of ratified decisions including D-08.
- `docs/adr/ADR-PMF-003-pmo-governance-semantics.md` — sibling ADR in this ratification set; establishes the precedent of preserving and clarifying real structural analogs (there, `pmos`; here, `PlatformEventRow` and bounded-context events) rather than deleting or duplicating them.
