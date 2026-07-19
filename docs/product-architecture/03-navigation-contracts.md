# PMFreak — Navigation Contracts (PR3)

**Type:** Product/UX architecture. Documentation only. No routes, navigation code, breadcrumbs, or menus were modified to produce this document.

**Authority:** Builds strictly on `03-canonical-information-architecture.md` §8–§17 and §28, and the ratified hierarchy in `01.1-domain-ratification.md`. Every rule below is a binding contract for PR4 and every implementation PR after it.

---

## 1. Navigation Edge Contract

Only the following entity-to-entity navigation edges are valid. No screen may offer a navigation action that implies any other edge.

| From | To | Cardinality | Nature |
| --- | --- | --- | --- |
| Enterprise | Workspace | 1:N | Ratified, mandatory once Enterprise exists |
| Workspace | PMO | 1:N | Ratified, mandatory once PMO exists |
| Workspace | Project | 1:N | Ratified shortcut (direct) |
| PMO | Portfolio | 1:N | Ratified, mandatory once Portfolio exists |
| PMO | Program | 1:N | Ratified, mandatory (Program→PMO is never optional) |
| PMO | Project | 1:N | Ratified shortcut (direct) |
| Portfolio | Program | 1:N | Ratified shortcut (optional) |
| Portfolio | Project | 1:N | Ratified shortcut (direct, optional) |
| Program | Project | 1:N | Ratified |
| Any of the six Aggregates | its own Command Center | 1:1 | Projection, terminal node only |

Any navigation UI (link, button, breadcrumb, card, list-row) that would take a user from one entity to another via an edge not in this table is non-conformant.

---

## 2. Breadcrumb Contracts

### 2.1 Canonical maximal trail

```
Enterprise ↓ Workspace ↓ PMO ↓ Portfolio ↓ Program ↓ Project ↓ Project Command Center
```

### 2.2 Shortcut trails

A breadcrumb always reflects the entity's **actual** ancestry, never a hypothetical full trail. Examples:

| Entry path | Resulting breadcrumb |
| --- | --- |
| Independent PM (no PMO/Portfolio/Program) | `Workspace ↓ Project ↓ Project Command Center` |
| Project created directly under PMO | `Workspace ↓ PMO ↓ Project ↓ Project Command Center` |
| Project under a Program (no Portfolio) | `Workspace ↓ PMO ↓ Program ↓ Project ↓ Project Command Center` |
| Project under a Portfolio-owned Program | `Workspace ↓ PMO ↓ Portfolio ↓ Program ↓ Project ↓ Project Command Center` |
| Enterprise-segment user viewing any Workspace | `Enterprise ↓ Workspace ↓ ...` (prefixed) |

### 2.3 Rules

1. Every breadcrumb node is clickable and navigates to that ancestor's Home screen (never its Command Center — Command Center is only ever the trail's terminal node, per §2.4).
2. A breadcrumb never skips a level that is actually part of the entity's ancestry chain.
3. A breadcrumb never inserts a level that is not actually part of the chain (e.g. never shows "PMO" for a Project created directly under Workspace).
4. **Command Center is always the terminal node**, never a mid-trail level (ADR-PMF-014 Rule 4). A trail like `Workspace ↓ PMO Command Center ↓ Project` is non-conformant.
5. Cross-Workspace breadcrumbs (Enterprise segment, Consultant) always show the Workspace name explicitly — never abbreviate or omit it, since it is the tenancy boundary.
6. Guest breadcrumbs show only the single shared item — no ancestor nodes are rendered, clickable or otherwise.

---

## 3. Entry Points

Documented per canonical screen. "Entry Points" here means every legitimate way a user can land on the screen — anything not listed is not a supported entry.

| Screen | Entry Points |
| --- | --- |
| Landing | Direct URL, marketing links, invitation links |
| Workspace Home | Post-login default redirect, Workspace switcher, breadcrumb root, Log Out → Log In round-trip |
| Enterprise Home | Global Nav Enterprise switcher, post-login redirect (Enterprise-tier users only) |
| PMO Home | Workspace Home PMO list, breadcrumb |
| Portfolio Home | PMO Home Portfolio list, breadcrumb |
| Program Home | PMO Home or Portfolio Home Program list, breadcrumb |
| Project Home | Any parent entity's Project list, Search, Notifications, direct/shared link |
| Any Command Center | "Open [Entity] Command Center" action from that entity's Home, Search, Notification deep-link |
| Project Intelligence Feed | Project Command Center, Project Home |
| Project Memory | Project Home, Project Command Center |
| Knowledge Center | Enterprise Home, Enterprise Command Center |
| Execution Layer screens | Project Home, Project Command Center |
| Administration screens | Workspace Settings, Enterprise Settings |
| Search / Notifications / Profile | Global Nav, from any screen |
| Saved Projects | Profile, "Save" action on any Project Home |

---

## 4. Exit Points

The inverse contract — where a user can go *from* each screen, beyond the always-available Global Navigation.

