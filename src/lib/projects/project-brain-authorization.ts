import type { WorkspaceRole } from "@/lib/workspace-access";

/**
 * Authorization boundary for "may this workspace member create a Project /
 * activate its Project Brain". Mirrors the DB-level boundary the default-PMO
 * RPC already enforces (the "workspace managers can manage pmos" RLS policy,
 * owner/admin/pm only — supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql).
 *
 * Before this check existed, `projects` itself had no role gate at all (any
 * authenticated workspace member could insert a row), while the PMO a brand
 * new project auto-creates (ensureDefaultPmo) WAS gated to owner/admin/pm at
 * the database layer. That mismatch meant a `viewer` could pass the project
 * insert but then hit an unexplained RLS rejection creating the PMO
 * underneath it — a real permission denial, surfaced to the user as a
 * generic "unexpected error" (or, depending on where in the Server Action
 * transport it manifested, a fabricated "network error"). Gating here,
 * before any workspace/PMO/project mutation is attempted, makes the two
 * boundaries consistent and turns that failure into an honest, upfront
 * permission denial with zero partial persistence.
 */
export const canActivateProjectBrain = (role: WorkspaceRole | null | undefined): boolean =>
  role === "owner" || role === "admin" || role === "pm";
