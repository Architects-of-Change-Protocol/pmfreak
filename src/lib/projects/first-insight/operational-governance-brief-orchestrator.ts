import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOperationalGovernanceBrief } from "./operational-governance-brief-engine";
import { persistOperationalGovernanceBrief, type PersistOperationalGovernanceBriefResult } from "./operational-governance-brief-store";
import type { OperationalGovernanceBrief } from "./operational-governance-brief-types";

export type GenerateAndPersistBriefInput = {
  workspaceId: string;
  projectId: string;
  projectOnboardingPayload: Record<string, unknown> | null;
  createdBy: string;
  supabase: SupabaseClient;
};

export type GenerateAndPersistBriefResult =
  | { ok: true; brief: OperationalGovernanceBrief }
  | { ok: false; brief: OperationalGovernanceBrief; error: string };

export async function generateAndPersistOperationalGovernanceBrief({
  workspaceId,
  projectId,
  projectOnboardingPayload,
  createdBy,
  supabase,
}: GenerateAndPersistBriefInput): Promise<GenerateAndPersistBriefResult> {
  const [{ data: governanceRow }, { data: runtimeRow }] = await Promise.all([
    supabase
      .from("workspace_governance")
      .select("governance_jsonb")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ governance_jsonb: Record<string, unknown> }>(),
    supabase
      .from("workspace_runtime_state")
      .select("awakening_state, imprint_state, validation_state, flags")
      .eq("workspace_id", workspaceId)
      .eq("user_id", createdBy)
      .limit(1)
      .maybeSingle<Record<string, unknown>>(),
  ]);

  const brief = generateOperationalGovernanceBrief({
    workspaceId,
    projectId,
    pmoGovernance: governanceRow?.governance_jsonb ?? null,
    projectOnboardingPayload,
    workspaceRuntimeState: runtimeRow ?? null,
  });

  const persisted: PersistOperationalGovernanceBriefResult = await persistOperationalGovernanceBrief({
    brief,
    createdBy,
    supabase,
  });

  if (!persisted.ok) return { ok: false, brief, error: persisted.error };
  return { ok: true, brief };
}
