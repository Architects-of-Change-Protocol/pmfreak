# PMFreak — Canonical Screen Catalog (PR3)

**Type:** Product/UX architecture. Documentation only. No product code, components, routes, or styles were modified to produce this catalog.

**Authority:** This catalog is the exhaustive companion to `03-canonical-information-architecture.md` §5–§6. It does not redefine any screen's Purpose/Parent/Entity/etc. — those fields are canonical in that document. This catalog exists to enumerate, for every canonical screen, its **views, variants, states, overlays, drawers, modals, panels, sidebars, tabs, and widgets**, per the PR brief's explicit requirement. Vocabulary throughout is identical to `02-canonical-product-language.md` — no synonym substitution.

---

## 1. Universal States

Every screen in this catalog inherits these five states unless explicitly noted otherwise. They are not re-listed per screen below except where a screen has a state beyond this baseline.

| State | Description |
| --- | --- |
| **Loading** | Skeleton/placeholder shown while the entity or projection resolves. |
| **Populated** | Normal state, entity/projection data present. |
| **Empty** | Zero child records exist yet — governed by `03-canonical-information-architecture.md` §18 Empty State Strategy. |
| **Error** | Data failed to resolve — never exposes internal identifiers, enum values, or stack details (PR2 style guide). |
| **Read-only (Guest)** | All primary/floating actions hidden; only the shared item's content is rendered; no navigation to ancestor/sibling entities. |

---

## 2. Global & Personal Layer

### Landing
- **Variants:** Default (unauthenticated), Invitation-referred (pre-fills workspace/inviter context), Expired-session-redirect.
- **States:** Populated only (no data-dependent Loading/Empty/Error — static marketing content).
- **Modals:** Sign Up modal, Log In modal (may also be full-screen variants).
- **Panels:** None.

### Search (Global) and its four scoped variants (Workspace / Project / Knowledge / Agent Search)
- **Views:** Results-list view, filtered-by-entity-type view.
- **States:** Loading, Populated, Empty (no results), Error.
- **Overlays:** Quick-result preview overlay (hover/focus preview before full navigation).
- **Panels:** Filter panel (entity type, date range, scope).
- **Widgets:** Result-count widget, "search all Workspaces" widget (Enterprise segment only).

### Notifications
- **Views:** All, Unread, By-entity-type.
- **States:** Loading, Populated, Empty ("You're all caught up"), Error.
- **Drawers:** Notification detail drawer (opens without leaving the underlying screen).
- **Panels:** Notification preference panel (links to Profile).
- **Widgets:** Unread-count badge (Global Nav), governance-exception badge (visually distinct per §20 Notification Strategy).

### Profile
- **Tabs:** Identity, Preferences, Workspace Memberships.
- **Panels:** Notification preference panel, security/session panel.
- **Modals:** Change password modal, revoke-session modal.

### Saved Projects
- **Views:** List view, card-grid view.
- **States:** Loading, Populated, Empty ("No saved Projects yet").
- **Widgets:** Per-item "Save/Unsave" toggle widget.

---

## 3. Enterprise Layer

### Enterprise Home
- **Tabs:** Overview, Workspaces, Settings (deep-link to Enterprise Settings).
- **Panels:** Workspace-list panel.
- **Widgets:** Enterprise Overview widget (per IA Principle 8, this is an Overview, never a full Dashboard on the Home screen), Workspace-count widget.
- **States:** Loading, Populated, Empty ("No Workspaces yet. Create Workspace to get started.").

