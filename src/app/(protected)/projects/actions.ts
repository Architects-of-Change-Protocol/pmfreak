"use server";

import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { canCreateMoreProjects } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { generateAndPersistOperationalGovernanceBrief } from "@/lib/projects/first-insight";

export async function createProjectAction(formData: FormData) {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;

  if (!name) {
    redirect("/projects?error=Project+name+is+required");
  }

  const projectAccess = await canCreateMoreProjects(user.id);
  if (!projectAccess.ok) {
    redirect(`/projects?error=${encodeURIComponent("upgrade_required")}&feature=${encodeURIComponent(projectAccess.feature)}&requiredPlan=${projectAccess.requiredPlan}`);
  }

  const ensured = await ensureUserWorkspace(user.id);

  const onboardingPayload = {
    identity: { projectName: name, clientOrganization: "", projectType: "other", contractCode: "", pmAssigned: user.email ?? user.id, technicalLead: "", targetDeliveryDate: "" },
    deliveryContext: { problemStatement: description ?? "", mainDeliverable: name, externalDependencies: "", contractualMilestones: "", scopeType: "discovery" },
    governance: { raidInitialized: true, stakeholdersInitialized: false, deliveryCadenceInitialized: false, reportingStructureInitialized: false, escalationMapInitialized: false, healthBaselineInitialized: true },
    discovery: { unknowns: "Created from lightweight project form", requirementsDefined: null, pendingClientDependencies: "", pendingAccesses: "", vendorDependencies: "", financialBlockers: "" },
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, workspace_id: ensured.workspaceId, name, description, onboarding_payload: onboardingPayload })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    redirect(`/projects?error=${encodeURIComponent(error?.message ?? "Unable to create project")}`);
  }

  let briefGeneration = "";
  try {
    const briefResult = await generateAndPersistOperationalGovernanceBrief({
      workspaceId: ensured.workspaceId,
      projectId: data.id,
      projectOnboardingPayload: onboardingPayload,
      createdBy: user.id,
      supabase,
    });
    if (!briefResult.ok) briefGeneration = "&briefGeneration=failed";
  } catch {
    briefGeneration = "&briefGeneration=failed";
  }

  redirect(`/command-center?projectId=${data.id}${briefGeneration}`);
}
