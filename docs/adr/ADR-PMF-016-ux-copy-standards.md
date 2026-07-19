# ADR-PMF-016: UX Copy Standards — Tone, Pipeline-Stage Disclosure, and Forbidden Language

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-008 ratified that the Project Intelligence Feed must never collapse Recommendation into Decision, Decision into Action, or Action into Outcome — each pipeline stage must be visually and structurally distinct wherever it is surfaced (ADR-PMF-008 rules 4–7, UX Implications). ADR-PMF-010 ratified the same non-collapsing discipline for Enterprise Intelligence's fact/observation/recommendation/decision/outcome/candidate-pattern/ratified-pattern taxonomy (ADR-PMF-010 rule 11, UX Implications). ADR-PMF-009 ratified that Project Memory must visibly distinguish facts, inferences, decisions, and outcomes to users browsing it (ADR-PMF-009 rule 7, UX Implications). Each of these ADRs states a **copy/UX discipline requirement** as a side effect of a domain ruling, but none of them is itself a copy-style ADR — copy tone, sentence structure, capitalization, and forbidden language were out of scope for all three, by their own Out of Scope sections.

Separately, PR1's audit of the two agents that exist today (Cost Governance, Quality Governance) found their behavior deliberately bounded — deterministic, recommendation-only, no autonomous execution — and explicitly documented, in the codebase's own architecture notes, as a hard constraint (`docs/architecture/autonomous-intervention-runtime.md`: *"blocking autonomous external execution"* — PR1 §25). No existing ADR states the *copy-level* consequence of that constraint: that Agent-produced language in the product must never claim more autonomy or certainty than the ratified domain model allows.

This ADR is the first PMFreak decision record that ratifies UX copy standards as their own binding contract, consistent with `docs/product-architecture/02-product-copy-style-guide.md`, and gives ADR-level backing to that style guide the same way ADR-PMF-013 gave ADR-level backing to the canonical vocabulary document.

## Decision

**PMFreak's UX copy is governed by a single, binding standard: tone is competent and calm; every pipeline-stage distinction ratified elsewhere (Recommendation/Decision/Action/Outcome; fact/inference/observation/decision/outcome/candidate-pattern/ratified-pattern) must be visible in copy, never collapsed; and a fixed list of language is forbidden across every surface.** `docs/product-architecture/02-product-copy-style-guide.md` is the authoritative reference for tone, voice, sentence rules, capitalization, and per-surface-type copy rules (buttons, menus, empty states, errors, notifications, success/warning messages, confirmation dialogs, AI/Agent responses); this ADR ratifies that document as binding and fixes its most consequential, cross-cutting rules as domain-adjacent policy.

## Domain Rules

1. Copy tone is competent and calm — never hype-driven, never alarmist, never claiming certainty or autonomy the ratified domain model does not grant.
2. Any copy referencing a Forecast must state or imply confidence/uncertainty, consistent with Forecast's ratified definition as deterministic-but-not-certain (PR1 §26; `02-canonical-product-language.md` §7 Forecast).
3. Any copy referencing an Agent's output must label it a Recommendation, never a Decision or a completed Action, consistent with ADR-PMF-008's non-auto-promotion rules and PR1 §25's agent-boundary findings.
4. Any list or view presenting more than one pipeline stage (Recommendation/Decision/Action/Outcome, or fact/observation/inference/decision/outcome/candidate-pattern/ratified-pattern) must visually and textually distinguish each stage — never a flattened, undifferentiated list, per ADR-PMF-008 rule set and ADR-PMF-009/010's parallel requirements.
5. Health/Status indicators relying on color must always pair color with a text label; color alone never conveys Health, Status, or pipeline stage.
6. The following language is forbidden anywhere in the product, its documentation, or its marketing: any of the Forbidden Synonyms listed in `02-canonical-product-language.md` §6; internal identifiers, enum values, or schema/table names; hype language overstating autonomy ("AI-powered magic," "fully autonomous," "self-driving PMO"); PMI certification, compliance, or endorsement claims (per PR1 §39); and euphemisms that obscure a destructive action's irreversibility.
7. Confirmation dialogs for destructive (non-archival) actions must state the action and its irreversibility explicitly, and must never default-focus the destructive button.
8. `docs/product-architecture/02-product-copy-style-guide.md` is the canonical reference for all rules in this ADR that require more granular, per-surface-type guidance (buttons, menus, empty states, errors, notifications, success/warning messages, confirmation dialogs, AI/Agent responses, accessibility).

