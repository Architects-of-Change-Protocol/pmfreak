"use server";

import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { canCreateMoreProjects } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/workspaces";

const asField = (value: FormDataEntryValue | null) => String(value ?? "").trim();

export async function activateContextAction(formData: FormData) {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();

  const name = asField(formData.get("name"));
  if (!name) {
    redirect("/command-center?error=Project+name+is+required");
  }

  const projectAccess = await canCreateMoreProjects(user.id);
  if (!projectAccess.ok) {
    redirect(`/projects?error=${encodeURIComponent("upgrade_required")}&feature=${encodeURIComponent(projectAccess.feature)}&requiredPlan=${projectAccess.requiredPlan}`);
  }

  const descriptionInput = asField(formData.get("description"));
  const sponsor = asField(formData.get("sponsor"));
  const phase = asField(formData.get("phase"));
  const timeline = asField(formData.get("timeline"));
  const risk = asField(formData.get("risk"));
  const stakeholders = asField(formData.get("stakeholders"));

  const setupSummary = [
    sponsor ? `Customer/Sponsor: ${sponsor}` : null,
    phase ? `Current phase: ${phase}` : null,
    timeline ? `Timeline pressure: ${timeline}` : null,
    risk ? `Top known risk: ${risk}` : null,
    stakeholders ? `Key stakeholders: ${stakeholders}` : null,
  ].filter(Boolean);

  const description = [descriptionInput, setupSummary.length ? `Setup context\n${setupSummary.join("\n")}` : null]
    .filter(Boolean)
    .join("\n\n") || null;

  const ensured = await ensureUserWorkspace(user.id);
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, workspace_id: ensured.workspaceId, name, description })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    redirect(`/command-center?error=${encodeURIComponent(error?.message ?? "Unable to activate context")}`);
  }

  redirect(`/command-center?projectId=${data.id}&from=onboarding`);
}
