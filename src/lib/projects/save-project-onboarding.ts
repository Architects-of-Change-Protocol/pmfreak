"use server";

import { getAuthUser } from "@/lib/auth";
import { canCreateMoreProjects } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWriteWorkspace } from "@/lib/workspaces/resolve-write-workspace";
import { ensureDefaultPmo, getPmoById } from "@/lib/pmos/pmo-service";
import { generateAndPersistOperationalGovernanceBrief } from "@/lib/projects/first-insight";
import { ingestProjectSetupContext } from "@/lib/projects/ingest-project-setup-context";
import { canActivateProjectBrain } from "@/lib/projects/project-brain-authorization";
import type { ResolvedWriteWorkspace } from "@/lib/workspaces/resolve-write-workspace";
import type { ProjectOnboardingPayload } from "./project-onboarding-types";

// Postgres unique_violation. See
// supabase/migrations/20260901000000_project_onboarding_create_correlation_idempotency.sql —
// (workspace_id, create_correlation_id) is unique, so a retried submission
// that already committed hits this code instead of inserting a duplicate row.
const UNIQUE_VIOLATION = "23505";

export type ProjectSaveResult =
  | { status: "success"; projectId: string; correlationId: string; briefStatus: "generated" | "generation_failed"; briefError?: string }
  | {
      status: "recoverable_failure";
      error: string;
      failureClass: string;
      correlationId: string;
    }
  | {
      status: "fatal_failure";
      error: string;
      failureClass: string;
      correlationId: string;
    };

function validatePayload(payload: ProjectOnboardingPayload): string | null {
  if (!payload?.identity?.projectName?.trim()) return "Project name is required";
  if (!payload?.identity?.clientOrganization?.trim()) return "Client organization is required";
  if (!payload?.identity?.projectType) return "Project type is required";
  if (!payload?.identity?.pmAssigned?.trim()) return "PM assigned is required";
  if (!payload?.deliveryContext?.problemStatement?.trim()) return "Problem statement is required";
  if (!payload?.deliveryContext?.mainDeliverable?.trim()) return "Main deliverable is required";
  return null;
}

function emit(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...fields, timestamp: new Date().toISOString() }));
}

