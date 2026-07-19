# ADR-PMF-021: User Journey Architecture

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-017 ratified the screen inventory and ADR-PMF-018 ratified the navigation contracts those screens connect through. Neither specifies the *sequences* a real user actually walks — from Log In to a completed, meaningful outcome. PR1 found direct evidence that at least one such sequence is currently broken end to end: the onboarding wizard blocks "Create Project" until "Create Command Center" (a PMO) is completed, with the gating tooltip itself citing a rationale ("governance, objectives, and agent context") that contradicts ADR-PMF-006 Rule 11's ruling that Project creation must never be gated behind a higher hierarchy level. A screen inventory and a navigation contract do not, by themselves, prevent this kind of journey-level defect — a product can have perfectly named, perfectly connected screens and still walk a new user through the wrong sequence to reach them.

The founder's brief for this PR explicitly requires complete journeys for nine user profiles and five specific journey types (create first Project, create PMO, administer Portfolio, open Command Center, use AI), each traced from Log In to completion. This ADR ratifies those journeys as binding architecture, closing the sequencing gap the screen/navigation ADRs alone leave open.

## Decision

**PMFreak's user experience is governed by a ratified set of nine profile journeys and five completion journeys, documented exhaustively in `docs/product-architecture/03-user-journeys.md`, each composed exclusively of screens from the ADR-PMF-017 inventory and navigation edges from the ADR-PMF-018 contract.** No journey may include a step that gates a lower hierarchy level's creation behind a higher one (restating and giving journey-level teeth to ADR-PMF-006 Rule 11). Every journey terminates on a state that represents genuine task completion for that profile — not merely "arrived at a screen."

## Alternatives Considered

- **Treat journeys as a design/UX-research artifact outside the ADR process, produced during PR4 instead of ratified here.** Rejected: PR1's own evidence (the PMO-before-Project gate) shows that a broken journey can persist for multiple ratification cycles (PR1, PR1.1, ADR-PMF-006, ADR-PMF-007 all flagged it; none fixed it) specifically because no single document owned "is this sequence, end to end, correct" as a binding question. Ratifying journeys closes that gap the same way ratifying vocabulary and screens did for their respective layers.
- **Specify only the five required completion journeys, omitting the nine profile journeys.** Rejected: the five completion journeys alone do not establish what a given profile's *default*, everyday path looks like (e.g. an Executive's journey is read-heavy and rarely reaches a "creation" journey at all) — both layers are needed for a complete architecture, and the founder's brief explicitly requires both.
- **Allow journeys to include a redirect or gate not in the ADR-PMF-018 Navigation Contract's closed three-class redirect set, if a specific profile's journey seems to benefit from it.** Rejected: this would let journey design silently reopen the redirect question ADR-PMF-018 already closed. Every journey step in this ADR uses only the three permitted redirect classes.

## Positive Consequences

- Gives the PMO-before-Project defect a third, independent point of ratified contradiction (alongside ADR-PMF-006 and ADR-PMF-007): the Create First Project journey in `03-user-journeys.md` §3.1 explicitly states no PMO/Portfolio/Program/Enterprise creation is required, with no exception. A future implementation PR now has three converging ADRs, not one, establishing this as a defect to fix.
- Gives PR4 concrete, step-by-step journey diagrams (Mermaid flowcharts) for the five required journeys, directly implementable as user-flow specifications.
- Makes the Executive/Consultant/Guest journeys — profiles easy to under-specify because they don't "create" much — first-class, equally-ratified journeys rather than an afterthought of the creator-focused flows.
- Establishes a Journey Cross-Reference (`03-user-journeys.md` §4) connecting each completion journey to the profiles it serves, so a future implementation PR can prioritize journey work by profile impact.

## Negative Consequences

- Nine profile journeys plus five completion journeys is a large specification surface to keep synchronized with the screen inventory and navigation contracts as both evolve — any future screen rename or navigation-edge change requires checking whether it invalidates a journey step.
- Some journeys (Portfolio Manager, Program Manager, Enterprise Command Center journeys) describe screens/entities that don't exist in the schema yet — these journeys are ratified as target architecture, not currently walkable end to end, mirroring the same aspirational-but-ratified status other Portfolio/Enterprise/Program-FK content in this PR carries.

## Risks

- **Journey-drift risk:** without a conformance check tying implementation back to these journeys, a future feature could subtly break a ratified journey (e.g. adding a new required step) without anyone noticing until a user complains. Flagged as a follow-up need for PR4, not resolved here.
- **Incompleteness risk:** nine profiles and five journeys is what the founder's brief required as a minimum, not a claim that every real user path is covered — edge cases (e.g. a user who is simultaneously a Consultant and a PMO Manager for their own Workspace) are not separately journeyed here and would need composition of the documented journeys, not a new one, unless found to require genuinely different steps.

## UX Implications

Every profile now has a ratified default entry path and landing screen (`03-user-journeys.md` §2); every one of the five required completion journeys now has a ratified step-by-step sequence with a Mermaid diagram (§3). Design work in PR4 should treat these as the sequence to storyboard against, not as a starting point to redesign from scratch.

## Implementation Implications

No code is changed by this ADR. A future implementation PR must, at minimum, fix the Create First Project journey's current violation (the PMO-before-Project onboarding gate) to bring the running product into conformance with §3.1 of `03-user-journeys.md`.

## Future Evolution

As Portfolio, Program-FK, and Enterprise become schema-backed, the journeys that reference them (Administer Portfolio, Create PMO's downstream Portfolio/Program steps, the Executive's Enterprise Command Center entry) become walkable end to end without requiring a new journey-architecture decision — the sequences are already specified.

## Compatibility Implications

Backward compatible: no existing onboarding flow, wizard, or redirect is changed by this ADR itself.

## Out of Scope

- Fixing the PMO-before-Project onboarding gate in running code (future implementation PR).
- Journey conformance tooling (flagged as a follow-up).
- Edge-case/composite-role journeys beyond the nine profiles and five completion journeys required by this PR's brief.
