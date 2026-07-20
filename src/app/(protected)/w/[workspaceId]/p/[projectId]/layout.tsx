import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { isFeatureEnabled } from "@/platform/feature-flags";
import { ApplicationShell } from "@/platform/shell/ApplicationShell";

/**
 * Layout for PR9's new canonical routes — additive to the existing
 * (protected) shell, gated behind FEATURE_COMMAND_CENTER so the legacy
 * OperationalShell/`/command-center` route is untouched (Fase 13, "permite
 * rollback"). The outer (protected)/layout.tsx above this one already
 * handles auth continuity/onboarding; this layout adds the
 * project/workspace-scoped access check ADR-PMF-061 requires — the URL
 * segment is a request, never an authority.
 */
export default async function ProjectScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  if (!isFeatureEnabled("FEATURE_COMMAND_CENTER")) notFound();

  const { workspaceId, projectId } = await params;
  const user = await requireAuthUser();
  try {
    await requireProjectAccess(projectId, "read");
  } catch {
    // Unauthorized reads 404 rather than 403 to avoid confirming a resource's
    // existence to a caller who cannot access it.
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: project }, { data: workspace }] = await Promise.all([
    supabase.from("projects").select("id,name,workspace_id").eq("id", projectId).maybeSingle(),
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle(),
  ]);

  if (!project || project.workspace_id !== workspaceId) notFound();

  const headersList = await headers();
  const activePath = headersList.get("x-pathname") ?? "";

  return (
    <ApplicationShell
      companyName={user.companyName}
      workspaceName={workspace?.name ?? "Workspace"}
      userFullName={user.fullName}
      userRole={user.role}
      workspaceId={workspaceId}
      projectId={projectId}
      activePath={activePath}
    >
      {children}
    </ApplicationShell>
  );
}
