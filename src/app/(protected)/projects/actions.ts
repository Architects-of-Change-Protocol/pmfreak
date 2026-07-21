"use server";

import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMinimalProject } from "@/lib/projects/create-minimal-project";
import { generateAndPersistOperationalGovernanceBrief } from "@/lib/projects/first-insight";
import { ingestProjectSetupContext } from "@/lib/projects/ingest-project-setup-context";

/**
 * Thin wrapper around the canonical createMinimalProject() service — see
 * src/lib/projects/create-minimal-project.ts, which is also used by
 * POST /api/projects (the create-project modal). This wrapper owns only
 * what's specific to this redirect-based form: building the onboarding
 * payload and triggering the best-effort intelligence side effects
 * (RAID context ingestion, first governance brief) before redirecting into
 * the Command Center.
 */
export async function createProjectAction(formData: FormData) {
  const user = await requireAuthUser();

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const pmoId = String(formData.get("pmoId") ?? "").trim() || null;

  const onboardingPayload = {
    identity: { projectName: name, clientOrganization: "", projectType: "other", contractCode: "", pmAssigned: user.email ?? user.id, technicalLead: "", targetDeliveryDate: "" },
    deliveryContext: { problemStatement: description ?? "", mainDeliverable: name, externalDependencies: "", contractualMilestones: "", scopeType: "discovery" },
    governance: { raidInitialized: true, stakeholdersInitialized: false, deliveryCadenceInitialized: false, reportingStructureInitialized: false, escalationMapInitialized: false, healthBaselineInitialized: true },
    discovery: { unknowns: "Created from lightweight project form", requirementsDefined: null, pendingClientDependencies: "", pendingAccesses: "", vendorDependencies: "", financialBlockers: "" },
    createdAt: new Date().toISOString(),
  };

  const result = await createMinimalProject({ userId: user.id, name, description, pmoId, onboardingPayload });

  if (!result.ok) {
    if (result.failureClass === "upgrade_required") {
      redirect(`/projects?error=${encodeURIComponent("upgrade_required")}`);
    }
    redirect(`/projects?error=${encodeURIComponent(result.error)}`);
  }

  const { project, workspaceId, role } = result;
  const supabase = await createSupabaseServerClient();

  // Feed the typed description into the intelligence loop before generating
  // the first brief, so detected RAID items are part of it. Best-effort.
  if (description) {
    await ingestProjectSetupContext({
      supabase,
      workspaceId,
      projectId: project.id,
      userId: user.id,
      companyId: user.companyId,
      role,
      projectName: name,
      content: description,
    });
  }

  let briefGeneration = "";
  try {
    const briefResult = await generateAndPersistOperationalGovernanceBrief({
      workspaceId,
      projectId: project.id,
      projectOnboardingPayload: onboardingPayload,
      createdBy: user.id,
      supabase,
    });
    if (!briefResult.ok) briefGeneration = "&briefGeneration=failed";
  } catch {
    briefGeneration = "&briefGeneration=failed";
  }

  // New projects land in the Command Center, already showing the operational
  // intelligence derived from the context typed at creation.
  redirect(`/command-center?projectId=${project.id}${briefGeneration}`);
}
