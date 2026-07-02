"use server";

import { getAuthUser } from "@/lib/auth";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { PmoTenant } from "./pmo-tenant-types";
import { validatePmoTenantPayload } from "./pmo-tenant-validate";
import { defaultOwnerTypeFor, type CommandCenterType } from "@/lib/command-center/command-center-types";

// Explicit three-state contract — callers must handle all three.
export type PmoTenantSaveResult =
  | { status: "success"; correlationId: string }
  | { status: "recoverable_failure"; error: string; failureClass: string; correlationId: string }
  | { status: "fatal_failure"; error: string; failureClass: string; correlationId: string };

const PMO_TENANT_SCHEMA_VERSION = 2;

type LogLevel = "info" | "warn" | "error";

function emit(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>
) {
  console[level](JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }));
}

export async function savePmoTenant(tenant: PmoTenant): Promise<PmoTenantSaveResult> {
  const correlationId = crypto.randomUUID();
  let upsertedWorkspaceId: string | null = null;
  let supabaseClient: ReturnType<typeof createSupabaseServiceRoleClient> | null = null;
  let userId: string | undefined;
  let workspaceId: string | undefined;

  emit("info", "pmo.create.started", { correlationId });

  try {
    const validation = validatePmoTenantPayload(tenant);
    if (!validation.ok) {
      emit("error", "pmo.create.failed", {
        correlationId,
        failureClass: "validation_failed",
        errors: validation.errors,
      });
      return { status: "fatal_failure", error: "Invalid PMO configuration.", failureClass: "validation_failed", correlationId };
    }

    const user = await getAuthUser();
    if (!user) {
      emit("error", "pmo.create.failed", { correlationId, failureClass: "unauthenticated" });
      return { status: "fatal_failure", error: "Not authenticated.", failureClass: "unauthenticated", correlationId };
    }
    userId = user.id;

    const resolution = await resolveCanonicalWorkspace(user.id);
    if (!resolution.workspaceId) {
      emit("error", "pmo.create.failed", { correlationId, userId, failureClass: "no_workspace" });
      return { status: "fatal_failure", error: "No active workspace found for this account.", failureClass: "no_workspace", correlationId };
    }
    workspaceId = resolution.workspaceId;

    supabaseClient = createSupabaseServiceRoleClient({
      routeId: "pmo/save-pmo-tenant",
      operation: "upsert",
      reason: "pmo_tenant_activation",
      workspaceId: resolution.workspaceId,
      actorUserId: user.id,
    });

    const { error: upsertError } = await supabaseClient.from("workspace_governance").upsert(
      {
        workspace_id: resolution.workspaceId,
        schema_version: PMO_TENANT_SCHEMA_VERSION,
        governance_jsonb: tenant as unknown as Record<string, unknown>,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    );

    if (upsertError) {
      emit("error", "pmo.create.failed", {
        correlationId,
        userId,
        workspaceId,
        failureClass: "upsert_error",
        error: upsertError.message,
      });
      return {
        status: "recoverable_failure",
        error: "Failed to save PMO configuration. Please try again.",
        failureClass: "upsert_error",
        correlationId,
      };
    }

    // Track that the upsert landed so we can roll back on subsequent failure.
    upsertedWorkspaceId = resolution.workspaceId;

    // Promote the auto-bootstrapped workspace into a fully typed Command Center:
    // this is the transition from "no Command Center exists yet" to a real one.
    const commandCenterType = tenant.identity.pmoType as CommandCenterType;
    const { error: workspaceUpdateError } = await supabaseClient
      .from("workspaces")
      .update({
        name: tenant.identity.pmoName,
        command_center_type: commandCenterType,
        owner_type: defaultOwnerTypeFor(commandCenterType),
        data_owner: user.id,
        source_context: tenant.contextSeed.strategicObjective || null,
      })
      .eq("id", resolution.workspaceId);

    if (workspaceUpdateError) {
      emit("warn", "pmo.create.workspace_metadata_warn", {
        correlationId,
        userId,
        workspaceId,
        error: workspaceUpdateError.message,
      });
    }

    emit("info", "pmo.create.persisted", {
      correlationId,
      userId,
      workspaceId,
      schemaVersion: PMO_TENANT_SCHEMA_VERSION,
    });

    // Mark onboarding complete — non-fatal: the governance row is the canonical proof.
    const { error: metaError } = await supabaseClient.auth.admin.updateUserById(user.id, {
      user_metadata: { onboarding_completed: true },
    });
    if (metaError) {
      emit("warn", "pmo.create.metadata_warn", { correlationId, userId, error: metaError.message });
    }

    emit("info", "pmo.create.success", { correlationId, userId, workspaceId });
    return { status: "success", correlationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    emit("error", "pmo.create.failed", {
      correlationId,
      userId,
      workspaceId,
      failureClass: "unexpected_exception",
      error: message,
    });

    // Explicit rollback: if the upsert landed before the exception, undo it.
    if (upsertedWorkspaceId && supabaseClient) {
      emit("warn", "pmo.create.rollback.started", { correlationId, userId, workspaceId: upsertedWorkspaceId });
      try {
        await supabaseClient
          .from("workspace_governance")
          .delete()
          .eq("workspace_id", upsertedWorkspaceId);
        emit("warn", "pmo.create.rollback.completed", { correlationId, userId, workspaceId: upsertedWorkspaceId });
      } catch (rollbackErr) {
        const rbMsg = rollbackErr instanceof Error ? rollbackErr.message : "unknown";
        emit("error", "pmo.create.rollback.failed", {
          correlationId,
          userId,
          workspaceId: upsertedWorkspaceId,
          error: rbMsg,
        });
      }
    }

    return {
      status: "recoverable_failure",
      error: "An unexpected error occurred. Please try again.",
      failureClass: "unexpected_exception",
      correlationId,
    };
  }
}
