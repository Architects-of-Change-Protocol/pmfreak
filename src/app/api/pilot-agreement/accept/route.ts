import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PILOT_AGREEMENT_VERSION } from "@/lib/pilot/pilot-agreement";

const ROUTE_ID = "/api/pilot-agreement/accept";

/**
 * Pilot Gate Sprint 01 — Task 9: records an in-product acceptance of the
 * pilot agreement (current version only) for the signed-in user. Technical
 * support only; the agreement content itself is placeholder pending legal
 * review, and the page states so.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const agreementVersion = typeof body.agreementVersion === "string" ? body.agreementVersion : "";
  if (!workspaceId) return NextResponse.json({ error: "workspace_required" }, { status: 400 });
  if (agreementVersion !== PILOT_AGREEMENT_VERSION) {
    // Version pinning: the client must acknowledge the exact current
    // version, so a stale tab can never record acceptance of newer terms.
    return NextResponse.json({ error: "agreement_version_mismatch", currentVersion: PILOT_AGREEMENT_VERSION }, { status: 409 });
  }

  try {
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "workspace_access_denied" }, { status: 403 });
    }
    return safeInternalErrorResponse(ROUTE_ID, error);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("pilot_agreement_acceptances").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    agreement_version: PILOT_AGREEMENT_VERSION,
    method: "in_product",
    recorded_by: user.id,
  });

  if (error && error.code !== "23505") {
    return safeInternalErrorResponse(ROUTE_ID, new Error(error.message));
  }
  // Unique violation = already accepted this version: idempotent success.
  const alreadyAccepted = error?.code === "23505";

  // Founder Circle hook (best-effort, never blocks the acceptance record):
  // when the founder program is enabled and this user is a participant in
  // agreement_pending, the acceptance advances their program lifecycle.
  // The acceptance row above stays the single source of truth either way.
  try {
    const { loadFounderProgramConfig } = await import("@/lib/founder-program/config");
    const config = await loadFounderProgramConfig();
    if (config.enabled) {
      const { syncFounderAgreementAcceptance } = await import("@/lib/founder-program/admission");
      await syncFounderAgreementAcceptance({
        userId: user.id,
        agreementVersion: PILOT_AGREEMENT_VERSION,
        requiredAgreementVersion: config.settings.requiredAgreementVersion,
      });
    }
  } catch {
    // Program-side sync failures must not undo or hide a recorded acceptance.
  }

  return NextResponse.json({ ok: true, alreadyAccepted, agreementVersion: PILOT_AGREEMENT_VERSION });
}
