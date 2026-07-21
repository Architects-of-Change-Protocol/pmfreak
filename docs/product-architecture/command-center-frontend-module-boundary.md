# Command Center — Frontend Module Boundary

Status: Migration boundary (classification + strangler seam; no file moves)
Parent: `07-frontend-module-boundaries.md`
Governing ADRs: ADR-PMF-058 (Domain-Aligned Frontend Modules), ADR-PMF-068 (Incremental Frontend Migration)
Sprint: PR9 — Canonical Product Experience Implementation

## 1. Purpose and Non-Goals

This document establishes the ownership boundary for the "Command Center" frontend surfaces so that a future migration PR can answer "which module owns this file" and "is this import allowed" without guessing. It **classifies** the existing surfaces against the target module catalog (`07-frontend-module-boundaries.md` §2) and defines the allowed/forbidden dependency edges and the strangler-pattern path to target.

**This document, and the PR that adds it, does not move, rename, or delete a single file, and does not modify any route.** Per ADR-PMF-068, the current and target structures coexist; classification precedes reorganization (ADR-PMF-058 §Migration Implications).

Non-goals for this sprint:
- No file moves (ADR-PMF-068 rule 2 — the old surface keeps working until its replacement is verified).
- No route changes (`07-canonical-frontend-architecture.md` §1 — "does not create, move, or modify a single route").
- No new business logic, no new dependencies.
- No per-file reclassification of every symbol (deferred to migration execution, ADR-PMF-058 §Out of Scope).

## 2. The Central Finding: "Command Center" Is Not a Module

There is **no "Command Center" bounded context** (PR4 §10) and therefore **no `modules/command-center`** in the target catalog (`07-frontend-module-boundaries.md` §2). This is deliberate and is the reason this boundary document exists:

- A Command Center is a **per-scope screen** — Enterprise Command Center, Workspace Command Center, PMO Command Center, Portfolio Command Center, Program Command Center, Project Command Center — each **owned by its scoping module** (`07-frontend-module-boundaries.md` §2 rows for `modules/enterprise`, `modules/workspace`, `modules/pmo`, `modules/portfolio`, `modules/program`, `modules/project`).
- A Command Center screen is a **projection composition**, never a source of truth (`07-canonical-frontend-architecture.md` §3 principle 14, restating PR4 §9.5) — it composes Query results owned elsewhere.
- `src/app/(protected)/command-center/` is a **route, not a bounded context** (`07-canonical-frontend-architecture.md` §2, which names this exact folder as the illustrating example).

Consequence: the five "Command Center" surfaces below do **not** collapse into one new module. Each is classified against the layer model (`07-frontend-module-boundaries.md` §1) and routed to an **existing** scoping module. Creating a `modules/command-center` would be exactly the "arbitrary frontend module … invented that does not correspond to an already-ratified bounded context" that ADR-PMF-058 Rule 1 forbids.

## 3. Current Ownership Locations (as of this branch)

Enumerated directly from the repository at HEAD. This is a structural classification, not an exhaustive per-symbol audit.

| # | Current location | Layer (`§1`) | What it holds today | External importers |
| --- | --- | --- | --- | --- |
| 1 | `src/features/command-center/` (20 files) | Features + Domain Presentation | The operational Command Center screen shell (`command-center-client.tsx`, `command-center-layout.tsx`, `command-center-empty-state.tsx`), presentational panels (`command-feed`, `needs-you-queue`, `detail-drawer`, `project-*`, `status-badge`, `vault-intake-panel`, `agent-*`), view-model `types.ts`, and static demo/`operational-data`/`conversation-data` fixtures. No persistence access. | `src/app/(protected)/command-center/page.tsx` only (imports `CommandCenterClient`, `CommandCenterEmptyState`) |
| 2 | `src/components/command-center/` (10 files) | Domain Presentation | PMO governance panels/dashboards (`pmo-dry-run-gate-dashboard`, `pmo-implementation-planning-dashboard`, and eight `pmo-*-panel` presentational stubs). Self-contained; imports nothing from `@/`. | `src/app/(protected)/policy-implementation-planning/page.tsx`, `src/app/(protected)/policy-dry-run-gate/page.tsx` |
| 3 | `src/lib/command-center/` (3 files) | Application Contracts / domain types | `command-center-types.ts` (`CommandCenterType`, `OwnerType`, `COMMAND_CENTER_TYPES`, `commandCenterTypeLabel`, `isCompanyOwnedContext`, `defaultOwnerTypeFor` — the **tenant-context** taxonomy, i.e. which kind of command center a workspace *is*), `conversation-chat.ts`, `agent-idle-copy.ts`. | `src/lib/workspaces.ts`, `src/lib/pmo/*`, `src/app/api/command-center/chat/route.ts`, `src/app/(protected)/dashboard/page.tsx`, `src/components/pmfreak/workspace/command-center-context-banner.tsx`, `src/components/pmfreak/pmo/create-pmo-wizard.tsx` |
| 4 | `src/lib/operational-command-center/` (14 files, has own `index.ts`) | Application layer (backend read-model / engines), **not a frontend surface** | Operational-focus read-model registry, repository, and scoring/health/lineage/priority/rationale engines. Already exposes a public `index.ts` barrel. | None in app/component code (the sole textual match in `src/lib/db/database-contract.ts` is a coincidental substring of the contract **version string**, not an import). |
| 5 | `src/app/(protected)/command-center/` (`page.tsx`, `actions.ts`) | Routes | The workspace operations-console route: resolves workspace + active project server-side, surfaces the PMO portfolio strip, renders the screen shell. | (route — entered by URL) |

