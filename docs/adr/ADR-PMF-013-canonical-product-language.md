# ADR-PMF-013: Canonical Product Language Is the Single Naming Authority for PMFreak

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited PMFreak's implementation and found that, independent of any domain-model defect, the *words* the product uses are themselves inconsistent: "Command Center" applied to five to six unrelated objects (§9, §11, §22), "Portfolio" applied to six unrelated objects with zero PMI-sense implementation (§9, §13, §18), and "Project" itself called three different things — Project, Context, and Initiative — in different parts of the same product (§9, §11, §20). PR1.1 (`docs/product-architecture/01.1-domain-ratification.md`) and ADR-PMF-001 through ADR-PMF-012 then ratified what each entity in the domain *is* — cardinalities, invariants, parent/child relationships, contracts — but explicitly left "final visible navigation names," "final UI," and the naming-consolidation *execution* itself as open, out-of-scope items (PR1.1 §25, items 13 and 20; PR1.1 §47, D-06 and D-12 rows: "semantics only — execution remains a future copy-only PR").

This left a real gap: a fully ratified domain model with no ratified vocabulary. Two engineers implementing the same ratified Portfolio entity, with no naming authority to check against, could each choose a different UI label for it, reproducing the exact naming drift PR1 spent its audit cataloguing — just one level later in the process. This ADR closes that gap, establishing `docs/product-architecture/02-canonical-product-language.md` (and its per-topic companion ADRs, ADR-PMF-014 through ADR-PMF-016) as the single naming authority for every user-facing, API-facing, and documentation-facing word PMFreak uses for a ratified domain concept.

This ADR does not reinterpret, reopen, or change any decision made in PR1.1 or ADR-PMF-001 through -012. It is strictly additive: those documents fixed *what things are*; this one fixes *what they are called*.

## Decision

**`docs/product-architecture/02-canonical-product-language.md` is the canonical, binding naming authority for every ratified PMFreak domain concept.** Every user-facing word, every button label, every navigation entry, every breadcrumb, every API field name (where a natural mapping exists), and every future documentation page must use the name that document assigns, and must observe its Forbidden Synonyms list. A future PR that introduces a new name for an already-named concept, or reuses an already-named word for a new concept, is non-conformant with this ADR unless it first supersedes `02-canonical-product-language.md` through its own ADR, exactly as a domain-model change would have to supersede ADR-PMF-001 through -012.

This decision does not implement any rename, does not touch any UI, route, API, or schema, and does not claim the current codebase conforms to the ratified vocabulary today. It ratifies the target vocabulary and the process by which it may change.

## Domain Rules

1. One concept has exactly one canonical name, as listed in `02-canonical-product-language.md` §4 (Canonical Vocabulary). No screen, button, API field, or document may introduce a second name for an already-named concept.
2. One canonical name has exactly one meaning. A name already assigned to one concept may not be reused for a different concept (e.g., "Portfolio" may never again be reused for a personal saved-list feature; that concept is "Saved Projects").
3. Naming follows the ratified domain model first. No UI, marketing, or documentation convenience may override a ratified entity boundary from PR1.1/ADR-PMF-001–012 by inventing a name that blurs it.
4. Internal identifiers (table names, enum values, column names, config keys) are never promoted to user-facing vocabulary, and never appear in UX copy, error messages, or Agent output.
5. A concept hidden from a given segment's UI by progressive disclosure (ADR-PMF-012) retains its one canonical name; hiding is never an excuse to invent a "simpler" alias.
6. Any future ADR that changes a name in `02-canonical-product-language.md` must explicitly supersede this ADR and that document, following the same Accepted/Superseded convention already established for ADR-PMF-001 through -012.
7. This ADR and its companion vocabulary document do not, by themselves, authorize or schedule any rename of existing code, routes, or copy; they establish the target and the governance process. Execution is future, separately-scoped PR work (PR3+).

## Alternatives Considered

- **Leave naming as an implicit convention, decided ad hoc per PR.** Rejected: this is the status quo that produced the five-to-six-meaning "Command Center" problem and the six-meaning "Portfolio" problem PR1 documented. A ratified domain model with no naming authority would only move the drift one layer later.
- **Fold naming decisions into each domain ADR (ADR-PMF-001 through -012) retroactively.** Rejected: those ADRs are already Accepted and their own Validation sections confirm they were checked against the evidence available at ratification time; reopening them to add naming content would blur their "no code, no naming, decision-only" scope and risks re-litigating settled domain rules alongside unrelated naming questions. A separate, dedicated naming authority is cleaner and matches PR1.1's own explicit "naming consolidation execution... remains a future copy-only PR" framing (§47, D-06/D-12 rows).
- **Treat naming as a UX/design responsibility with no ADR-level backing.** Rejected: PR1's own evidence (five to six meanings for one word, used in production) shows that naming decisions have exactly the same durability requirements as domain decisions — without a written, binding contract, the same drift recurs. Naming deserves the same ADR discipline as domain semantics, not a lesser one.
- **Wait until PR3 implementation to decide naming, one screen at a time.** Rejected: this reproduces the original problem — different engineers, on different PRs, independently choosing labels for the same ratified entity with nothing to check against. Fixing the vocabulary before implementation begins is cheaper than reconciling divergent naming after the fact.

