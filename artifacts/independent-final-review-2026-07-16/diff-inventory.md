# Diff Inventory — 64 files, +4703/-52 (main@7c5e94c...HEAD@dd3c40a)

| Categoría | Archivos | Responsabilidad | Riesgo |
|---|---|---|---|
| **Migración** | `supabase/migrations/20260828000000_workspace_pmo_project_hierarchy.sql` | New tables (`pmos`, `context_conversations`, `context_messages`); `projects.pmo_id`/`methodology`/`icon`/`color` columns; two `BEFORE INSERT/UPDATE` triggers enforcing cross-workspace consistency; advisory-lock-guarded backfill | Was High (race + cross-workspace gap), now Low — both closed with re-verified evidence |
| **Contratos DB** | `src/lib/db/database-contract.ts`, `scripts/check-db-schema-contract.mjs` | Type/column declarations for the new tables; contract checker registration | Low — mechanical, verified by `check-db-schema-contract.mjs` PASS |
| **RLS / policies** | (inside the migration file — no separate files) | `pmos`/`context_conversations`/`context_messages` RLS policies (owner/admin/pm write, all-members read) | Low — independently re-verified with 8 negative tests + positive controls |
| **Servicios de dominio** | `src/lib/pmos/pmo-service.ts`, `src/lib/projects/project-admin-service.ts`, `src/lib/chat/context-chat-service.ts`, `src/lib/chat/context-chat-responder.ts`, `src/lib/context/context-scope.ts` | PMO/project CRUD, conversation persistence, deterministic chat grounding, scope-id derivation | Low — one new fix this review (archived-PMO target rejection); all else re-verified |
| **APIs** | `src/app/api/pmos/route.ts`, `src/app/api/pmos/[id]/route.ts`, `src/app/api/pmos/[id]/duplicate/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/duplicate/route.ts`, `src/app/api/projects/route.ts`, `src/app/api/context-chat/route.ts`, `src/app/api/getting-started/route.ts` | REST surface for PMO/project mutation, project listing, context chat | Low — role checks independently re-verified against real RLS policies |
| **Resolución de Workspace** | `src/lib/workspaces.ts`, `src/lib/workspaces/preferred-workspace.ts` | `createWorkspace`, cookie-based preference (never authorization — re-verified) | Low |
| **Navegación** | `src/lib/workspace/navigation-hierarchy.ts`, `src/components/pmfreak/operational-shell.tsx`, `src/components/pmfreak/navigation/sidebar-pmo-tree.tsx`, `src/app/(protected)/projects/[id]/project-tab-nav.tsx`, `src/app/(protected)/pmos/[pmoId]/pmo-tab-nav.tsx`, `src/lib/auth/route-policy-registry.ts` | Sidebar PMO tree, tab navs, route classification | Low — no collision with legacy `/workspace` route confirmed; index coverage confirmed for the sidebar's 2-query (not N+1) fetch |
| **Onboarding** | `src/lib/auth/resolve-onboarding-state.ts`, `src/lib/pmo/save-pmo-tenant.ts`, `src/lib/projects/save-project-onboarding.ts`, `src/app/(protected)/projects/actions.ts`, `src/app/(protected)/command-center/actions.ts`, `src/app/(protected)/workspaces/actions.ts`, `src/app/(protected)/workspaces/new/page.tsx`, `src/app/(protected)/projects/new/page.tsx`, `src/components/pmfreak/projects/create-project-wizard.tsx` | Workspace→PMO→Project creation chain; `pmos` row materialization alongside legacy governance JSON | Low — chain traced end to end, redirects intact |
| **Páginas (UI)** | `src/app/(protected)/pmos/**`, `src/app/(protected)/workspaces/**`, `src/app/(protected)/chat/page.tsx`, `src/app/(protected)/projects/[id]/**`, `src/components/pmfreak/pmos/pmo-admin-client.tsx`, `src/components/pmfreak/projects/project-settings-client.tsx`, `src/components/pmfreak/chat/context-chat-panel.tsx` | PMO/Project/Workspace admin UI, chat panel | Low |
| **Layout / gating** | `src/app/(protected)/layout.tsx`, `src/app/(protected)/command-center/page.tsx` | Cookie-aware workspace resolution at the shell layer; command-center cross-PMO operations strip | Low — one overlapping file with main's advance (non-conflicting, documented in environment-baseline.md) |
| **Tests** | `tests/workspace-pmo-project-hierarchy.test.mjs`, `tests/workspace-pmo-project-validation-sprint.test.mjs` (+ this review's new `tests/workspace-pmo-project-independent-review.test.mjs`, not yet counted in the 64), `tests/create-project-brain.test.mjs`, `tests/create-project-flow.test.mjs`, `tests/navigation-collapse.test.mjs`, `tests/pilot-capability-set.test.ts` | New hierarchy/regression coverage; 4 pre-existing test files updated to the new Overview-first landing / PMO tree behavior | Low — updated assertions verified to encode the NEW intentional contract, not just "made green" |
| **Evidencia / docs** | `artifacts/validation-sprint-2026-07-16/*`, `docs/architecture/workspace-pmo-project-hierarchy.md` | Prior sprint's own evidence and architecture doc | N/A — reviewed, not blindly trusted (see other files in this folder) |

## Unrelated changes

**None found.** All 64 files trace directly to either the original
Workspace→PMO→Project implementation or the subsequent validation sprint's
fixes. No scope creep, no drive-by refactors, no unrelated dependency bumps.

## Files modified by this independent review (added on top of the 64)

See `defects.md` and `final-report.md` §D for the itemized list — one
source file fixed (`src/lib/projects/project-admin-service.ts`), one new
test file added, this evidence folder.
