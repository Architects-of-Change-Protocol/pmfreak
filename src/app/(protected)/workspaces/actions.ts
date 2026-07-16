"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspaces";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { PREFERRED_WORKSPACE_COOKIE } from "@/lib/workspaces/preferred-workspace";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

async function setPreferredWorkspaceCookie(workspaceId: string) {
  const store = await cookies();
  store.set(PREFERRED_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
  });
}

/**
 * Explicit workspace creation (Change 1: Create Workspace from scratch).
 * The new workspace becomes the active one and the user continues into the
 * PMO setup flow — Workspace → PMO → Project.
 */
export async function createWorkspaceAction(formData: FormData) {
  const user = await requireAuthUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect("/workspaces/new?error=Workspace+name+is+required");
  }

  const { workspaceId } = await createWorkspace(user.id, name);
  await setPreferredWorkspaceCookie(workspaceId);
  redirect("/workspace/setup");
}

/** Switches the active workspace (validated against real memberships). */
export async function switchWorkspaceAction(formData: FormData) {
  const user = await requireAuthUser();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  if (!workspaceId) redirect("/workspaces");

  const resolution = await resolveCanonicalWorkspace(user.id, workspaceId);
  if (resolution.workspaceId !== workspaceId) {
    redirect("/workspaces?error=You+are+not+a+member+of+that+workspace");
  }

  await setPreferredWorkspaceCookie(workspaceId);
  redirect("/command-center");
}