## Positive Consequences

- Gives PR3 and every future implementation PR a single, checkable naming reference, exactly as ADR-PMF-001–012 already give them a single checkable domain reference.
- Prevents the ratified domain model (PR1.1) from being undermined by inconsistent naming during implementation — the single largest root cause PR1 identified for the product's prior conceptual drift.
- Establishes a governance process (Rule 6) for future naming changes, so a legitimate future rename is possible without reintroducing ungoverned drift.
- Converts PR1.1's explicitly-left-open naming items ("final visible navigation names," §25 items 13/20) into a ratified answer, narrowing what remains genuinely open for PR3.

## Negative Consequences

- Adds a second document (plus three companion ADRs) that future contributors must consult alongside PR1.1 and ADR-PMF-001–012, increasing the total ratified-documentation surface a new engineer must read before implementing.
- Because this ADR ratifies vocabulary, not implementation, the gap between ratified name and actual UI copy (which still says "Create Command Center," "Context," "Initiative," etc.) persists until a future PR executes the renames — this ADR does not close that gap, only names it precisely.
- Any future legitimately-needed rename now requires a superseding ADR rather than an informal PR description, which is a small but real process overhead compared to the status quo.

## Risks

- **Authority-fragmentation risk:** if a future PR introduces UI copy without checking this ADR or its companion document, drift can still occur; ratification alone does not enforce compliance. Mitigation: future PR review (human or automated) should check new copy against `02-canonical-product-language.md` the same way domain PRs are checked against ADR-PMF-001–012.
- **Staleness risk:** as new concepts are added to the product, this document's Canonical Vocabulary table (§4) must be extended via a superseding or companion ADR; if a future team adds a concept without registering it here, the same "no naming authority" gap reappears for that concept specifically.
- **Over-specification risk:** because this document defines twelve fields per concept for dozens of concepts, some fields (e.g., "Typical lifecycle" for concepts with no current implementation) are necessarily thin or aspirational; a future implementer should treat "Not yet implemented" fields as directional, not as a claim of existing behavior.

## Security and Data Implications

None. This ADR is a naming/documentation governance decision. It does not touch RLS, schema, or any access-control code path. It does reinforce, per Rule 4, that internal identifiers must never leak into user-facing surfaces — a defense-in-depth naming discipline, not a new security control.

## Migration Implications

No migration is executed by this ADR. Future implementation PRs (PR3+) should treat `02-canonical-product-language.md` §27 (Migration Recommendations) as their starting punch list: the Command Center CTA rename, the Project/Context/Initiative consolidation, the `personal_portfolios` → "Saved Projects" UI rename, and the Command Center table-naming reconciliation.

## UX Implications

No UI, navigation, route, or copy is changed by this ADR. It establishes the target vocabulary and rules (UX Naming Rules, Button Naming Rules, Navigation Naming Rules, Breadcrumb Rules — all in the companion document) that future UX work must conform to.

## Compatibility Implications

Backward compatible with the current implementation: no existing table, route, API, or UI copy is required to change as a direct result of this ADR. The gap between today's naming (Command Center as PMO-creation CTA, Project/Context/Initiative, six-meaning Portfolio) and the ratified vocabulary persists until a future PR closes it; this ADR does not claim otherwise.

## Out of Scope

- Any rename, copy change, route change, or schema change (future PR3+).
- Any change to ADR-PMF-001 through -012's domain rules, cardinalities, or invariants.
- Defining exact microcopy/sentence-level strings for every screen (the companion Style Guide, `02-product-copy-style-guide.md`, governs tone/voice; exact strings are PR3+ execution detail).
- Any statement about timeline, sprint assignment, or prioritization of naming-migration work relative to other roadmap items.

## Validation

- This decision is validated by ratification: it is recorded as Accepted, with Founder / Product Authority and PMFreak Architecture as decision owners, resolving the naming-authority gap PR1.1 explicitly left open (§25 items 13, 20; §47 D-06/D-12 rows).
- No code, schema, or test changes accompany this ADR, so there is no build, lint, typecheck, or test suite to run against it. The applicable check is documentary: `02-canonical-product-language.md`'s Consistency Validation section (§35) confirms no conflicting synonyms, no duplicated definitions, and no ambiguous concepts across the vocabulary table and per-concept definitions.
- Future validation belongs to PR3: any new UI copy, button, route, or API field introduced after this ADR's ratification date should be checkable against `02-canonical-product-language.md` §4/§6, and any reviewer finding a violation should treat it as a defect against this ADR, the same way a domain violation is treated as a defect against ADR-PMF-001–012.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1, source of the naming-drift evidence this ADR resolves (§9, §11, §13, §20, §22).
- `docs/product-architecture/01.1-domain-ratification.md` — PR1.1, which explicitly left final naming as an open item (§25 items 13/20, §47).
- `docs/product-architecture/02-canonical-product-language.md` — the canonical vocabulary document this ADR ratifies as binding authority.
- `docs/product-architecture/02-product-copy-style-guide.md` — companion tone/voice guide.
- `docs/adr/ADR-PMF-001-enterprise-workspace-separation.md` through `docs/adr/ADR-PMF-012-progressive-disclosure.md` — the domain-model ADRs this document's vocabulary is named for, without altering.
