# PR8 Companion — UX Principles

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `01-canonical-domain-model.md` (Recommendation/Decision/Action/Outcome chain), `03-canonical-information-architecture.md` §§1–14 (screen catalog, IA Principles), `02-canonical-product-language.md` (canonical vocabulary), `07-ai-memory-and-intelligence-experience.md` §1, ADR-PMF-030

Purpose: fix the philosophy every other PR8 document, and every future screen design, is answerable to — what PMFreak's interface is *for*, whose questions it answers, and what it must never become. This document does not specify pixels; it specifies the standard a pixel is judged against.

## 1. The Governing Distinction

PMFreak is not a dashboard. A dashboard's contract with its user ends at "here is data, formatted." PMFreak's contract ends at "here is what you should decide, and why." The difference is not cosmetic — it is the reason `04-canonical-application-architecture.md`'s Recommendation → Decision → Action → Outcome chain and `04-ai-agent-application-architecture.md`'s Agent Run → Proposal → Approval → Command chain exist as domain concepts at all (PR1 §on invariants; restated at the frontend layer in `07-ai-memory-and-intelligence-experience.md` §1, §5). A product that only displayed metrics would have no use for either chain. PMFreak displays metrics **in service of** those chains.

```
Traditional dashboard:          PMFreak:

Data                            Context
 ↓                                ↓
Charts                          Intelligence
 ↓                                ↓
User interprets                 Recommendation
                                   ↓
                                 Decision
                                   ↓
                                 Action
                                   ↓
                                 Outcome
```

