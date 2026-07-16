# RLS / Authorization Matrix — Real Roles Only

Roles are the actual `workspace_memberships.role` CHECK-constraint values:
`owner | admin | pm | viewer`, plus "Sin acceso" (not a member).

**Important finding (documented, not a defect in this diff — see
`defects.md` D1):** `src/lib/security/rbac.ts`'s `WorkspaceRole` type
(`owner | admin | PM | contributor | executive_viewer | external_stakeholder | ai_agent`)
is a *different*, pre-existing enum used by the AOC governance runtime for
some pre-existing project-access paths. `ROLE_PERMISSION_MAP`/
`defaultGovernancePolicyEvaluator` — the only place that enum's permission
sets are checked — is dead code (zero real consumers, confirmed by grep).
The actual DB-backed role for a real user is always one of the four
`workspace_memberships` values; "Contributor"/"Executive Viewer"/"External
Stakeholder" are not reachable states in the current schema. The matrix
below uses only the real, reachable roles.

| Acción | Owner | Admin | PM | Viewer | Sin acceso |
|---|---|---|---|---|---|
| Ver PMO | ✅ | ✅ | ✅ | ✅ | ❌ (RLS) |
| Crear PMO | ✅ | ✅ | ✅ | ❌ (403, app+RLS) | ❌ |
| Editar PMO | ✅ | ✅ | ✅ | ❌ | ❌ |
| Archivar PMO | ✅ | ✅ | ✅ | ❌ | ❌ |
| Eliminar PMO | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear Project | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar Project | ✅ | ✅ | ✅ | ❌ (pre-existing `write`-permission path also grants `contributor`-typed accounts, but no real membership row can hold that value) | ❌ |
| Mover Project | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Eliminar Project** | ✅ | ✅ | ❌ (403, app-layer only — RLS has zero role restriction here) | ❌ | ❌ |
| Ver Workspace Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver PMO Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver Project Chat | ✅ | ✅ | ✅ | ✅ | ❌ |

## Validated in four layers

1. **UI** — `listPmos`/`listPmosWithProjects` default to `includeArchived:
   false`; the project-move dropdown only lists active PMOs (code-reviewed,
   not merely assumed).
2. **API** — every PMO mutation route calls
   `requireWorkspaceRole(workspaceId, "pm")` (from `src/lib/workspace-access.ts`
   — a direct DB-role check, confirmed to bypass the AOC governance runtime
   entirely, see `defects.md` D1); project DELETE additionally calls
   `requireWorkspaceRole(workspaceId, "admin")`.
3. **Servicios** — `pmo-service.ts`/`project-admin-service.ts` re-validate
   workspace scoping on every mutation via `getPmoById(workspaceId, id)`
   (workspace-filtered lookup, not global-by-id).
4. **PostgreSQL / RLS** — independently re-verified live (see
   `rls-negative-tests.md`): `pmos` "manage" policy restricts to
   `owner|admin|pm`; `projects` DELETE policy has **no** role predicate at
   all (confirmed via `select policyname, cmd, qual from pg_policies where
   tablename='projects' and cmd='DELETE'` — this is exactly why layer 2's
   app-level admin check is load-bearing, not redundant).
