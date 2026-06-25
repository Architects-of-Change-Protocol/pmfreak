import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { generatePMOExecutiveReport } from "@/lib/pmo-executive-reporting";
import type { ReportType } from "@/lib/pmo-executive-reporting";

const ROUTE = "POST /api/pmo-executive-reports/generate";

const VALID_REPORT_TYPES = new Set<ReportType>([
  "daily_pmo_brief",
  "weekly_pmo_review",
  "executive_risk_summary",
  "governance_compliance_report",
  "intervention_status_report",
  "board_ready_summary",
]);

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const body = await request.json().catch(() => ({}));
    const { reportType, periodStart, periodEnd } = body as {
      reportType?: string;
      periodStart?: string;
      periodEnd?: string;
    };

    const resolvedType =
      reportType && VALID_REPORT_TYPES.has(reportType as ReportType)
        ? (reportType as ReportType)
        : undefined;

    const result = await generatePMOExecutiveReport({
      workspaceId,
      actorId: user.id,
      reportType: resolvedType,
      periodStart: periodStart ?? null,
      periodEnd: periodEnd ?? null,
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED: 403,
        PMO_EXECUTIVE_REPORTING_GENERATION_FAILED: 500,
        PMO_EXECUTIVE_REPORTING_PERSISTENCE_FAILED: 500,
      };
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error } },
        { status: statusMap[result.failureClass] ?? 500 }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
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
