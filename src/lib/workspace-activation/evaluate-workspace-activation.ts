import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/workspace-access";
import { evaluateActivationRules } from "./activation-rules";
import type { WorkspaceActivationEvidence, WorkspaceActivationResult } from "./types";

/**
 * Evidence collection for workspace activation.
 *
 * Every check is a presence probe against real rows, scoped to the workspace
 * (RLS on the anon server client is the backstop; the explicit
 * `workspace_id` filter is the first line). Nothing is fabricated: when a
 * query errors we treat the evidence as absent (a step can only ever appear
 * LESS complete on failure, never more).
 */

type EvidenceQueryClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;

export type CollectEvidenceInput = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  /** Persisted UX interaction event, read from workspace_onboarding_preferences. */
  insightsFirstViewedAt?: string | null;
  /** Test seam — defaults to the RLS-scoped server client. */
  getClient?: () => Promise<EvidenceQueryClient>;
};

async function probeExists(
  client: EvidenceQueryClient,
  table: string,
  build: (query: ReturnType<EvidenceQueryClient["from"]>) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<boolean> {
  try {
    const { data, error } = await build(client.from(table));
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function collectWorkspaceActivationEvidence(
  input: CollectEvidenceInput,
): Promise<WorkspaceActivationEvidence> {
  const getClient = input.getClient ?? (createSupabaseServerClient as () => Promise<EvidenceQueryClient>);
  const client = await getClient();
  const workspaceId = input.workspaceId;

  const [
    ownerTypeRow,
    membershipRows,
    pendingInviteExists,
    pmoExists,
    projectExists,
    taskExists,
    milestoneExists,
    raidItemExists,
    governanceSignalExists,
    recommendedActionExists,
    userMessageExists,
  ] = await Promise.all([
    (async () => {
      try {
        const { data, error } = await client
          .from("workspaces")
          .select("owner_type")
          .eq("id", workspaceId)
          .maybeSingle<{ owner_type: string | null }>();
        if (error) return null;
        return data ?? null;
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        const { data, error } = await client
          .from("workspace_memberships")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .limit(2);
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    })(),
    probeExists(client, "workspace_invitations", (q) =>
      q.select("id").eq("workspace_id", workspaceId).eq("status", "pending").limit(1),
    ),
    probeExists(client, "pmos", (q) =>
      q.select("id").eq("workspace_id", workspaceId).eq("status", "active").limit(1),
    ),
    probeExists(client, "projects", (q) =>
      q.select("id").eq("workspace_id", workspaceId).neq("status", "archived").limit(1),
    ),
    probeExists(client, "execution_tasks", (q) =>
      q.select("id").eq("workspace_id", workspaceId).limit(1),
    ),
    probeExists(client, "project_milestones", (q) =>
      q.select("id").eq("workspace_id", workspaceId).limit(1),
    ),
    probeExists(client, "raid_items", (q) =>
      q.select("id").eq("workspace_id", workspaceId).limit(1),
    ),
    probeExists(client, "governance_signals", (q) =>
      q.select("id").eq("workspace_id", workspaceId).limit(1),
    ),
    probeExists(client, "recommended_actions", (q) =>
      q.select("id").eq("workspace_id", workspaceId).limit(1),
    ),
    probeExists(client, "context_messages", (q) =>
      q.select("id").eq("workspace_id", workspaceId).eq("role", "user").limit(1),
    ),
  ]);

  return {
    workspaceId,
    userId: input.userId,
    role: input.role,
    ownerType: ownerTypeRow?.owner_type ?? null,
    memberCount: Array.isArray(membershipRows) ? membershipRows.length : 0,
    pendingInviteExists,
    pmoExists,
    projectExists,
    taskExists,
    milestoneExists,
    raidItemExists,
    governanceSignalExists,
    recommendedActionExists,
    userMessageExists,
    insightsFirstViewedAt: input.insightsFirstViewedAt ?? null,
  };
}

/** Convenience: collect evidence and run the pure rules in one call. */
export async function evaluateWorkspaceActivation(
  input: CollectEvidenceInput,
): Promise<WorkspaceActivationResult> {
  const evidence = await collectWorkspaceActivationEvidence(input);
  return evaluateActivationRules(evidence);
}
