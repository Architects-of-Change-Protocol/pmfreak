import { resolvePreferredWorkspace } from "./preferred-workspace";
import { ensureUserWorkspace } from "@/lib/workspaces";

export type ResolvedWriteWorkspace = {
  workspaceId: string;
  role: "owner" | "admin" | "pm" | "viewer" | null;
  bootstrapped: boolean;
};

/**
 * Resolves which workspace a new write (project, PMO, ...) should land in
 * for a user who may belong to several: the caller's preferred (cookie-
 * selected) workspace when it is a real, active membership; otherwise the
 * oldest membership; otherwise a freshly bootstrapped workspace for a
 * brand-new account. Never trusts the cookie value directly —
 * resolveCanonicalWorkspace (via resolvePreferredWorkspace) validates it
 * against real membership rows before honoring it.
 *
 * Use this instead of calling ensureUserWorkspace/resolveCanonicalWorkspace
 * directly from any write path — those ignore the preferred-workspace
 * cookie entirely and always resolve to the oldest membership, which is
 * wrong for any user who has switched to a different workspace.
 */
export async function resolveWriteWorkspace(userId: string): Promise<ResolvedWriteWorkspace> {
  const preferred = await resolvePreferredWorkspace(userId);
  if (preferred.workspaceId) {
    return { workspaceId: preferred.workspaceId, role: preferred.role, bootstrapped: false };
  }
  const ensured = await ensureUserWorkspace(userId);
  return { workspaceId: ensured.workspaceId, role: ensured.role, bootstrapped: true };
}
