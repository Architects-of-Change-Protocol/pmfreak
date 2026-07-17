"use server";

import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { canCreateMoreProjects } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWriteWorkspace } from "@/lib/workspaces/resolve-write-workspace";
import { ensureDefaultPmo, getPmoById } from "@/lib/pmos/pmo-service";
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

  const ensured = await resolveWriteWorkspace(user.id);

  // Every project belongs to a PMO (Workspace → PMO → Project). Honor an
  // explicit selection from the form; otherwise attach to the workspace's
  // default PMO, creating it when this is the first project ever.
  const requestedPmoId = String(formData.get("pmoId") ?? "").trim();
  let pmoId: string;
  if (requestedPmoId) {
    const requestedPmo = await getPmoById(ensured.workspaceId, requestedPmoId);
    if (!requestedPmo) {
      redirect("/projects?error=Selected+PMO+was+not+found");
    }
    pmoId = requestedPmo.id;
  } else {
    const defaultPmo = await ensureDefaultPmo(ensured.workspaceId, user.id);
    pmoId = defaultPmo.id;
  }

  const onboardingPayload = {
    identity: { projectName: name, clientOrganization: "", projectType: "other", contractCode: "", pmAssigned: user.email ?? user.id, technicalLead: "", targetDeliveryDate: "" },
    deliveryContext: { problemStatement: description ?? "", mainDeliverable: name, externalDependencies: "", contractualMilestones: "", scopeType: "discovery" },
    governance: { raidInitialized: true, stakeholdersInitialized: false, deliveryCadenceInitialized: false, reportingStructureInitialized: false, escalationMapInitialized: false, healthBaselineInitialized: true },
    discovery: { unknowns: "Created from lightweight project form", requirementsDefined: null, pendingClientDependencies: "", pendingAccesses: "", vendorDependencies: "", financialBlockers: "" },
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, workspace_id: ensured.workspaceId, pmo_id: pmoId, name, description, onboarding_payload: onboardingPayload })
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

  // Projects open on their Overview (the chat is one view among many).
  redirect(`/projects/${data.id}${briefGeneration ? `?${briefGeneration.slice(1)}` : ""}`);
}
