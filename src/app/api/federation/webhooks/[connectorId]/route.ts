import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireSystemOrWebhookSecret } from "@/lib/security/server-authorization";
import { ingestFederatedEvent } from "@/lib/live-federation/ingestion/live-ingestion-runtime";

// Previously "authorized" meant only `Authorization: Bearer <anything>` —
// the token value itself was never checked, so any caller could impersonate
// a federation connector for any workspaceId. The Bearer token is now
// verified against FEDERATION_WEBHOOK_SECRET with requireSystemOrWebhookSecret
// (the same shared-secret pattern used elsewhere for system/webhook callers),
// and fails closed if the secret isn't configured.
export async function POST(request: NextRequest, { params }: { params: Promise<{ connectorId: string }> }) {
  const { connectorId } = await params;
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  let federationAuthorized = true;
  try {
    requireSystemOrWebhookSecret(bearerToken, process.env.FEDERATION_WEBHOOK_SECRET);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      federationAuthorized = false;
    } else {
      throw error;
    }
  }

  const body = await request.json();
  const workspaceId = String(body.workspaceId ?? request.headers.get("x-workspace-id") ?? "");
  const sourceSystem = String(body.sourceSystem ?? "custom") as "jira" | "slack" | "github" | "calendar" | "notion" | "custom";
  const nonce = String(body.nonce ?? request.headers.get("x-ingress-nonce") ?? "");
  if (!workspaceId || !nonce) {
    return NextResponse.json({ ok: false, error: "missing workspaceId or nonce" }, { status: 400 });
  }
  try {
    const result = ingestFederatedEvent({
      workspaceId,
      connectorId,
      sourceSystem,
      federationAuthorized,
      nonce,
      payload: body.payload ?? body,
    });
    return NextResponse.json({ ok: true, receipt: result.event.lineage.ingressId, routes: result.routes.map((r) => r.target) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "ingestion failed" }, { status: 409 });
  }
}
