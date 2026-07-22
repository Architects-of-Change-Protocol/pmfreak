"use server";

import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import {
  readInitialIngestionStatus,
  withInitialIngestionStatus,
  type InitialIngestionStatus,
} from "@/lib/projects/initial-ingestion-state";

export type MarkInitialIngestionResult = { ok: boolean };

/**
 * Advances the durable initial-ingestion marker on `projects.onboarding_payload`.
 *
 * Authorization is unchanged and unconditional: both the read and the write are
 * scoped to the project id AND the caller's own resolved workspace, so a project
 * outside that workspace is never read or mutated. RLS remains the backstop —
 * this uses the user-scoped client, never the service role.
 *
 * Monotonic by design: a completed guided entry is never regressed back to
 * in_progress, so re-entering the Inbox later cannot re-trigger onboarding.
 */
export async function markInitialIngestionAction(
  projectId: string,
  status: Extract<InitialIngestionStatus, "in_progress" | "completed">,
): Promise<MarkInitialIngestionResult> {
  const user = await requireAuthUser();

  const preferred = await resolvePreferredWorkspace(user.id);
  if (!preferred.workspaceId) {
    return { ok: false };
  }

  const supabase = await createSupabaseServerClient();

  const { data: row, error: readError } = await supabase
    .from("projects")
    .select("onboarding_payload")
    .eq("id", projectId)
    .eq("workspace_id", preferred.workspaceId)
    .maybeSingle<{ onboarding_payload: unknown }>();

  if (readError || !row) {
    return { ok: false };
  }

  const current = readInitialIngestionStatus(row.onboarding_payload ?? null);

  // Already where we want to be, or already finished — nothing to write.
  if (current === status || current === "completed") {
    return { ok: true };
  }

  const nextPayload = withInitialIngestionStatus(
    row.onboarding_payload ?? null,
    status,
    new Date().toISOString(),
  );

  const { error: writeError } = await supabase
    .from("projects")
    .update({ onboarding_payload: nextPayload })
    .eq("id", projectId)
    .eq("workspace_id", preferred.workspaceId);

  if (writeError) {
    console.error(
      JSON.stringify({
        event: "command_center.initial_ingestion_write_failed",
        projectId,
        status,
        reason: writeError.message,
      }),
    );
    return { ok: false };
  }

  return { ok: true };
}