export async function saveProjectOnboarding(
  payload: ProjectOnboardingPayload,
  correlationId?: string,
  opts?: { pmoId?: string | null }
): Promise<ProjectSaveResult> {
  const cid = correlationId ?? `proj_${Date.now()}`;
  let insertedProjectId: string | null = null;

  try {
    const user = await getAuthUser();
    if (!user) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "fatal_failure",
        reason: "unauthenticated",
      });
      return {
        status: "fatal_failure",
        error: "Not authenticated. Please sign in and try again.",
        failureClass: "unauthenticated",
        correlationId: cid,
      };
    }

    const validationError = validatePayload(payload);
    if (validationError) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "fatal_failure",
        reason: "invalid_payload",
        detail: validationError,
        userId: user.id,
      });
      return {
        status: "fatal_failure",
        error: validationError,
        failureClass: "invalid_payload",
        correlationId: cid,
      };
    }

    emit("project.create.started", { correlationId: cid, userId: user.id });

    const projectAccess = await canCreateMoreProjects(user.id);
    if (!projectAccess.ok) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "fatal_failure",
        reason: "upgrade_required",
        userId: user.id,
      });
      return {
        status: "fatal_failure",
        error: "upgrade_required",
        failureClass: "upgrade_required",
        correlationId: cid,
      };
    }

    let ensured: ResolvedWriteWorkspace;
    try {
      ensured = await resolveWriteWorkspace(user.id);
    } catch (wsErr) {
      const detail = wsErr instanceof Error ? wsErr.message : "unknown workspace error";
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "recoverable_failure",
        reason: "workspace_error",
        detail,
        userId: user.id,
      });
      return {
        status: "recoverable_failure",
        error: "Unable to resolve workspace. Please try again.",
        failureClass: "workspace_error",
        correlationId: cid,
      };
    }

    if (!ensured.workspaceId) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "fatal_failure",
        reason: "missing_workspace",
        userId: user.id,
      });
      return {
        status: "fatal_failure",
        error: "No workspace found. Please contact support.",
        failureClass: "missing_workspace",
        correlationId: cid,
      };
    }

    // Authorization boundary: mirrors the DB-level "workspace managers can
    // manage pmos" RLS policy (owner/admin/pm) that ensureDefaultPmo below
    // is already subject to. Checked here, before any mutation is attempted,
    // so a viewer gets one honest, upfront permission denial instead of
    // passing the (previously ungated) project insert and then hitting an
    // unexplained RLS rejection creating the PMO underneath it — see
    // docs/audits/remediation/release-gate-01-brain-activation-honesty.md.
    if (!canActivateProjectBrain(ensured.role)) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "fatal_failure",
        reason: "insufficient_permissions",
        userId: user.id,
        workspaceId: ensured.workspaceId,
        role: ensured.role,
      });
      return {
        status: "fatal_failure",
        error: "Your workspace role does not have permission to create projects or activate a Project Brain. Ask a workspace owner, admin, or PM.",
        failureClass: "insufficient_permissions",
        correlationId: cid,
      };
    }

    const supabase = await createSupabaseServerClient();

    // Attach the project to its PMO: an explicit selection (e.g. "New
    // Project" launched from a PMO page) wins; otherwise the workspace's
    // default PMO is used/created.
    let pmoId: string;
    const requestedPmo = opts?.pmoId ? await getPmoById(ensured.workspaceId, opts.pmoId) : null;
    if (requestedPmo) {
      pmoId = requestedPmo.id;
    } else {
      const defaultPmo = await ensureDefaultPmo(ensured.workspaceId, user.id);
      pmoId = defaultPmo.id;
    }
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        workspace_id: ensured.workspaceId,
        pmo_id: pmoId,
        name: payload.identity.projectName,
        description: payload.deliveryContext.problemStatement || null,
        status: "active",
        onboarding_payload: payload as unknown as Record<string, unknown>,
        create_correlation_id: cid,
      })
      .select("id")
      .single<{ id: string }>();

    if (error?.code === UNIQUE_VIOLATION) {
      // A prior attempt with this exact correlationId already committed —
      // the wizard's correlationId is generated once per mount and reused
      // by Retry (see create-project-wizard.tsx), so this can only happen
      // when the client never received/processed that earlier success.
      // Idempotent: return the already-persisted project instead of
      // inserting a duplicate.
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", ensured.workspaceId)
        .eq("create_correlation_id", cid)
        .single<{ id: string }>();

      if (existing?.id) {
        emit("project.create.idempotent_replay", {
          correlationId: cid,
          projectId: existing.id,
          userId: user.id,
          workspaceId: ensured.workspaceId,
        });
        return { status: "success", projectId: existing.id, correlationId: cid, briefStatus: "generated" };
      }
    }

    if (error || !data?.id) {
      emit("project.create.failed", {
        correlationId: cid,
        failureClass: "recoverable_failure",
        reason: "db_insert_error",
        detail: error?.message,
        userId: user.id,
        workspaceId: ensured.workspaceId,
      });
      return {
        status: "recoverable_failure",
        error: error?.message ?? "Unable to create project. Please try again.",
        failureClass: "db_insert_error",
        correlationId: cid,
      };
    }

    // Insert confirmed — project creation must survive first-insight failures.
    insertedProjectId = data.id;

    // Feed the onboarding context into the intelligence loop (vault RAID
    // extraction + operational evidence chain) before generating the first
    // brief, so detected RAID items are part of it. Best-effort by design.
    const contextLines = [
      payload.deliveryContext.problemStatement ? `Problem statement: ${payload.deliveryContext.problemStatement}` : null,
      payload.deliveryContext.externalDependencies ? `External dependencies: ${payload.deliveryContext.externalDependencies}` : null,
      payload.deliveryContext.contractualMilestones ? `Contractual milestones: ${payload.deliveryContext.contractualMilestones}` : null,
      payload.discovery?.unknowns ? `Known unknowns: ${payload.discovery.unknowns}` : null,
      payload.discovery?.pendingClientDependencies ? `Pending client dependencies: ${payload.discovery.pendingClientDependencies}` : null,
      payload.discovery?.pendingAccesses ? `Pending accesses: ${payload.discovery.pendingAccesses}` : null,
      payload.discovery?.vendorDependencies ? `Vendor dependencies: ${payload.discovery.vendorDependencies}` : null,
      payload.discovery?.financialBlockers ? `Financial blockers: ${payload.discovery.financialBlockers}` : null,
    ].filter(Boolean) as string[];
    if (contextLines.length > 0) {
      await ingestProjectSetupContext({
        supabase,
        workspaceId: ensured.workspaceId,
        projectId: data.id,
        userId: user.id,
        companyId: user.companyId,
        role: ensured.role ?? null,
        projectName: payload.identity.projectName,
        content: contextLines.join("\n"),
      });
    }

    let briefStatus: "generated" | "generation_failed" = "generated";
    let briefError: string | undefined;
    try {
      const briefResult = await generateAndPersistOperationalGovernanceBrief({
        workspaceId: ensured.workspaceId,
        projectId: data.id,
        projectOnboardingPayload: payload as unknown as Record<string, unknown>,
        createdBy: user.id,
        supabase,
      });

      if (!briefResult.ok) {
        briefStatus = "generation_failed";
        briefError = briefResult.error;
        emit("project.create.brief_generation_failed", {
          correlationId: cid,
          projectId: data.id,
          userId: user.id,
          workspaceId: ensured.workspaceId,
          detail: briefResult.error,
        });
      } else {
        emit("project.create.brief_generated", {
          correlationId: cid,
          projectId: data.id,
          briefId: briefResult.brief.briefId,
          confidenceScore: briefResult.brief.confidenceScore,
          userId: user.id,
          workspaceId: ensured.workspaceId,
        });
      }
    } catch (briefErr) {
      briefStatus = "generation_failed";
      briefError = briefErr instanceof Error ? briefErr.message : "brief_generation_exception";
      emit("project.create.brief_generation_failed", {
        correlationId: cid,
        projectId: data.id,
        userId: user.id,
        workspaceId: ensured.workspaceId,
        detail: briefError,
      });
    }

    emit("project.create.persisted", {
      correlationId: cid,
      projectId: data.id,
      userId: user.id,
      workspaceId: ensured.workspaceId,
    });

    emit("project.create.success", {
      correlationId: cid,
      projectId: data.id,
      userId: user.id,
      workspaceId: ensured.workspaceId,
    });

    return { status: "success", projectId: data.id, correlationId: cid, briefStatus, briefError };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Rollback if the project row was already inserted before the downstream failure
    if (insertedProjectId) {
      emit("project.create.rollback.started", {
        correlationId: cid,
        projectId: insertedProjectId,
        reason: message,
      });

      // Tracked so the returned message never claims the rollback succeeded
      // when it didn't — previously this branch always said "the project has
      // been removed" regardless of whether the delete itself succeeded,
      // which could tell a user a row was gone when it was still there. If
      // the rollback genuinely fails, the row survives with its
      // create_correlation_id intact, so a subsequent Retry (same
      // correlationId) hits the idempotency unique constraint above and
      // correctly resolves to that same, real project instead of erroring
      // again or creating a duplicate.
      let rollbackSucceeded = false;
      try {
        const supabase = await createSupabaseServerClient();
        const { error: rbErr } = await supabase
          .from("projects")
          .delete()
          .eq("id", insertedProjectId);

        if (rbErr) {
          emit("project.create.rollback.failed", {
            correlationId: cid,
            projectId: insertedProjectId,
            detail: rbErr.message,
          });
        } else {
          rollbackSucceeded = true;
          emit("project.create.rollback.completed", {
            correlationId: cid,
            projectId: insertedProjectId,
          });
        }
      } catch (rbCatch) {
        emit("project.create.rollback.failed", {
          correlationId: cid,
          projectId: insertedProjectId,
          detail: rbCatch instanceof Error ? rbCatch.message : "rollback exception",
        });
      }

      return {
        status: "recoverable_failure",
        error: rollbackSucceeded
          ? "Project initialization failed. The project has been removed. Please try again."
          : "Project initialization failed. Please try again — retrying will resume this same project rather than creating a duplicate.",
        failureClass: "downstream_failure",
        correlationId: cid,
      };
    }

    emit("project.create.failed", {
      correlationId: cid,
      failureClass: "recoverable_failure",
      reason: "unexpected_exception",
      detail: message,
    });
    return {
      status: "recoverable_failure",
      error: "An unexpected error occurred. Please try again.",
      failureClass: "unexpected_exception",
      correlationId: cid,
    };
  }
}
