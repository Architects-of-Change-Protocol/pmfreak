import { cookies } from "next/headers";
import { resolveCanonicalWorkspace, type WorkspaceResolution } from "@/lib/workspaces/canonical-workspace-resolver";

/**
 * Persisted "current workspace" selection.
 *
 * A user can belong to many workspaces; the active one is remembered in a
 * cookie and validated against real memberships on every request by
 * resolveCanonicalWorkspace (which falls back to the oldest active
 * membership when the cookie is stale or missing).
 */

export const PREFERRED_WORKSPACE_COOKIE = "pmfreak.workspaceId";

export async function readPreferredWorkspaceId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(PREFERRED_WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function resolvePreferredWorkspace(userId: string): Promise<WorkspaceResolution> {
  const preferred = await readPreferredWorkspaceId();
  return resolveCanonicalWorkspace(userId, preferred);
}
