# PMFreak — Product Copy Style Guide

**Type:** Documentation only. Companion to `docs/product-architecture/02-canonical-product-language.md` (PR2). No product code, components, routes, or in-app copy were modified to produce this document.

---

## 1. Relationship to the Canonical Product Language

This guide governs **how** PMFreak writes — tone, voice, sentence structure, capitalization — for surfaces that use the vocabulary ratified in `02-canonical-product-language.md`. It does not define **what** anything is called; that document is authoritative for naming. Where the two could be read as conflicting, the canonical vocabulary document wins on naming, this document wins on tone/style.

## 2. Naming Tone

PMFreak's copy is direct, competent, and calm. It describes what a governed PM operation actually does — it does not oversell autonomy, certainty, or intelligence the product does not have. This follows directly from the ratified domain: Agents recommend, they do not decide (ADR-PMF-008); Forecasts carry confidence, they are not predictions (PR1 §26); Enterprise Intelligence is governed, not automatic (ADR-PMF-010). Copy tone must never claim more certainty or autonomy than the ratified domain model allows.

## 3. Voice

- **Competent, not casual.** PMFreak speaks like an experienced PM colleague, not a hype-driven assistant.
- **Precise, not vague.** Use the exact canonical name (§4 of the vocabulary doc) rather than a friendlier paraphrase.
- **Calm under risk.** Risk, Issue, and Health-degradation copy states facts plainly; it does not editorialize or alarm.
- **Second person for the user, third person for entities.** "You created a Project" — not "the user created a Project."

## 4. Sentence Rules