### Enterprise Command Center
- **Widgets:** Cross-Workspace health grid widget, governance-exception widget, Enterprise Intelligence highlight widget.
- **Panels:** Governance-exception detail panel (slide-in, does not navigate away).
- **Drawers:** Workspace quick-detail drawer (preview a Workspace's health without full navigation).
- **States:** Loading, Populated, Empty (Enterprise exists but zero Workspaces), Error.

### Enterprise Settings
- **Tabs:** General, Billing, Data Sovereignty, Integrations (Enterprise-scoped).
- **Modals:** Confirm-billing-change modal, confirm-data-sovereignty-policy-change modal.

---

## 4. Workspace Layer

### Workspace Home
- **Tabs:** Overview, Projects, PMOs, Settings (deep-link).
- **Panels:** Project-list panel, PMO-list panel.
- **Widgets:** Workspace Overview widget, Project-count widget, PMO-count widget.
- **Modals:** Create Project modal, Create PMO modal.
- **States:** Loading, Populated, Empty ("No Projects yet. Create Project to get started." — the product's single most important empty state).

### Workspace Command Center
- **Widgets:** PMO/Project health grid widget, recent-activity widget, Recommendation-summary widget.
- **Drawers:** PMO quick-detail drawer, Project quick-detail drawer.
- **States:** Loading, Populated, Empty, Error.

### Workspace Settings
- **Tabs:** General, Members, Integrations, Billing (deep-link to Administration if Workspace-scoped billing exists).
- **Modals:** Rename Workspace modal, archive-Workspace confirmation modal (destructive, keyboard-reachable, destructive button never default-focused per PR2 style guide).

---

## 5. PMO Layer

### PMO Home
- **Tabs:** Overview, Portfolios, Programs, Projects, Settings (deep-link).
- **Panels:** Portfolio-list panel, Program-list panel, direct-Project-list panel.
- **Widgets:** PMO Overview widget, PMO Health widget.
- **Modals:** Create PMO modal *(never labeled "Create Command Center" — ADR-PMF-014 Rule 2)*, Create Portfolio modal, Create Program modal.
- **States:** Loading, Populated, Empty ("No Portfolios yet. Create Portfolio to get started." — never implies Enterprise is required).

### PMO Command Center
- **Widgets:** Portfolio/Program/Project health grid widget, governance-exception widget, template/standard-compliance widget.
- **Panels:** Governance-exception detail panel.
- **Drawers:** Portfolio/Program/Project quick-detail drawer.
- **States:** Loading, Populated, Empty, Error.
- **Note:** Structurally and visually distinct from the internal `/pmo-command-center` ops dashboard (ADR-PMF-014 Rule 6) — that surface is out of this user-facing catalog's scope entirely.

### PMO Settings
- **Tabs:** General, `pmo_type` configuration, Governance profile, Agent activation toggles (the legacy `PmoTenant` config surfaced as PMO configuration, never as a separate entity — PR1.1).

---

## 6. Portfolio Layer

### Portfolio Home
- **Tabs:** Overview, Programs, Projects, Settings (deep-link).
- **Panels:** Program-list panel, direct-Project-list panel.
- **Widgets:** Portfolio Overview widget, investment/priority summary widget.
- **Modals:** Create Program modal, Attach Project modal.
- **States:** Loading, Populated, Empty ("No Programs yet. Create Program to get started.").

### Portfolio Command Center
- **Widgets:** Investment/priority grid widget, capacity widget, risk-rollup widget.
- **Drawers:** Program/Project quick-detail drawer.
- **States:** Loading, Populated, Empty, Error.

---

## 7. Program Layer

### Program Home
- **Tabs:** Overview, Projects, Roadmap, Settings (deep-link).
- **Panels:** Project-list panel.
- **Widgets:** Program Overview widget, coordination-status widget.
- **Modals:** Create Project modal, Import Roadmap modal.
- **States:** Loading, Populated, Empty ("No Projects yet. Create Project to get started."), Error.

### Program Command Center
- **Widgets:** Project coordination grid widget, benefit-tracking widget, Roadmap-status widget.
- **Drawers:** Project quick-detail drawer.
- **States:** Loading, Populated, Empty, Error.

### Roadmap
- **Views:** Epic view, Sprint view, Card/board view.
- **Tabs:** Epics, Sprints, Cards.
- **Panels:** Card-detail side panel.
- **Modals:** Upload-roadmap-document modal, Edit Epic/Sprint/Card modal.
- **States:** Loading, Populated, Empty ("No Roadmap uploaded yet."), Error (parse failure).

---

## 8. Project Layer

### Project Home
- **Tabs:** Overview, Tasks, Milestones, Risks, Issues, Dependencies, Stakeholders, Documents.
- **Panels:** Quick-stats panel (open Tasks, open Risks, upcoming Milestones).
- **Widgets:** Project Overview widget, Health widget.
- **Modals:** Create Task modal, Create Risk modal, Create Issue modal, Create Dependency modal, Invite Stakeholder modal, Upload Document modal.
- **Sidebars:** Execution Layer navigation sidebar (Tasks/Milestones/Risks/Issues/Dependencies/Stakeholders/Documents).
- **States:** Loading, Populated, Empty ("No Tasks yet. Create Task to get started."), Error, Read-only (Guest).

### Project Command Center
- **Widgets:** Intelligence Feed widget, Health widget, Task widget, Risk/Issue widget, Recommendation widget.
- **Panels:** Recommendation detail panel (slide-in, review without leaving screen).
- **Drawers:** Task/Risk/Issue quick-detail drawer, Decision-record drawer.
- **Floating Actions:** Approve Recommendation, Record Decision, Close Milestone (contextual, per item in view).
- **States:** Loading, Populated, Empty (Project exists, zero activity yet), Error.
- **Note:** Must be built as a Project-scoped screen only — never mixing in cross-PMO Workspace-level data (the exact defect flagged against today's `/command-center` route in the main IA document §11).

---

## 9. Execution Layer (all Project-scoped)

| Screen | Views | Tabs | Modals | Drawers/Panels | Widgets |
| --- | --- | --- | --- | --- | --- |
| **Tasks** | List, Board (Kanban), Calendar | By assignee, By status | Create Task, Edit Task, Bulk-assign | Task detail drawer | Overdue-count widget |
| **Milestones** | List, Timeline | Upcoming, Past | Create Milestone, Close Milestone (confirmation) | Milestone detail drawer | Next-Milestone widget |
| **Risks** | List, Matrix (probability × impact) | Open, Mitigated, Closed | Log Risk, Mitigate Risk | Risk detail drawer | Risk-heat widget |
| **Issues** | List | Open, Resolved | Log Issue, Resolve Issue | Issue detail drawer | Open-Issue-count widget |
| **Dependencies** | List, Graph | Blocking, Blocked-by | Log Dependency, Resolve Dependency | Dependency detail drawer | Critical-path widget |
| **Stakeholders** | List, Influence/Interest grid | — | Add Stakeholder, Edit Stakeholder | Stakeholder detail drawer | — |
| **Documents** | List, Grid (thumbnails) | By type, By tag | Upload Document, Link Evidence | Document preview panel | Recent-upload widget |
| **Recommendations** | List, By-source (Agent) | Pending, Approved, Rejected | Approve Recommendation, Reject Recommendation | Recommendation detail panel | Pending-count widget |
| **Decisions** | List, Timeline | — | Record Decision | Decision detail drawer (shows originating Recommendation if any, and any Decision that superseded it) | — |
| **Actions** | List, By-assignee | Open, Complete | Log Action, Complete Action | Action detail drawer | — |
| **Outcomes** | List, Timeline | — | Record Outcome | Outcome detail drawer (linked back to its Action) | — |

Every row above additionally inherits: Loading, Populated, Empty, Error, Read-only (Guest, where the Guest's shared link includes that Execution Layer screen).

---

## 10. Knowledge Layer

### Project Intelligence Feed
- **Views:** Chronological view, Semantic/topic-grouped view, Pipeline-stage view (Raw Source → Normalized Event → Evidence → Proposed Record → Approved Record → Recommendation → Decision → Action → Outcome).
- **Panels:** Item-detail side panel (never collapses pipeline stages — each stage visually distinct per ADR-PMF-016).
- **Floating Actions:** Approve Recommendation, Record Decision.
- **States:** Loading, Populated, Empty ("Nothing in the Feed yet."), Error.

### Project Memory
- **Views:** Facts view, Inferences view, Decisions view, Outcomes view — each a visually distinct category, never merged.
- **Panels:** Lineage panel (source, actor, date, context, evidence, confidence, validation status).
- **Drawers:** Correction-history drawer (superseding entries, never silent overwrite).
- **States:** Loading, Populated, Empty, Error.

### Knowledge Center
- **Views:** Candidate Patterns view, Ratified Patterns view — never merged into one undifferentiated "Patterns" list.
- **Panels:** Provenance panel (full lineage back to origin Workspace/Project).
- **Modals:** Ratify Pattern modal (requires all six elevation-gate criteria satisfied).
- **States:** Loading, Populated, Empty ("No knowledge has been elevated yet." — states the six-part gate plainly, never implies the feature is broken), Error.

---

## 11. Administration Layer

### Settings family (Workspace / PMO / Portfolio / Program / Enterprise Settings)
See each entity's own section above for its specific tabs — the family shares a common shell pattern: **Tabs** for configuration categories, **Modals** for destructive/high-consequence changes (rename, archive, delete), never inline-destructive without confirmation.

### Administration (hub)
- **Tabs:** Users, Permissions, Audit, API Keys, Billing, Integrations (each a distinct screen, listed below — Administration itself is a navigation hub, not a data screen).

### Users
- **Views:** List, By-role.
- **Modals:** Invite User, Change Role (confirmation), Remove User (destructive confirmation).
- **States:** Loading, Populated, Empty (single-user Workspace).

### Permissions
- **Views:** Role matrix view, Per-user override view.
- **Modals:** Assign Permission, Revoke Permission (destructive confirmation).

### Audit
- **Views:** Chronological log, Filtered-by-actor, Filtered-by-entity.
- **Panels:** Filter panel (date range, actor, action type).
- **Modals:** Export Audit Log.
- **States:** Loading, Populated, Empty, Error.

### API Keys
- **Views:** List.
- **Modals:** Create API Key (shows secret once, never again), Revoke API Key (destructive confirmation).

### Billing
- **Tabs:** Plan, Payment Method, Invoices.
- **Modals:** Change Plan, Update Payment Method.
- **Note:** No `enterprise` plan tier selector exists in this catalog until the tier is built — `plan='enterprise'` remains a dead, unreachable value today (PR1 §12 C-2).

### Integrations
- **Views:** Connected, Available.
- **Modals:** Connect Integration, Disconnect Integration (destructive confirmation).

---

## 12. Cross-Scope Screens (Reports / Health Center / Forecast Center / Calendar / Timeline / Agent Center)

Each manifests once per applicable scope (Enterprise/Workspace/PMO/Portfolio/Program/Project — see main IA §5.11); the view/tab/widget shape is identical across scopes, only the composed data differs.

### Reports
- **Views:** Formal export view, Scheduled-report view.
- **Modals:** Generate Report, Schedule Report.
- **States:** Loading, Populated, Empty, Error.

### Health Center
- **Views:** Rollup grid (all child entities at a glance), Drill-down view (one entity's Health drivers).
- **Widgets:** Green/Yellow/Red indicator widget (always paired with a text label, never color-only — accessibility rule from PR2 style guide).

### Forecast Center
- **Views:** Timeline-projection view, Evidence-basis view (shows the deterministic evidence a forecast is built from — never presented as statistical prophecy).
- **Panels:** Evidence-basis panel.

### Calendar
- **Views:** Month, Week, Agenda.
- **Modals:** Create Task/Milestone from Calendar (deep-links into the owning Execution Layer screen).

### Timeline
- **Views:** Gantt-style view, Phase view.
- **Panels:** Phase-detail panel.

### Agent Center
- **Views:** By-Agent view (Cost Governance Agent, Quality Governance Agent, others as activated), By-Recommendation view.
- **Panels:** Agent-configuration panel (scope, activation toggle).
- **States:** Loading, Populated, Empty ("No Agent activity yet for this scope."), Error.
- **Note:** Never surfaces a Decision/Action/Outcome as Agent-authored — Agent output is always framed as Recommendation only (§21 AI Interaction Model, main IA document).

---

## 13. Command Center Widget Cross-Reference

All six Command Centers (Enterprise/Workspace/PMO/Portfolio/Program/Project) share this widget taxonomy, scoped to their own entity:

| Widget type | Present in |
| --- | --- |
| Health grid/rollup widget | All six |
| Governance-exception widget | Enterprise, PMO |
| Recommendation/Intelligence widget | Project (primary), Program, Portfolio, PMO (rollup form) |
| Investment/priority widget | Portfolio |
| Coordination/benefit-tracking widget | Program |
| Task/Risk/Issue widget | Project |
| Cross-Workspace widget | Enterprise |

No Command Center widget ever reads data outside its own entity's descendant scope — this is the structural fix for the "mixed Project/Workspace data on one screen" defect PR1 found in the current `/command-center` route.

---

## 14. Validation Note

Every overlay, drawer, modal, panel, sidebar, tab, and widget enumerated above belongs to exactly one canonical screen from `03-canonical-information-architecture.md` §5. None introduces a new entity, a new navigation edge, or a new piece of vocabulary beyond what PR2 and this catalog's parent document already ratified.
