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

  if (error) {
    // Unique violation = already accepted this version: idempotent success.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyAccepted: true, agreementVersion: PILOT_AGREEMENT_VERSION });
    }
    return safeInternalErrorResponse(ROUTE_ID, new Error(error.message));
  }

  return NextResponse.json({ ok: true, alreadyAccepted: false, agreementVersion: PILOT_AGREEMENT_VERSION });
}