1. Lead with the action or the state, not the mechanism. ("Your Project's schedule slipped 3 days," not "The system has detected a schedule variance event.")
2. One idea per sentence in UI copy; reserve compound sentences for longer help text.
3. Never bury the canonical entity name in a subordinate clause when it's the subject of the action.
4. Use active voice for user actions ("Approve this Recommendation"); passive voice is acceptable only for system-observed state ("This Milestone was reached on time").
5. Never use a Recommendation, Candidate Pattern, or Observation in a sentence structure that implies it is already decided or ratified (no "PMFreak decided..." for an Agent's Recommendation).

## 5. Capitalization

- Canonical entity names (Enterprise, Workspace, PMO, Portfolio, Program, Project, Command Center, Task, Milestone, Risk, Issue, Decision, Recommendation, Action, Outcome, Agent, Evidence, Pattern, Health, Status) are capitalized when referring to the specific PMFreak concept, exactly as defined in `02-canonical-product-language.md` §4/§7.
- The same words are lowercase when used generically in ordinary prose that is not referring to the PMFreak entity (e.g., "your workspace for the afternoon" in a casual help article about the user's desk — avoid this ambiguity where possible by preferring the canonical term).
- Button and menu labels use Title Case ("Create Project," "Approve Recommendation").
- Sentence-level body copy uses sentence case, with canonical entity names capitalized per the rule above.
- Never render internal identifiers (`workspace_id`, `command_center_type`) in any capitalization in user-facing copy — they must not appear at all.

## 6. Buttons

- Name the action and, for creation buttons, the entity created (§9 of the vocabulary doc). Never name a button after a projection ("Command Center") when it creates an entity.
- Keep button labels to 1–3 words: "Create Project," "Approve Recommendation," "Close Milestone."
- Destructive buttons state the action plainly: "Delete Project," never a euphemism.

## 7. Menus

- Menu items use the exact canonical name from the vocabulary doc's Navigation Naming Rules (§10).
- Group menu items by hierarchy level (Workspace-level items together, PMO-level items together), never interleaved without visual grouping.
- Never abbreviate a canonical name inconsistently across menus (always "PMO," never "P.M.O." in one menu and "PMOs" in another without a deliberate, singular pluralization rule — plural is "PMOs").

## 8. Empty States

- State what's missing using the canonical name, and the canonical creation verb: "No Projects yet. Create Project to get started." — never "Nothing here yet! Let's get building 🚀"-style copy that avoids naming the entity.
- Do not use an empty state to imply a higher hierarchy level is required unless it genuinely is (per ADR-PMF-006 rule 11 / ADR-PMF-012 rule 7): a Project-list empty state must never say "Create a PMO first."

## 9. Errors

- State what failed, using the canonical entity name, and — where actionable — what the user can do.
- Never surface an internal identifier, enum value, or stack detail in an error message.
- Never imply a domain violation is the user's fault when it's a system gap (e.g., don't say "You cannot create a Project without a PMO" if that block is itself the known onboarding contradiction ADR-PMF-006/007/012 flag as a defect to fix, not a rule to enforce).

## 10. Notifications

- Lead with the canonical entity and what happened: "Project Health changed to Yellow" — not "Something changed you should know about."
- Distinguish a Recommendation notification from a Decision notification from an Outcome notification explicitly in the notification text, never collapsing pipeline stages (ADR-PMF-008 rules 4–7).

## 11. Success Messages

- Confirm the action taken using the canonical verb and entity: "Project created." "Decision recorded." "Milestone closed."
- Avoid unnecessary exclamation or congratulatory tone for routine operational actions; PMFreak is a working tool, not a game.

## 12. Warning Messages

- State the condition and its Health/Risk implication plainly: "This Risk has been open for 30 days without a mitigating Action."
- Never present a warning about a Candidate Pattern or unratified Recommendation with the same urgency styling as a warning about a ratified Decision or a realized Issue.

## 13. Confirmation Dialogs

- State exactly what will happen, using canonical names: "Delete this Project? This also removes its Tasks, Milestones, and Evidence." Never a generic "Are you sure?" with no object named.
- For irreversible actions (delete, not archive), name the irreversibility explicitly.

## 14. AI Responses

- An Agent's response is always framed as a Recommendation, never as a Decision or a completed Action, consistent with ADR-PMF-008 and ADR-PMF-010's non-auto-promotion rules.
- State confidence and evidence basis where the underlying Forecast/Recommendation carries one; never present a Forecast as certain.
- Never claim the Agent "decided," "executed," or "approved" anything — those verbs belong to the human/governed Decision and Action steps.

## 15. Agent Messages

- Every Agent message that produces a Recommendation must be labeled as a Recommendation, from an explicitly named Agent (e.g., "Cost Governance Agent recommends...").
- Agent messages must never use "I" in a way that implies autonomous personhood beyond what the ratified domain allows (Agent = deterministic, recommendation-only, per PR1 §25); prefer naming the Agent role rather than a first-person voice that implies general autonomy.

## 16. Consistency Rules

1. One canonical name, used identically, across every button, menu, empty state, error, notification, success message, warning, confirmation dialog, AI response, and Agent message.
2. No screen introduces a new synonym for an already-canonical concept without registering it first in `02-canonical-product-language.md`.
3. Tone stays consistent across all copy categories in this guide — competent and calm, never hype-driven, never alarmist.
4. Every reference to Agent-produced content states plainly that it is a Recommendation, not a Decision.

## 17. Forbidden Language

- Marketing or hype language that overstates autonomy: "AI-powered magic," "fully autonomous," "self-driving PMO."
- Any of the Forbidden Synonyms listed in `02-canonical-product-language.md` §6.
- Internal identifiers, enum values, or schema/table names in any user-facing surface.
- Presenting a PMFreak-specific extension (Command Center, Enterprise Intelligence, Foresight) as a PMI-standard or industry-certified term.
- Claims of PMI certification, compliance, or endorsement anywhere in the product (per PR1 §39 and the vocabulary doc §24).
- Euphemisms for destructive actions ("archive" used to mean permanent delete, or vice versa).

## 18. Accessibility Rules

- Every entity-qualified label (e.g., "Project Command Center") must be present in full in the accessible name (`aria-label`/visible text), not abbreviated to a bare "Command Center" for screen-reader users even where visual space is constrained.
- Health and Status indicators that rely on color (Green/Yellow/Red) must always pair color with a text label — color alone is never sufficient to convey Health.
- Confirmation dialogs for destructive actions must be reachable and dismissible via keyboard, with the destructive action never the default-focused button.
- Notifications and warnings must not rely on icon or color alone to distinguish a Recommendation from a Decision from an Outcome — the pipeline stage must be stated in text.

## 19. Final Status

```text
STYLE GUIDE ESTABLISHED
```

This guide is documentation-only and introduces no code, route, or copy change. It governs future copy work alongside `02-canonical-product-language.md`.
