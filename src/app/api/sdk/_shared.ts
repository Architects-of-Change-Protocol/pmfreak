import { getAuthUser } from "@/lib/auth";
import { apiError, apiUnauthorized, type ApiMeta } from "@/lib/api/http";
import { logReliabilityEvent } from "@/lib/api/reliability";

export async function requireSdkUser(meta: ApiMeta) {
  const user = await getAuthUser();
  if (!user) return { response: apiUnauthorized(meta) };
  return { user };
}

export function sdkWorkspaceRequired(meta: ApiMeta) {
  return apiError({ code: "workspace_required", suggestedAction: "Select a workspace and retry." }, meta, 400);
}

export function sdkDbError(meta: ApiMeta, route: string, reason: string, userId?: string | null, workspaceId?: string | null) {
  // The raw driver `reason` stays server-side (reliability log) only; the
  // client gets a stable generic code — raw Postgres error text leaks
  // schema details to authenticated callers (Pilot Gate Sprint 01, F-07).
  logReliabilityEvent({ requestId: meta.requestId, route, userId, workspaceId, errorCode: "database_unavailable", recoverable: true, reason });
  return apiError({ code: "database_unavailable", reason: "database_unavailable", suggestedAction: "Please retry in a few moments." }, meta, 503);
}