Every screen in `03-screen-catalog.md` already exists inside this second shape, whether or not its current-state implementation reflects it (`07-frontend-migration-strategy.md`'s current-vs-target gaps are exactly the places the shape is not yet honored). PR8 does not add this shape to PMFreak — it names the shape PR1–PR7 already committed to and derives the interaction rules that follow from it.

## 2. UX Principles (binding, ordered by precedence)

1. **Optimize decisions, not tasks.** A screen's primary question is never "what items exist" (a list) but "what needs my judgment" (a prioritized set). A task list answers "what tickets do I have"; PMFreak answers "what does this project need from me for it to succeed." Where a canonical screen is unavoidably a register (`03-canonical-information-architecture.md` §5's Task/Milestone/Risk/Issue/Dependency registers), it is still entered from, and returns to, a Command Center that states why the register matters right now (§4 below).
2. **Attention is a designed, finite resource.** Every screen names what needs the user's attention before it lists what merely exists. Risks, pending Decisions, blockers, and Recommendations are surfaced ahead of completed or steady-state items — never buried at parity with them in an undifferentiated list (§4, Command Center Experience companion).
3. **Evidence precedes inference; inference precedes recommendation; recommendation precedes decision.** Restated at the UX layer from `04-canonical-application-architecture.md` §7.3 principle 7 and `07-ai-memory-and-intelligence-experience.md` §1: no screen ever shows a conclusion (a Recommendation, a confidence score, a health color) without a reachable path — never more than one interaction away — to the Evidence it is drawn from (`08-ai-interaction-patterns.md` §3, `08-information-visualization.md` §2).
4. **A Recommendation is not a Decision; a Decision is not an Action; an Action is not an Outcome.** Restated a third time (PR1 domain invariant, PR7 frontend rule, here as UX law) because it is the single most consequential rule PR8's component and interaction design must never violate: distinct visual weight, distinct required interaction, never one control that performs more than one step of `ApproveRecommendation → RecordDecision → CreateActionFromDecision → RecordOutcome` (ADR-PMF-030; `08-ai-interaction-patterns.md` §1).
5. **Reduce cognitive load through hierarchy, not through omission.** Progressive disclosure (`03-canonical-information-architecture.md` §3 IA Principle "Progressive Disclosure") means later, deeper screens reveal detail an earlier screen summarized — not that information is hidden without a path to it. A Command Center's "87% health" is always one click from the Dependency graph, resource conflict, or timeline deviation that produced it (§10 below; `08-information-visualization.md` §3).
6. **Confidence is a qualified signal, never a bare authority.** Every AI-originated number, badge, or claim carries its basis and its confidence alongside it, in the same view — never as an unqualified fact styled identically to human-recorded, governed data (`08-ai-interaction-patterns.md` §2; `07-ai-memory-and-intelligence-experience.md` §5–§6's AI-generated-content labeling rule).
7. **Human approval is a first-class interaction, not a formality.** Any screen surfacing an Agent Proposal or a Recommendation treats the approval/rejection control with the same visual seriousness PR7 requires of any Command with irreversible or governance-relevant effect (`07-command-query-and-error-experience.md` §4's confirmation rule) — never a low-contrast, easy-to-miss accessory to a "primary" AI-styled panel.
8. **One screen answers one question.** Restated from IA Principle "One Screen, One Purpose" (`03-canonical-information-architecture.md` §3): a screen that tries to be a PM's execution view and a PMO's portfolio view simultaneously has already failed both users (§3 below).
9. **The interface never asks the user to interpret raw data it could have already interpreted.** A burndown chart with no accompanying answer to "why is this project behind" is a dashboard, not PMFreak (`08-information-visualization.md` §1's "every visualization answers a question" rule).
10. **Vocabulary is fixed.** Every label, heading, and microcopy string in every PR8 artifact uses `02-canonical-product-language.md`'s canonical terms exactly — no PR8 document introduces a new synonym for Workspace, Portfolio, Program, Command Center, Dashboard, Health, Recommendation, Decision, Feed, or any other governed term, and none of `02-canonical-product-language.md`'s Forbidden Synonyms appear anywhere in a PR8 mockup or component name.

## 3. Persona-Differentiated Experience

`03-canonical-information-architecture.md` §on personas already ratifies nine entry-flow profiles (Independent PM, PM as team member, PMO Manager, Executive, Portfolio Manager, Program Manager, Administrator, Consultant, Guest) with distinct default landings. PR8 does not add personas — it fixes what each of the four most consequential roles is optimizing for, so that a screen shared across roles (a Command Center reachable by both a PM and an Executive) can be judged against the right question for the viewer looking at it right now.

| Persona | Governing question | Primary surface | Full journey |
| --- | --- | --- | --- |
| Project Manager | "What needs my attention today for this project to succeed?" | My Execution Center (Workspace/Project home composing Task, Risk, Decision, Recommendation state) | `08-user-journeys.md` §2 |
| PMO Manager | "What is the health of my portfolio, and where is it degrading?" | PMO Command Center | `08-user-journeys.md` §3 |
| Executive | "Do I need to intervene?" | Executive Brief (Enterprise/PMO Command Center, read-weighted) | `08-user-journeys.md` §4 |
| Enterprise Administrator | "Is the system operating correctly and safely?" | Governance Center (Administration screens, `03-canonical-information-architecture.md` §7) | `08-user-journeys.md` §5 |

No screen is designed for "the user" in the abstract; every screen in the catalog is designed for the specific persona(s) `03-screen-catalog.md` already assigns it, and PR8's density, prioritization, and default-open state (§5 below) follow that assignment.

## 4. What the Interface Prioritizes

In descending order, on any screen composing more than one kind of information (i.e., every Command Center, per `08-command-center-experience.md` §1):

1. Risks — items that threaten a governed Outcome and have not yet been decided on.
2. Pending Decisions — Recommendations or Agent Proposals awaiting the human approval `04-ai-agent-application-architecture.md` requires.
3. Blockers — Dependencies and Issues currently preventing Task or Milestone progress.
4. Recommendations — reviewed AI or governance output not yet acted on.
5. Actions in flight — work already decided on and underway.

This ordering is a UX rule, not a data-model rule: the underlying Queries (`06-query-catalog.md`) return whatever their contract defines; the screen's *presentation* imposes this priority, per Query result, before render. A screen that lists Actions above open Risks has inverted this rule regardless of what its API call returned.

## 5. What the Interface Rejects

- **Infinite, undifferentiated lists.** Every register screen (`03-canonical-information-architecture.md` §5 Execution Layer) opens filtered to attention-worthy items by default (open Risks over closed ones, undecided Decisions over recorded ones) — never a raw, unsorted table as the landing state.
- **Giant tables as a primary surface.** A table is a valid *secondary* view (export, bulk review) — never the first thing a Command Center or Execution screen shows.
- **Deep, generic menus.** Navigation follows `03-navigation-contracts.md`'s ratified edges exactly; PR8 introduces no additional menu depth beyond what that document's layer model (Global/Primary/Secondary/Context/Local) already fixes.
- **Chart-for-its-own-sake.** See Principle 9 and `08-information-visualization.md` §1.
- **AI output presented as fact.** See Principle 6, §2 above, and `08-ai-interaction-patterns.md` §2.

## Validation Notes

Every entity, chain, screen, persona, and Command name in this document is taken verbatim from `01-canonical-domain-model.md`, `02-canonical-product-language.md`, `03-canonical-information-architecture.md` and its companions, `04-canonical-application-architecture.md` (including `04-ai-agent-application-architecture.md`), `06-canonical-api-contracts.md`'s command catalog, and `07-canonical-frontend-architecture.md`'s companions — none was renamed, reinterpreted, or redefined. This document introduces no new entity, Command, Query, or screen; it fixes prioritization and interaction philosophy only. No code, route, component, or schema was created or modified to produce it.
