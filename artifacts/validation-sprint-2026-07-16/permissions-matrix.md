# Permission Matrix — Workspace → PMO → Project Hierarchy

Roles are the codebase's real `workspace_memberships.role` enum
(`owner | admin | pm | viewer`) plus "External/no access" (not a member of
the workspace at all). No new roles were invented for this sprint.

| Action | owner | admin | pm | viewer | External |
|---|---|---|---|---|---|
| View PMO | ✅ | ✅ | ✅ | ✅ | ❌ (RLS) |
| Create PMO | ✅ | ✅ | ✅ | ❌ (403, app+RLS) | ❌ |
| Edit PMO (name/type/icon/color/archive) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete PMO | ✅ | ✅ | ✅ | ❌ | ❌ |
| Duplicate PMO | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Project | ✅ | ✅ | ✅ (contributor role also, via existing `write` permission) | ❌ | ❌ |
| Edit Project (PATCH — name/status/methodology/icon/color/move PMO) | ✅ | ✅ | ✅ | ❌ (contributor: ✅, pre-existing `write`-permission grant) | ❌ |
| **Delete Project** (hard delete, cascades) | ✅ | ✅ | ❌ (403, app-layer only — RLS has no role restriction here) | ❌ | ❌ |
| Duplicate Project | ✅ | ✅ | ✅ | ❌ (contributor: ✅) | ❌ |
| Move Project between PMOs | ✅ | ✅ | ✅ | ❌ | ❌ |
| View PMO Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Project Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Workspace Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| Send message in any chat | ✅ | ✅ | ✅ | ✅ | ❌ |

Notes:
- "Edit Project" and "Duplicate Project" go through the pre-existing
  `requireProjectAccess(id, "write")` gate (unchanged, established
  convention), which — per the existing `ROLE_PERMISSION_MAP` in
  `src/lib/security/rbac.ts` — also grants `contributor`-tier accounts
  write access. That role tier predates this sprint and was not
  introduced or altered here.
- "Delete Project" was found to rely on the SAME `write` permission as
  edit, with **zero role restriction at the RLS layer** for
  `projects` DELETE (any workspace member's DELETE passes RLS). This was
  fixed by adding an explicit app-layer `admin`-minimum role check
  (`src/lib/workspace-access.ts:requireWorkspaceRole`) ahead of the
  delete, independent of the AOC-governed write permission (see
  `docs/…` / commit for `enforce project DELETE requires admin role`).
- PMO mutation routes previously only checked read-level membership
  (`requireWorkspaceMember`); a viewer's write attempt was rejected by
  RLS but surfaced as a generic 500. Fixed with an explicit
  `pm`-minimum role check matching the RLS "workspace managers can
  manage pmos" policy exactly, returning a clean 403.
- Chat read/send has no destructive semantics and correctly requires
  only workspace membership (any role, including viewer) — this was
  already correct and unchanged.