| Screen | Exit Points |
| --- | --- |
| Landing | Sign Up flow, Log In flow → Workspace Home |
| Workspace Home | Project Home, PMO Home, Workspace Command Center, Workspace Settings |
| Enterprise Home | Workspace Home, Enterprise Command Center, Enterprise Settings |
| PMO Home | Portfolio Home, Program Home, Project Home, PMO Command Center |
| Portfolio Home | Program Home, Project Home, Portfolio Command Center |
| Program Home | Project Home, Roadmap, Program Command Center |
| Project Home | Project Command Center, any Execution Layer screen |
| Any Command Center | Its own entity's Home (breadcrumb ancestor), its direct children's Homes |
| Project Intelligence Feed | Recommendations, Decisions, Documents |
| Project Memory | Knowledge Center (if elevation applies) |
| Execution Layer screens | Project Home, Project Command Center |
| Administration screens | Any sibling Administration screen, entity Settings |

---

## 5. Redirects

Only three redirect classes are permitted anywhere in the product's navigation architecture:

1. **Post-authentication redirect** — Landing → Workspace Home (or Enterprise Home for Enterprise-tier users) after successful Log In or Sign Up.
2. **Post-creation redirect** — any "Create [Entity]" action redirects to that entity's own Home screen, never to a management/settings screen (IA Principle 7).
3. **Access-revocation redirect** — a Guest whose shared-item access has expired or been revoked is redirected to a plain "access ended" state, never silently to Landing or a 404 without explanation.

No other redirect is permitted. In particular: no onboarding flow may redirect a user attempting to create a Project into a PMO-creation flow first (this is the ratified fix for the current-state defect documented in `01.1-domain-ratification.md` §23 and flagged as a Navigation Anti-pattern in the main IA document §28).

---

## 6. Context Rules

Restated as binding contract from the main IA document §17, with the enforcement rule made explicit for each:

| Context | Must survive | Enforcement rule |
| --- | --- | --- |
| Workspace | All navigation within it | No screen transition may silently change the active Workspace without an explicit switcher action |
| PMO | Navigation among its Portfolios/Programs/Projects | Breadcrumb PMO node must remain constant until the user navigates outside that PMO |
| Portfolio | Navigation among its Programs/Projects | Same pattern as PMO |
| Program | Navigation among its Projects | Same pattern as PMO |
| Project | Navigation among its Execution Layer screens | The Execution Layer sidebar/tabs never triggers a full context reload — only the active tab changes |
| Filters | Within one list screen, across pagination/sort | Filter state is screen-local; never carried to a different screen implicitly |
| Dates | Across Health/Forecast/Timeline/Calendar within one entity scope | Cleared only on entity-scope change, never on tab change within the same entity |
| Search | Within Search results, including back-navigation from a result | Returning from a result via back-navigation restores the exact prior query and filter state |
| Selection | Within one list screen | Cleared on any navigation away from that screen |

---

## 7. Screen Relationship Matrix

Full adjacency across every screen family (✓ = a direct navigation edge exists; — = no direct edge; edges are always bidirectional for "return" navigation unless noted).

| | Home | Command Center | Settings | Execution Layer | Knowledge Layer | Administration | Search/Notifications |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Home** | — | ✓ | ✓ | ✓ (Project only) | ✓ (Project only) | ✓ (deliberate, via Settings) | ✓ (Global Nav) |
| **Command Center** | ✓ (ancestor) | — | — | ✓ (Project Command Center only) | ✓ (Project/Enterprise Command Center only) | — | ✓ (Global Nav) |
| **Settings** | ✓ | — | — | — | — | ✓ (Workspace/Enterprise Settings only) | ✓ (Global Nav) |
| **Execution Layer** | ✓ | ✓ (Project Command Center) | — | ✓ (sibling, via Project Home tabs) | ✓ (Recommendations → Feed) | — | ✓ (Global Nav) |
| **Knowledge Layer** | ✓ | ✓ | — | ✓ (Feed → Recommendations/Decisions) | — | — | ✓ (Global Nav) |
| **Administration** | ✓ | — | ✓ | — | — | ✓ (sibling screens) | ✓ (Global Nav) |
| **Search/Notifications** | ✓ (any result) | ✓ (any result) | — | ✓ (any result) | ✓ (any result) | — | — |

---

## 8. Anti-pattern Enforcement

Each rule in this document exists specifically to prevent one of the Navigation Anti-patterns documented in `03-canonical-information-architecture.md` §28. Cross-reference:

| Anti-pattern | Prevented by |
| --- | --- |
| Command Center as entity | §1 Navigation Edge Contract (Command Center is never a source node, only a terminal projection) |
| Workspace as menu | §6 Context Rules (Workspace context must survive, proving it is a boundary, not a label) |
| PMO duplicated | §1 (only one PMO edge exists, from the canonical `pmos` entity) |
| Portfolio hidden behind unrelated label | §3 Entry Points (Portfolio Home has exactly one legitimate entry path, from PMO Home) |
| Navigation loops | §7 Screen Relationship Matrix (every edge is purposeful; no screen links back to itself without state change) |
| Lost context | §6 Context Rules |
| Bare "Command Center" | §2.4 (always entity-qualified, always terminal) |
| Onboarding gate above Project | §5 Redirects (Project creation never redirects through PMO creation) |
