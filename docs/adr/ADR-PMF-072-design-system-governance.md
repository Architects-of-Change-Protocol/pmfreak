# ADR-PMF-072: Design System Governance

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`07-frontend-module-boundaries.md` §8 already names a Platform layer responsible for shared UI, but no prior PR fixes what belongs in it, how it is tokenized, or how it is prevented from drifting once PR9+ implementation begins adding screens. Left unfixed, the seven recurring UX patterns PR8's other companions specify (a Decision's five-part shape, a Recommendation's disclosure shape, a Health/Risk encoding) would each be reimplemented per screen, exactly the accretion failure mode `07-canonical-frontend-architecture.md` §1 diagnosed for module structure, recurring at the component level instead.

## Decision

**PMFreak's visual language is a governed token set plus exactly seven named Enterprise Components — `HealthIndicator`, `RiskBadge`, `ConfidenceScore`, `DecisionCard`, `EvidenceViewer`, `AgentStatus`, `ApprovalFlow` — each tracing to a pattern a PR8 companion document already fixes; no screen renders the concept any of these seven represents without going through the corresponding component.** Full specification: `08-design-system.md` §2–§5.

## Frontend Rules

1. Every Health value, Risk/Issue severity, AI confidence value, Decision, Evidence disclosure, Agent status, or approval interaction rendered anywhere in the frontend uses the corresponding Enterprise Component — never a one-off, screen-local reimplementation (`08-design-system.md` §3).
2. No component or screen hardcodes a color, spacing value, or type size outside the token set (`08-design-system.md` §2) — restating `02-canonical-product-language.md`'s one-concept-one-name principle for visual tokens.
3. All seven Enterprise Components are placed in the Domain Presentation layer of `07-canonical-frontend-architecture.md` §5's six-layer model (domain-aware, receives fetched view models as props) — never Platform (domain-free) and never a Feature (dispatches Commands); `ApprovalFlow` renders the approve/reject controls, but Command dispatch is wired by the composing Feature (`08-design-system.md` §4).
4. A future PR adding an eighth Enterprise Component states which PR8 principle or companion pattern it renders — a component with no traceable pattern is rejected under this ADR (`08-design-system.md` §5.3).
5. A breaking change to a foundation token's meaning or an Enterprise Component's required behavior is a governed decision requiring an ADR amendment or successor, never a silent restyle (`08-design-system.md` §5.4).

## Alternatives Considered

- **Let each domain module define its own local components as needed, without a shared catalog.** Rejected: this is the module-boundary accretion problem PR7 already solved for code organization, recurring at the visual layer — a `RiskBadge` reimplemented per module inevitably drifts in meaning and styling, undermining the "one concept, one name" language discipline PR2 already established for text.
- **Adopt an existing open-source enterprise design system wholesale (e.g., a specific component library) as the governance model.** Rejected at this stage: PR8 is documentary architecture, not implementation — committing to a specific library is exactly the kind of premature, evidence-free choice `07-canonical-frontend-architecture.md` §13 already declined to make for its own open frontend-tooling decisions; the component *catalog* (what must exist) is fixed here, the *library* is left open (§6 below).
- **Govern the design system informally, via code review convention only, without a named component catalog.** Rejected: informal convention is exactly what allowed the current-state frontend (`07-frontend-migration-strategy.md`'s inventory) to accumulate inconsistent patterns; a named, ADR-anchored catalog is checkable in review, convention is not.

## Positive Consequences

- Gives every future PR a fixed, small (seven-item) checklist for "does this screen reuse the governed component, or has it invented a parallel one" — directly reviewable.
- Keeps the seven Enterprise Components traceable to the specific PR8 pattern each renders, so a future change to, say, the Recommendation disclosure shape (`08-ai-interaction-patterns.md` §2) has one component (`ConfidenceScore`, potentially others) to update, not N screen-local implementations.

## Negative Consequences

- Adds governance overhead to introducing an eighth component — a deliberate cost, trading implementation speed for long-term visual consistency.

## Risks

- **Premature ossification risk:** fixing seven components before any implementation exists could constrain a pattern PR9+ discovers doesn't fit reality — mitigated by Frontend Rule 4's explicit path to add an eighth component with a named justification, rather than freezing the catalog permanently.

## Security and Data Implications

- None — this ADR governs visual/component structure, not data access or authorization.

## Application Implications

- None — no new Command, Query, or entity is introduced.

## Frontend Implications

- Places the seven Enterprise Components in `07-canonical-frontend-architecture.md`'s existing Domain Presentation layer (§5's six-layer model) — this ADR does not modify that layer model, only populates it with named components.

## Migration Implications

- Any current-state screen rendering a Health value, severity, confidence, Decision, Evidence, Agent status, or approval control outside these seven components is a named migration target during `07-frontend-migration-strategy.md`'s strangler-pattern migration — brought into conformance with this ADR as it migrates, not before.

## Compatibility Implications

- Compatible with any component-library implementation, token-tooling choice, or dark-mode strategy chosen later (§6, open) — this ADR fixes the catalog and its governance, not its implementation technology.

## Out of Scope

- Exact token values (color hex codes, type scale, spacing scale, icon set, motion durations) — `08-design-system.md` §6, open.
- Component-library implementation choice, design-token pipeline, Storybook/workshop tooling — open, mirroring `07-canonical-frontend-architecture.md` §13's precedent.

## Validation

Validation criteria: (1) every PR8 companion document's UI pattern maps to one of the seven Enterprise Components or explicitly to a foundation token, with no orphaned pattern; (2) any future PR introducing an eighth component cites the specific principle/pattern justifying it, per Frontend Rule 4.

## References

- `docs/product-architecture/08-design-system.md`
- `docs/product-architecture/07-canonical-frontend-architecture.md` §5, §13
- `docs/product-architecture/07-frontend-module-boundaries.md` §8