## Alternatives Considered

- **Leave copy tone and pipeline-stage disclosure as an unwritten design convention**, relying on ADR-PMF-008/009/010's scattered UX Implications sections. Rejected: those sections state the requirement exists but do not fix cross-cutting tone, forbidden language, or accessibility rules; without a single binding reference, each new surface would need to independently rediscover the same discipline, exactly the drift pattern ADR-PMF-013 exists to prevent for naming.
- **Fold copy standards directly into `02-canonical-product-language.md`** rather than a separate style guide plus ADR. Rejected: naming (what something is called) and tone/voice (how it is said) are different concerns with different failure modes — a vocabulary document mixing in sentence-level tone rules would be harder to use as a quick naming lookup. Keeping them as companion-but-separate documents, each with its own ADR, mirrors how ADR-PMF-002 (Workspace) and ADR-PMF-007 (Command Center) are separate ADRs despite being related.
- **Allow Agent copy more expressive/first-person latitude** ("I think we should...") to feel more conversational. Rejected: PR1 §25 and ADR-PMF-008 both establish that Agents are deterministic and recommendation-only; language that reads as autonomous personhood risks implying a level of independent judgment or authority the ratified domain model explicitly withholds (Rule 3, and the companion style guide §15).
- **Treat accessibility rules as a separate, later concern**, deferring them past this ADR. Rejected: color-only Health/Status indication (Rule 5) is a concrete, checkable requirement available now, at no implementation cost to state as policy; deferring it risks it being forgotten once visual design work begins in PR3.

## Positive Consequences

- Gives copy review a single, ADR-level standard to check new UX copy against, parallel to how ADR-PMF-001–012 give domain review a standard and ADR-PMF-013/014/015 give naming/IA review a standard.
- Makes explicit, for the first time, the copy-level consequence of the ratified non-auto-promotion pipeline (ADR-PMF-008/009/010): that consequence was previously scattered across three ADRs' UX Implications sections with no single cross-cutting rule.
- Closes a real, current-state risk: because only 2 of 13 named agents exist today, and both are deterministic (PR1 §25), copy describing them has an outsized influence on user trust calibration — ratifying "never claim more autonomy than the domain allows" now, before more agents ship, is cheaper than correcting inflated copy later.
- Gives accessibility a concrete, testable floor (Rule 5, Rule 7) before visual design work begins on any new surface.

## Negative Consequences

- Adds a fourth ratified naming/copy document (after ADR-PMF-013, ADR-PMF-014, ADR-PMF-015) to the growing set of references a contributor must check before shipping user-facing copy.
- Does not, by itself, audit or correct any existing copy in the product; like the naming ADRs, it ratifies a target standard without executing a retroactive copy audit.
- Rule 4's "never a flattened, undifferentiated list" requirement adds real design constraint to any future Feed/Memory/Enterprise Intelligence UI — a flattened activity-stream design, which might otherwise be the simplest to build, is explicitly foreclosed by this ADR (consistent with, not beyond, what ADR-PMF-008/009/010 already required).

## Risks

