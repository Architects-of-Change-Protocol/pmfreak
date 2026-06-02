import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { OperationalGovernanceBrief } from "./operational-governance-brief-types";

export type PersistOperationalGovernanceBriefInput = {
  brief: OperationalGovernanceBrief;
  createdBy: string;
  supabase?: SupabaseClient;
};

export type PersistOperationalGovernanceBriefResult =
  | { ok: true; briefId: string }
  | { ok: false; error: string };

export async function persistOperationalGovernanceBrief({
  brief,
  createdBy,
  supabase,
}: PersistOperationalGovernanceBriefInput): Promise<PersistOperationalGovernanceBriefResult> {
  const client = supabase ?? createSupabaseServiceRoleClient({
    routeId: "projects/first-insight/persist",
    operation: "upsert",
    reason: "operational_governance_brief_generation",
    workspaceId: brief.workspaceId,
    actorUserId: createdBy,
  });

  const { error } = await client.from("operational_governance_briefs").upsert(
    {
      id: brief.briefId,
      workspace_id: brief.workspaceId,
      project_id: brief.projectId,
      brief_payload: brief as unknown as Record<string, unknown>,
      confidence_score: brief.confidenceScore,
      generated_at: brief.generatedAt,
      created_by: createdBy,
    },
    { onConflict: "project_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, briefId: brief.briefId };
}

export async function loadLatestOperationalGovernanceBrief(
  projectId: string,
  supabase: SupabaseClient
): Promise<OperationalGovernanceBrief | null> {
  const { data, error } = await supabase
    .from("operational_governance_briefs")
    .select("brief_payload")
    .eq("project_id", projectId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ brief_payload: OperationalGovernanceBrief }>();

  if (error || !data?.brief_payload) return null;
  return data.brief_payload;
}