## 4. Target Ownership

Target modules are drawn **only** from the ratified catalog (`07-frontend-module-boundaries.md` §2). No new module is introduced.

| # | Current location | Target module(s) | Target layer | Rationale |
| --- | --- | --- | --- | --- |
| 1 | `src/features/command-center/` | Primarily `modules/workspace` (Workspace Command Center screen + its Features), with project-scoped pieces to `modules/project` (Project Command Center). Cross-scope derived views (Health/Forecast/Calendar/Timeline shapes, if present) remain Domain Presentation consumed by the scoping module. | Screens / Features / Domain Presentation | The current `/command-center` route is a workspace-scoped operations console with project drill-in; a Command Center is a projection composition owned by its scoping module (§2). Exact split is per-file, done during migration, not here. |
| 2 | `src/components/command-center/` | `modules/pmo` | Domain Presentation | Every file is a `pmo-*` governance panel; PMO Governance is the owning bounded context (`07-frontend-module-boundaries.md` §2, `modules/pmo`). |
| 3 | `src/lib/command-center/` | `command-center-types.ts` → `modules/workspace` + `modules/pmo` Application Contracts (tenant-context taxonomy shared via public entry points); `conversation-chat.ts` → `modules/agents` / owning screen's Application Contracts; `agent-idle-copy.ts` → Domain Presentation copy of its owning screen. | Application Contracts / Domain Presentation | Mixed lib folder; each symbol traces to a different owner. The `CommandCenterType` taxonomy is a tenant-identity concept (Workspace/PMO), not a screen concept. |
| 4 | `src/lib/operational-command-center/` | Application layer (backend); consumed by scoping modules **only through the API contract** (`06-canonical-api-contracts.md`), never imported by a UI component. | Not a frontend module | It is a read-model/engine service. Per ADR-PMF-060 / §3 principle 4, frontend reaches it via a contract client, not by importing it. Its existing `index.ts` is the application-layer public surface, not a frontend module entry point. |
| 5 | `src/app/(protected)/command-center/` | Route stays in `src/app/`; delegates to `modules/workspace`'s Screen once that Screen is ready (ADR-PMF-068 rule 1). | Routes | A route is thin and delegates to a module's Screen composition root (`07-frontend-module-boundaries.md` §6). The per-route mapping (Workspace Command Center vs. deprecate/split) is decided during migration (ADR-PMF-068 rule 3), not now. |

## 5. Allowed Dependencies

Restated from `07-frontend-module-boundaries.md` §3, scoped to these surfaces:

1. The route (`src/app/(protected)/command-center/page.tsx`) may depend on the Command Center Features surface **through its public entry point** (`src/features/command-center/index.ts`, §7 below) and on server-side tenant/data helpers it already uses (`@/lib/auth`, `@/lib/workspaces`, `@/lib/pmos/*`) — the latter being server-resolved tenant context (`07-canonical-frontend-architecture.md` §3 principle 10).
2. Command Center Features/Domain Presentation may depend on Platform primitives and on their own module's Application Contracts.
3. Any layer may depend on Platform.
4. Application Contracts (e.g. a future Command Center contract client) may depend on Platform-level HTTP/fetch primitives and on the operational read-model **only via the API** (surface #4).
5. Frontend consumers of the tenant-context taxonomy (`CommandCenterType` et al.) depend on it as an Application-Contracts type import — allowed across modules once it is re-exported from `modules/workspace` / `modules/pmo` public entry points.

## 6. Forbidden Dependencies

Restated from `07-frontend-module-boundaries.md` §3 (Forbidden) and §7.3:

1. **No deep imports into internals.** After the seam in §7 exists, no consumer imports `src/features/command-center/*` files directly except through `src/features/command-center/index.ts`. (The route's current deep imports are grandfathered until the migration step that switches them — ADR-PMF-068 rule 2.)
2. **No persistence access from UI.** No file under `src/features/command-center/` or `src/components/command-center/` may import `@supabase/*`, `@/lib/db/*`, an ORM type, or a raw SQL string (ADR-PMF-060). Current state: both surfaces are already persistence-clean; this must not regress.
3. **No UI import of the operational read-model.** No component/feature imports `@/lib/operational-command-center/*`; that engine is reached only through the API contract (surface #4 rationale).
4. **Platform stays domain-free.** Nothing extracted to Platform from these surfaces may branch on a domain entity type; the moment a "shared" Command Center piece branches on entity type it is Domain Presentation and stays in its module (ADR-PMF-058 Rule 3).
5. **No new `modules/command-center`.** No sibling reaches "across" into another module's internals, and no arbitrary Command Center module is created (ADR-PMF-058 Rule 1; §2 above).
6. **No duplicate contract clients** for the same operational Command/Query across the workspace/project/pmo modules (§3 Forbidden rule 6).

## 7. Strangler Seam Introduced by This PR

Per ADR-PMF-068 (target and current coexist; introduce the seam before moving anything), this PR adds **one** additive, logic-free file:

- `src/features/command-center/index.ts` — a public entry point (barrel) over the **existing legacy** `src/features/command-center/` folder. It re-exports only the genuine public surface currently consumed by the Routes layer: `CommandCenterClient` and `CommandCenterEmptyState`, plus the view-model types that describe their props contract.

What this seam is and is not:
- **It is** a transitional strangler seam over a legacy folder, giving that folder a single public entry point so future consumers stop deep-importing its internals (§6 rule 1) and so its contents can later move into `modules/workspace` / `modules/project` behind a stable import path.
- **It is not** a ratification of a "Command Center module." It creates no `src/modules/command-center/`, adds no business logic, changes no route, and does not itself rewrite the existing deep imports in `page.tsx` (that switch is a later, independently-revertible migration step — ADR-PMF-068 rule 5).

No barrel is added for surfaces #2–#4: `src/components/command-center/` is Domain Presentation consumed directly by two routes and will move wholesale into `modules/pmo`; `src/lib/operational-command-center/` already has an application-layer `index.ts`; `src/lib/command-center/` is a mixed folder whose symbols split across owners and should not be frozen behind a single barrel that would imply single ownership.

## 8. Migration Approach (Strangler, Phased)

Each step is independently revertible (ADR-PMF-068 rule 5) and the old surface keeps working until its replacement is verified (rule 2).

1. **Seam (this PR).** Introduce `src/features/command-center/index.ts`. Classify all five surfaces (this document). No moves.
2. **Adopt the seam.** Switch `src/app/(protected)/command-center/page.tsx` to import from the barrel instead of deep paths. Route behavior unchanged; import surface narrowed to the public contract.
3. **Establish `modules/workspace`.** Create the Workspace module skeleton (`screens/ features/ presentation/ contracts/ index.ts`) and move the workspace-scoped Command Center Screen/Features from `src/features/command-center/` into it, re-exporting through `modules/workspace`'s public entry point. Only then does the route migrate to the canonical route map (ADR-PMF-068 rule 1 — screen, module, and data contract simultaneously ready).
4. **Split project-scoped pieces** into `modules/project`; extract any genuinely-shared, domain-free primitives to Platform (ADR-PMF-058 Rule 3 test applied per component).
5. **Move `src/components/command-center/` → `modules/pmo`** Domain Presentation; update the two policy routes' imports to the module public entry point.
6. **Reclassify `src/lib/command-center/` per symbol** into `modules/workspace` / `modules/pmo` / `modules/agents` Application Contracts, re-exported from each module's public entry point.
7. **Introduce a Command Center contract client** (Application Contracts) that consumes the operational read-model (`src/lib/operational-command-center/`) via the API contract, and remove any residual direct coupling.
8. **Add fitness functions** (`07-frontend-module-boundaries.md` §4) — cross-module import check, persistence-import check, Platform-purity check — extending the existing `check:aoc-*` pattern to the module catalog.
9. **Removal.** Delete the emptied legacy `src/features/command-center/` / `src/components/command-center/` folders only after their consumers are cut over and verified (ADR-PMF-068 §Removal Criteria).

## 9. Architectural Risks

- **R1 — Scope-split ambiguity (Misclassification, ADR-PMF-058 §Risks).** The current `/command-center` route mixes workspace-scoped and project-scoped concerns; splitting `src/features/command-center/` across `modules/workspace` and `modules/project` risks fracturing one screen's frontend across two modules. Mitigation: the split traces to PR4 §17 application-service ownership (`07-frontend-module-boundaries.md` §7), decided per-file at step 3–4, not guessed here.
- **R2 — Route-mapping decision risk (ADR-PMF-068 rule 3).** `/command-center` has no clean 1:1 canonical screen (it is an operations console, not literally "Workspace Command Center"); its mapping-vs-deprecate decision is deferred to migration and must not be forced by the seam. The seam is deliberately import-narrowing only, taking no position on the route's final identity.
- **R3 — Version-string false positive.** `src/lib/operational-command-center` appears in `src/lib/db/database-contract.ts` only as a substring of `DATABASE_CONTRACT_VERSION`; a naïve grep-based fitness function could mistake it for an import. Any dependency linter must match import statements, not raw substrings.
- **R4 — Mixed-folder freeze hazard.** Adding a single barrel over `src/lib/command-center/` would wrongly imply single ownership of a folder whose symbols split across three owners; this PR intentionally does not, to avoid encoding a false boundary.
- **R5 — Seam-adoption stall (Stalled-migration, ADR-PMF-068 §Risks).** An unused barrel provides no value until adopted; if steps 2–3 never land, the seam is inert. Mitigation: the phased plan (§8) sequences adoption immediately after the seam, and the legacy folder remains fully functional in the interim.
