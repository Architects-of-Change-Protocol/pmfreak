import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import type { WorkspaceRole } from "@/lib/workspace-access";
import { normalizeWorkspaceRole } from "@/lib/workspace-access";
import {
  OnboardingPreferenceValidationError,
  evaluateWorkspaceActivation,
  getOnboardingPreferences,
  saveOnboardingPreferences,
  validateOnboardingPreferencePatch,
} from "@/lib/workspace-activation";

/**
 * Workspace activation & guided-onboarding preferences.
 *
 * GET  → evidence-derived activation state for the caller's workspace.
 * PATCH → the caller's own display preferences (collapse/dismiss/skip/viewed).
 *
 * Tenancy: the caller must hold a real membership in the target workspace
 * (verified here from workspace_memberships through the RLS-scoped client;
 * RLS on every probed table is the backstop). A workspaceId query param is
 * accepted but never trusted without that membership check.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MembershipContext = { workspaceId: string; role: WorkspaceRole };

async function resolveMembership(
  request: NextRequest,
  userId: string,
): Promise<{ ok: true; membership: MembershipContext } | { ok: false; response: NextResponse }> {
  const requestedWorkspaceId = request.nextUrl.searchParams.get("workspaceId");

  if (requestedWorkspaceId) {
    if (!UUID_RE.test(requestedWorkspaceId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Invalid workspaceId.", failureClass: "validation_failed" },
          { status: 400 },
        ),
      };
    }
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", requestedWorkspaceId)
      .eq("user_id", userId)
      .maybeSingle<{ role: string }>();
    const role = normalizeWorkspaceRole(data?.role);
    if (!role) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Access denied.", failureClass: "unauthorized" },
          { status: 403 },
        ),
      };
    }
    return { ok: true, membership: { workspaceId: requestedWorkspaceId, role } };
  }

  const resolution = await resolvePreferredWorkspace(userId);
  const role = normalizeWorkspaceRole(resolution.role);
  if (!resolution.workspaceId || !role) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "No active workspace membership.", failureClass: "unauthorized" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, membership: { workspaceId: resolution.workspaceId, role } };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" },
      { status: 401 },
    );
  }

  const resolved = await resolveMembership(request, user.id);
  if (!resolved.ok) return resolved.response;
  const { workspaceId, role } = resolved.membership;

  try {
    const preferences = await getOnboardingPreferences({ workspaceId, userId: user.id });
    const activation = await evaluateWorkspaceActivation({
      workspaceId,
      userId: user.id,
      role,
      insightsFirstViewedAt: preferences.insightsFirstViewedAt,
    });
    return NextResponse.json({ ok: true, data: { activation, preferences } });
  } catch (error) {
    console.error("[workspace-activation] evaluation failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load workspace activation.", failureClass: "persistence_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" },
      { status: 401 },
    );
  }

  const resolved = await resolveMembership(request, user.id);
  if (!resolved.ok) return resolved.response;
  const { workspaceId } = resolved.membership;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be JSON.", failureClass: "validation_failed" },
      { status: 400 },
    );
  }

  try {
    const patch = validateOnboardingPreferencePatch(body);
    // Personal display preference only: the authenticated user writes their
    // own row (RLS enforces user_id = auth.uid()). No role gate — viewers may
    // collapse or dismiss their own guide; progress itself is never writable.
    const preferences = await saveOnboardingPreferences({ workspaceId, userId: user.id, patch });
    return NextResponse.json({ ok: true, data: { preferences } });
  } catch (error) {
    if (error instanceof OnboardingPreferenceValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, failureClass: "validation_failed" },
        { status: 400 },
      );
    }
    console.error("[workspace-activation] preference save failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to save onboarding preferences.", failureClass: "persistence_failed" },
      { status: 500 },
    );
  }
}