- **Enforcement-without-tooling risk:** like ADR-PMF-013/014/015, this ADR states a standard but does not, by itself, add automated linting or copy-review tooling. A future PR could still ship non-conformant copy unless human or automated review checks it against this document and the companion style guide.
- **Agent-copy drift risk:** as more of the 13 named agent roles are eventually implemented (PR1 §25 notes only 2 exist today), each new agent's copy must independently be checked against Rule 3 — there is no single code path enforcing this yet.
- **Style-guide/ADR duplication risk:** because this ADR restates several rules that also appear in `02-product-copy-style-guide.md` in more detail, a future edit to one without the corresponding edit to the other could create a subtle inconsistency. Mitigation: this ADR states the cross-cutting, domain-adjacent rules only (Rules 1–7); granular per-surface rules live solely in the style guide (Rule 8 defers to it explicitly) to minimize duplicated surface area.

## Security and Data Implications

Rule 6's prohibition on surfacing internal identifiers in copy has a minor information-disclosure benefit, consistent with `02-canonical-product-language.md` Principle 7 (Technical Names Hidden). No RLS, schema, or access-control implication otherwise; this ADR is a copy/tone standard, not a security control.

## Migration Implications

No migration is executed by this ADR. A future implementation PR should audit existing product copy against Rules 1–7 and the companion style guide, prioritizing: Agent-output copy (Rule 3), any existing flattened activity-stream or memory-browsing UI (Rule 4), and any color-only Health/Status indicators (Rule 5).

## UX Implications

This ADR is itself a UX/copy standard; its "implication" is the standard stated in Domain Rules 1–7, to be applied to all future copy work and, opportunistically, to existing copy during unrelated future PRs that touch the same surfaces.

## Compatibility Implications

Backward compatible: no existing copy, route, or component is changed by this ADR. Existing copy that does not yet conform (e.g., any current flattened activity view, any current Agent-output phrasing not yet reviewed against Rule 3) is not broken by this ADR; it is simply now checkable against a written standard it previously lacked.

## Out of Scope

- Auditing or rewriting any existing product copy (future PR3+).
- Defining exact microcopy/sentence-level strings for every screen — the companion style guide covers tone/voice; exact strings remain a PR3+ execution detail.
- Any code, schema, route, or API change.
- Naming/vocabulary decisions (covered by ADR-PMF-013) or Command Center-specific naming (ADR-PMF-014) — this ADR governs tone and pipeline-stage disclosure, not what things are called.

## Validation

- This decision is validated by ratification, consolidating the copy-level consequences already implicit in ADR-PMF-008 (rules 4–7, UX Implications), ADR-PMF-009 (rule 7, UX Implications), and ADR-PMF-010 (rule 11, UX Implications) into one cross-cutting, checkable standard.
- No code, schema, or test changes accompany this ADR; the applicable check is documentary: `docs/product-architecture/02-product-copy-style-guide.md` was checked against Rules 1–7 above and contains no contradiction — every rule stated here is either restated or elaborated there.
- Future PR3 acceptance test (not executed here): a review of shipped Agent-output copy should find no instance describing an Agent as having "decided" or "done" something; a review of any Feed/Memory/Enterprise Intelligence list UI should find pipeline stages visually distinguished, not flattened; a review of Health/Status indicators should find no color-only signal.

## References

- `docs/adr/ADR-PMF-008-project-intelligence-feed.md` — source of the Recommendation/Decision/Action/Outcome non-collapsing requirement.
- `docs/adr/ADR-PMF-009-project-memory-separation.md` — source of the fact/inference/decision/outcome typed-distinction requirement.
- `docs/adr/ADR-PMF-010-enterprise-intelligence-governance.md` — source of the fact/observation/recommendation/decision/outcome/candidate-pattern/ratified-pattern typed-distinction requirement.
- `docs/product-architecture/01-canonical-domain-model.md` — PR1 §25 (Agent Position, the 2-of-13-agents boundary-philosophy finding), §39 (PMI Alignment Matrix, source of the no-PMI-certification-claim rule).
- `docs/adr/ADR-PMF-013-canonical-product-language.md` — establishes the naming-authority governance pattern this ADR follows for copy standards.
- `docs/product-architecture/02-product-copy-style-guide.md` — the companion document this ADR ratifies as binding.
