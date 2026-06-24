import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { getPMOperatingDossier } from "@/lib/pm-detail-intelligence";

const ROUTE = "/api/pm-registry/[pmId]/intelligence";

type Props = { params: Promise<{ pmId: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;

    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await getPMOperatingDossier({ workspaceId, pmId, actorId: user.id });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        PM_DETAIL_WORKSPACE_REQUIRED: 403,
        PM_DETAIL_PM_NOT_FOUND: 404,
        PM_DETAIL_UNAUTHORIZED: 403,
        PM_DETAIL_CROSS_WORKSPACE_ACCESS: 403,
        PM_DETAIL_DOSSIER_FAILED: 500,
      };
      const httpStatus = statusMap[result.failureClass] ?? 500;
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error } },
        { status: httpStatus },
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    throw error;
  }
}
